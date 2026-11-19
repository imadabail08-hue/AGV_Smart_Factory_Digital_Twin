/**
 * AGV SMART FACTORY - APPLICATION PRINCIPALE (LAB 01 à LAB 07)
 * Rendu 60 FPS, modèle CAO AGV, Occupancy Grid, Moteur A*, Visualiseur 3D & Obstacles Dynamiques
 */

let factory = null;
let agv = null;
let grid = null;
let pathVisualizer = null;
let obstacleManager = null;
let missionManager = null;
let animationFrameId = null;

let isEditObstacleMode = false;
let lastComputedPath = null;

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('scene-container');
    if (!container) {
        console.error("Erreur : #scene-container introuvable dans le DOM.");
        return;
    }

    // 1. Environnement usine 3D (LAB 01)
    factory = new FactoryEnvironment(container);
    console.log("🏭 Usine 3D initialisée.");

    // 2. Matrice d'occupation 2D (LAB 03)
    grid = new OccupancyGrid(factory.scene);
    console.log("🗺️ Matrice d'occupation (Occupancy Grid) initialisée.");

    // 3. Visualiseur de chemin 3D (LAB 05)
    pathVisualizer = new PathVisualizer(factory.scene);
    console.log("✨ Visualiseur de trajectoire 3D initialisé.");

    // 4. Robot AGV mécatronique (LAB 02, LAB 06 & LAB 07)
    agv = new AGVRobot(factory.scene, { x: 3, z: 3 });
    console.log("🤖 Robot AGV initialisé en Zone D.");

    // 5. Gestionnaire d'obstacles dynamiques (LAB 07)
    obstacleManager = new DynamicObstacleManager(factory.scene, grid);
    console.log("⚠️ Gestionnaire d'obstacles dynamiques initialisé.");

    // 5b. Gestionnaire de missions et cycle industriel complet (LAB 09)
    missionManager = new MissionManager(agv, grid, pathVisualizer, (eventMsg) => {
        addTelemetryLog(eventMsg);
    });
    console.log("🏭 Gestionnaire de cycle industriel (FSM LAB 09) initialisé.");

    // 5c. Branchement de la télémétrie en temps réel (LAB 10)
    agv.onTelemetryUpdate = (data) => {
        updateTelemetryUI(data);
    };

    // 6. Démarrage de la boucle de rendu 60 FPS
    let lastTime = performance.now();
    function animate() {
        animationFrameId = requestAnimationFrame(animate);

        const now = performance.now();
        const deltaTime = (now - lastTime) / 1000;
        lastTime = now;

        // Mise à jour de l'AGV (avec scan LiDAR), du tracé 3D et des obstacles dynamiques
        if (agv) agv.update(deltaTime, grid);
        if (pathVisualizer) pathVisualizer.update(deltaTime);
        if (obstacleManager) obstacleManager.update(deltaTime);

        // Rendu Three.js
        factory.render();
    }
    animate();

    // 7. Configuration des contrôles et de l'interactivité
    setupCameraControls();
    setupAGVManualControls();
    setupGridControls();
    setupAStarControls();
    setupDynamicObstacleControls();
    setupLAB08ReplanningControls();
    setupMissionControls();
    setupTelemetrySystem();

    // 8. Mise à jour de la télémétrie initiale
    updateTelemetry();
    updateGridStatsUI();
});

function setupCameraControls() {
    const viewButtons = document.querySelectorAll('.view-btn');
    viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            viewButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const view = btn.getAttribute('data-view');
            factory.setCameraView(view);
        });
    });

    const zoneButtons = document.querySelectorAll('.zone-btn');
    zoneButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const zoneKey = btn.getAttribute('data-zone');
            factory.setCameraView(zoneKey);
        });
    });

    const agvFocusBtn = document.getElementById('btn-focus-agv');
    if (agvFocusBtn) {
        agvFocusBtn.addEventListener('click', () => {
            if (agv && factory) {
                const pos = agv.mesh.position;
                factory.camera.position.set(pos.x, pos.y + 5, pos.z + 6);
                factory.controls.target.set(pos.x, pos.y, pos.z);
                factory.controls.update();
            }
        });
    }
}

