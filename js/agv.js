/**
 * AGV SMART FACTORY - MODÈLE 3D DU ROBOT AGV (LAB 02, LAB 06 & LAB 07)
 * Modèle Multi-parties officiel '02_RESCUE_SWARM_ASSEMBLAGE.step' :
 * - Carrosserie Graphite Titane industriel (#22303c)
 * - 4 Jantes Jaune Sécurité éclatant (#f59e0b)
 * - 4 Pneus en Gomme Noire crantée (#0f172a)
 * - Orientation cinématique parfaite : Roues alignées sur la trajectoire (axe Z)
 * - Plaque de chargement supérieure hydraulique avec cales jaunes
 * - Contrôleur cinématique autonome de suivi de trajectoire A* (LAB 06)
 * - Capteur de sécurité LiDAR frontal & Détection d'obstacles dynamiques (LAB 07)
 */

class AGVRobot {
    constructor(scene, initialGridPos = { x: 3, z: 3 }) {
        this.scene = scene;
        this.gridPos = { ...initialGridPos };
        
        // États opérationnels : 'IDLE', 'MOVING', 'LOADING', 'BLOCKED', 'CHARGING'
        this.state = 'IDLE';
        this.hasCargo = false;
        this.currentHeading = 0; // Angle lacet (Yaw)

        // Cinématique et suivi de trajectoire (LAB 06)
        this.trajectory = [];
        this.targetIndex = 0;
        this.isNavigating = false;
        this.moveSpeed = 3.0; // Vitesse de translation : 3.0 m/s (~2 cellules/sec)
        this.rotSpeed = 6.0;  // Vitesse angulaire : 6.0 rad/s
        this.onNavigationComplete = null;
        this.onWaypointReached = null;

        // Détection sensorielle LiDAR & Évitement de collision (LAB 07)
        this.lidarGroup = null;
        this.lidarMat = null;
        this.lidarOutline = null;
        this.isLiDARAlarm = false;
        this.lidarRange = 2.0; // Portée du champ de protection (mètres)
        this.onObstacleDetected = null; // Callback déclenché sur arrêt d'urgence

        // Télémétrie et Supervision Industrielle (LAB 10)
        this.battery = 100.0; // 100% au départ
        this.odometer = 0.0;  // Distance totale en mètres
        this.onTelemetryUpdate = null; // Callback télémétrie temps réel

        // Groupe racine Three.js
        this.mesh = new THREE.Group();
        this.mesh.name = "AGV_Robot_Rescue_Swarm";

        // Échelle idéale : proportions fidèles au couloir de 1.50 m
        this.mesh.scale.set(1.05, 1.05, 1.05);

        // Composants et références
        this.loadingPlateGroup = null;
        this.cargoMesh = null;
        this.beaconLight = null;
        this.beaconMesh = null;
        this.beaconMat = null;

        // Construction du robot
        this.initRobot();

        // Positionnement initial sur la grille usine
        const worldPos = GridCoords.gridToWorld(this.gridPos.x, this.gridPos.z, 0);
        this.mesh.position.set(worldPos.x, worldPos.y, worldPos.z);
        this.scene.add(this.mesh);
    }

    initRobot() {
        this.buildCADMultiMaterialBody();
        this.buildLoadingPlate();
        this.buildCargoModel();
        this.buildSafetyBeacon();
        this.buildLiDARVisual();
    }

