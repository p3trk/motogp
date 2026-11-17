"""Export the bike and rider as simplified meshes for the game (GDD 11i-b, step 3).

Run from the project root, on the rigged bike scene (models/ is not in git):
  /Applications/Blender.app/Contents/MacOS/Blender -b "<scene>.blend" -P tools/export_bike_models.py -- \
      --js src/bike3dmodel.js

The scene is put in the same frame as the sprites (tools/render_bike_sprites.py): bike forward +X, left +Y,
up +Z, metres, scaled so the bike is BIKE_LEN long, lowest point on the road (z = 0). The rider is exported
in its posed state (the IK pose in the file).

Every object becomes one of four roles, and the game colours each role per team:
  body   the bodywork (Parts 1, 3, 4, 9)           team colour 1
  screen the windscreen (Part 2)                    team colour 2
  dark   wheels, stand and small parts             DARK
  rider  the rider body                            RIDER_SUIT
Each role is one indexed mesh (positions as float32, indices as uint32, base64), written to src/bike3dmodel.js.
"""
import array
import base64
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_bike_sprites as rbs  # noqa: E402  (same scene setup as the sprites)
import rider_pose  # noqa: E402  (the rider's hang-off and tuck, the same as tools/render_rider_poses.py)
import helmet  # noqa: E402  (the race helmet, the same as tools/render_helmet.py)

TARGET_TRIS = {'body': 60000, 'screen': 2000, 'wheel': 8000, 'dark': 20000, 'rider': 60000, 'suit': 60000, 'stripe': 20000, 'helmet': 1200, 'visor': 300}   # triangles per role: about 130k in total, so the shape survives (the first 16k budget tore the fairings and the rider)


def script_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return {argv[k].lstrip('-'): argv[k + 1] for k in range(0, len(argv) - 1, 2)}


def role_of(obj):
    if obj.name == 'Human':
        return 'rider'
    name = obj.name
    if name.startswith('Part'):
        num = name.replace('Part', '').split('_')[0]
        if num in ('1', '3', '4', '9'):
            return 'body'
        if num == '2':
            return 'screen'
        if name == 'Part8':       # the front wheel (tyre 11 cm wide, centred on the front axle); it turns with steering.
            return 'wheel'       # Part8_1 is the rear wheel and stays fixed
    return 'dark'


