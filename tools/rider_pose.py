"""The rider's hang-off pose for a lean (GDD 11l-b). Used by tools/render_rider_poses.py (to check the poses by eye) and
tools/export_bike_models.py (to bake them for the game), so both use the same pose.

Works in the exported frame set up by render_bike_sprites.place_scene: bike forward +X, up +Z. Positive lean is a right
turn; at runtime the bike rolls by Rx(-lean), which tips its top toward +Y, so the inside of the turn is +Y.

At every lean the rider tucks: the upper body pitches forward (TUCK) so the helmet comes down behind the windscreen, and
the head tilts back (HEAD_UP) so the rider looks ahead.

The hang-off, scaled by f = |lean| / HANG_FULL (35 degrees, then held) and mirrored for a left turn:
  - pelvis: the bottom slides off the seat to the inside (HIP_SHIFT) and drops a little (HIP_DROP), and the hips roll into
    the turn (HIP_ROLL);
  - spine: the upper body leans further into the turn (SPINE_ROLL) and turns toward the inside (SPINE_YAW);
  - head: rolls back toward level by HEAD_LEVEL of the body's roll, as riders keep their eyes level;
  - inside knee: points out toward the road, as far as KNEE_OUT allows but never closer than KNEE_CLEAR to the road
    once the bike leans, so it does not drop below the bike (found by search on its IK pole; pulled up and in if needed);
  - outside knee: rests against the side of the tank (KNEE_PAD from its surface), found by search on its IK pole.
The IK keeps the feet on the pegs; fit_hands puts the hands on the grips. Call remember(), measure_hands() and
setup() once, on the rest pose.
"""
import math

import bpy
from mathutils import Matrix, Vector

FULL = math.radians(64)
HANG_FULL = math.radians(35)   # the hang-off is complete by this lean (riders are fully off well before maximum lean)
P = {
    'TUCK': 0.8, 'HEAD_UP': 0.7,
    'HIP_SHIFT': 0.22, 'HIP_DROP': 0.05, 'HIP_ROLL': 0.10,
    'SPINE_ROLL': 0.10, 'SPINE_YAW': 0.15,
    'HEAD_LEVEL': 0.5,
    'KNEE_OUT': 0.6, 'KNEE_DOWN': 0.25, 'KNEE_CLEAR': 0.15, 'KNEE_PAD': 0.07,
}
_BIKE = {}
# the handlebar grips, measured from the bike's mesh (slices across the bars, GDD 11l-b): the centre of each grip in the
# exported frame, x forward, +-y to the side, z above the road. Each pose moves the wrist's IK target until the centre of
# the hand (measured on the mesh at rest, in the forearm's own frame) sits on the grip (fit_hands).
GRIP = Vector((0.41, 0.29, 0.79))
PALM_ABOVE = 0.025  # m: the knuckles sit this far above the grip's centre, so the fingers wrap the bar from above
ARM_STRETCH = 0.25   # how freely the arm bones may stretch to reach the grips (Blender's ik_stretch; 0 is rigid)


def setup(bike_meshes, lo_z):
    """The bike's surface near the rider (for the outside knee) and the road height (for the inside knee)."""
    pts = []
    for o in bike_meshes:
        mw = o.matrix_world
        for v in o.data.vertices:
            w = mw @ v.co
            if -0.6 < w.x < 0.6 and lo_z + 0.3 < w.z < lo_z + 1.1:
                pts.append(w)
    _BIKE['pts'] = pts
    _BIKE['lo_z'] = lo_z
    _BIKE['grip'] = {'L': Vector((GRIP.x, GRIP.y, lo_z + GRIP.z)), 'R': Vector((GRIP.x, -GRIP.y, lo_z + GRIP.z))}  # Grip.L is +y


def _body_verts(human, helpers):
    """World positions of the body mesh in its current pose, with or without MakeHuman's hidden helper geometry
    (the joint markers), which the 'Hide helpers' mask modifier removes."""
    masks = [m for m in human.modifiers if m.type == 'MASK']
    for m in masks:
        m.show_viewport = not helpers
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = human.evaluated_get(dg)
    me = ev.to_mesh()
    vs = [human.matrix_world @ v.co for v in me.vertices]
    ev.to_mesh_clear()
    for m in masks:
        m.show_viewport = True
    bpy.context.view_layer.update()
    return vs


