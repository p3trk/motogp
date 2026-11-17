"""The rider's race helmet (GDD 11i-b), built from a UV sphere shaped around the head. Used by tools/export_bike_models.py
(baked into the game) and tools/render_helmet.py (to check it by eye).

build(hh) returns {role: (verts, tris)} in head-local metres (x forward, y left, z up, origin at the head's centre):
  helmet  the shell (team helmet colour): egg-shaped, longer at the back, a flatter crown, a chin bar, a curved neck line
          (low under the chin, higher at the back) and two vents on the top
  visor   the eye port (dark glass): a lens-shaped patch 2 mm off the shell's front
  trim    the team's design (team suit colour): a centre stripe over the top, a sweep down each side and a rear spoiler
hh is the head's half size at rest (Vector), from the rider mesh.
"""
import math

import bmesh
from mathutils import Matrix, Vector

PAD = Vector((0.030, 0.030, 0.035))   # m of shell around the head
DROP = -0.012                          # m: the helmet's centre sits a little below the head's centre (covers the chin)
BOX = 2.4                              # the shell's superellipsoid exponent (2 is an ellipsoid; higher is boxier)


def _smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def _shape(u, a, b, c):
    """A point of the shell from a unit direction u, with the shell's half sizes a (front-back), b (side), c (height).
    Every change of shape is blended, so the surface has no steps: longer at the back, a flatter crown, and a chin bar
    that comes forward and down at the front."""
    x, y, z = u
    r = (abs(x) ** BOX + abs(y) ** BOX + abs(z) ** BOX) ** (-1 / BOX)   # a superellipsoid: boxier than an egg
    p = Vector((x * a * r, y * b * r, z * c * r))
    p.x *= 1 + 0.20 * _smooth(-x / 0.6)                        # longer at the back
    p.z *= 1 - 0.16 * _smooth((z - 0.4) / 0.5)                 # a lower, flatter crown
    chin = _smooth((x - 0.1) / 0.5) * _smooth((-z - 0.2) / 0.5)
    p.x *= 1 + 0.08 * chin                                     # the chin bar: forward
    p.z *= 1 + 0.18 * chin                                     # and down
    p.y *= 1 - 0.06 * _smooth((-z - 0.3) / 0.5)                # narrower toward the neck
    return p + Vector((0, 0, DROP))


def _normal(p, a, b, c):
    """The outward normal of the shell near p (the ellipsoid's, good enough to lift the details off the shell)."""
    q = p - Vector((0, 0, DROP))
    return Vector((q.x / (a * a), q.y / (b * b), q.z / (c * c))).normalized()


def _on_shell(d, a, b, c, lift):
    """The shell point in unit direction d, lifted off the shell by lift metres."""
    p = _shape(d.normalized(), a, b, c)
    return p + _normal(p, a, b, c) * lift


def _grid(rows, cols, point):
    """A smooth patch: point(i, j) for a rows x cols grid, as (verts, tris)."""
    verts = [point(i, j) for i in range(rows) for j in range(cols)]
    tris = []
    for i in range(rows - 1):
        for j in range(cols - 1):
            k = i * cols + j
            tris += [(k, k + cols, k + 1), (k + 1, k + cols, k + cols + 1)]
    return verts, tris


