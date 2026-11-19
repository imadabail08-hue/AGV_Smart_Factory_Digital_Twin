import base64
import os
import numpy as np
import trimesh

stl_file = r'C:\Users\Windows 10\Documents\PlatformIO\Projects\Comprendre l’algorithme A\agv_smart_factory\models\agv_rescue_swarm.stl'
js_path = r'C:\Users\Windows 10\Documents\PlatformIO\Projects\Comprendre l’algorithme A\agv_smart_factory\js\rescue_swarm_model.js'

print('Loading full CAD STL mesh...')
mesh = trimesh.load(stl_file)

scale = 0.00285
z_min = float(mesh.vertices[:, 2].min())

# 1. Separate Wheel Faces vs Body Faces
v = mesh.vertices
f = mesh.faces

# Vertices in the 4 wheel zones
v_is_wheel = (np.abs(v[:, 0]) > 108.0) & (v[:, 2] < 105.0)
f_is_wheel = v_is_wheel[f].all(axis=1)

# --- A. BODY MESH ---
body = mesh.copy()
body.update_faces(~f_is_wheel)
body.remove_unreferenced_vertices()

# Transform body coordinates to Three.js (X = X, Y = Z - z_min, Z = Y)
bx = body.vertices[:, 0] * scale
by = (body.vertices[:, 2] - z_min) * scale
bz = body.vertices[:, 1] * scale
body_vertices = np.column_stack([bx, by, bz]).astype(np.float32)
body_faces = body.faces.astype(np.uint32)

print(f'Body: {len(body_vertices)} vertices, {len(body_faces)} faces')

# --- B. EXTRACT A SINGLE REFERENCE WHEEL ---
# Left Front wheel: X < -108, Y > 30, Z < 105
wheel_lf_mask = (v[:, 0] < -108.0) & (v[:, 1] > 30.0) & (v[:, 2] < 105.0)
wheel_lf_faces = wheel_lf_mask[f].all(axis=1)

wheel = mesh.copy()
wheel.update_faces(wheel_lf_faces)
wheel.remove_unreferenced_vertices()

# Center of wheel
w_center_cad = wheel.bounds.mean(axis=0)
wv = wheel.vertices - w_center_cad
wf = wheel.faces

# Radius in Y-Z plane (axle is along X)
r = np.sqrt(wv[:, 1]**2 + wv[:, 2]**2)

# Separate Rim (r < 38mm) and Tire (r >= 38mm)
f_r_mean = r[wf].mean(axis=1)
f_is_rim = f_r_mean < 37.5
f_is_tire = ~f_is_rim

# Jante (Rim)
rim = wheel.copy()
rim.update_faces(f_is_rim)
rim.remove_unreferenced_vertices()

# Transform to Three.js coordinates (centered at origin):
# CAD X -> Three.js X, CAD Y -> Three.js Z, CAD Z -> Three.js Y
rx = rim.vertices[:, 0] * scale
ry = rim.vertices[:, 2] * scale
rz = rim.vertices[:, 1] * scale
rim_vertices = np.column_stack([rx, ry, rz]).astype(np.float32)
rim_faces = rim.faces.astype(np.uint32)
print(f'Rim (Jante): {len(rim_vertices)} vertices, {len(rim_faces)} faces')

# Pneu (Tire)
tire = wheel.copy()
tire.update_faces(f_is_tire)
tire.remove_unreferenced_vertices()

tx = tire.vertices[:, 0] * scale
ty = tire.vertices[:, 2] * scale
tz = tire.vertices[:, 1] * scale
tire_vertices = np.column_stack([tx, ty, tz]).astype(np.float32)
tire_faces = tire.faces.astype(np.uint32)
print(f'Tire (Pneu): {len(tire_vertices)} vertices, {len(tire_faces)} faces')

# --- C. WHEEL MOUNTING POSITIONS IN THREE.JS ---
# We have 4 wheel axles:
# CAD coordinates: LF=[-150.8, 110.0, 52.5], LR=[-150.8, -110.0, 52.5]
#                  RF=[ 150.8, 110.0, 52.5], RR=[ 150.8, -110.0, 52.5]
wheel_y = float((w_center_cad[2] - z_min) * scale)
wheel_lx = float(-abs(w_center_cad[0]) * scale)
wheel_rx = float(abs(w_center_cad[0]) * scale)
wheel_fz = float(abs(w_center_cad[1]) * scale)
wheel_rz = float(-abs(w_center_cad[1]) * scale)

wheel_positions = {
    'LF': {'x': wheel_lx, 'y': wheel_y, 'z': wheel_fz, 'mirror': False},
    'LR': {'x': wheel_lx, 'y': wheel_y, 'z': wheel_rz, 'mirror': False},
    'RF': {'x': wheel_rx, 'y': wheel_y, 'z': wheel_fz, 'mirror': True},
    'RR': {'x': wheel_rx, 'y': wheel_y, 'z': wheel_rz, 'mirror': True}
}

import json

# --- D. WRITE JS FILE ---
def b64_arr(arr):
    return base64.b64encode(arr.tobytes()).decode('ascii')

wheel_positions_json = json.dumps(wheel_positions, indent=4)

with open(js_path, 'w', encoding='utf-8') as out:
    out.write('/**\n * MODÈLE MULTI-PARTIES HAUTE DÉFINITION DE L\'AGV (02_RESCUE_SWARM)\n')
    out.write(' * Carrosserie Graphite + 4 Roues indépendantes (Jantes Jaunes & Pneus Noirs Crantés)\n */\n\n')
    out.write('const RESCUE_SWARM_MULTIPART = {\n')
    out.write(f'    wheelPositions: {wheel_positions_json},\n')
    out.write('    body: {\n')
    out.write(f'        positions: "{b64_arr(body_vertices)}",\n')
    out.write(f'        indices: "{b64_arr(body_faces)}"\n')
    out.write('    },\n')
    out.write('    rim: {\n')
    out.write(f'        positions: "{b64_arr(rim_vertices)}",\n')
    out.write(f'        indices: "{b64_arr(rim_faces)}"\n')
    out.write('    },\n')
    out.write('    tire: {\n')
    out.write(f'        positions: "{b64_arr(tire_vertices)}",\n')
    out.write(f'        indices: "{b64_arr(tire_faces)}"\n')
    out.write('    }\n')
    out.write('};\n\n')
    out.write('''function createBufferGeometryFromB64(posB64, idxB64) {
    function b64ToUint8(b64) {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }

    const posBytes = b64ToUint8(posB64);
    const idxBytes = b64ToUint8(idxB64);

    const positions = new Float32Array(posBytes.buffer);
    const indices = new Uint32Array(idxBytes.buffer);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    return geometry;
}

function createRescueSwarmBodyGeometry() {
    return createBufferGeometryFromB64(RESCUE_SWARM_MULTIPART.body.positions, RESCUE_SWARM_MULTIPART.body.indices);
}

function createRescueSwarmRimGeometry() {
    return createBufferGeometryFromB64(RESCUE_SWARM_MULTIPART.rim.positions, RESCUE_SWARM_MULTIPART.rim.indices);
}

function createRescueSwarmTireGeometry() {
    return createBufferGeometryFromB64(RESCUE_SWARM_MULTIPART.tire.positions, RESCUE_SWARM_MULTIPART.tire.indices);
}
''')

print('SUCCESS! Generated multi-part CAD JS in:', js_path, 'Size:', os.path.getsize(js_path))
