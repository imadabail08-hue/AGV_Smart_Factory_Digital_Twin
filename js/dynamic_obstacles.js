/**
 * AGV SMART FACTORY - GESTIONNAIRE D'OBSTACLES DYNAMIQUES (LAB 07)
 * Modélisation d'aléas industriels imprévus dans l'usine numérique :
 * - Palettes tombées / Caisses de détresse avec chevrons jaune/noir
 * - Cônes de balisage avec gyrophare orange clignotant
 * - Synchronisation bidirectionnelle avec l'Occupancy Grid Map 2D
 */

class DynamicObstacleManager {
    constructor(scene, grid) {
        this.scene = scene;
        this.grid = grid;
        this.obstaclesGroup = new THREE.Group();
        this.obstaclesGroup.name = "Dynamic_Obstacles_Layer";
        this.scene.add(this.obstaclesGroup);

        // Liste des obstacles actifs : { id, gridX, gridZ, mesh }
        this.activeObstacles = [];
    }

    /**
     * Crée un modèle 3D d'obstacle industriel (Palette + Caisse d'incident rayée jaune/noir)
     */
    createObstacleMesh() {
        const group = new THREE.Group();

        // 1. Palette en bois (base)
        const palletGeo = new THREE.BoxGeometry(1.1, 0.12, 1.1);
        const woodMat = new THREE.MeshStandardMaterial({
            color: 0x92400e, // Brun bois industriel
            roughness: 0.85,
            metalness: 0.1
        });
        const pallet = new THREE.Mesh(palletGeo, woodMat);
        pallet.position.y = 0.06;
        pallet.castShadow = true;
        pallet.receiveShadow = true;
        group.add(pallet);

        // 2. Caisse principale (Conteneur incident)
        const boxGeo = new THREE.BoxGeometry(0.85, 0.70, 0.85);
        const boxMat = new THREE.MeshStandardMaterial({
            color: 0xb45309, // Orange foncé sécurité
            roughness: 0.5,
            metalness: 0.3
        });
        const box = new THREE.Mesh(boxGeo, boxMat);
        box.position.y = 0.12 + 0.35;
        box.castShadow = true;
        box.receiveShadow = true;
        group.add(box);

        // 3. Bandes d'avertissement hachurées jaune/noir (Warning Stripes)
        const stripeGeo = new THREE.PlaneGeometry(0.70, 0.22);
        const stripeMat = new THREE.MeshBasicMaterial({
            color: 0xf59e0b, // Jaune sécurité
            side: THREE.DoubleSide
        });

        // 4 faces d'avertissement
        const faceConfigs = [
            { pos: [0, 0.50, 0.43], rotY: 0 },
            { pos: [0, 0.50, -0.43], rotY: Math.PI },
            { pos: [0.43, 0.50, 0], rotY: Math.PI / 2 },
            { pos: [-0.43, 0.50, 0], rotY: -Math.PI / 2 }
        ];

        faceConfigs.forEach(fc => {
            const stripe = new THREE.Mesh(stripeGeo, stripeMat);
            stripe.position.set(...fc.pos);
            stripe.rotation.y = fc.rotY;
            group.add(stripe);
        });

        // 4. Balise d'alerte clignotante orange au sommet
        const beaconGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.14, 16);
        const beaconMat = new THREE.MeshStandardMaterial({
            color: 0xf97316,
            emissive: 0xf97316,
            emissiveIntensity: 1.5,
            roughness: 0.2
        });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.y = 0.12 + 0.70 + 0.07;
        group.add(beacon);

        // Lumière d'alerte orange
        const light = new THREE.PointLight(0xf97316, 1.8, 3.5);
        light.position.set(0, beacon.position.y + 0.05, 0);
        group.add(light);

        // Référence pour l'animation
        group.userData = { beaconMat, light };

