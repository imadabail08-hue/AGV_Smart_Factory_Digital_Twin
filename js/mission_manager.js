/**
 * AGV SMART FACTORY - GESTION DES MISSIONS MULTIPLES (LAB 09)
 * Machine à États Finis (FSM) orchestrant le cycle logistique complet de l'Usine 4.0
 * Conforme au scénario officiel de la consigne (p. 4) :
 * Étape 1 : Prise de colis brut en Zone A (Stockage)
 * Étape 2 : Transport & usinage en Zone B (Production)
 * Étape 3 : Transport & expédition en Zone C (Expédition)
 * Étape 4 : Fin de cycle & retour recharge en Zone D (Recharge)
 */

class MissionManager {
    constructor(agv, grid, pathVisualizer, onEvent = null) {
        this.agv = agv;
        this.grid = grid;
        this.pathVisualizer = pathVisualizer;
        this.onEvent = onEvent;

        this.isRunning = false;
        this.isPaused = false;
        this.currentStep = 0; // 0 = en attente, 1 = vers A, 2 = vers B, 3 = vers C, 4 = vers D
        this.timer = null;
        this.startTime = null;
        this.elapsedSeconds = 0;

        // Définition des 4 étapes du cycle nominal
        this.cycleSteps = [
            {
                step: 1,
                name: "Prise Colis Brut",
                targetZone: 'A',
                badgeColor: '#0284c7',
                desc: "Déplacement vers Stockage (Zone A) pour prise d'un colis brut."
            },
            {
                step: 2,
                name: "Acheminement Production",
                targetZone: 'B',
                badgeColor: '#10b981',
                desc: "Transport vers Production (Zone B), dépose et simulation usinage."
            },
            {
                step: 3,
                name: "Livraison Expédition",
                targetZone: 'C',
                badgeColor: '#f59e0b',
                desc: "Prise du produit fini et transfert vers Quai d'Expédition (Zone C)."
            },
            {
                step: 4,
                name: "Retour Recharge Induction",
                targetZone: 'D',
                badgeColor: '#06b6d4',
                desc: "Retour automatique vers Station de Recharge (Zone D)."
            }
        ];
    }

    /**
     * Retourne la zone cible de l'étape courante
     */
    getCurrentTargetZone() {
        if (!this.isRunning || this.currentStep < 1 || this.currentStep > this.cycleSteps.length) {
            return null;
        }
        return this.cycleSteps[this.currentStep - 1].targetZone;
    }

    /**
     * Démarre le cycle industriel complet depuis le début
     */
    startFullCycle() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.isPaused = false;
        this.currentStep = 1;
        this.startTime = Date.now();

        this.log("🚀 Lancement du Cycle Industriel Complet (A ➔ B ➔ C ➔ D)");
        this.updateUI();