function setupAGVManualControls() {
    const btnLoad = document.getElementById('btn-cargo-load');
    const btnUnload = document.getElementById('btn-cargo-unload');
    const btnRotate = document.getElementById('btn-agv-rotate');
    const btnAlert = document.getElementById('btn-agv-alert');
    const btnNormal = document.getElementById('btn-agv-normal');

    if (btnLoad) {
        btnLoad.addEventListener('click', () => {
            agv.loadCargo();
            updateAGVStatusUI("Colis Chargé sur la plaque");
        });
    }

    if (btnUnload) {
        btnUnload.addEventListener('click', () => {
            agv.unloadCargo();
            updateAGVStatusUI("Colis Déchargé");
        });
    }

    if (btnRotate) {
        let currentAngle = 0;
        btnRotate.addEventListener('click', () => {
            currentAngle += Math.PI / 2;
            agv.setRotation(currentAngle);
            updateAGVStatusUI(`Orientation : ${Math.round((currentAngle * 180 / Math.PI) % 360)}°`);
        });
    }

    if (btnAlert) {
        btnAlert.addEventListener('click', () => {
            agv.setState('BLOCKED');
            agv.setLiDARAlarm(true);
            updateAGVStatusUI("État : BLOCKED (Urgence)");
        });
    }

    if (btnNormal) {
        btnNormal.addEventListener('click', () => {
            agv.setState('IDLE');
            agv.setLiDARAlarm(false);
            updateAGVStatusUI("État : IDLE (Prêt)");
        });
    }
}

function setupGridControls() {
    const btnToggleGrid = document.getElementById('btn-toggle-grid');
    const btnEditObstacle = document.getElementById('btn-edit-obstacle');

    if (btnToggleGrid) {
        btnToggleGrid.addEventListener('click', () => {
            const isVisible = grid.toggleOverlayVisibility();
            btnToggleGrid.textContent = isVisible ? "👁️ Calque Grille (ON)" : "🕶️ Calque Grille (OFF)";
            btnToggleGrid.className = isVisible ? "action-btn success" : "action-btn";
        });
    }

    if (btnEditObstacle) {
        btnEditObstacle.addEventListener('click', () => {
            isEditObstacleMode = !isEditObstacleMode;
            btnEditObstacle.className = isEditObstacleMode ? "action-btn danger" : "action-btn";
            btnEditObstacle.textContent = isEditObstacleMode ? "🛑 Mode Clic Actif" : "✏️ Mode Obstacle";
            
            const cursorInfo = document.getElementById('cell-cursor-info');
            if (cursorInfo) {
                cursorInfo.textContent = isEditObstacleMode ? "Cliquez sur une case pour poser/enlever un obstacle" : "Cliquez sur une case pour inspecter";
            }
        });
    }

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };

    window.addEventListener('pointerdown', (e) => {
        downPos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('pointerup', (e) => {
        const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
        if (dist > 5) return;

        const rect = factory.renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, factory.camera);

        const intersects = raycaster.intersectObjects(grid.overlayGroup.children);
        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const gx = hitMesh.userData.gridX;
            const gz = hitMesh.userData.gridZ;

            if (gx !== undefined && gz !== undefined) {
                if (isEditObstacleMode) {
                    if (grid.isWalkable(gx, gz)) {
                        obstacleManager.spawnObstacle(gx, gz);
                    } else {
                        obstacleManager.removeObstacle(gx, gz);
                    }
                    updateGridStatsUI();
                }

                const isWalkable = grid.isWalkable(gx, gz);
                const cursorInfo = document.getElementById('cell-cursor-info');
                if (cursorInfo) {
                    cursorInfo.innerHTML = `Case <strong>(${gx}, ${gz})</strong> : <span style="color: ${isWalkable ? '#10b981' : '#ef4444'}; font-weight: bold;">${isWalkable ? 'LIBRE' : 'OBSTACLE'}</span>`;
                }
            }
        }
    });
}

function updateGridStatsUI() {
    const stats = grid.getStats();
    const elStats = document.getElementById('grid-stats-text');
    if (elStats) {
        elStats.innerHTML = `<span style="color: #34d399;">${stats.free} libres</span> / <span style="color: #f87171;">${stats.blocked} bloquées</span>`;
    }
}

/**
 * Contrôles interactifs LAB 04 (Calcul A*), LAB 05 (Tracé 3D) & LAB 06 (Mouvement autonome)
 */
