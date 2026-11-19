/**
 * AGV SMART FACTORY - PLANIFICATEUR DE TRAJECTOIRE A* (LAB 04)
 * Implémentation formelle haute performance de l'algorithme A* en JavaScript :
 * - Fonction d'évaluation : f(n) = g(n) + h(n)
 * - Heuristique admissible et consistante : Distance de Manhattan (4 directions)
 * - Brise-égalité (Tie-breaking) pour exploration directionnelle directe
 * - File de priorité Min-Heap binaire en O(log N)
 * - Reconstruction optimale du chemin par rebroussement (Backtracking)
 */

class MinHeap {
    constructor(compareFn) {
        this.heap = [];
        this.compare = compareFn || ((a, b) => a.f - b.f);
    }

    size() {
        return this.heap.length;
    }

    isEmpty() {
        return this.heap.length === 0;
    }

    push(item) {
        this.heap.push(item);
        this._siftUp(this.heap.length - 1);
    }

    pop() {
        if (this.isEmpty()) return null;
        const top = this.heap[0];
        const bottom = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = bottom;
            this._siftDown(0);
        }
        return top;
    }

    _siftUp(index) {
        let current = index;
        while (current > 0) {
            const parent = Math.floor((current - 1) / 2);
            if (this.compare(this.heap[current], this.heap[parent]) < 0) {
                [this.heap[current], this.heap[parent]] = [this.heap[parent], this.heap[current]];
                current = parent;
            } else {
                break;
            }
        }
    }

    _siftDown(index) {
        let current = index;
        const length = this.heap.length;
        while (true) {
            let left = 2 * current + 1;
            let right = 2 * current + 2;
            let smallest = current;

            if (left < length && this.compare(this.heap[left], this.heap[smallest]) < 0) {
                smallest = left;
            }
            if (right < length && this.compare(this.heap[right], this.heap[smallest]) < 0) {
                smallest = right;
            }
            if (smallest !== current) {
                [this.heap[current], this.heap[smallest]] = [this.heap[smallest], this.heap[current]];
                current = smallest;
            } else {
                break;
            }
        }
    }
}

class AStarPlanner {
    /**
     * Heuristique de Manhattan pure avec facteur de brise-égalité (Tie-Breaking)
     * h(n) = (|x - targetX| + |z - targetZ|) * (1 + epsilon)
     */
    static heuristicManhattan(x1, z1, x2, z2) {
        const dx = Math.abs(x1 - x2);
        const dz = Math.abs(z1 - z2);
        // Léger facteur 1.001 pour briser les égalités et orienter la recherche en ligne droite
        return (dx + dz) * 1.001;
    }

    /**
     * Génère une clé unique entière pour une cellule (colX, rowZ)
     */
    static cellKey(x, z, width) {
        return z * width + x;
    }

    /**
     * Décode une clé entière en coordonnées { x, z }
     */
    static decodeKey(key, width) {
        return {
            x: key % width,
            z: Math.floor(key / width)
        };
    }

