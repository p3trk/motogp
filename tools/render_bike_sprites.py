"""Render the 3D bike and rider sprites for the game (GDD 11i).

Run from the project root, pointing at the rigged bike scene (models/ is not in git):
  /Applications/Blender.app/Contents/MacOS/Blender -b "<scene>.blend" -P tools/render_bike_sprites.py -- \
      --out shots/bike3d --js src/bike3d.js

For each team in TEAM_COLOURS it renders two top-down, transparent sprites at the
game's size (SPR 48 px per metre, rendered at 4x):
  chassis: the bike with no rider
  rider:   the rider only, on the same bike position
Both use the team's fictional colours, not the source livery, so no real sponsor
marks are drawn. The result is written as src/bike3d.js (generated, do not edit).
"""
import base64
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

# Team colours copied from TEAMS in src/core.js (c1, c2). Keep in step; the unit tests check the count.
TEAM_COLOURS = [
    ('#c8102e', '#f4f4f4'), ('#1f4fd1', '#0b1530'), ('#ff6a13', '#141414'), ('#93d500', '#121212'),
    ('#1e2226', '#ffcc00'), ('#39b6e8', '#ffffff'), ('#6a2bd9', '#c9ff3d'), ('#b9c2c9', '#c8102e'),
    ('#ffd400', '#0057b8'), ('#efefef', '#009246'), ('#0a2a6b', '#ff3d7f'),
]
DARK = '#1b1b1b'
RIDER_SUIT = '#ececec'   # near white: stands out from the team bodywork and the dark tarmac
SPR = 48                 # game pixels per metre (src/render.js)
W_M, H_M = 2.5, 1.3      # sprite canvas in metres (SPW, SPH)
PX_PER_M = SPR * 4       # rendered at 4x the game's resolution, so the CLOSE camera stays sharp
BIKE_LEN = 1.96          # bike length in the game's sprite units, metres
RIDER_NAMES = ('Human', 'RiderRig')


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def script_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return {argv[k].lstrip('-'): argv[k + 1] for k in range(0, len(argv) - 1, 2)}


def part_colour(name, c1, c2):
    # Parts 1, 3, 4, 9 are the bodywork (team colour 1). Part 2 is the screen (colour 2).
    # Everything else (wheels, stand, small parts) is dark.
    num = name.replace('Part', '').split('_')[0]
    if num in ('1', '3', '4', '9'):
        return hex_rgb(c1)
    if num == '2':
        return hex_rgb(c2)
    return hex_rgb(DARK)


def set_colours(c1, c2):
    for m in bpy.data.materials:
        if m.name.startswith('Part') and m.name.endswith('_Mat'):
            m.diffuse_color = (*part_colour(m.name, c1, c2), 1.0)
        elif m.name == 'RiderSuit':
            m.diffuse_color = (*hex_rgb(RIDER_SUIT), 1.0)


def world_bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def place_scene():
    """Turn the whole scene 90 degrees so the bike points along +X (the game's forward), scale it to
    BIKE_LEN and centre it on the origin."""
    roots = [o for o in bpy.data.objects if o.parent is None and o.name not in ('Camera', 'Light')]
    turn = bpy.data.objects.new('Turn', None)
    bpy.context.scene.collection.objects.link(turn)
    for o in roots:
        o.parent = turn
        o.matrix_parent_inverse = Matrix.Identity(4)
    turn.rotation_euler = (0, 0, math.pi / 2)
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    lo, hi = world_bounds(meshes)
    s = BIKE_LEN / (hi.x - lo.x)
    turn.scale = (s, s, s)
    bpy.context.view_layer.update()
    lo, hi = world_bounds(meshes)
    centre = (lo + hi) / 2
    turn.location = (-centre.x, -centre.y, 0)
    bpy.context.view_layer.update()


def top_camera():
    cd = bpy.data.cameras.new('TopCam')
    cd.type = 'ORTHO'
    cd.ortho_scale = W_M
    co = bpy.data.objects.new('TopCam', cd)
    bpy.context.scene.collection.objects.link(co)
    co.location = (0, 0, 10)
    co.rotation_euler = (0, 0, 0)
    return co


def set_render_visibility(hidden_names):
    """Hide the named objects and everything parented under them, from the renders."""
    for o in bpy.data.objects:
        chain, p = [o.name], o.parent
        while p is not None:
            chain.append(p.name)
            p = p.parent
        o.hide_render = any(n in hidden_names for n in chain)


def render_sprite(path, cam):
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_WORKBENCH'
    scn.display.shading.light = 'FLAT'
    scn.display.shading.color_type = 'MATERIAL'
    scn.view_settings.view_transform = 'Standard'
    scn.view_settings.look = 'None'
    scn.render.film_transparent = True
    scn.render.resolution_x = int(W_M * PX_PER_M)
    scn.render.resolution_y = int(H_M * PX_PER_M)
    scn.render.resolution_percentage = 100
    scn.render.image_settings.file_format = 'PNG'
    scn.render.image_settings.color_mode = 'RGBA'
    scn.camera = cam
    scn.render.filepath = path
    bpy.ops.render.render(write_still=True)


def encode(paths):
    with open(paths, 'rb') as f:
        return base64.b64encode(f.read()).decode('ascii')


def main():
    a = script_args()
    out_dir = a.get('out', os.path.join('shots', 'bike3d'))
    js_path = a.get('js', os.path.join('src', 'bike3d.js'))
    os.makedirs(out_dir, exist_ok=True)

    place_scene()
    cam = top_camera()
    lines = []
    for k, (c1, c2) in enumerate(TEAM_COLOURS):
        set_colours(c1, c2)
        set_render_visibility(RIDER_NAMES)            # chassis: no rider
        chassis = os.path.join(out_dir, f'team{k}_chassis.png')
        render_sprite(chassis, cam)
        set_render_visibility(('Ducati_Lenovo_Team', 'FootPeg.L', 'FootPeg.R'))  # rider only
        rider = os.path.join(out_dir, f'team{k}_rider.png')
        render_sprite(rider, cam)
        lines.append(f"  {{ chassis: 'data:image/png;base64,{encode(chassis)}', "
                     f"rider: 'data:image/png;base64,{encode(rider)}' }},")
        print('TEAM', k, c1, c2)

    body = ('// Generated by tools/render_bike_sprites.py (GDD 11i). Do not edit by hand.\n'
            f'const BIKE3D = {{ w: {int(W_M * PX_PER_M)}, h: {int(H_M * PX_PER_M)}, teams: [\n'
            + '\n'.join(lines) + '\n] };\n')
    with open(js_path, 'w', encoding='ascii') as f:
        f.write(body)
    print('WROTE', js_path, len(lines), 'teams')


if __name__ == '__main__':
    main()
