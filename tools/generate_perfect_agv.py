import json
import base64
import os
import numpy as np

stl_file = r'agv_smart_factory/models/agv_rescue_swarm.stl'

print("1. Lecture du fichier STL mécatronique...")
vertices = []
with open(stl_file, 'r') as f:
    for line in f:
        if line.strip().startswith('vertex'):
            parts = line.split()
            vertices.append([float(parts[1]), float(parts[2]), float(parts[3])])

v = np.array(vertices, dtype=np.float32)
f = np.arange(len(v), dtype=np.uint32).reshape(-1, 3)

fc = v[f].mean(axis=1) # centres des facettes en coordonnées CAO

# 4 roues en CAO : |Y| > 118 mm et Z < 105 mm
is_wheel = (np.abs(fc[:, 1]) > 118.0) & (fc[:, 2] < 105.0)

x_c = np.where(fc[:, 0] >= 0, 120.0, -120.0)
z_c = 55.6
r = np.sqrt((fc[:, 0] - x_c)**2 + (fc[:, 2] - z_c)**2)

# Découpe ultra-précise Jante vs Pneu :
# Jante = disque central de rayon < 36.0 mm
# Pneu = bande de roulement externe et crampons tout-terrain
is_rim = is_wheel & (r < 36.0)
is_tire = is_wheel & (r >= 36.0)

mat_idx = np.zeros(len(f), dtype=np.int32)
mat_idx[is_rim] = 1   # 1 = Jante Jaune Sécurité
mat_idx[is_tire] = 2  # 2 = Gomme Noire

# Tri des triangles pour regroupement multi-matériaux
order = np.argsort(mat_idx)
sorted_faces = f[order].astype(np.uint32)

body_count = int((mat_idx == 0).sum() * 3)
rim_count = int((mat_idx == 1).sum() * 3)
tire_count = int((mat_idx == 2).sum() * 3)

groups = [
    {'start': 0, 'count': body_count, 'materialIndex': 0, 'name': 'Body_Graphite'},
    {'start': body_count, 'count': rim_count, 'materialIndex': 1, 'name': 'Rim_Yellow'},
    {'start': body_count + rim_count, 'count': tire_count, 'materialIndex': 2, 'name': 'Tire_Black'}
]

print("Groupes créés :", groups)

scale = 0.00285
z_min = float(v[:, 2].min())

# Transformation rigide orthonormée directe (Det = +1, aucun reflet) :
# CAD +X (Avant du robot) -> Three.js +Z (Axe de marche principal)
# CAD +Z (Haut du robot)  -> Three.js +Y (Hauteur verticale)
# CAD +Y (Gauche/Droite)  -> Three.js +X (Largeur de voie)
tx = v[:, 1] * scale
ty = (v[:, 2] - z_min) * scale + 0.02
tz = v[:, 0] * scale

transformed_vertices = np.column_stack([tx, ty, tz]).astype(np.float32)

pos_b64 = base64.b64encode(transformed_vertices.tobytes()).decode('ascii')
idx_b64 = base64.b64encode(sorted_faces.tobytes()).decode('ascii')

js_content = f'''/**
 * MODÈLE CAO MULTI-MATÉRIAUX EXACT DU ROBOT AGV (02_RESCUE_SWARM)
 * Matériaux PBR : 0 = Carrosserie Graphite | 1 = Jantes Jaune Sécurité | 2 = Pneus Gomme Noire
 * Orientation cinématique corrigée : Roues alignées avec l'axe de trajectoire Z
 */

var RESCUE_SWARM_CAD_DATA = {{
    groups: {json.dumps(groups, indent=4)},
    bounds: {{
        width: {round(float(tx.max() - tx.min()), 3)},
        height: {round(float(ty.max() - ty.min()), 3)},
        length: {round(float(tz.max() - tz.min()), 3)}
    }},
    positionsB64: "{pos_b64}",
    indicesB64: "{idx_b64}"
}};

function createRescueSwarmCADGeometry() {{
    function b64ToUint8(b64) {{
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }}

    const posBytes = b64ToUint8(RESCUE_SWARM_CAD_DATA.positionsB64);
    const idxBytes = b64ToUint8(RESCUE_SWARM_CAD_DATA.indicesB64);

    const positions = new Float32Array(posBytes.buffer);
    const indices = new Uint32Array(idxBytes.buffer);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    // Définition des groupes multi-matériaux
    RESCUE_SWARM_CAD_DATA.groups.forEach(g => {{
        geometry.addGroup(g.start, g.count, g.materialIndex);
    }});

    geometry.computeVertexNormals();

    return geometry;
}}
'''

targets = [
    r'agv_smart_factory/js/rescue_swarm_model.js',
    r'C:\Users\Windows 10\Documents\PlatformIO\Projects\labs\agv_smart_factory\js\rescue_swarm_model.js'
]

for t in targets:
    os.makedirs(os.path.dirname(t), exist_ok=True)
    with open(t, 'w', encoding='utf-8') as out:
        out.write(js_content)
    print(f"Généré : {t} ({os.path.getsize(t)} octets)")

print("SUCCÈS TOTAL !")