function setupAStarControls() {
    const btnRunAStar = document.getElementById('btn-run-astar');
    const btnClearPath = document.getElementById('btn-clear-path');
    const btnStartMove = document.getElementById('btn-start-move');
    const btnStopMove = document.getElementById('btn-stop-move');
    const selectStart = document.getElementById('select-start-zone');
    const selectGoal = document.getElementById('select-goal-zone');

    function calculatePath() {
        const startZoneKey = selectStart.value;
        const goalZoneKey = selectGoal.value;

        const startPt = CONFIG.ZONES[startZoneKey].dropPoint;
        const goalPt = CONFIG.ZONES[goalZoneKey].dropPoint;

        console.log(`[A*] Calcul : Zone ${startZoneKey} (${startPt.x}, ${startPt.z}) -> Zone ${goalZoneKey} (${goalPt.x}, ${goalPt.z})`);

        const result = AStarPlanner.findPath(grid, startPt, goalPt);

        const elStatus = document.getElementById('astar-status-text');
        const elCost = document.getElementById('astar-cost-text');
        const elNodes = document.getElementById('astar-nodes-text');
        const elTime = document.getElementById('astar-time-text');

        if (result.success) {
            lastComputedPath = result.path;
            const distanceMeters = (result.cost * CONFIG.CELL_SIZE).toFixed(1);
            if (elStatus) elStatus.innerHTML = `<span style="color: #10b981;">✅ Chemin Optimal Tracé</span>`;
            if (elCost) elCost.innerHTML = `<strong>${result.cost} cases</strong> (${distanceMeters} m)`;
            if (elNodes) elNodes.innerHTML = `<strong>${result.nodesExplored}</strong> extractions Min-Heap`;
            if (elTime) elTime.innerHTML = `<strong>${result.timeMs} ms</strong>`;

            // LAB 05 : Tracé 3D du ruban lumineux dans l'usine
            if (pathVisualizer) {
                pathVisualizer.drawPath(result.path);
            }

            // Positionne l'AGV au départ et aligne son cap sur la première étape
            if (agv) {
                agv.setGridPosition(startPt.x, startPt.z);
                if (result.path.length >= 2) {
                    const p0 = GridCoords.gridToWorld(result.path[0].x, result.path[0].z, 0);
                    const p1 = GridCoords.gridToWorld(result.path[1].x, result.path[1].z, 0);
                    const initialHeading = Math.atan2(p1.x - p0.x, p1.z - p0.z);
                    agv.setRotation(initialHeading);
                }
                updateAGVStatusUI(`Prêt au départ (Zone ${startZoneKey})`);
            }
        } else {
            lastComputedPath = null;
            if (elStatus) elStatus.innerHTML = `<span style="color: #ef4444;">❌ Aucun chemin (Cloisonné)</span>`;
            if (elCost) elCost.textContent = `--`;
            if (elNodes) elNodes.textContent = `${result.nodesExplored} explorés`;
            if (elTime) elTime.textContent = `${result.timeMs} ms`;

            if (pathVisualizer) {
                pathVisualizer.clearPath();
            }
        }

        return result;
    }

    if (btnRunAStar) {
        btnRunAStar.addEventListener('click', calculatePath);
    }

    // LAB 06 : Démarrage du mouvement autonome de l'AGV
    if (btnStartMove) {
        btnStartMove.addEventListener('click', () => {
            if (!lastComputedPath || lastComputedPath.length < 2) {
                const res = calculatePath();
                if (!res || !res.success) return;
            }

            if (agv && lastComputedPath) {
                const goalZoneKey = selectGoal.value;
                updateAGVStatusUI(`En déplacement vers Zone ${goalZoneKey}...`);

                // Feedback sur la progression étape par étape
                agv.onWaypointReached = (idx, total, currentGrid) => {
                    updateAGVStatusUI(`En transit : étape ${idx}/${total} (case ${currentGrid.colX}, ${currentGrid.rowZ})`);
                };

                // Lancement de la navigation physique le long des waypoints A*
                agv.followPath(lastComputedPath, () => {
                    updateAGVStatusUI(`🏁 Arrivée en Zone ${goalZoneKey} réussie !`);
                    const elStatus = document.getElementById('astar-status-text');
                    if (elStatus) {
                        elStatus.innerHTML = `<span style="color: #10b981; font-weight: bold;">🏁 Mission Accomplie</span>`;
                    }
                });
            }
        });
    }

    if (btnStopMove) {
        btnStopMove.addEventListener('click', () => {
            if (agv) {
                agv.stopNavigation();
                updateAGVStatusUI("⏹️ Navigation stoppée");
            }
        });
    }

    if (btnClearPath) {
        btnClearPath.addEventListener('click', () => {
            if (pathVisualizer) pathVisualizer.clearPath();
            lastComputedPath = null;
            const elStatus = document.getElementById('astar-status-text');
            if (elStatus) elStatus.innerHTML = `<span style="color: #94a3b8;">Tracé effacé</span>`;
        });
    }
}

