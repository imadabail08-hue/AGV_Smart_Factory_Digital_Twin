/**
 * AGV SMART FACTORY - OCCUPANCY GRID MAP (LAB 03)
 * Modélisation discrète de l'environnement usine en matrice 2D binaire :
 * 0 = Cellule libre (navigable)
 * 1 = Obstacle statique ou dynamique (non navigable)
 * Fonctions de projection, extraction de voisins (4-voisinage) et calque visuel 3D
 */

class OccupancyGrid {
    constructor(scene, width = CONFIG.GRID_WIDTH, height = CONFIG.GRID_HEIGHT) {
        this.scene = scene;
        this.width = width;
        this.height = height;

        // Matrice 2D : grid[rowZ][colX]
        this.matrix = [];
        this.overlayGroup = new THREE.Group();
        this.overlayGroup.name = "Occupancy_Grid_Overlay";
        this.cellMeshes = []; // Références aux tuiles visuelles 3D
        this.showOverlay = true;

        // Initialisation
        this.initMatrix();
        this.loadStaticObstacles();
        this.build3DVisualOverlay();

        this.scene.add(this.overlayGroup);
    }

    /**
     * Initialise la matrice à 0 (toutes les cellules libres par défaut)
     */
    initMatrix() {
        this.matrix = [];
        for (let z = 0; z < this.height; z++) {
            const row = new Array(this.width).fill(0);
            this.matrix.push(row);
        }
    }

    /**
     * Inscrit les obstacles statiques permanents (Rayonnages, Machines) dans la matrice
     */
    loadStaticObstacles() {
        // 1. Rayonnages (Racks)
        CONFIG.RACKS.forEach(r => {
            for (let x = r.x; x < r.x + r.w; x++) {
                for (let z = r.z; z < r.z + r.d; z++) {
                    this.setObstacle(x, z, true);
                }
            }
        });

        // 2. Postes machines en Zone B
        this.setObstacle(20, 8, true);
        this.setObstacle(20, 10, true);

        console.log(`🗺️ Occupancy Grid initialisée : ${this.width}x${this.height} cellules. Obstacles statiques chargés.`);
    }

    /**
     * Vérifie si des coordonnées sont strictement dans les limites de la grille
     */
    isInside(colX, rowZ) {
        return colX >= 0 && colX < this.width && rowZ >= 0 && rowZ < this.height;
    }

    /**
     * Invariant de navigation : renvoie vrai si et seulement si la cellule est libre
     */
    isWalkable(colX, rowZ) {
        if (!this.isInside(colX, rowZ)) return false;
        return this.matrix[rowZ][colX] === 0;
    }

    /**
     * Modifie l'état d'occupation d'une cellule
     */
    setObstacle(colX, rowZ, isBlocked) {
        if (!this.isInside(colX, rowZ)) return;
        this.matrix[rowZ][colX] = isBlocked ? 1 : 0;
        this.updateCellVisual(colX, rowZ);
    }

    /**
     * Bascule l'état d'une cellule (0 <-> 1) par clic interactif
     */
    toggleCell(colX, rowZ) {
        if (!this.isInside(colX, rowZ)) return;
        const current = this.matrix[rowZ][colX];
        this.setObstacle(colX, rowZ, current === 0);
    }

    /**
     * Renvoie les voisins navigables d'une cellule selon la topologie Manhattan (4 directions)
     * Haut (0, -1), Bas (0, 1), Gauche (-1, 0), Droite (1, 0)
     */
    getNeighbors(colX, rowZ, allowDiagonals = false) {
        const neighbors = [];
        const directions4 = [
            { x: 0, z: -1 }, // Nord (Haut)
            { x: 1, z: 0 },  // Est (Droite)
            { x: 0, z: 1 },  // Sud (Bas)
            { x: -1, z: 0 }  // Ouest (Gauche)
        ];

        for (const dir of directions4) {
            const nx = colX + dir.x;
            const nz = rowZ + dir.z;
            if (this.isWalkable(nx, nz)) {
                neighbors.push({ x: nx, z: nz, cost: 1.0 });
            }
        }

        if (allowDiagonals) {
            const diagonals = [
                { x: 1, z: -1 }, { x: 1, z: 1 },
                { x: -1, z: 1 }, { x: -1, z: -1 }
            ];
            for (const dir of diagonals) {
                const nx = colX + dir.x;
                const nz = rowZ + dir.z;
                // Règle anti-corner cutting : les deux cases cardinales adjacentes doivent être libres
                if (this.isWalkable(nx, nz) && this.isWalkable(colX + dir.x, rowZ) && this.isWalkable(colX, rowZ + dir.z)) {
                    neighbors.push({ x: nx, z: nz, cost: Math.SQRT2 }); // ~1.414
                }
            }
        }

        return neighbors;
    }

    /**
     * Calque visuel 3D : crée un plan transparent au sol pour chaque cellule
     * Vert doux = Cellule libre | Rouge vif = Cellule bloquée
     */
    build3DVisualOverlay() {
        const cellSize = CONFIG.CELL_SIZE;
        const cellGeo = new THREE.PlaneGeometry(cellSize - 0.08, cellSize - 0.08);

        // Matériaux réutilisables
        this.matFree = new THREE.MeshBasicMaterial({
            color: 0x10b981,
            transparent: true,
            opacity: 0.12,
            side: THREE.DoubleSide
        });

        this.matBlocked = new THREE.MeshBasicMaterial({
            color: 0xef4444,
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide
        });

        this.cellMeshes = [];

        for (let z = 0; z < this.height; z++) {
            this.cellMeshes[z] = [];
            for (let x = 0; x < this.width; x++) {
                const isBlocked = this.matrix[z][x] === 1;
                const mat = isBlocked ? this.matBlocked : this.matFree;
                const mesh = new THREE.Mesh(cellGeo, mat);
                mesh.rotation.x = -Math.PI / 2;

                const worldPos = GridCoords.gridToWorld(x, z, 0.025);
                mesh.position.set(worldPos.x, worldPos.y, worldPos.z);
                mesh.userData = { gridX: x, gridZ: z };

                this.overlayGroup.add(mesh);
                this.cellMeshes[z][x] = mesh;
            }
        }
    }

    /**
     * Met à jour la couleur d'une case sur le calque 3D
     */
    updateCellVisual(x, z) {
        if (!this.cellMeshes[z] || !this.cellMeshes[z][x]) return;
        const isBlocked = this.matrix[z][x] === 1;
        this.cellMeshes[z][x].material = isBlocked ? this.matBlocked : this.matFree;
    }

    /**
     * Active ou masque le calque visuel de la grille
     */
    toggleOverlayVisibility() {
        this.showOverlay = !this.showOverlay;
        this.overlayGroup.visible = this.showOverlay;
        return this.showOverlay;
    }

    /**
     * Statistiques de navigabilité
     */
    getStats() {
        let free = 0;
        let blocked = 0;
        for (let z = 0; z < this.height; z++) {
            for (let x = 0; x < this.width; x++) {
                if (this.matrix[z][x] === 0) free++;
                else blocked++;
            }
        }
        return { total: this.width * this.height, free, blocked };
    }
}