def measure_hands(rig, human, rest=None):
    """Each hand at rest, from MakeHuman's joint markers (the ForeArm bone ends about 10 cm short of the real wrist, so
    the bone can't be used): the wrist, the four knuckles and the four fingertips (thumb left out), kept in the forearm
    bone's own frame because the hand moves with the forearm; and the hand's vertices in rest (the body without the
    helpers, as exported; evaluated here if not given). Call once, on the rest pose."""
    A = rig.matrix_world
    full = _body_verts(human, True)
    rest = rest if rest is not None else _body_verts(human, False)

    def joint(name):
        g = human.vertex_groups[name].index
        pts = [full[v.index] for v in human.data.vertices if any(e.group == g for e in v.groups)]
        return sum(pts, Vector()) / len(pts)

    _BIKE['hand'] = {}
    for side in ('L', 'R'):
        s = side.lower()
        wrist = joint(f'joint-{s}-hand')
        knuckles = [joint(f'joint-{s}-finger-{f}-1') for f in (2, 3, 4, 5)]
        tips = [joint(f'joint-{s}-finger-{f}-4') for f in (2, 3, 4, 5)]
        k = sum(knuckles, Vector()) / 4
        t = sum(tips, Vector()) / 4
        d = (t - wrist).normalized()
        L = (t - wrist).length
        ids = [i for i, v in enumerate(rest)   # the hand: within 6 cm of the line from the wrist to the fingertips
               if -0.01 < (v - wrist).dot(d) < L + 0.03 and ((v - wrist) - d * (v - wrist).dot(d)).length < 0.06]
        Minv = (A @ rig.pose.bones['ForeArm.' + side].matrix).inverted()
        _BIKE['hand'][side] = {'wrist': Minv @ wrist, 'knuckle': Minv @ k, 'tip': Minv @ t,
                               'index': Minv @ knuckles[0], 'pinky': Minv @ knuckles[3], 'ids': ids}


def _hand(rig, side):
    """The hand in the current pose: wrist, knuckles (centre), fingertips (centre), and the knuckle line's direction."""
    M = rig.matrix_world @ rig.pose.bones['ForeArm.' + side].matrix
    h = _BIKE['hand'][side]
    return M @ h['wrist'], M @ h['knuckle'], M @ h['tip'], (M @ h['pinky'] - M @ h['index']).normalized()


def hand_centre(rig, side):
    """The knuckles: the point that should sit over the grip."""
    return _hand(rig, side)[1]


def fit_hands(rig, steps=30):
    """Move each wrist's IK target until the centre of the hand sits on its grip."""
    for side in ('L', 'R'):
        g = bpy.data.objects['Grip.' + side]
        for _ in range(steps):
            err = hand_centre(rig, side) - (_BIKE['grip'][side] + Vector((0, 0, PALM_ABOVE)))
            if err.length < 0.003:
                break
            W = g.matrix_world.copy()
            W.translation -= err * 0.7   # damped: a full step can make the IK flip the elbow
            g.matrix_world = W
            bpy.context.view_layer.update()
_BASE = {}


def _about(point, rot3):
    """A 4x4 world transform: rotate by rot3 about point."""
    return Matrix.Translation(point) @ rot3.to_4x4() @ Matrix.Translation(-point)


def _apply(rig, name, W):
    """Apply a world-space transform W to a pose bone on top of its current pose (children follow)."""
    A = rig.matrix_world
    pb = rig.pose.bones[name]
    pb.matrix = A.inverted() @ W @ A @ pb.matrix
    bpy.context.view_layer.update()