/**
 * Contrôles interactifs LAB 07 : Simulation d'aléas industriels et capteur LiDAR
 */
function setupDynamicObstacleControls() {
    const btnSpawnObstacle = document.getElementById('btn-spawn-obstacle');
    const btnClearObstacles = document.getElementById('btn-clear-obstacles');
    const alertBanner = document.getElementById('obstacle-alert-banner');

    if (btnSpawnObstacle) {
        btnSpawnObstacle.addEventListener('click', () => {
            if (agv && agv.isNavigating) {
                // Fait apparaître l'obstacle 2 pas devant l'AGV en déplacement
                const obs = obstacleManager.spawnObstacleOnAGVPath(agv, 2);
                if (obs) {
                    updateAGVStatusUI("⚠️ Aléas : Couloir bloqué devant l'AGV !");
                    updateGridStatsUI();
                }
            } else if (lastComputedPath && lastComputedPath.length > 3) {
                // Fait apparaître au milieu de la trajectoire prévue
                const midIdx = Math.floor(lastComputedPath.length / 2);
                const pt = lastComputedPath[midIdx];
                obstacleManager.spawnObstacle(pt.x, pt.z);
                updateAGVStatusUI(`⚠️ Obstacle posé sur le couloir (${pt.x}, ${pt.z})`);
                updateGridStatsUI();
            } else {
                // Obstacle par défaut dans un couloir principal
                obstacleManager.spawnObstacle(11, 8);
                updateAGVStatusUI("⚠️ Obstacle dynamique posé en case (11, 8)");
                updateGridStatsUI();
            }
        });
    }

    if (btnClearObstacles) {
        btnClearObstacles.addEventListener('click', () => {
            if (obstacleManager) {
                obstacleManager.clearAll();
                updateGridStatsUI();
                updateAGVStatusUI("🧹 Obstacles retirés · Couloirs dégagés");
                if (alertBanner) alertBanner.style.display = 'none';
                if (agv && agv.state === 'BLOCKED') {
                    agv.setState('IDLE');
                    agv.setLiDARAlarm(false);
                }
            }
        });
    }

    // Réaction réflexe de l'AGV lors de la détection LiDAR (LAB 07 & LAB 08)
    if (agv) {
        agv.onObstacleDetected = (blockedCell, dist) => {
            updateAGVStatusUI(`🚨 ARRÊT D'URGENCE : Obstacle LiDAR à ${dist.toFixed(1)}m (case ${blockedCell.colX}, ${blockedCell.rowZ})`);
            
            if (alertBanner) {
                alertBanner.style.display = 'block';
                alertBanner.style.background = "rgba(239, 68, 68, 0.2)";
                alertBanner.style.borderColor = "#ef4444";
                alertBanner.style.color = "#fca5a5";
                alertBanner.innerHTML = `🚨 <strong>ARRÊT D'URGENCE (ISO 3691-4)</strong> : Obstacle détecté par LiDAR à ${dist.toFixed(1)} m en case (${blockedCell.colX}, ${blockedCell.rowZ}) !`;
            }

            const elStatus = document.getElementById('astar-status-text');
            if (elStatus) {
                elStatus.innerHTML = `<span style="color: #ef4444; font-weight: bold;">🚨 Arrêt d'Urgence LiDAR (LAB 07)</span>`;
            }

            // LAB 08 : Replanning automatique si activé
            const chkAuto = document.getElementById('chk-auto-replan');
            if (chkAuto && chkAuto.checked) {
                const elReplanStatus = document.getElementById('replan-status-text');
                if (elReplanStatus) {
                    elReplanStatus.innerHTML = `<span style="color: #f59e0b;">⏳ Analyse d'évitement en cours...</span>`;
                }

                // Délai réflexe de sécurité (800ms) simulant la prise de décision
                setTimeout(() => {
                    if (agv.state === 'BLOCKED') {
                        replanPath();
                    }
                }, 800);
            }
        };
    }
}