def decimated_world_mesh(obj, tris):
    """World-space mesh of obj after its modifiers (the posed rider included), decimated to about tris."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    mesh = ev.to_mesh().copy()
    ev.to_mesh_clear()
    current = len(mesh.loop_triangles)
    tmp = bpy.data.objects.new('tmp_' + obj.name, mesh)
    tmp.matrix_world = obj.matrix_world.copy()
    bpy.context.scene.collection.objects.link(tmp)
    if current > tris:
        dec = tmp.modifiers.new('Dec', 'DECIMATE')
        dec.ratio = max(0.01, tris / current)
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        out = tmp.evaluated_get(dg).to_mesh().copy()
        tmp.evaluated_get(dg).to_mesh_clear()
    else:
        out = mesh.copy()
    bpy.data.objects.remove(tmp)
    bpy.data.meshes.remove(mesh)
    mw = obj.matrix_world
    verts = [mw @ v.co for v in out.vertices]
    nm = mw.to_3x3().inverted().transposed()
    normals = [(nm @ vn.vector).normalized() for vn in out.vertex_normals]   # world normals (the suit is pushed out along them)
    tri = [tuple(t.vertices) for t in out.loop_triangles] if out.loop_triangles else []
    if not out.loop_triangles:
        out.calc_loop_triangles()
        tri = [tuple(t.vertices) for t in out.loop_triangles]
    bpy.data.meshes.remove(out)
    return verts, tri, normals


SUIT_OFFSET = 0.015   # m: the suit sits this far off the body, along the normals

def add_mesh(role, verts, normals, tris, lift, push):
    """Append vertices (pushed along normals by push metres) and triangles to a role."""
    used = sorted({i for t in tris for i in t})
    remap = {i: k for k, i in enumerate(used)}
    base = len(role['pos']) // 3
    for i in used:
        v = verts[i] + normals[i] * push
        role['pos'].extend([v.x + lift.x, v.y + lift.y, v.z + lift.z])
    role['idx'].extend(base + remap[i] for t in tris for i in t)

def add_sphere(role, centre, radii, budget, lift, name):
    """A UV sphere (helmet or visor) with its radii in metres, in the exported frame."""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=24, ring_count=12, location=centre + Vector((0, 0, 0)))
    o = bpy.context.active_object
    o.name = name
    o.scale = radii
    o.location = centre
    bpy.context.view_layer.update()
    verts, tri, normals = decimated_world_mesh(o, budget)
    add_mesh(role, verts, normals, tri, lift, 0.0)
    bpy.data.objects.remove(o)

POSE_DEG = [20, 40, 64, -20, -40, -64]   # the rider's lean poses (morph targets); the base mesh is upright, 0
POSE_SCALE = 8192                         # int16 units per metre for the pose positions (range +-4 m)


def export_rider(roles, lift, bike_meshes, lo_z):
    """The rider (skin, suit, stripe) and the race helmet (shell, visor, trim), posed by tools/rider_pose.py: the base mesh is the upright
    tuck, with one morph target per lean in POSE_DEG. The rider mesh is not decimated, so every pose has the same
    vertices. Skin, bands and the helmet's size are measured on the rest pose, so they stay put as the rider moves."""
    rig = bpy.data.objects['RiderRig']
    human = bpy.data.objects['Human']
    rider_pose.remember(rig)
    rider_pose.setup(bike_meshes, lo_z)
    head_m = lambda: rig.matrix_world @ rig.pose.bones['Head'].matrix   # the head bone in the world (4x4)
    rest, tri, _ = decimated_world_mesh(human, 10 ** 9)
    rider_pose.measure_hands(rig, human, rest)
    head_z = (rig.matrix_world @ rig.pose.bones['Head'].tail).z   # the head joint (the bone's head is the neck)
    rest_head = head_m().copy()

    def centre(t):
        return (rest[t[0]] + rest[t[1]] + rest[t[2]]) / 3

    def skin(t):   # where skin shows: head, neck and hands
        c = centre(t)
        return c.z > head_z - 0.06 or (abs(c.x) > 0.4 and c.z < head_z - 0.5)

    def stripe(t):   # the team's accent bands (GDD 11i-b)
        c = centre(t)
        return (head_z - 0.40 < c.z < head_z - 0.32) or (head_z - 0.62 < c.z < head_z - 0.54)

    parts = [('rider', [t for t in tri if skin(t)], 0.0),
             ('suit', [t for t in tri if not skin(t) and not stripe(t)], SUIT_OFFSET),
             ('stripe', [t for t in tri if not skin(t) and stripe(t)], SUIT_OFFSET)]
    used = {r: sorted({i for t in ts for i in t}) for r, ts, _ in parts}

    def positions(vs, ns, r, push):
        out = []
        for i in used[r]:
            v = vs[i] + ns[i] * push + lift
            out.extend([v.x, v.y, v.z])
        return out

    # helmet and visor, sized from the head's own vertices at rest (the Head bone's tail is at the jaw): the helmet is
    # an ellipsoid around the head with 25 mm of padding, the visor sits on the face. They turn with the head bone.
    head_ids = [i for i, v in enumerate(rest) if v.z > head_z - 0.02 and abs(v.y) < 0.2]

    def head_box(vs):
        lo = Vector((min(vs[i].x for i in head_ids), min(vs[i].y for i in head_ids), min(vs[i].z for i in head_ids)))
        hi = Vector((max(vs[i].x for i in head_ids), max(vs[i].y for i in head_ids), max(vs[i].z for i in head_ids)))
        return (lo + hi) / 2, (hi - lo) / 2

    hc_rest, hh = head_box(rest)
    # the race helmet (tools/helmet.py): shell, visor and trim, built around the head in head-local metres
    templates = {name: (tv, tt, Vector((0, 0, 0))) for name, (tv, tt) in helmet.build(hh).items()}

    def sphere(name, c, rot):
        tv, _, off = templates[name]
        out = []
        for v in tv:
            p = c + rot @ (off + v) + lift
            out.extend([p.x, p.y, p.z])
        return out

    def posed(lean):
        rider_pose.pose(rig, lean)
        vs, _, ns = decimated_world_mesh(human, 10 ** 9)
        rider_pose.curl_fingers(rig, vs)
        assert len(vs) == len(rest), 'the rider vertex count changed between poses'   # the rest triangles are kept
        print('POSE', round(math.degrees(lean)), 'wrist_gap', rider_pose.wrist_gap(rig), rider_pose._BIKE.get('last', {}) if lean else '')
        T = head_m() @ rest_head.inverted()   # how the head moved from rest: the helmet moves with it exactly
        return vs, ns, T @ hc_rest, T.to_3x3().normalized()

    vs, ns, hc, rot = posed(0.0)
    for r, ts, push in parts:
        remap = {i: k for k, i in enumerate(used[r])}
        roles[r] = {'pos': positions(vs, ns, r, push), 'idx': [remap[i] for t in ts for i in t], 'morph': []}
    for name, (tv, tt, off) in templates.items():
        roles[name] = {'pos': sphere(name, hc, rot), 'idx': [i for t in tt for i in t], 'morph': []}
    for deg in POSE_DEG:
        vs, ns, hc, rot = posed(math.radians(deg))
        for r, ts, push in parts:
            roles[r]['morph'].append(positions(vs, ns, r, push))
        for name in templates:
            roles[name]['morph'].append(sphere(name, hc, rot))
    rider_pose.reset(rig)