        return group;
    }

    /**
     * Fait apparaître un obstacle dynamique à une cellule précise
     */
    spawnObstacle(colX, rowZ) {
        if (!this.grid.isInside(colX, rowZ)) return null;

        // Si la case est déjà occupée par un obstacle dynamique
        const existing = this.activeObstacles.find(o => o.gridX === colX && o.gridZ === rowZ);
        if (existing) return existing;

        const mesh = this.createObstacleMesh();
        const worldPos = GridCoords.gridToWorld(colX, rowZ, 0);
        mesh.position.set(worldPos.x, 0, worldPos.z);

        this.obstaclesGroup.add(mesh);
        this.activeObstacles.push({
            id: `dyn_obs_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            gridX: colX,
            gridZ: rowZ,
            mesh
        });

        // Marque immédiatement la cellule comme bloquée dans l'Occupancy Grid Map
        this.grid.setObstacle(colX, rowZ, true);
        console.log(`⚠️ [LAB 07] Obstacle dynamique posé en case (${colX}, ${rowZ}). Matrice mise à jour.`);

        return mesh;
    }

    /**
     * Supprime un obstacle dynamique spécifique
     */
    removeObstacle(colX, rowZ) {
        const idx = this.activeObstacles.findIndex(o => o.gridX === colX && o.gridZ === rowZ);
        if (idx !== -1) {
            const obs = this.activeObstacles[idx];
            this.obstaclesGroup.remove(obs.mesh);
            this.activeObstacles.splice(idx, 1);

            // Vérifie si ce n'est pas un rack statique avant de libérer la cellule
            let isStatic = false;
            CONFIG.RACKS.forEach(r => {
                if (colX >= r.x && colX < r.x + r.w && rowZ >= r.z && rowZ < r.z + r.d) {
                    isStatic = true;
                }
            });
            if ((colX === 20 && rowZ === 8) || (colX === 20 && rowZ === 10)) isStatic = true;

            if (!isStatic) {
                this.grid.setObstacle(colX, rowZ, false);
            }
            console.log(`🧹 [LAB 07] Obstacle dynamique retiré de la case (${colX}, ${rowZ}).`);
            return true;
        }
        return false;
    }

    /**
     * Fait apparaître un obstacle imprévu directement devant l'AGV (sur sa trajectoire A*)
     * @param {AGVRobot} agv - Instance de l'AGV en déplacement
     * @param {number} stepsAhead - Nombre de pas en avant sur le trajet (défaut : 2)
     */
    spawnObstacleOnAGVPath(agv, stepsAhead = 2) {
        if (!agv || !agv.isNavigating || !agv.trajectory || agv.trajectory.length === 0) {
            console.warn("⚠️ Impossible de poser un obstacle sur le chemin : AGV immobile ou sans trajectoire.");
            return null;
        }

        const targetIdx = Math.min(agv.targetIndex + stepsAhead, agv.trajectory.length - 1);
        const targetPoint = agv.trajectory[targetIdx];
        const gridCoord = GridCoords.worldToGrid(targetPoint.x, targetPoint.z);

        return this.spawnObstacle(gridCoord.colX, gridCoord.rowZ);
    }

    /**
     * Supprime tous les obstacles dynamiques actifs et nettoie la grille
     */
    clearAll() {
        while (this.activeObstacles.length > 0) {
            const obs = this.activeObstacles.pop();
            this.obstaclesGroup.remove(obs.mesh);

            // Libère la cellule dans la grille
            this.grid.setObstacle(obs.gridX, obs.gridZ, false);
        }

        // Recharge les obstacles statiques pour garantir l'intégrité de l'usine
        this.grid.loadStaticObstacles();
        console.log("🧹 [LAB 07] Tous les obstacles dynamiques ont été purgés.");
    }

    /**
     * Animation du clignotement des gyrophares des obstacles
     */
    update(deltaTime = 0.016) {
        const time = performance.now() * 0.008;
        this.activeObstacles.forEach(obs => {
            if (obs.mesh.userData && obs.mesh.userData.light) {
                const pulse = Math.sin(time * 3);
                obs.mesh.userData.light.intensity = pulse > 0 ? 1.8 : 0.2;
                if (obs.mesh.userData.beaconMat) {
                    obs.mesh.userData.beaconMat.emissiveIntensity = pulse > 0 ? 1.5 : 0.2;
                }
            }
        });
    }
}