        // Démarre la première étape vers la Zone A
        this.executeCurrentStep();
    }

    /**
     * Exécute l'étape courante du cycle
     */
    executeCurrentStep() {
        if (!this.isRunning || this.isPaused) return;

        const stepDef = this.cycleSteps[this.currentStep - 1];
        const targetZoneKey = stepDef.targetZone;
        const targetDropPoint = CONFIG.ZONES[targetZoneKey].dropPoint;

        // Détermine la position de départ actuelle de l'AGV
        const currentGrid = GridCoords.worldToGrid(this.agv.mesh.position.x, this.agv.mesh.position.z);
        let startPt = { x: currentGrid.colX, z: currentGrid.rowZ };

        if (!this.grid.isWalkable(startPt.x, startPt.z)) {
            const neighbors = this.grid.getNeighbors(startPt.x, startPt.z);
            if (neighbors.length > 0) startPt = { x: neighbors[0].x, z: neighbors[0].z };
        }

        this.log(`📍 Étape ${this.currentStep}/4 : ${stepDef.name} vers Zone ${targetZoneKey}`);

        // Calcul du chemin optimal A* vers la zone cible
        const plan = AStarPlanner.findPath(this.grid, startPt, targetDropPoint);

        if (!plan.success) {
            this.log(`❌ Impossible de rejoindre la Zone ${targetZoneKey} (Voie bloquée)`);
            this.isRunning = false;
            this.updateUI();
            return;
        }

        // Tracé visuel 3D
        if (this.pathVisualizer) {
            this.pathVisualizer.drawPath(plan.path, parseInt(stepDef.badgeColor.replace('#', '0x'), 16));
        }

        // L'AGV s'élance sur la trajectoire
        this.agv.followPath(plan.path, () => {
            this.onStepArrival(targetZoneKey);
        });

        this.updateUI();
    }

    /**
     * Gestionnaire d'arrivée sur la zone cible de l'étape
     */
    onStepArrival(zoneKey) {
        if (!this.isRunning) return;

        switch (this.currentStep) {
            case 1: // Arrivée en Zone A (Stockage)
                this.log("📦 Arrivée en Zone A : Chargement du colis brut...");
                this.agv.loadCargo();
                this.updateUI("📦 Chargement en cours...");

                // Temporisation industrielle de manutention (1.5s)
                setTimeout(() => {
                    if (!this.isRunning) return;
                    this.log("✅ Colis chargé sur le plateau. Cap sur Zone B (Production) !");
                    this.currentStep = 2;
                    this.executeCurrentStep();
                }, 1500);
                break;

            case 2: // Arrivée en Zone B (Production)
                this.log("⚙️ Arrivée en Zone B : Dépose pour usinage CNC...");
                this.agv.unloadCargo();
                this.updateUI("⚙️ Usinage CNC en cours (1.5s)...");

                // Temporisation d'usinage machine puis prise du produit fini
                setTimeout(() => {
                    if (!this.isRunning) return;
                    this.log("📦 Usinage achevé. Chargement du produit fini...");
                    this.agv.loadCargo();

                    setTimeout(() => {
                        if (!this.isRunning) return;
                        this.log("✅ Produit fini chargé. Cap sur Zone C (Expédition) !");
                        this.currentStep = 3;
                        this.executeCurrentStep();
                    }, 1200);
                }, 1500);
                break;

            case 3: // Arrivée en Zone C (Expédition)
                this.log("🚛 Arrivée en Zone C : Dépose du produit fini sur quai...");
                this.agv.unloadCargo();
                this.updateUI("🚛 Dépose quai expédition...");

                // Temporisation de dépose
                setTimeout(() => {
                    if (!this.isRunning) return;
                    this.log("✅ Dépose validée. Retour à la base de recharge (Zone D) !");
                    this.currentStep = 4;
                    this.executeCurrentStep();
                }, 1500);
                break;

            case 4: // Arrivée en Zone D (Recharge)
                this.log("⚡ Arrivée en Zone D : Accostage sur borne à induction.");
                this.agv.setState('CHARGING');
                this.isRunning = false;
                this.currentStep = 0;
                this.log("🏁 CYCLE INDUSTRIEL COMPLET VALIDÉ AVEC SUCCÈS !");
                this.updateUI("🏁 Mission Terminée avec Succès");
                break;
        }
    }

    /**
     * Interrompt le cycle en cours
     */
    stopCycle() {
        this.isRunning = false;
        this.isPaused = false;
        this.currentStep = 0;
        if (this.agv) {
            this.agv.stop();
            this.agv.setState('IDLE');
        }
        this.log("⏹️ Cycle industriel arrêté par l'opérateur.");
        this.updateUI();
    }

    /**
     * Notifie les événements au journal de bord
     */
    log(message) {
        console.log(`[MISSION MANAGER] ${message}`);
        if (this.onEvent) {
            this.onEvent(message);
        }
    }

    /**
     * Mise à jour de l'affichage dans le panneau HUD
     */
    updateUI(customStatus = null) {
        const elStatus = document.getElementById('mission-step-text');
        const elDesc = document.getElementById('mission-desc-text');
        const elProgress = document.getElementById('mission-progress-bar');
        const btnStart = document.getElementById('btn-start-cycle');
        const btnStop = document.getElementById('btn-stop-cycle');

        if (!elStatus) return;

        if (this.isRunning) {
            const stepDef = this.cycleSteps[this.currentStep - 1];
            elStatus.innerHTML = customStatus || `<span style="color: ${stepDef.badgeColor}; font-weight: bold;">Étape ${this.currentStep}/4 : ${stepDef.name}</span>`;
            if (elDesc) elDesc.textContent = stepDef.desc;
            if (elProgress) elProgress.style.width = `${(this.currentStep / 4) * 100}%`;
            if (btnStart) btnStart.disabled = true;
            if (btnStop) btnStop.disabled = false;
        } else {
            elStatus.innerHTML = customStatus || `<span style="color: #94a3b8;">Cycle en attente</span>`;
            if (elDesc) elDesc.textContent = "Prêt à exécuter le scénario officiel : A (Stockage) ➔ B (Production) ➔ C (Expédition) ➔ D (Recharge).";
            if (elProgress) elProgress.style.width = customStatus ? "100%" : "0%";
            if (btnStart) btnStart.disabled = false;
            if (btnStop) btnStop.disabled = true;
        }
    }
}