/**
 * LAB 08 : REPLANNING DYNAMIQUE A* (RECALCUL SANS TÉLÉPORTATION)
 */
function replanPath() {
    if (!agv) return false;

    // 1. Détermination de la cellule de départ : position réelle courante de l'AGV
    const currentGrid = GridCoords.worldToGrid(agv.mesh.position.x, agv.mesh.position.z);
    agv.gridPos = { x: currentGrid.colX, z: currentGrid.rowZ, colX: currentGrid.colX, rowZ: currentGrid.rowZ };
    let startPt = { x: currentGrid.colX, z: currentGrid.rowZ };

    // Sécurité anti-blocage : si la case est considérée bloquée, sélectionner le voisin libre le plus proche
    if (!grid.isWalkable(startPt.x, startPt.z)) {
        const neighbors = grid.getNeighbors(startPt.x, startPt.z);
        if (neighbors.length > 0) {
            startPt = { x: neighbors[0].x, z: neighbors[0].z };
        }
    }

    // 2. Détermination de la cible (Zone d'arrivée de la mission)
    let goalZoneKey = 'B';
    if (missionManager && missionManager.isRunning) {
        goalZoneKey = missionManager.getCurrentTargetZone() || 'B';
    } else {
        const selectGoal = document.getElementById('select-goal-zone');
        goalZoneKey = selectGoal ? selectGoal.value : 'B';
    }
    const goalPt = CONFIG.ZONES[goalZoneKey].dropPoint;

    console.log(`🔄 [LAB 08 - REPLANNING] Recalcul depuis la case courante (${startPt.x}, ${startPt.z}) vers Zone ${goalZoneKey}...`);

    const elReplanStatus = document.getElementById('replan-status-text');
    const elReplanMetric = document.getElementById('replan-metric-text');

    if (elReplanStatus) {
        elReplanStatus.innerHTML = `<span style="color: #38bdf8;">Calcul du détour A* en cours...</span>`;
    }

    const t0 = performance.now();
    const rerouteResult = AStarPlanner.findPath(grid, startPt, goalPt);
    const replanTimeMs = (performance.now() - t0).toFixed(2);

    if (rerouteResult.success) {
        lastComputedPath = rerouteResult.path;
        const distMeters = (rerouteResult.cost * CONFIG.CELL_SIZE).toFixed(1);

        // 1. Dessine le nouveau chemin de contournement (Vert Émeraude validation)
        if (pathVisualizer) {
            pathVisualizer.drawPath(rerouteResult.path, 0x10b981);
        }

        // 2. Met à jour l'IHM
        if (elReplanStatus) {
            elReplanStatus.innerHTML = `<span style="color: #10b981; font-weight: bold;">✅ Contournement Actif</span>`;
        }
        if (elReplanMetric) {
            elReplanMetric.innerHTML = `Détour : <strong>${rerouteResult.cost} cases</strong> (${distMeters} m) en <strong>${replanTimeMs} ms</strong> [${rerouteResult.nodesExplored} extractions]`;
        }

        updateAGVStatusUI(`🔄 Déviation engagée vers Zone ${goalZoneKey} (${rerouteResult.cost} cases)`);

        // 3. Masque l'alerte d'urgence
        const alertBanner = document.getElementById('obstacle-alert-banner');
        if (alertBanner) {
            alertBanner.innerHTML = `🔄 <strong>DÉTOURNEMENT ENGAGÉ (LAB 08)</strong> : Trajectoire alternative calculée en ${replanTimeMs} ms sans collision.`;
            alertBanner.style.background = "rgba(16, 185, 129, 0.2)";
            alertBanner.style.borderColor = "#10b981";
            alertBanner.style.color = "#6ee7b7";
        }

        // 4. L'AGV se remet en route immédiatement sans téléportation
        agv.setLiDARAlarm(false);
        agv.followPath(rerouteResult.path, () => {
            updateAGVStatusUI(`🏁 Arrivée en Zone ${goalZoneKey} réussie après contournement !`);
            const elStatus = document.getElementById('astar-status-text');
            if (elStatus) {
                elStatus.innerHTML = `<span style="color: #10b981; font-weight: bold;">🏁 Mission Accomplie (Contournement)</span>`;
            }

            // Si un cycle multi-étapes est en cours, passer à l'étape suivante !
            if (missionManager && missionManager.isRunning) {
                missionManager.onStepArrival(goalZoneKey);
            }
        });

        return true;
    } else {
        console.error("❌ Aucun chemin de contournement trouvé (couloir cloisonné).");
        if (elReplanStatus) {
            elReplanStatus.innerHTML = `<span style="color: #ef4444; font-weight: bold;">❌ Aucun itinéraire</span>`;
        }
        if (elReplanMetric) {
            elReplanMetric.innerHTML = `Couloir totalement fermé (0 solution A*)`;
        }
        updateAGVStatusUI("❌ Cloisonné : Impossible de contourner l'obstacle.");
        return false;
    }
}

