/**
 * AGV SMART FACTORY - MOTEUR SCÈNE 3D (LAB 01)
 * Création de l'usine 3D Three.js : Zones A, B, C, D, E, Couloirs, Racks, Éclairage & Caméra
 */

class FactoryEnvironment {
    constructor(canvasContainer) {
        this.container = canvasContainer;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.zoneSprites = [];
        this.colliders = []; // Objets 3D représentant les obstacles

        this.initThree();
        this.buildLighting();
        this.buildFloorAndGrid();
        this.buildZones();
        this.buildRacksAndProps();
        this.setupEventListeners();
    }

    /**
     * Initialisation du moteur Three.js et de la caméra orbitale
     */
    initThree() {
        // 1. Scène
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0b0f19); // Espace sombre type salle de contrôle industrielle
        this.scene.fog = new THREE.FogExp2(0x0b0f19, 0.012);

        // 2. Caméra perspective
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        // Position isométrique initiale élégante
        this.camera.position.set(0, 32, 28);

        // 3. Renderer WebGL avec ombres douces et antialiasing
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.container.appendChild(this.renderer.domElement);

        // 4. Contrôles orbitaux (OrbitControls)
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Empêcher la caméra de passer sous le sol
        this.controls.minDistance = 5;
        this.controls.maxDistance = 75;
        this.controls.target.set(0, 0, 0);
    }

    /**
     * Éclairage industriel réaliste (Ambiance + Spot directionnel à ombres + Accents de zones)
     */
    buildLighting() {
        // Lumière d'ambiance industrielle
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
        this.scene.add(ambientLight);

        // Lumière principale du plafonnier d'usine (Ombres portées nettes)
        const mainLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
        mainLight.position.set(15, 35, 20);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 80;
        
        const d = 25;
        mainLight.shadow.camera.left = -d;
        mainLight.shadow.camera.right = d;
        mainLight.shadow.camera.top = d;
        mainLight.shadow.camera.bottom = -d;
        mainLight.shadow.bias = -0.0005;
        this.scene.add(mainLight);

        // Lumière de débouchage douce bleutée pour un look "Digital Twin"
        const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.35);
        fillLight.position.set(-20, 20, -15);
        this.scene.add(fillLight);

        // Lumières d'accentuation sur les zones stratégiques (douces pour préserver les couleurs réelles)
        const chargeLight = new THREE.PointLight(CONFIG.COLORS.zoneD, 0.8, 8);
        const pD = GridCoords.gridToWorld(2.5, 2.0, 1.8);
        chargeLight.position.set(pD.x, pD.y, pD.z);
        this.scene.add(chargeLight);

        const prodLight = new THREE.PointLight(CONFIG.COLORS.zoneB, 1.2, 12);
        const pB = GridCoords.gridToWorld(20.0, 9.0, 2.5);
        prodLight.position.set(pB.x, pB.y, pB.z);
        this.scene.add(prodLight);
    }

    /**
     * Sol industriel avec dalle béton, marquages de couloirs et grille de projection
     */
    buildFloorAndGrid() {
        const totalW = CONFIG.GRID_WIDTH * CONFIG.CELL_SIZE;
        const totalH = CONFIG.GRID_HEIGHT * CONFIG.CELL_SIZE;

        // Dalle de sol principale
        const floorGeo = new THREE.BoxGeometry(totalW + 2, 0.4, totalH + 2);
        const floorMat = new THREE.MeshStandardMaterial({
            color: CONFIG.COLORS.floor,
            roughness: 0.7,
            metalness: 0.15
        });
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.position.y = -0.2;
        floorMesh.receiveShadow = true;
        this.scene.add(floorMesh);

        // Bordure de sécurité usine (rebord périphérique)
        const borderGeo = new THREE.BoxGeometry(totalW + 2.4, 0.15, totalH + 2.4);
        const borderMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
        const borderMesh = new THREE.Mesh(borderGeo, borderMat);
        borderMesh.position.y = -0.05;
        this.scene.add(borderMesh);

        // Grille de projection au sol (Chaque carré = 1 cellule discrète)
        const gridHelper = new THREE.GridHelper(
            Math.max(totalW, totalH),
            Math.max(CONFIG.GRID_WIDTH, CONFIG.GRID_HEIGHT),
            CONFIG.COLORS.gridLines,
            0x1e293b
        );
        gridHelper.position.y = 0.01;
        // Ajustement de taille selon le ratio
        this.scene.add(gridHelper);

        // Lignes de guidage logistiques au sol (peinture jaune industrielle sur les artères principales)
        this.createRoadMarking(0, 0, totalW, 0.08, 0); // Ligne médiane longitudinale
    }

    createRoadMarking(x, z, length, width, rotY = 0) {
        const geo = new THREE.PlaneGeometry(length, width);
        const mat = new THREE.MeshBasicMaterial({ color: 0xeab308, opacity: 0.4, transparent: true });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = rotY;
        mesh.position.set(x, 0.02, z);
        this.scene.add(mesh);
    }

    /**
     * Implantation des 5 Zones officielles (A, B, C, D, E) avec dalles lumineuses et badges 3D
     */
    buildZones() {
        Object.values(CONFIG.ZONES).forEach(zone => {
            const b = zone.bounds;
            const wCells = (b.xMax - b.xMin + 1);
            const hCells = (b.zMax - b.zMin + 1);
            const width3D = wCells * CONFIG.CELL_SIZE;
            const depth3D = hCells * CONFIG.CELL_SIZE;

            // Position centrale de la zone
            const centerCol = (b.xMin + b.xMax) / 2;
            const centerRow = (b.zMin + b.zMax) / 2;
            const pos = GridCoords.gridToWorld(centerCol, centerRow, 0.02);

            // Dalle de sol colorée spécifique à la zone
            const zoneGeo = new THREE.PlaneGeometry(width3D - 0.1, depth3D - 0.1);
            const zoneMat = new THREE.MeshStandardMaterial({
                color: zone.color,
                roughness: 0.5,
                metalness: 0.2,
                transparent: true,
                opacity: 0.65
            });
            const zoneMesh = new THREE.Mesh(zoneGeo, zoneMat);
            zoneMesh.rotation.x = -Math.PI / 2;
            zoneMesh.position.set(pos.x, 0.02, pos.z);
            zoneMesh.receiveShadow = true;
            this.scene.add(zoneMesh);

            // Bordure lumineuse du périmètre de zone
            const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(width3D, 0.06, depth3D));
            const edgeMat = new THREE.LineBasicMaterial({ color: zone.color, linewidth: 2 });
            const edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
            edgeMesh.position.set(pos.x, 0.03, pos.z);
            this.scene.add(edgeMesh);

            // Badge 3D flottant avec texte haute résolution et icône
            const badgeSprite = this.createZoneBadge(zone);
            badgeSprite.position.set(pos.x, 3.2, pos.z);
            this.scene.add(badgeSprite);
            this.zoneSprites.push(badgeSprite);

            // Point de dépose / prise AGV (marqueur visuel au sol)
            const dropPos = GridCoords.gridToWorld(zone.dropPoint.x, zone.dropPoint.z, 0.03);
            const dropGeo = new THREE.RingGeometry(0.3, 0.5, 24);
            const dropMat = new THREE.MeshBasicMaterial({ color: zone.color, side: THREE.DoubleSide });
            const dropRing = new THREE.Mesh(dropGeo, dropMat);
            dropRing.rotation.x = -Math.PI / 2;
            dropRing.position.set(dropPos.x, 0.03, dropPos.z);
            this.scene.add(dropRing);
        });
    }

    /**
     * Génère un badge texturé 3D lisible sous tous les angles pour repérer les zones
     */
    createZoneBadge(zone) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Fond vitré arrondi avec bordure colorée
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = zone.hex;
        ctx.lineWidth = 10;
        if (ctx.roundRect) {
            ctx.roundRect(10, 10, 492, 236, 30);
        } else {
            ctx.strokeRect(10, 10, 492, 236);
            ctx.fillRect(10, 10, 492, 236);
        }
        ctx.fill();
        ctx.stroke();

        // En-tête : Lettre de Zone
        ctx.fillStyle = zone.hex;
        ctx.font = 'bold 80px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`ZONE ${zone.id}`, 256, 80);

        // Sous-titre : Nom de fonction
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 44px "Segoe UI", Arial, sans-serif';
        ctx.fillText(`${zone.icon} ${zone.name}`, 256, 155);

        // Texture Three.js
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(3.8, 1.9, 1);
        return sprite;
    }

    /**
     * Modélisation des rayonnages industriels (Racks) et machines d'usine
     */
    buildRacksAndProps() {
        // Construction des Racks de stockage d'entrepôt
        CONFIG.RACKS.forEach(r => {
            this.createWarehouseRack(r.x, r.z, r.w, r.d);
        });

        // Décoration spécifique Zone B : Machines de production & convoyeur
        this.createProductionStation(20, 8);
        this.createProductionStation(20, 10);

        // Décoration spécifique Zone D : Borne de recharge automatique
        this.createChargingStation(2, 2);

        // Décoration spécifique Zone C : Quai d'expédition & piles de palettes
        this.createShippingDock(11, 13);

        // Décoration spécifique Zone E : Poste de maintenance & diagnostic
        this.createMaintenanceStation(3, 12);
    }

    /**
     * Rayonnage industriel métallique complet avec montants, traverses et palettes chargées
     */
    createWarehouseRack(colX, rowZ, widthCells, depthCells) {
        const rackGroup = new THREE.Group();
        const totalW = widthCells * CONFIG.CELL_SIZE;
        const totalD = depthCells * CONFIG.CELL_SIZE;
        const height = 4.2;

        const pos = GridCoords.gridToWorld(colX + (widthCells - 1) / 2, rowZ + (depthCells - 1) / 2);

        // Montants métalliques (piliers bleus/gris)
        const uprightMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.rackMetal, roughness: 0.5, metalness: 0.6 });
        const pillarGeo = new THREE.BoxGeometry(0.12, height, 0.12);

        const corners = [
            [-totalW / 2 + 0.1, -totalD / 2 + 0.1],
            [totalW / 2 - 0.1, -totalD / 2 + 0.1],
            [-totalW / 2 + 0.1, totalD / 2 - 0.1],
            [totalW / 2 - 0.1, totalD / 2 - 0.1],
        ];

        corners.forEach(([cx, cz]) => {
            const p = new THREE.Mesh(pillarGeo, uprightMat);
            p.position.set(cx, height / 2, cz);
            p.castShadow = true;
            rackGroup.add(p);
        });

        // 3 Niveaux de traverses orange industrielles
        const beamMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.rackBeam, roughness: 0.4 });
        const levels = [0.8, 2.0, 3.2];

        levels.forEach(lvl => {
            const shelfGeo = new THREE.BoxGeometry(totalW - 0.1, 0.08, totalD - 0.1);
            const shelf = new THREE.Mesh(shelfGeo, beamMat);
            shelf.position.y = lvl;
            shelf.castShadow = true;
            shelf.receiveShadow = true;
            rackGroup.add(shelf);

            // Palettes et colis sur les étagères
            for (let i = 0; i < widthCells; i++) {
                const subX = -totalW / 2 + (i + 0.5) * CONFIG.CELL_SIZE;
                this.addPalletWithBoxes(rackGroup, subX, lvl + 0.06, 0);
            }
        });

        rackGroup.position.set(pos.x, 0, pos.z);
        this.scene.add(rackGroup);
        this.colliders.push(rackGroup);
    }

    addPalletWithBoxes(group, x, y, z) {
        // Palette bois
        const palletGeo = new THREE.BoxGeometry(0.9, 0.12, 0.9);
        const palletMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.palletWood, roughness: 0.9 });
        const pallet = new THREE.Mesh(palletGeo, palletMat);
        pallet.position.set(x, y + 0.06, z);
        pallet.castShadow = true;
        group.add(pallet);

        // Cartons posés
        const boxMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.boxCardboard, roughness: 0.8 });
        const numBoxes = Math.random() > 0.3 ? 2 : 1;
        for (let b = 0; b < numBoxes; b++) {
            const boxGeo = new THREE.BoxGeometry(0.38, 0.4, 0.38);
            const box = new THREE.Mesh(boxGeo, boxMat);
            box.position.set(x + (b === 0 ? -0.18 : 0.18), y + 0.32, z);
            box.castShadow = true;
            group.add(box);
        }
    }

    createProductionStation(colX, rowZ) {
        const group = new THREE.Group();
        const pos = GridCoords.gridToWorld(colX, rowZ);

        // Machine CNC principale
        const baseGeo = new THREE.BoxGeometry(1.8, 1.6, 1.4);
        const baseMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.machineBody, roughness: 0.4, metalness: 0.5 });
        const machine = new THREE.Mesh(baseGeo, baseMat);
        machine.position.y = 0.8;
        machine.castShadow = true;
        group.add(machine);

        // Écran pupitre opérateur
        const screenGeo = new THREE.BoxGeometry(0.4, 0.3, 0.05);
        const screenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const screen = new THREE.Mesh(screenGeo, screenMat);
        screen.position.set(-0.5, 1.7, 0.7);
        group.add(screen);

        // Gyrophare vert état machine
        const beaconGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.25, 16);
        const beaconMat = new THREE.MeshBasicMaterial({ color: CONFIG.COLORS.machineAccent });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(0.6, 1.7, 0);
        group.add(beacon);

        group.position.set(pos.x, 0, pos.z);
        this.scene.add(group);
    }

    createChargingStation(colX, rowZ) {
        const group = new THREE.Group();
        const pos = GridCoords.gridToWorld(colX, rowZ);

        // Plaque d'induction au sol
        const padGeo = new THREE.BoxGeometry(1.2, 0.05, 1.2);
        const padMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.7 });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.y = 0.025;
        group.add(pad);

        // Anneau lumineux cyan de recharge
        const ringGeo = new THREE.RingGeometry(0.35, 0.5, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: CONFIG.COLORS.zoneD, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.06;
        group.add(ring);

        // Borne armoire électrique
        const cabGeo = new THREE.BoxGeometry(0.4, 1.5, 0.4);
        const cabMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
        const cab = new THREE.Mesh(cabGeo, cabMat);
        cab.position.set(0, 0.75, -0.6);
        cab.castShadow = true;
        group.add(cab);

        group.position.set(pos.x, 0, pos.z);
        this.scene.add(group);
    }

    createShippingDock(colX, rowZ) {
        const group = new THREE.Group();
        const pos = GridCoords.gridToWorld(colX, rowZ);

        // Palette et cartons de fret prêts au départ
        this.addPalletWithBoxes(group, 0, 0, 0);
        this.addPalletWithBoxes(group, 0.8, 0, 0);

        group.position.set(pos.x, 0, pos.z);
        this.scene.add(group);
    }

    createMaintenanceStation(colX, rowZ) {
        const group = new THREE.Group();
        const pos = GridCoords.gridToWorld(colX, rowZ);

        // Établi mécanique rouge / acier
        const benchGeo = new THREE.BoxGeometry(1.4, 0.9, 0.7);
        const benchMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });
        const bench = new THREE.Mesh(benchGeo, benchMat);
        bench.position.set(0, 0.45, -0.5);
        bench.castShadow = true;
        group.add(bench);

        group.position.set(pos.x, 0, pos.z);
        this.scene.add(group);
    }

    /**
     * Vues prédéfinies de la caméra (Perspective 3D, Vue du dessus 2D, Focus Zone)
     */
    setCameraView(viewType) {
        if (viewType === 'iso') {
            this.camera.position.set(0, 32, 28);
            this.controls.target.set(0, 0, 0);
        } else if (viewType === 'top') {
            this.camera.position.set(0, 42, 0.1);
            this.controls.target.set(0, 0, 0);
        } else if (CONFIG.ZONES[viewType]) {
            const z = CONFIG.ZONES[viewType];
            const p = GridCoords.gridToWorld((z.bounds.xMin + z.bounds.xMax) / 2, (z.bounds.zMin + z.bounds.zMax) / 2);
            this.camera.position.set(p.x, 14, p.z + 12);
            this.controls.target.set(p.x, 0, p.z);
        }
        this.controls.update();
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize());
    }

    onWindowResize() {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    render() {
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}