def remember(rig):
    """Store the rest of the pose (bones and IK pole targets) so every lean starts from it, and let the arm's IK reach:
    the arm bones may stretch a little. The chain stays two bones (upper arm and forearm): taking in the clavicle let
    the solver swing the arm out sideways or over the shoulder."""
    _BASE['bones'] = {pb.name: pb.matrix_basis.copy() for pb in rig.pose.bones}
    _BASE['poles'] = {o.name: o.location.copy() for o in bpy.data.objects if o.name.startswith('KneePole.')}
    _BASE['grips'] = {o.name: o.location.copy() for o in bpy.data.objects if o.name.startswith('Grip.')}
    for side in ('L', 'R'):
        for c in rig.pose.bones['ForeArm.' + side].constraints:
            if c.type == 'IK':
                c.chain_count = 2
                c.use_stretch = True
        for b in ('UpperArm.', 'ForeArm.'):
            rig.pose.bones[b + side].ik_stretch = ARM_STRETCH


def reset(rig):
    for name, m in _BASE['bones'].items():
        rig.pose.bones[name].matrix_basis = m
    for name, loc in list(_BASE['poles'].items()) + list(_BASE['grips'].items()):
        bpy.data.objects[name].location = loc
    bpy.context.view_layer.update()


def inside_side(rig, lean):
    """'L' or 'R': the leg on the inside of the turn (the one further toward the inside, +Y for a right turn)."""
    A = rig.matrix_world
    yl = (A @ rig.pose.bones['Thigh.L'].head).y
    yr = (A @ rig.pose.bones['Thigh.R'].head).y
    toward = 1 if lean > 0 else -1
    return 'L' if (yl - yr) * toward > 0 else 'R'


def knee(rig, side):
    """The knee joint of a leg, in the exported frame."""
    return rig.matrix_world @ rig.pose.bones['Calf.' + side].head


def tank_side(k, s_out):
    """The tank's outer surface on the side s_out (+1: +Y, -1: -Y) at the height and position of knee k, or None."""
    near = [p.y * s_out for p in _BIKE['pts'] if abs(p.x - k.x) < 0.05 and abs(p.z - k.z) < 0.05 and p.y * s_out > 0]
    return max(near) if near else None


def road_clear(k, lean):
    """How high point k is above the road once the bike leans (it rolls by Rx(-lean) about the contact line)."""
    c = Vector((0, 0, _BIKE['lo_z']))
    return (Matrix.Rotation(-lean, 3, 'X') @ (k - c)).z


def _set_pole(name, offset):
    pole = bpy.data.objects[name]
    pole.location = _BASE['poles'][name]
    bpy.context.view_layer.update()
    W = pole.matrix_world.copy()
    W.translation += offset
    pole.matrix_world = W
    bpy.context.view_layer.update()


def _search(fn, lo, hi, steps=14):
    """Bisection for the t in [lo, hi] where fn(t) changes from True to False (fn(lo) True)."""
    for _ in range(steps):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if fn(mid) else (lo, mid)
    return lo


def pose(rig, lean, params=None):
    """Pose the rider for a lean (radians), from the remembered rest pose, with the hands on the grips."""
    _pose_body(rig, lean, params)
    fit_hands(rig)


