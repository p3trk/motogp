"""Render the race helmet (tools/helmet.py) on its own in a few team colours, to check its shape by eye (GDD 11i-b).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P tools/render_helmet.py -- --out shots/helmet
"""
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helmet  # noqa: E402

HEAD_HALF = Vector((0.132, 0.113, 0.119))   # the rider's head at rest (from the export log)
TEAMS = [('Rosso Veloce', '#c8102e', '#f4f4f4'), ('Lime Works', '#93d500', '#121212'), ('Celeste', '#39b6e8', '#f4f4f4')]
VIEWS = {'side': (Vector((0, -2, 0.05)), 0.5), 'front': (Vector((2, 0, 0.05)), 0.5), 'rear': (Vector((-2, 0, 0.1)), 0.5),
         'top': (Vector((0.001, 0, 2)), 0.5), 'front34': (Vector((1.6, -1.3, 0.35)), 0.55)}


def col(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = dict(zip(argv[::2], argv[1::2])).get('--out', os.path.join('shots', 'helmet'))
    os.makedirs(out, exist_ok=True)
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    pieces = helmet.build(HEAD_HALF)
    objs = {}
    for role, (verts, tris) in pieces.items():
        me = bpy.data.meshes.new(role)
        me.from_pydata([tuple(v) for v in verts], [], tris)
        me.shade_smooth() if hasattr(me, 'shade_smooth') else None
        ob = bpy.data.objects.new(role, me)
        bpy.context.scene.collection.objects.link(ob)
        m = bpy.data.materials.new(role)
        me.materials.append(m)
        objs[role] = (ob, m)
    print('TRIS', {r: len(t) for r, (v, t) in pieces.items()})
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_WORKBENCH'
    scn.display.shading.light = 'STUDIO'
    scn.display.shading.color_type = 'MATERIAL'
    scn.display.shading.background_type = 'VIEWPORT'
    scn.display.shading.background_color = (0.8, 0.8, 0.8)
    scn.render.resolution_x = scn.render.resolution_y = 400
    for k, (name, shell, trim) in enumerate(TEAMS):
        objs['helmet'][1].diffuse_color = col(shell)
        objs['trim'][1].diffuse_color = col(trim)
        objs['visor'][1].diffuse_color = col('#0d1116')
        for v, (loc, scale) in VIEWS.items():
            cd = bpy.data.cameras.new(v)
            cd.type = 'ORTHO'
            cd.ortho_scale = scale
            co = bpy.data.objects.new(v, cd)
            scn.collection.objects.link(co)
            co.location = loc
            co.rotation_euler = (-loc).to_track_quat('-Z', 'Y').to_euler()
            scn.camera = co
            scn.render.filepath = os.path.join(out, f'team{k}_{v}.png')
            bpy.ops.render.render(write_still=True)
    print('DONE')


if __name__ == '__main__':
    main()
