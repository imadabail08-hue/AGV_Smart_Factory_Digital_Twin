import base64
import json
import os
import numpy as np
import trimesh

stl_file = r'C:\Users\Windows 10\Documents\PlatformIO\Projects\Comprendre l’algorithme A\agv_smart_factory\models\agv_rescue_swarm.stl'
js_path = r'C:\Users\Windows 10\Documents\PlatformIO\Projects\Comprendre l’algorithme A\agv_smart_factory\js\rescue_swarm_model.js'

print('Loading full CAD STL mesh...')
mesh = trimesh.load(stl_file)

scale = 0.00285
z_min = float(mesh.vertices[:, 2].min())

v = mesh.vertices
f = mesh.faces

# Face centers in CAD
fc = v[f].mean(axis=1)

# Classify faces:
# 0 = Body (Graphite), 1 = Rim (Yellow Security), 2 = Tire (Black Rubber)
mat_idx = np.zeros(len(f), dtype=np.int32)

# Wheel areas: |X| > 105mm and Z < 105mm
is_wheel = (np.abs(fc[:, 0]) > 105.0) & (fc[:, 2] < 105.0)
y_axle = np.where(fc[:, 1] >= 0, 110.0, -110.0)
z_axle = 52.5

# Distance from axle
r = np.sqrt((fc[:, 1] - y_axle)**2 + (fc[:, 2] - z_axle)**2)

is_rim = is_wheel & (r < 37.5)
is_tire = is_wheel & (r >= 37.5)

mat_idx[is_rim] = 1
mat_idx[is_tire] = 2

# Sort faces so that all material 0 faces come first, then 1, then 2
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

print('Groups:', groups)

# Transform vertices to Three.js coordinates
# X = X * scale, Y = (Z - z_min) * scale, Z = Y * scale
tx = v[:, 0] * scale
ty = (v[:, 2] - z_min) * scale
tz = v[:, 1] * scale
transformed_vertices = np.column_stack([tx, ty, tz]).astype(np.float32)

pos_b64 = base64.b64encode(transformed_vertices.tobytes()).decode('ascii')
idx_b64 = base64.b64encode(sorted_faces.tobytes()).decode('ascii')

with open(js_path, 'w', encoding='utf-8') as out:
    out.write('/**\n * MODÈLE CAO MULTI-MATÉRIAUX EXACT DU ROBOT AGV (02_RESCUE_SWARM)\n')
    out.write(' * Matériaux PBR : 0 = Carrosserie Graphite | 1 = Jantes Jaune Sécurité | 2 = Pneus Gomme Noire\n */\n\n')
    out.write('var RESCUE_SWARM_CAD_DATA = {\n')
    out.write(f'    groups: {json.dumps(groups, indent=4)},\n')
    out.write(f'    positionsB64: "{pos_b64}",\n')
    out.write(f'    indicesB64: "{idx_b64}"\n')
    out.write('};\n\n')
    out.write('''function createRescueSwarmCADGeometry() {
    function b64ToUint8(b64) {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }

    const posBytes = b64ToUint8(RESCUE_SWARM_CAD_DATA.positionsB64);
    const idxBytes = b64ToUint8(RESCUE_SWARM_CAD_DATA.indicesB64);

    const positions = new Float32Array(posBytes.buffer);
    const indices = new Uint32Array(idxBytes.buffer);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    // Définition des groupes multi-matériaux (Corps Graphite, Jantes Jaunes, Pneus Noirs)
    RESCUE_SWARM_CAD_DATA.groups.forEach(g => {
        geometry.addGroup(g.start, g.count, g.materialIndex);
    });

    geometry.computeVertexNormals();

    return geometry;
}
''')

print('SUCCESS! Multi-material CAD model generated! Size:', os.path.getsize(js_path), 'bytes')