def _pose_body(rig, lean, params=None):
    """The body's pose for a lean: tuck, hang-off and knees."""
    q = dict(P, **(params or {}))
    reset(rig)
    A = rig.matrix_world
    world = lambda name, end='head': A @ getattr(rig.pose.bones[name], end)
    # tuck at every lean: the upper body pitches forward behind the screen (+ about Y tips the top toward +X, forward),
    # the head tilts back so the rider looks ahead
    _apply(rig, 'Spine', _about(world('Spine'), Matrix.Rotation(q['TUCK'], 3, 'Y')))
    _apply(rig, 'Head', _about(world('Head'), Matrix.Rotation(-q['HEAD_UP'] * q['TUCK'], 3, 'Y')))
    if lean == 0:
        return
    s = 1 if lean > 0 else -1                   # +1 right turn (inside +Y), -1 left turn (inside -Y)
    f = min(1.0, abs(lean) / HANG_FULL)

    # pelvis: slide to the inside and down, roll into the turn (the same direction as the bike: Rx(-s ...))
    hip = world('Pelvis')
    _apply(rig, 'Pelvis', Matrix.Translation(Vector((0, s * q['HIP_SHIFT'] * f, -q['HIP_DROP'] * f)))
           @ _about(hip, Matrix.Rotation(-s * q['HIP_ROLL'] * f, 3, 'X')))
    # spine: lean further in, and turn the chest toward the inside (a turn about the vertical toward +Y is +Z)
    sp = world('Spine')
    _apply(rig, 'Spine', _about(sp, Matrix.Rotation(s * q['SPINE_YAW'] * f, 3, 'Z') @ Matrix.Rotation(-s * q['SPINE_ROLL'] * f, 3, 'X')))
    # head: back toward level, a share of the body's roll and the bike's lean
    hd = world('Head')
    body = q['HIP_ROLL'] * f + q['SPINE_ROLL'] * f + abs(lean)
    _apply(rig, 'Head', _about(hd, Matrix.Rotation(s * q['HEAD_LEVEL'] * body, 3, 'X')))
    # inside knee: out and down toward the road, but not closer than KNEE_CLEAR once the bike leans
    ins = inside_side(rig, lean)
    pin = 'KneePole.' + ins
    off_in = lambda t: Vector((0, s * q['KNEE_OUT'] * t, -q['KNEE_DOWN'] * t))
    def clear_ok(t):
        _set_pole(pin, off_in(t))
        return road_clear(knee(rig, ins), lean) >= q['KNEE_CLEAR']
    t_in = f if clear_ok(f) else _search(clear_ok, -0.8, f)   # below 0 the knee is pulled up and in, above the road
    _set_pole(pin, off_in(t_in))
    # outside knee: against the side of the tank. Its pole moves to the outside (t > 0) or the inside (t < 0) until the
    # knee sits KNEE_PAD outside the tank's surface (the knee's radius)
    out = 'R' if ins == 'L' else 'L'
    pout = 'KneePole.' + out
    def beyond(t):   # True while the knee is still inside the tank (or past it toward the inside)
        _set_pole(pout, Vector((0, -s * t, 0)))
        k = knee(rig, out)
        surf = tank_side(k, -s)
        return surf is not None and (-s * k.y) < surf + q['KNEE_PAD']
    t_out = 0.0
    _set_pole(pout, Vector((0, 0, 0)))
    if tank_side(knee(rig, out), -s) is None:
        pass   # no tank beside the knee: leave it
    elif beyond(0.0):
        t_out = _search(beyond, 0.0, 1.5)
    else:   # already outside the tank: pull it in until it touches
        t_out = -_search(lambda t: not beyond(-t), 0.0, 1.5)
    _set_pole(pout, Vector((0, -s * t_out, 0)))
    _BIKE['last'] = {'inside_knee_t': round(t_in, 3), 'inside_knee_clear': round(road_clear(knee(rig, ins), lean), 3),
                     'outside_knee_t': round(t_out, 3)}


def wrist_gap(rig):
    """How far the centre of each hand is from where it should be, just above the centre of its grip (m)."""
    return [round((hand_centre(rig, s) - _BIKE['grip'][s] - Vector((0, 0, PALM_ABOVE))).length, 3) for s in ('L', 'R')]


def curl_fingers(rig, verts):
    """Close each hand round its grip: the vertices past the knuckles turn about the knuckle line by an angle that
    grows to FINGER_CURL at the fingertips. The direction is the one that brings the fingertips round toward the grip.
    verts are world positions of the posed rider mesh (no helpers), changed in place."""
    for side in ('L', 'R'):
        wrist, k, tip, ax = _hand(rig, side)
        fd = (tip - k).normalized()
        flen = (tip - k).length
        grip = _BIKE['grip'][side]
        sign = min((1.0, -1.0), key=lambda sg: ((k + Matrix.Rotation(sg * FINGER_CURL, 3, ax) @ (tip - k)) - grip).length)
        for i in _BIKE['hand'][side]['ids']:
            t = (verts[i] - k).dot(fd)
            if t <= 0:
                continue
            R = Matrix.Rotation(sign * FINGER_CURL * min(1.0, t / flen), 3, ax)
            verts[i] = k + R @ (verts[i] - k)


FINGER_CURL = math.radians(110)