function setupLAB08ReplanningControls() {
    const btnManualReplan = document.getElementById('btn-manual-replan');
    if (btnManualReplan) {
        btnManualReplan.addEventListener('click', () => {
            replanPath();
        });
    }
}

function updateAGVStatusUI(statusText) {
    const el = document.getElementById('agv-live-status');
    if (el) {
        el.textContent = statusText;
    }
}

function updateTelemetry() {
    const elNodes = document.getElementById('stat-objects');
    if (elNodes && factory) {
        elNodes.textContent = factory.scene.children.length;
    }
}

/**
 * LAB 09 : Contrôles du Cycle Industriel Complet (A -> B -> C -> D)
 */
function setupMissionControls() {
    const btnStartCycle = document.getElementById('btn-start-cycle');
    const btnStopCycle = document.getElementById('btn-stop-cycle');

    if (btnStartCycle) {
        btnStartCycle.addEventListener('click', () => {
            if (missionManager) {
                startTelemetryTimer();
                missionManager.startFullCycle();
            }
        });
    }

    if (btnStopCycle) {
        btnStopCycle.addEventListener('click', () => {
            if (missionManager) {
                missionManager.stopCycle();
                stopTelemetryTimer();
            }
        });
    }
}

/**
 * LAB 10 : Supervision, Télémétrie en Direct et Journal d'Audit
 */
let missionStartTime = null;
let telemetryTimerInterval = null;

function setupTelemetrySystem() {
    addTelemetryLog("Système de supervision initialisé · Prêt");
}

function startTelemetryTimer() {
    if (telemetryTimerInterval) clearInterval(telemetryTimerInterval);
    missionStartTime = Date.now();
    telemetryTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - missionStartTime) / 1000);
        const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const secs = String(elapsed % 60).padStart(2, '0');
        const elTimer = document.getElementById('telemetry-timer-text');
        if (elTimer) elTimer.textContent = `${mins}:${secs}`;
    }, 1000);
}

function stopTelemetryTimer() {
    if (telemetryTimerInterval) {
        clearInterval(telemetryTimerInterval);
        telemetryTimerInterval = null;
    }
}

function updateTelemetryUI(data) {
    const elBatteryPct = document.getElementById('telemetry-battery-pct');
    const elBatteryBar = document.getElementById('telemetry-battery-bar');
    const elOdometer = document.getElementById('telemetry-odometer-text');

    if (elBatteryPct && elBatteryBar) {
        const pct = Math.max(0, Math.min(100, data.battery)).toFixed(1);
        elBatteryPct.textContent = `${pct} %`;
        elBatteryBar.style.width = `${pct}%`;

        // Alerte colorée selon le niveau de charge
        if (pct < 20) {
            elBatteryBar.style.background = '#ef4444'; // Rouge critique
            elBatteryPct.style.color = '#ef4444';
        } else if (pct < 50) {
            elBatteryBar.style.background = '#f59e0b'; // Ambre avertissement
            elBatteryPct.style.color = '#f59e0b';
        } else {
            elBatteryBar.style.background = '#22c55e'; // Vert nominal
            elBatteryPct.style.color = '#22c55e';
        }

        if (data.state === 'CHARGING') {
            elBatteryPct.innerHTML = `⚡ ${pct} % (Charge...)`;
            elBatteryPct.style.color = '#06b6d4';
            elBatteryBar.style.background = '#06b6d4';
        }
    }

    if (elOdometer) {
        elOdometer.textContent = `${data.odometer.toFixed(1)} m`;
    }
}

function addTelemetryLog(msg) {
    const stream = document.getElementById('telemetry-log-stream');
    if (!stream) return;

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const logItem = document.createElement('div');
    logItem.innerHTML = `<span style="color: #64748b;">[${timeStr}]</span> ${msg}`;
    stream.appendChild(logItem);
    stream.scrollTop = stream.scrollHeight;
}
