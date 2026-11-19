/**
 * AGV SMART FACTORY - VISUALISEUR DE CHEMIN 3D (LAB 05)
 * Tracé dans l'espace Three.js de la trajectoire calculée par A* :
 * - Ligne de guidage optique néon industrielle (laser/bande phosphorescente)
 * - Anneaux de waypoints discrets aux nœuds du parcours
 * - Balise de cible pulsante à l'arrivée (Goal Beacon)
 * - Nettoyage GPU propre à chaque nouveau calcul
 */

class PathVisualizer {
    constructor(scene) {
        this.scene = scene;
        this.pathGroup = new THREE.Group();
        this.pathGroup.name = "AStar_Path_Visualization";
        this.scene.add(this.pathGroup);

        this.goalRing = null;
        this.currentPath = [];
    }

    /**
     * Supprime proprement tous les objets 3D du chemin actuel de la mémoire GPU
     */
    clearPath() {
        while (this.pathGroup.children.length > 0) {
            const child = this.pathGroup.children[0];
            this.pathGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        }
        this.goalRing = null;
        this.currentPath = [];
    }

    /**
     * Trace la trajectoire A* dans la scène 3D à partir de la liste des cellules [{x, z}, ...]
     */
    drawPath(gridWaypoints, colorHex = 0x06b6d4) {
        this.clearPath();

        if (!gridWaypoints || gridWaypoints.length < 2) {
            return;
        }

        this.currentPath = gridWaypoints;
        const altitude = 0.035; // 3.5 cm au-dessus du sol (passe sous l'AGV sans aucun clipping)

        // 1. Conversion des cellules discrètes en points 3D continus
        const points3D = gridWaypoints.map(pt => {
            const w = GridCoords.gridToWorld(pt.x, pt.z, altitude);
            return new THREE.Vector3(w.x, altitude, w.z);
        });

        // 2. Tracé de la ligne optique de guidage laser (fine et émissive)
        const curve = new THREE.CatmullRomCurve3(points3D, false, 'catmullrom', 0.05);
        const tubeGeo = new THREE.TubeGeometry(curve, points3D.length * 6, 0.018, 12, false);
        const tubeMat = new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorHex,
            emissiveIntensity: 1.2,
            roughness: 0.2,
            metalness: 0.5
        });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        tubeMesh.castShadow = false;
        tubeMesh.receiveShadow = false;
        this.pathGroup.add(tubeMesh);

        // 3. Ruban de sécurité au sol (largeur 18 cm)
        const ribbonMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 2, opacity: 0.7, transparent: true });
        const shadowPoints = gridWaypoints.map(pt => {
            const w = GridCoords.gridToWorld(pt.x, pt.z, 0.026);
            return new THREE.Vector3(w.x, 0.026, w.z);
        });
        const shadowGeo = new THREE.BufferGeometry().setFromPoints(shadowPoints);
        const shadowLine = new THREE.Line(shadowGeo, ribbonMat);
        this.pathGroup.add(shadowLine);

        // 4. Marqueurs de Waypoints discrets (Anneaux lumineux à chaque cellule)
        const ringGeo = new THREE.RingGeometry(0.08, 0.16, 16);
        const ringMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide });

        points3D.forEach((pt, idx) => {
            if (idx < points3D.length - 1) {
                const ring = new THREE.Mesh(ringGeo, ringMat);
                ring.rotation.x = -Math.PI / 2;
                ring.position.set(pt.x, 0.028, pt.z);
                this.pathGroup.add(ring);
            }
        });

        // 5. Balise d'arrivée (Goal Beacon) : Cible pulsante avec halo
        const goalPt = points3D[points3D.length - 1];
        const goalGeo = new THREE.RingGeometry(0.24, 0.44, 24);
        const goalMat = new THREE.MeshBasicMaterial({
            color: 0x10b981,     // Vert émeraude validation
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85
        });
        this.goalRing = new THREE.Mesh(goalGeo, goalMat);
        this.goalRing.rotation.x = -Math.PI / 2;
        this.goalRing.position.set(goalPt.x, 0.030, goalPt.z);
        this.pathGroup.add(this.goalRing);

        // Colonne lumineuse verticale d'arrivée
        const beaconColGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.8, 16);
        const beaconColMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.45 });
        const beaconCol = new THREE.Mesh(beaconColGeo, beaconColMat);
        beaconCol.position.set(goalPt.x, 0.9, goalPt.z);
        this.pathGroup.add(beaconCol);
    }

    /**
     * Animation d'impulsion de la balise d'arrivée
     */
    update(deltaTime = 0.016) {
        if (this.goalRing) {
            const time = performance.now() * 0.006;
            const scale = 1.0 + 0.18 * Math.sin(time);
            this.goalRing.scale.set(scale, scale, 1);
        }
    }
}