def b64(arr):
    return base64.b64encode(arr.tobytes()).decode('ascii')


def main():
    a = script_args()
    js_path = a.get('js', os.path.join('src', 'bike3dmodel.js'))
    # triangle budget multipliers: the bike (bodywork, screen, wheel, dark parts) and the rider are set separately.
    # The game uses 10% for the bike (all bikes) and 50% for the rider (the player only). 1 is the full model.
    bike_scale = float(a.get('bike-scale', a.get('scale', '1')))
    rider_scale = float(a.get('rider-scale', a.get('scale', '1')))
    for k in TARGET_TRIS:
        TARGET_TRIS[k] = int(TARGET_TRIS[k] * (rider_scale if k == 'rider' else bike_scale))
    rbs.place_scene()
    bpy.context.view_layer.update()

    # lowest point of the bike on the road
    mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH' and o.name not in ('Human',) and not o.name.startswith('tmp_')]
    lo_z = min(min((o.matrix_world @ Vector(c)).z for c in o.bound_box) for o in mesh_objs)
    lift = Vector((0, 0, -lo_z))

    roles = {r: {'pos': [], 'idx': []} for r in TARGET_TRIS}
    members = {r: [] for r in TARGET_TRIS}
    members['suit'] = []
    for obj in bpy.data.objects:
        if obj.type == 'MESH' and not obj.name.startswith('tmp_'):
            members[role_of(obj)].append(obj)
    for obj in bpy.data.objects:
        if obj.type != 'MESH' or obj.name.startswith('tmp_'):
            continue
        role = role_of(obj)
        share = max(40, TARGET_TRIS[role] // max(1, len(members[role])))
        verts, tri, normals = decimated_world_mesh(obj, share)
        if obj.name == 'Human':   # the rider is exported after the bike, with its lean poses (export_rider)
            continue
        base = len(roles[role]['pos']) // 3
        for v in verts:
            roles[role]['pos'].extend([v.x + lift.x, v.y + lift.y, v.z + lift.z])
        roles[role]['idx'].extend(i + base for t in tri for i in t)

    export_rider(roles, lift, [o for o in mesh_objs if o.name.startswith('Part')], lo_z)

    # the front wheel's axle, in the exported frame: the pivot for steering (GDD 11i-b, step 4)
    front = [o for o in bpy.data.objects if o.type == 'MESH' and o.name == 'Part8']
    fc = sum((sum(((o.matrix_world @ Vector(c)) for c in o.bound_box), Vector()) / 8 for o in front), Vector()) / max(1, len(front))
    pivot = fc + lift
    lines = [f"  pivot: [{pivot.x:.5f}, {pivot.y:.5f}, {pivot.z:.5f}],"]
    lines.append(f"  poseLean: [{', '.join(f'{math.radians(d):.5f}' for d in POSE_DEG)}],")
    lines.append(f"  poseScale: {POSE_SCALE},")
    for role, d in roles.items():
        pos = array.array('f', d['pos'])
        idx = array.array('I', d['idx'])
        morph = ''
        if d.get('morph'):
            morph = ', morph: [' + ', '.join("'" + b64(array.array('h', [round(v * POSE_SCALE) for v in m])) + "'" for m in d['morph']) + ']'
        lines.append(f"  {role}: {{ pos: '{b64(pos)}', idx: '{b64(idx)}'{morph} }},")
        print('ROLE', role, 'verts', len(pos) // 3, 'tris', len(idx) // 3)
    body = ('// Generated by tools/export_bike_models.py (GDD 11i-b). Do not edit by hand.\n'
            'const BIKE3DMODEL = {\n' + '\n'.join(lines) + '\n};\n')
    with open(js_path, 'w', encoding='ascii') as f:
        f.write(body)
    print('WROTE', js_path, os.path.getsize(js_path), 'bytes')


if __name__ == '__main__':
    main()
