import base64
import os
import numpy as np
import trimesh

stl_file = r'C:\Users\Windows 10\Documents\PlatformIO\Projects\Comprendre l’algorithme A\agv_smart_factory\models\agv_rescue_swarm.stl'
js_path = r'C:\Users\Windows 10\Documents\PlatformIO\Projects\Comprendre l’algorithme A\agv_smart_factory\js\rescue_swarm_model.js'

print('Loading STL mesh from:', stl_file)
mesh = trimesh.load(stl_file)

vertices = np.array(mesh.vertices, dtype=np.float32)
faces = np.array(mesh.faces, dtype=np.uint32)

# CAD bounds: X: [-193.5, 193.5], Y: [-177, 177], Z: [0.1, 278] (in mm)
# In Three.js: X = X, Y = Z (vertical height), Z = -Y (forward)
scale = 0.00285

three_x = vertices[:, 0] * scale
three_y = (vertices[:, 2] - vertices[:, 2].min()) * scale
three_z = vertices[:, 1] * scale

transformed_vertices = np.column_stack([three_x, three_y, three_z]).astype(np.float32)

pos_bytes = transformed_vertices.tobytes()
idx_bytes = faces.tobytes()

pos_b64 = base64.b64encode(pos_bytes).decode('ascii')
idx_b64 = base64.b64encode(idx_bytes).decode('ascii')

w = float(three_x.max() - three_x.min())
h = float(three_y.max() - three_y.min())
d = float(three_z.max() - three_z.min())

with open(js_path, 'w', encoding='utf-8') as f:
    f.write('/**\n * MODÈLE CAO EXACT DU ROBOT AGV (02_RESCUE_SWARM_ASSEMBLAGE)\n')
    f.write(' * Converti directement depuis le fichier STEP officiel d\'assemblage mécatronique\n')
    f.write(f' * Sommets : {len(transformed_vertices)} | Triangles : {len(faces)}\n */\n\n')
    f.write('const RESCUE_SWARM_CAD_DATA = {\n')
    f.write(f'    vertexCount: {len(transformed_vertices)},\n')
    f.write(f'    faceCount: {len(faces)},\n')
    f.write(f'    bounds: {{ width: {round(w, 3)}, height: {round(h, 3)}, depth: {round(d, 3)} }},\n')
    f.write(f'    positionsB64: "{pos_b64}",\n')
    f.write(f'    indicesB64: "{idx_b64}"\n')
    f.write('};\n\n')
    f.write('''function createRescueSwarmCADGeometry() {
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
    geometry.computeVertexNormals();

    return geometry;
}
''')

print('SUCCESS! Generated rescue_swarm_model.js. Size:', os.path.getsize(js_path), 'bytes')