    /**
     * Modèle CAO complet avec rendu multi-matériaux (Corps Graphite, Jantes Jaunes, Pneus Noirs)
     */
    buildCADMultiMaterialBody() {
        const cadGeo = createRescueSwarmCADGeometry();

        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x22303c, // Graphite titane industriel
            roughness: 0.38,
            metalness: 0.72,
            flatShading: false
        });

        const rimMat = new THREE.MeshStandardMaterial({
            color: 0xf59e0b, // Jaune Sécurité éclatant (Jante)
            roughness: 0.28,
            metalness: 0.55,
            flatShading: false
        });

        const tireMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a, // Gomme Noire crantée (Pneu)
            roughness: 0.92,
            metalness: 0.08,
            flatShading: false
        });

        const materials = [bodyMat, rimMat, tireMat];
        const cadMesh = new THREE.Mesh(cadGeo, materials);
        cadMesh.castShadow = true;
        cadMesh.receiveShadow = true;
        this.mesh.add(cadMesh);

        // Halo lumineux sous le châssis (Underglow sécurité)
        const underglow = new THREE.PointLight(0x38bdf8, 0.45, 1.6);
        underglow.position.set(0, 0.12, 0);
        this.mesh.add(underglow);
    }

    /**
     * Faisceau LiDAR 3D de sécurité projeté au ras du sol devant l'AGV (LAB 07)
     * Champ de protection angulaire de 50° avec portée de 2.0 m
     */
    buildLiDARVisual() {
        this.lidarGroup = new THREE.Group();
        this.lidarGroup.name = "Safety_LiDAR_Sensor";

        // Cône de détection en éventail (FoV = 50°)
        const fovAngle = (50 * Math.PI) / 180;
        const radius = this.lidarRange;
        const segments = 24;

        // Géométrie d'éventail projeté vers l'avant (+Z)
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        for (let i = 0; i <= segments; i++) {
            const a = -fovAngle / 2 + (i / segments) * fovAngle;
            // En Three.js, l'avant du robot est +Z, l'axe latéral est X
            shape.lineTo(Math.sin(a) * radius, Math.cos(a) * radius);
        }
        shape.closePath();

        const geom = new THREE.ShapeGeometry(shape);
        this.lidarMat = new THREE.MeshBasicMaterial({
            color: 0x06b6d4, // Cyan de scan par défaut
            transparent: true,
            opacity: 0.22,
            side: THREE.DoubleSide
        });
        const coneMesh = new THREE.Mesh(geom, this.lidarMat);
        coneMesh.rotation.x = Math.PI / 2; // À plat au sol

        // Positionné au niveau du pare-chocs avant (Z = 0.52 m, Y = 0.03 m)
        coneMesh.position.set(0, 0.03, 0.52);
        this.lidarGroup.add(coneMesh);

        // Contour laser fin et émissif
        const borderPoints = [];
        borderPoints.push(new THREE.Vector3(0, 0.031, 0.52));
        for (let i = 0; i <= segments; i++) {
            const a = -fovAngle / 2 + (i / segments) * fovAngle;
            borderPoints.push(new THREE.Vector3(
                Math.sin(a) * radius,
                0.031,
                0.52 + Math.cos(a) * radius
            ));
        }
        borderPoints.push(new THREE.Vector3(0, 0.031, 0.52));
        const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPoints);
        this.lidarOutline = new THREE.Line(borderGeo, new THREE.LineBasicMaterial({
            color: 0x06b6d4,
            transparent: true,
            opacity: 0.6
        }));
        this.lidarGroup.add(this.lidarOutline);

        this.mesh.add(this.lidarGroup);
    }

    /**
     * Alerte visuelle LiDAR (passage immédiat au rouge clignotant lors d'une détection)
     */
    setLiDARAlarm(isAlarm) {
        this.isLiDARAlarm = isAlarm;
        const color = isAlarm ? 0xef4444 : 0x06b6d4;
        const opacity = isAlarm ? 0.65 : 0.22;

        if (this.lidarMat) {
            this.lidarMat.color.setHex(color);
            this.lidarMat.opacity = opacity;
        }
        if (this.lidarOutline && this.lidarOutline.material) {
            this.lidarOutline.material.color.setHex(color);
        }
    }

    /**
     * Plaque de charge supérieure hydraulique avec cornières de calage jaunes
     */
    buildLoadingPlate() {
        this.loadingPlateGroup = new THREE.Group();
        this.loadingPlateGroup.name = "Loading_Plate";

        const plateWidth = 0.80;  // Largeur (axe X Three.js)
        const plateLength = 0.74; // Longueur (axe Z Three.js)
        const plateThickness = 0.035;

        // Plateau supérieur principal
        const plateGeo = new THREE.BoxGeometry(plateWidth, plateThickness, plateLength);
        const plateMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.8 });
        const mainPlate = new THREE.Mesh(plateGeo, plateMat);
        mainPlate.castShadow = true;
        mainPlate.receiveShadow = true;
        this.loadingPlateGroup.add(mainPlate);

        // Tapis antidérapant en caoutchouc texturé
        const matGeo = new THREE.PlaneGeometry(plateWidth - 0.08, plateLength - 0.08);
        const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0a0f1d, roughness: 0.95 });
        const rubberPad = new THREE.Mesh(matGeo, rubberMat);
        rubberPad.rotation.x = -Math.PI / 2;
        rubberPad.position.y = plateThickness / 2 + 0.002;
        this.loadingPlateGroup.add(rubberPad);

        // 4 Cornières d'arrêt et de centrage de palette (Jaune Sécurité)
        const cornerMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35 });
        const cornerGeo = new THREE.BoxGeometry(0.06, 0.05, 0.06);
        const offsets = [
            [-plateWidth / 2 + 0.04, -plateLength / 2 + 0.04],
            [plateWidth / 2 - 0.04, -plateLength / 2 + 0.04],
            [-plateWidth / 2 + 0.04, plateLength / 2 - 0.04],
            [plateWidth / 2 - 0.04, plateLength / 2 - 0.04]
        ];

        offsets.forEach(([cx, cz]) => {
            const corner = new THREE.Mesh(cornerGeo, cornerMat);
            corner.position.set(cx, plateThickness / 2 + 0.02, cz);
            corner.castShadow = true;
            this.loadingPlateGroup.add(corner);
        });

        // 4 Vérins hydrauliques télescopiques chromés
        const cylMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.15, metalness: 0.95 });
        const cylGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.06, 16);
        [[-0.22, -0.18], [0.22, -0.18], [-0.22, 0.18], [0.22, 0.18]].forEach(([cx, cz]) => {
            const cyl = new THREE.Mesh(cylGeo, cylMat);
            cyl.position.set(cx, -0.03, cz);
            cyl.castShadow = true;
            this.loadingPlateGroup.add(cyl);
        });

        // Hauteur de base ajustée sur le toit du châssis CAO (Y = 0.58 m)
        this.basePlateY = 0.58;
        this.liftedPlateY = 0.65;
        this.loadingPlateGroup.position.set(0, this.basePlateY, 0);
        this.mesh.add(this.loadingPlateGroup);
    }

    /**
     * Colis industriel standardisé à transporter
     */
    buildCargoModel() {
        this.cargoMesh = new THREE.Group();
        this.cargoMesh.name = "Cargo_Box";

        const boxHeight = 0.42;
        const boxGeo = new THREE.BoxGeometry(0.54, boxHeight, 0.54);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
        const box = new THREE.Mesh(boxGeo, boxMat);
        box.position.y = boxHeight / 2;
        box.castShadow = true;
        this.cargoMesh.add(box);

        // Étiquette code-barres / expédition
        const labelGeo = new THREE.PlaneGeometry(0.22, 0.14);
        const labelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const label = new THREE.Mesh(labelGeo, labelMat);
        label.position.set(0, 0.20, 0.54 / 2 + 0.002);
        this.cargoMesh.add(label);

        this.cargoMesh.position.set(0, 0.02, 0);
        this.cargoMesh.visible = false;
        this.loadingPlateGroup.add(this.cargoMesh);
    }

    /**
     * Gyrophare d'état opérationnel et de sécurité
     */
    buildSafetyBeacon() {
        const beaconGroup = new THREE.Group();
        
        // Embase sur l'arrière du robot (Z = -0.38 m)
        const baseGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.04, 16);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.set(0, 0.59, -0.38);
        beaconGroup.add(base);

        // Dôme lumineux
        const domeGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.07, 16);
        this.beaconMat = new THREE.MeshStandardMaterial({
            color: 0x06b6d4,
            emissive: 0x06b6d4,
            emissiveIntensity: 1.0,
            roughness: 0.2
        });
        this.beaconMesh = new THREE.Mesh(domeGeo, this.beaconMat);
        this.beaconMesh.position.set(0, 0.63, -0.38);
        beaconGroup.add(this.beaconMesh);

        // Lumière ponctuelle d'ambiance
        this.beaconLight = new THREE.PointLight(0x06b6d4, 1.8, 3.5);
        this.beaconLight.position.set(0, 0.67, -0.38);
        beaconGroup.add(this.beaconLight);

        this.mesh.add(beaconGroup);
    }

    loadCargo() {
        this.hasCargo = true;
        this.cargoMesh.visible = true;
        if (this.loadingPlateGroup) this.loadingPlateGroup.position.y = this.liftedPlateY;
        this.setState('LOADING');
        setTimeout(() => this.setState(this.isNavigating ? 'MOVING' : 'IDLE'), 800);
    }

    unloadCargo() {
        this.hasCargo = false;
        this.cargoMesh.visible = false;
        if (this.loadingPlateGroup) this.loadingPlateGroup.position.y = this.basePlateY;
        this.setState(this.isNavigating ? 'MOVING' : 'IDLE');
    }

    setState(newState) {
        this.state = newState;
        let color = 0x06b6d4;

        switch (newState) {
            case 'MOVING':   color = 0x0284c7; break;
            case 'LOADING':  color = 0xf59e0b; break;
            case 'BLOCKED':  color = 0xef4444; break;
            case 'CHARGING': color = 0x10b981; break;
            case 'IDLE':
            default:         color = 0x06b6d4; break;
        }

        if (this.beaconMat && this.beaconLight) {
            this.beaconMat.color.setHex(color);
            this.beaconMat.emissive.setHex(color);
            this.beaconLight.color.setHex(color);
        }
    }

    setGridPosition(colX, rowZ) {
        this.gridPos = { x: colX, z: rowZ };
        const worldPos = GridCoords.gridToWorld(colX, rowZ, 0);
        this.mesh.position.x = worldPos.x;
        this.mesh.position.z = worldPos.z;
    }

    setRotation(angleRad) {
        this.currentHeading = angleRad;
        this.mesh.rotation.y = angleRad;
    }

    /**
     * DÉMARRAGE DE LA NAVIGATION AUTONOME SUR UN PARCOURS A* (LAB 06)
     */
    followPath(waypoints, onComplete = null) {
        if (!waypoints || waypoints.length < 2) {
            console.warn("[AGV] Trajectoire invalide ou trop courte.");
            return;
        }

        this.trajectory = waypoints.map(pt => GridCoords.gridToWorld(pt.x, pt.z, 0));
        this.targetIndex = 1; // Le premier waypoint à viser est l'étape 1
        this.isNavigating = true;
        this.onNavigationComplete = onComplete;
        this.setState('MOVING');
        this.setLiDARAlarm(false);

        // Orientation immédiate vers le premier waypoint
        const currentPos = this.mesh.position;
        const target = this.trajectory[1];
        const initialHeading = Math.atan2(target.x - currentPos.x, target.z - currentPos.z);
        this.setRotation(initialHeading);

        console.log(`🤖 [AGV] Début navigation : ${waypoints.length} waypoints à franchir.`);
    }

    /**
     * DÉCLENCHEMENT DE L'ARRÊT D'URGENCE RÉFLEXE PAR DÉTECTION LIDAR (LAB 07)
     */
    triggerEmergencyStop(blockedGridCell, distance) {
        if (this.state === 'BLOCKED') return; // Déjà arrêté en sécurité

        this.isNavigating = false;
        this.setState('BLOCKED');
        this.setLiDARAlarm(true);

        console.warn(`🚨 [LAB 07 - SÉCURITÉ ISO 3691-4] ARRÊT D'URGENCE IMMÉDIAT !`);
        console.warn(`Obstacle inopiné détecté par LiDAR en cellule (${blockedGridCell.colX}, ${blockedGridCell.rowZ}) à ${distance.toFixed(2)} m`);

        if (this.onObstacleDetected) {
            this.onObstacleDetected(blockedGridCell, distance);
        }
    }

    /**
     * Met en pause le déplacement
     */
    pauseNavigation() {
        this.isNavigating = false;
        this.setState('IDLE');
    }

    /**
     * Reprend le déplacement
     */
    resumeNavigation() {
        if (this.trajectory.length > 0 && this.targetIndex < this.trajectory.length) {
            this.isNavigating = true;
            this.setState('MOVING');
            this.setLiDARAlarm(false);
        }
    }

    /**
     * Arrête définitivement et vide la trajectoire
     */
    stopNavigation() {
        this.isNavigating = false;
        this.trajectory = [];
        this.targetIndex = 0;
        this.setState('IDLE');
        this.setLiDARAlarm(false);
    }

    /**
     * Contrôleur cinématique & Scanner de sécurité LiDAR exécutés à 60 FPS
     * @param {number} deltaTime - Intervalle de temps entre frames
     * @param {OccupancyGrid} grid - Matrice d'occupation usine pour détection d'obstacles
     */
    update(deltaTime = 0.016, grid = null) {
        // Clignotement du gyrophare
        if (this.beaconLight) {
            const time = performance.now() * 0.005;
            if (this.state === 'BLOCKED') {
                // Flash rapide stroboscopique d'urgence
                const flash = Math.sin(time * 8) > 0 ? 2.5 : 0.2;
                this.beaconLight.intensity = flash;
            } else {
                this.beaconLight.intensity = 1.3 + 0.5 * Math.sin(time);
            }
        }

        // Animation d'alerte LiDAR si actif
        if (this.isLiDARAlarm && this.lidarMat) {
            const time = performance.now() * 0.008;
            this.lidarMat.opacity = 0.4 + 0.3 * Math.sin(time * 5);
        }

        // SCAN LIDAR DE SÉCURITÉ AVANT DÉPLACEMENT (LAB 07)
        if (this.isNavigating && grid) {
            // Portée d'arrêt d'urgence : scrute à 1.4 m devant l'AGV (direction du cap)
            const frontCheckDist = 1.40;
            const lookX = this.mesh.position.x + Math.sin(this.currentHeading) * frontCheckDist;
            const lookZ = this.mesh.position.z + Math.cos(this.currentHeading) * frontCheckDist;
            const aheadCell = GridCoords.worldToGrid(lookX, lookZ);

            // Vérifie également la cellule cible immédiate du prochain waypoint
            let targetCell = null;
            if (this.targetIndex < this.trajectory.length) {
                const tw = this.trajectory[this.targetIndex];
                targetCell = GridCoords.worldToGrid(tw.x, tw.z);
            }

            const isAheadBlocked = grid.isInside(aheadCell.colX, aheadCell.rowZ) && !grid.isWalkable(aheadCell.colX, aheadCell.rowZ);
            const isTargetBlocked = targetCell && !grid.isWalkable(targetCell.colX, targetCell.rowZ);

            if (isAheadBlocked || isTargetBlocked) {
                const blockedCell = isAheadBlocked ? aheadCell : targetCell;
                const blockWorld = GridCoords.gridToWorld(blockedCell.colX, blockedCell.rowZ);
                const distToBlock = Math.hypot(
                    blockWorld.x - this.mesh.position.x,
                    blockWorld.z - this.mesh.position.z
                );
                this.triggerEmergencyStop(blockedCell, distToBlock);
                return; // Bloque tout mouvement !
            }
        }

        // DÉPLACEMENT CINÉMATIQUE SI VOIE LIBRE
        if (this.isNavigating && this.trajectory.length > 0 && this.targetIndex < this.trajectory.length) {
            const target = this.trajectory[this.targetIndex];
            const currentPos = this.mesh.position;

            const dx = target.x - currentPos.x;
            const dz = target.z - currentPos.z;
            const distance = Math.hypot(dx, dz);

            // Calcul du cap angulaire cible vers le waypoint suivant
            const targetAngle = Math.atan2(dx, dz);

            // Différence angulaire minimale sur [-PI, +PI]
            let angleDiff = Math.atan2(Math.sin(targetAngle - this.currentHeading), Math.cos(targetAngle - this.currentHeading));

            // 1. Rotation contrôlée vers la cible
            if (Math.abs(angleDiff) > 0.04) {
                const rotStep = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.rotSpeed * deltaTime);
                this.setRotation(this.currentHeading + rotStep);
            }

            // 2. Avance en translation si l'AGV est approximativement aligné
            if (Math.abs(angleDiff) < 0.6) {
                const moveDist = Math.min(distance, this.moveSpeed * deltaTime);
                this.mesh.position.x += Math.sin(this.currentHeading) * moveDist;
                this.mesh.position.z += Math.cos(this.currentHeading) * moveDist;

                // Télémétrie odomètre & décharge batterie (LAB 10)
                this.odometer += moveDist;
                this.battery = Math.max(0, this.battery - moveDist * 0.25);
            }

            // 3. Franchissement du waypoint
            if (distance < 0.12) {
                const currentGrid = GridCoords.worldToGrid(this.mesh.position.x, this.mesh.position.z);
                this.gridPos = currentGrid;

                if (this.onWaypointReached) {
                    this.onWaypointReached(this.targetIndex, this.trajectory.length, currentGrid);
                }

                this.targetIndex++;

                // Arrivée au terminus
                if (this.targetIndex >= this.trajectory.length) {
                    this.isNavigating = false;
                    this.setState('IDLE');
                    console.log("🏁 [AGV] Mission accomplie ! Arrivée au point cible.");

                    if (this.onNavigationComplete) {
                        this.onNavigationComplete();
                    }
                }
            }
        }

        // Recharge automatique sur borne à induction en Zone D (LAB 10)
        if (this.state === 'CHARGING') {
            this.battery = Math.min(100, this.battery + deltaTime * 6.0); // +6% par seconde
        }

        // Notification temps réel du flux de télémétrie
        if (this.onTelemetryUpdate) {
            this.onTelemetryUpdate({
                battery: this.battery,
                odometer: this.odometer,
                state: this.state
            });
        }
    }
}