    /**
     * Recherche du chemin optimal A* sur l'Occupancy Grid
     * @param {OccupancyGrid} grid - Matrice 2D navigable
     * @param {{x: number, z: number}} start - Point de départ
     * @param {{x: number, z: number}} goal - Point d'arrivée
     * @param {boolean} allowDiagonals - Autorise ou non les diagonales (défaut: false)
     * @returns {{ success: boolean, path: Array<{x: number, z: number}>, cost: number, nodesExplored: number, timeMs: number }}
     */
    static findPath(grid, start, goal, allowDiagonals = false) {
        const startTime = performance.now();
        const W = grid.width;

        // Normalisation robuste des coordonnées (supporte {x, z} et {colX, rowZ})
        const sX = start.x !== undefined ? start.x : start.colX;
        const sZ = start.z !== undefined ? start.z : start.rowZ;
        const gX = goal.x !== undefined ? goal.x : goal.colX;
        const gZ = goal.z !== undefined ? goal.z : goal.rowZ;

        // Validation des préconditions de sécurité
        if (!grid.isWalkable(sX, sZ)) {
            console.warn(`[A*] Échec : Point de départ (${sX}, ${sZ}) bloqué ou non navigable !`);
            return { success: false, path: [], cost: 0, nodesExplored: 0, timeMs: 0 };
        }
        if (!grid.isWalkable(gX, gZ)) {
            console.warn(`[A*] Échec : Point d'arrivée (${gX}, ${gZ}) bloqué ou non navigable !`);
            return { success: false, path: [], cost: 0, nodesExplored: 0, timeMs: 0 };
        }

        const startKey = this.cellKey(sX, sZ, W);
        const goalKey = this.cellKey(gX, gZ, W);

        // Si départ == arrivée, chemin immédiat
        if (startKey === goalKey) {
            return {
                success: true,
                path: [{ x: sX, z: sZ }],
                cost: 0,
                nodesExplored: 1,
                timeMs: performance.now() - startTime
            };
        }

        // Structures d'état
        const gScores = new Map();
        const cameFrom = new Map();
        const closedSet = new Set();

        // Comparateur Min-Heap : plus petit f en premier, brise-égalité par le plus grand g
        const openHeap = new MinHeap((a, b) => {
            if (Math.abs(a.f - b.f) < 1e-6) {
                return b.g - a.g;
            }
            return a.f - b.f;
        });

        // Initialisation avec le nœud de départ
        const startH = this.heuristicManhattan(sX, sZ, gX, gZ);
        gScores.set(startKey, 0);
        openHeap.push({
            key: startKey,
            x: sX,
            z: sZ,
            g: 0,
            h: startH,
            f: startH
        });

        let nodesExplored = 0;

        // Boucle principale d'exploration A*
        while (!openHeap.isEmpty()) {
            const current = openHeap.pop();

            // Lazy Deletion : si le nœud a déjà été extrait et stabilisé, ignorer l'entrée périmée
            if (closedSet.has(current.key)) {
                continue;
            }

            // Stabilisation du nœud (fermeture)
            closedSet.add(current.key);
            nodesExplored++;

            // Objectif atteint !
            if (current.key === goalKey) {
                const totalCost = gScores.get(goalKey);
                const path = this.reconstructPath(cameFrom, current.key, W);
                const endTime = performance.now();

                return {
                    success: true,
                    path: path,
                    cost: Math.round(totalCost * 100) / 100,
                    nodesExplored: nodesExplored,
                    timeMs: Math.round((endTime - startTime) * 100) / 100
                };
            }

            // Exploration des cellules voisines
            const neighbors = grid.getNeighbors(current.x, current.z, allowDiagonals);

            for (const neighbor of neighbors) {
                const nKey = this.cellKey(neighbor.x, neighbor.z, W);

                if (closedSet.has(nKey)) {
                    continue;
                }

                const tentativeG = current.g + neighbor.cost;
                const recordedG = gScores.has(nKey) ? gScores.get(nKey) : Infinity;

                // Relaxation de l'arête : un meilleur chemin vers ce voisin a été découvert
                if (tentativeG < recordedG) {
                    cameFrom.set(nKey, current.key);
                    gScores.set(nKey, tentativeG);

                    const h = this.heuristicManhattan(neighbor.x, neighbor.z, goal.x, goal.z);
                    const f = tentativeG + h;

                    openHeap.push({
                        key: nKey,
                        x: neighbor.x,
                        z: neighbor.z,
                        g: tentativeG,
                        f: f
                    });
                }
            }
        }

        // Aucun chemin existant (espace cloisonné par des obstacles)
        return {
            success: false,
            path: [],
            cost: Infinity,
            nodesExplored: nodesExplored,
            timeMs: performance.now() - startTime
        };
    }

    /**
     * Reconstitution du chemin optimal du départ au but par rebroussement (Backtracking)
     */
    static reconstructPath(cameFrom, currentKey, width) {
        const path = [];
        let curr = currentKey;

        while (curr !== undefined) {
            path.push(this.decodeKey(curr, width));
            curr = cameFrom.get(curr);
        }

        return path.reverse();
    }
}
