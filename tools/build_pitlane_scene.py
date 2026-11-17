"""Build a pit-lane scene with all 22 bikes and riders, in their team colours, and render it (GDD 11i-b).

Run from the project root:
  /Applications/Blender.app/Contents/MacOS/Blender -b "<debranded scene>.blend" -P tools/build_pitlane_scene.py -- \
      --out shots/pitlane

Each rider's bike is a copy of the rigged bike in the debranded scene, placed in a row in a pit lane. Team colours
come from the same rules as the game (tools/render_bike_sprites.py and src/core.js TEAMS). Two riders per team, 11 teams.
Renders are Workbench (flat studio light), not the game's models at game detail.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_bike_sprites as rbs  # noqa: E402  (TEAM_COLOURS and the colour helpers)

# the team designs from src/core.js TEAMS: body (c1), screen (c2), suit, helmet
TEAMS = [   # (body, screen, suit, helmet): the same as TEAMS in src/core.js (c1, c2, suit, helmet)
    ('#c8102e', '#f4f4f4', '#f4f4f4', '#c8102e'), ('#1f4fd1', '#0b1530', '#c0c8d0', '#0b1530'),
    ('#ff6a13', '#141414', '#2a2a2e', '#ff6a13'), ('#93d500', '#121212', '#121212', '#93d500'),
    ('#1e2226', '#ffcc00', '#d4a017', '#1e2226'), ('#39b6e8', '#ffffff', '#f4f4f4', '#39b6e8'),
    ('#6a2bd9', '#c9ff3d', '#c9ff3d', '#6a2bd9'), ('#b9c2c9', '#c8102e', '#c8102e', '#b9c2c9'),
    ('#ffd400', '#0057b8', '#0057b8', '#ffd400'), ('#efefef', '#009246', '#009246', '#efefef'),
    ('#0a2a6b', '#ff3d7f', '#ff3d7f', '#0a2a6b'),
]
SLOTS = 22
SPACING = 3.6           # m between bikes along the pit lane
RIDER_PREFIX = ('Human', 'RiderRig')
RIG_LINKED = ('Peg.', 'KneePole.', 'Grip.', 'ElbowPole.', 'FootPeg.')


def col(hexs, a=1.0):
    h = hexs.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (a,)


def mat(name, hexs, rough=0.4):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = col(hexs)
    m.use_nodes = False
    return m


def role_of_part(name):
    num = name.replace('Part', '').split('_')[0]
    if num in ('1', '3', '4', '9'):
        return 'body'
    if num == '2':
        return 'screen'
    if name == 'Part8':
        return 'wheel'
    return 'dark'


def ensure_base_materials():
    return {'dark': mat('pit_dark', '#1b1b1b'), 'rider_skin': mat('pit_skin', '#d9b08c')}


def copy_object(obj, collection, remap):
    new = obj.copy()
    new.hide_render = False   # the originals are hidden from the render; the copies must not inherit that
    if obj.data is not None and obj.type in ('MESH', 'ARMATURE', 'CURVE'):
        new.data = obj.data.copy()
    collection.objects.link(new)
    remap[obj] = new
    return new


def build_slot(k, base, objs, anchor_loc):
    """One bike and rider, parented to an anchor empty at anchor_loc."""
    team = k // 2
    c1, c2, suit, helmet = TEAMS[team]
    anchor = bpy.data.objects.new(f'Slot{k:02d}', None)
    bpy.context.scene.collection.objects.link(anchor)
    anchor.location = anchor_loc
    remap = {}
    coll = bpy.context.scene.collection
    for o in objs:
        new = copy_object(o, coll, remap)
    for o in objs:
        new = remap[o]
        if o.parent is None or o.parent not in remap:
            new.parent = anchor
            new.matrix_parent_inverse = Matrix_identity()
        else:
            new.parent = remap[o.parent]
            new.matrix_parent_inverse = o.matrix_parent_inverse.copy()
    # constraints and modifiers point at the copies, so each rider uses its own rig and targets
    for o in objs:
        new = remap[o]
        if o.type == 'ARMATURE':
            for pb in new.pose.bones:
                for c in pb.constraints:
                    for attr in ('target', 'pole_target'):
                        if hasattr(c, attr) and getattr(c, attr) is not None:
                            setattr(c, attr, remap.get(getattr(c, attr), getattr(c, attr)))
        for md in new.modifiers:
            if hasattr(md, 'object') and md.object is not None:
                md.object = remap.get(md.object, md.object)
    # colours by part and by rider role
    for o in objs:
        new = remap[o]
        if o.type != 'MESH':
            continue
        if o.name == 'Human':
            new.data.materials.clear(); new.data.materials.append(mat(f'pit_suit_{team}', suit))
        elif o.name.startswith('Part'):
            r = role_of_part(o.name)
            colour = {'body': c1, 'screen': c2, 'wheel': '#1b1b1b', 'dark': '#1b1b1b'}[r]
            new.data.materials.clear(); new.data.materials.append(mat(f'pit_{r}_{team}', colour))
    return anchor, remap


def Matrix_identity():
    from mathutils import Matrix
    return Matrix.Identity(4)


def add_helmet(k, team, remap, rig_orig):
    """A helmet sphere on the copied rig's head, in the team's helmet colour."""
    rig = remap[rig_orig]
    bpy.context.view_layer.update()
    head = rig.matrix_world @ rig.pose.bones['Head'].tail
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=24, ring_count=12, location=head + Vector((0, 0, 0.02)))
    h = bpy.context.active_object
    h.name = f'Helmet{k:02d}'
    h.scale = (0.12, 0.10, 0.13)
    h.data.materials.append(mat(f'pit_helmet_{team}', TEAMS[team][3]))
    return h


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    a = {argv[i].lstrip('-'): argv[i + 1] for i in range(0, len(argv) - 1, 2)}
    out = a.get('out', os.path.join('shots', 'pitlane'))
    os.makedirs(out, exist_ok=True)
    ensure_base_materials()

    # the source objects for one bike and rider, from the debranded scene
    # the bike's root empty (it carries the model's scale) is copied too, so the parts keep their transform
    objs = [o for o in bpy.data.objects if o.name.startswith('Part') or o.name in RIDER_PREFIX
            or o.name.startswith(RIG_LINKED) or o.name == 'Ducati_Lenovo_Team']
    # leave the original in place and build copies only
    originals = list(objs)
    for o in originals:
        o.hide_render = True
    rig_orig = bpy.data.objects['RiderRig']

    # the pit lane: the bikes in one row, facing forward (+x), 3.6 m apart
    first = -(SLOTS - 1) / 2 * SPACING
    for k in range(SLOTS):
        anchor, remap = build_slot(k, None, originals, Vector((0, first + k * SPACING, 0)))
        anchor.rotation_euler = (0, 0, math.radians(0))
        add_helmet(k, k // 2, remap, rig_orig)
        print('SLOT', k, 'team', k // 2)

    # the pit lane floor and boxes
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, -0.001))
    floor = bpy.context.active_object
    floor.scale = (40, 60, 1)
    floor.data.materials.append(mat('pit_floor', '#3a3d41'))
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, -0.0005))
    lines = bpy.context.active_object
    lines.scale = (0.12, 60, 1)
    lines.data.materials.append(mat('pit_line', '#f2f2f2'))

    # lighting and camera (Workbench: flat studio light, material colours)
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_WORKBENCH'
    scn.display.shading.light = 'STUDIO'
    scn.display.shading.color_type = 'MATERIAL'
    scn.render.resolution_x = 1800
    scn.render.resolution_y = 900
    scn.render.film_transparent = False
    scn.world = scn.world or bpy.data.worlds.new('pit_world')
    scn.display.shading.background_type = 'VIEWPORT'
    scn.display.shading.background_color = (0.62, 0.64, 0.66)

    # the row runs along y: an overview from above, and the whole line seen from behind
    views = {
        'pitlane_overview': ((60.0, -60.0, 60.0), (0, 0, 0.5), 'ORTHO', 90),
        'pitlane_rear_row': ((-45.0, 0.0, 3.0), (0, 0, 0.9), 'ORTHO', 84),   # behind the row, looking along the bikes
    }
    for name, (loc, tgt, kind, size) in views.items():
        cd = bpy.data.cameras.new(name)
        cd.type = kind
        cd.ortho_scale = size
        co = bpy.data.objects.new(name, cd)
        bpy.context.scene.collection.objects.link(co)
        co.location = loc
        co.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        scn.camera = co
        scn.render.filepath = os.path.join(out, name + '.png')
        bpy.ops.render.render(write_still=True)
        print('RENDERED', name)


if __name__ == '__main__':
    main()