def _box(centre, size, normal):
    """A small box (spoiler or vent) set on the shell: its thin axis along the shell's normal, half sunk in."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    rot = Vector((0, 0, 1)).rotation_difference(normal).to_matrix().to_4x4()
    M = Matrix.Translation(centre) @ rot @ Matrix.Diagonal((*size, 1.0))
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    verts = [v.co.copy() for v in bm.verts]
    tris = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    return verts, tris


def _add(roles, role, piece):
    verts, tris = roles[role]
    base = len(verts)
    verts.extend(piece[0])
    tris.extend(tuple(base + i for i in t) for t in piece[1])


def _dir(az, el):
    return Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))


def _patch(a, b, c, rows, cols, el_lo, el_hi, az_lo, az_hi, lift):
    """A patch on the shell between two elevation curves el_lo(s), el_hi(s), for s in [0, 1] across az_lo..az_hi."""
    def point(i, j):
        s = j / (cols - 1)
        az = az_lo + (az_hi - az_lo) * s
        t = i / (rows - 1)
        return _on_shell(_dir(az, el_lo(s) + (el_hi(s) - el_lo(s)) * t), a, b, c, lift)
    return _grid(rows, cols, point)


def _ribbon(a, b, c, centre, side, width, height, n):
    """A raised strip on the shell: centre(t) a direction, side(t) a unit vector across it, width(t) its half width
    (in direction units) and height(t) its height off the shell (m), for t in 0..1. A top, two side walls and two ends."""
    def at(t, j, k):
        d = centre(t) + side(t) * width(t) * (-1 + 2 * j)
        return _on_shell(d, a, b, c, 0.001 + (height(t) if k else 0.0))
    pieces = [_grid(n, 2, lambda i, j: at(i / (n - 1), j, 1))]
    for j in (0, 1):
        pieces.append(_grid(n, 2, lambda i, k, j=j: at(i / (n - 1), j, k)))
    for t in (0.0, 1.0):
        pieces.append(_grid(2, 2, lambda k, j, t=t: at(t, j, k)))
    return pieces


def _path(d0, d1):
    """A path between two directions, and a unit vector across it on the shell."""
    def centre(t):
        return (d0 * (1 - t) + d1 * t).normalized()
    def side(t):
        return centre(t).cross(d1 - d0).normalized()
    return centre, side


def build(hh):
    """The race helmet, shaped after the reference views in models/reference/helmet-ref-*.png (form only: no logos or
    text, team colours).
      helmet  the shell: a boxy superellipsoid with a chin bar, the intake scoop on the brow, the big rear spoiler, the
              diagonal side ridges from the spoiler down to the cheeks and a raised pad low on each side at the back
      visor   the dark parts: the wrap-around visor, its gasket and the black plate behind its ends, the black rubber
              trim round the neck line, the intake's slot, the chin's V vent and three slots on each side of the chin,
              and two exhaust slots under the spoiler
      trim    the team's design: a raised panel down the centre of the top, from the scoop to the spoiler"""
    a, b, c = hh.x + PAD.x, hh.y + PAD.y, hh.z + PAD.z
    roles = {'helmet': ([], []), 'visor': ([], []), 'trim': ([], [])}
    add = lambda role, pieces: [_add(roles, role, pc) for pc in (pieces if isinstance(pieces, list) else [pieces])]

    # the shell: a smooth grid from the crown down to the neck line (low under the chin bar, higher at the back)
    cols, rows = 96, 48
    cut = lambda phi: math.radians(-38 - 26 * _smooth((math.cos(phi) + 0.2) / 1.2))
    def shell(i, j):
        phi = 2 * math.pi * j / cols
        el = math.pi / 2 - (math.pi / 2 - cut(phi)) * i / (rows - 1)
        return _shape(_dir(phi, el), a, b, c)
    verts = [shell(i, j) for i in range(rows) for j in range(cols)]
    tris = []
    for i in range(rows - 1):
        for j in range(cols):
            k, kn = i * cols + j, i * cols + (j + 1) % cols
            tris += [(k, k + cols, kn), (kn, k + cols, kn + cols)]
    roles['helmet'] = (verts, tris)

    # the black rubber trim right round the neck line
    def neck(k, j):
        phi = 2 * math.pi * j / cols
        return _on_shell(_dir(phi, cut(phi) + 0.075 * k), a, b, c, 0.003)
    nv = [neck(k, j) for k in range(2) for j in range(cols + 1)]
    nt = []
    for j in range(cols):
        nt += [(j, j + cols + 1, j + 1), (j + 1, j + cols + 1, j + cols + 2)]
    add('visor', (nv, nt))

    # the visor: wraps about 80 degrees round each side, the top edge almost straight, the lower edge rising at the ends
    W = 1.42
    top = lambda s: 0.45 - 0.06 * (2 * s - 1) ** 2
    bot = lambda s: -0.32 + 0.30 * (2 * s - 1) ** 4
    add('visor', _patch(a, b, c, 18, 90, bot, top, -W, W, 0.010))                                    # the glass
    g = 0.05
    add('visor', _patch(a, b, c, 18, 90, lambda s: bot(s) - g, lambda s: top(s) + g, -W - g, W + g, 0.005))   # gasket
    for sd in (1, -1):   # the black plate behind each end of the visor, up to the side ridge
        az0, az1 = (W - 0.05, W + 0.40) if sd > 0 else (-W - 0.40, -W + 0.05)
        lo = (lambda s: -0.08 + 0.10 * s) if sd > 0 else (lambda s: 0.02 - 0.10 * s)
        hi = (lambda s: 0.40 - 0.06 * s) if sd > 0 else (lambda s: 0.34 + 0.06 * s)
        add('visor', _patch(a, b, c, 8, 12, lo, hi, az0, az1, 0.004))

    # the chin: a V vent under the visor, and three slanted slots on each side of the chin bar
    def vee(i, j):
        t = i / 7
        el = -0.36 - 0.22 * t
        hw = 0.20 - 0.14 * t
        return _on_shell(_dir(hw * (-1 + 2 * j / 5), el), a, b, c, 0.004)
    add('visor', _grid(8, 6, vee))
    for sd in (1, -1):
        for k in range(3):
            lo = lambda s, k=k: -0.60 + 0.075 * k + 0.12 * s
            hi = lambda s, k=k: -0.565 + 0.075 * k + 0.12 * s
            az0, az1 = (0.42, 0.85) if sd > 0 else (-0.85, -0.42)
            if sd < 0:
                lo, hi = (lambda s, k=k: -0.60 + 0.075 * k + 0.12 * (1 - s)), (lambda s, k=k: -0.565 + 0.075 * k + 0.12 * (1 - s))
            add('visor', _patch(a, b, c, 2, 8, lo, hi, az0, az1, 0.004))

    # the intake scoop on the brow (shell) with its dark slot, and the raised centre panel over the top (team trim)
    fwd = lambda th: Vector((math.cos(th), 0, math.sin(th)))
    add('helmet', _ribbon(a, b, c, lambda t: fwd(0.62 + 0.30 * t), lambda t: Vector((0, 1, 0)),
                          lambda t: 0.10, lambda t: 0.006 + 0.012 * _smooth(t), 10))
    add('visor', _patch(a, b, c, 2, 6, lambda s: 0.555, lambda s: 0.605, -0.085, 0.085, 0.009))
    add('trim', _ribbon(a, b, c, lambda t: fwd(0.92 + 1.50 * t), lambda t: Vector((0, 1, 0)),
                        lambda t: 0.15, lambda t: 0.006, 40))

    # the big rear spoiler: a wide shelf that lifts off the back and overhangs it, closed by side walls and its
    # trailing edge, and two dark exhaust slots under it
    L, N, M = 0.016, 12, 16
    def spoiler(i, j, lifted):
        t = i / (N - 1)
        el = 0.50 - 0.26 * t
        half = 0.48 * (0.80 + 0.20 * t)
        d = _dir(math.pi + half * (-1 + 2 * j / (M - 1)), el)
        p = _on_shell(d, a, b, c, 0.002)
        if lifted:
            p = p + _normal(p, a, b, c) * (L * _smooth(t)) + Vector((-0.012 * _smooth(t), 0, 0))
        return p
    add('helmet', _grid(N, M, lambda i, j: spoiler(i, j, True)))
    for j in (0, M - 1):
        add('helmet', _grid(N, 2, lambda i, k, j=j: spoiler(i, j, k == 1)))
    add('helmet', _grid(2, M, lambda k, j: spoiler(N - 1, j, k == 1)))
    for sd in (1, -1):
        az0, az1 = (math.pi + 0.06, math.pi + 0.36) if sd > 0 else (math.pi - 0.36, math.pi - 0.06)
        add('visor', _patch(a, b, c, 2, 6, lambda s: 0.10, lambda s: 0.16, az0, az1, 0.004))

    # the diagonal side ridges, from the spoiler's ends down and forward to the cheeks, and a raised pad low on each
    # side at the back
    for sd in (1, -1):
        c0, s0 = _path(_dir(sd * 2.55, 0.42), _dir(sd * 1.70, -0.36))
        add('helmet', _ribbon(a, b, c, c0, s0, lambda t: 0.07 * (1 - 0.35 * t), lambda t: 0.020 * (1 - 0.5 * t), 16))
        c1, s1 = _path(_dir(sd * 1.95, -0.50), _dir(sd * 2.35, -0.40))
        add('helmet', _ribbon(a, b, c, c1, s1, lambda t: 0.07 * math.sin(math.pi * (0.15 + 0.7 * t)), lambda t: 0.008, 10))
    return roles
