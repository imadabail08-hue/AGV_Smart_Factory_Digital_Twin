/**
 * AGV SMART FACTORY - CONFIGURATION GLOBALE
 * Système de coordonnées, dimensions usine, zones logistiques et implantation
 */

const CONFIG = {
    // Dimensions de la grille discrète (Occupancy Grid)
    GRID_WIDTH: 24,    // 24 colonnes (axe X)
    GRID_HEIGHT: 16,   // 16 lignes (axe Z)
    CELL_SIZE: 1.5,    // Chaque cellule mesure 1.5m x 1.5m en unités 3D

    // Palette de couleurs industrielles des Zones
    COLORS: {
        floor: 0x1e2430,         // Sol béton industriel époxy foncé
        gridLines: 0x334155,     // Lignes du quadrillage
        corridor: 0x0f172a,      // Voies de circulation logistiques
        
        // Les 5 Zones officielles (Consigne p. 1-2)
        zoneA: 0x0284c7, // Stockage (Bleu logistique)
        zoneB: 0x10b981, // Production (Vert industrie)
        zoneC: 0xf59e0b, // Expédition (Ambre / Orange logistique)
        zoneD: 0x06b6d4, // Recharge (Cyan / Électrique)
        zoneE: 0x8b5cf6, // Maintenance (Violet diagnostic)

        rackMetal: 0x475569,     // Métal gris rayonnages
        rackBeam: 0xd97706,      // Poutres de charge orange sécurité
        palletWood: 0x92400e,    // Bois palettes
        boxCardboard: 0xd97706,  // Cartons emballés
        machineBody: 0x334155,   // Bâti machines
        machineAccent: 0x22c55e  // Voyants machines
    },

    // Définition spatiale des 5 Zones officielles (coordonnées grille [colX, rowZ])
    ZONES: {
        A: {
            id: 'A',
            name: 'Stockage',
            description: 'Récupération virtuelle des colis & racks palettes',
            color: 0x0284c7,
            hex: '#0284c7',
            bounds: { xMin: 7, xMax: 12, zMin: 1, zMax: 3 },
            dropPoint: { x: 10, z: 3 }, // Point d'accès AGV
            icon: '📦'
        },
        B: {
            id: 'B',
            name: 'Production',
            description: 'Livraison aux machines & postes d’usinage',
            color: 0x10b981,
            hex: '#10b981',
            bounds: { xMin: 18, xMax: 22, zMin: 7, zMax: 11 },
            dropPoint: { x: 18, z: 9 }, // Point d'accès AGV
            icon: '⚙️'
        },
        C: {
            id: 'C',
            name: 'Expédition',
            description: 'Transport & dépose des produits finis sur quai',
            color: 0xf59e0b,
            hex: '#f59e0b',
            bounds: { xMin: 8, xMax: 13, zMin: 12, zMax: 14 },
            dropPoint: { x: 10, z: 12 }, // Point d'accès AGV
            icon: '🚛'
        },
        D: {
            id: 'D',
            name: 'Recharge',
            description: 'Retour automatique & recharge induction de la batterie',
            color: 0x06b6d4,
            hex: '#06b6d4',
            bounds: { xMin: 1, xMax: 4, zMin: 1, zMax: 3 },
            dropPoint: { x: 3, z: 3 }, // Point d'accès AGV
            icon: '⚡'
        },
        E: {
            id: 'E',
            name: 'Maintenance',
            description: 'Intervention, banc de test & diagnostic AGV',
            color: 0x8b5cf6,
            hex: '#8b5cf6',
            bounds: { xMin: 2, xMax: 5, zMin: 11, zMax: 13 },
            dropPoint: { x: 4, z: 11 }, // Point d'accès AGV
            icon: '🛠️'
        }
    },

    // Emplacement des blocs de rayonnages fixes (obstacles permanents de l'entrepôt)
    RACKS: [
        // Racks du bloc central supérieur
        { x: 14, z: 2, w: 3, d: 2 },
        // Racks allée centrale gauche
        { x: 2,  z: 5, w: 2, d: 4 },
        { x: 5,  z: 5, w: 2, d: 4 },
        // Racks allée centrale milieu
        { x: 9,  z: 6, w: 2, d: 4 },
        { x: 12, z: 6, w: 2, d: 4 },
        // Racks secteur droit
        { x: 15, z: 5, w: 2, d: 5 }
    ]
};

// Fonctions utilitaires de projection spatiale 3D <-> Grille 2D
const GridCoords = {
    /**
     * Convertit une coordonnée discrète (colX, rowZ) en position 3D dans Three.js
     */
    gridToWorld(colX, rowZ, heightY = 0) {
        const originX = - (CONFIG.GRID_WIDTH * CONFIG.CELL_SIZE) / 2;
        const originZ = - (CONFIG.GRID_HEIGHT * CONFIG.CELL_SIZE) / 2;
        return {
            x: originX + (colX + 0.5) * CONFIG.CELL_SIZE,
            y: heightY,
            z: originZ + (rowZ + 0.5) * CONFIG.CELL_SIZE
        };
    },

    /**
     * Convertit une position 3D (X, Z) en case de grille (colX, rowZ)
     */
    worldToGrid(worldX, worldZ) {
        const originX = - (CONFIG.GRID_WIDTH * CONFIG.CELL_SIZE) / 2;
        const originZ = - (CONFIG.GRID_HEIGHT * CONFIG.CELL_SIZE) / 2;
        const colX = Math.floor((worldX - originX) / CONFIG.CELL_SIZE);
        const rowZ = Math.floor((worldZ - originZ) / CONFIG.CELL_SIZE);
        const cx = Math.max(0, Math.min(CONFIG.GRID_WIDTH - 1, colX));
        const rz = Math.max(0, Math.min(CONFIG.GRID_HEIGHT - 1, rowZ));
        return {
            colX: cx,
            rowZ: rz,
            x: cx,
            z: rz
        };
    }
};
