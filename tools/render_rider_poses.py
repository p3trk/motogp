"""Render the rider's hang-off poses on the leaned bike, to check them by eye before they are baked (GDD 11l-b).

Run from the project root, on the rigged bike scene:
  /Applications/Blender.app/Contents/MacOS/Blender -b "<scene>.blend" -P tools/render_rider_poses.py -- \
      --out shots/poses [--set HIP_SHIFT=0.3,SPINE_ROLL=0.2]

For each lean in LEANS it poses the rider (tools/rider_pose.py), rolls the whole bike by the lean about the contact line
(as the game does: Rx(-lean)), and renders it from behind and from a raised rear three-quarter. Files: <out>/<view>_<deg>.png.
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_bike_sprites as rbs  # noqa: E402
import rider_pose  # noqa: E402

LEANS = [0, 10, 20, 30, 40, 64]


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return {argv[i].lstrip('-'): argv[i + 1] for i in range(0, len(argv) - 1, 2)}


def main():
    a = args()
    out = a.get('out', os.path.join('shots', 'poses'))
    os.makedirs(out, exist_ok=True)
    params = {}
    for kv in filter(None, a.get('set', '').split(',')):
        k, v = kv.split('=')
        params[k] = float(v)

    rbs.place_scene()
    bpy.context.view_layer.update()
    rbs.set_colours('#39b6e8', '#ffffff')              # sky bike; the rider's suit is near white
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    lo_z = min(min((o.matrix_world @ Vector(c)).z for c in o.bound_box) for o in meshes if o.name != 'Human')

    # the lean: an empty on the contact line, the scene's root under it
    turn = bpy.data.objects['Turn']
    lean_e = bpy.data.objects.new('Lean', None)
    bpy.context.scene.collection.objects.link(lean_e)
    lean_e.location = (0, 0, lo_z)
    bpy.context.view_layer.update()
    turn.parent = lean_e
    turn.matrix_parent_inverse = lean_e.matrix_world.inverted()
    bpy.context.view_layer.update()

    rig = bpy.data.objects['RiderRig']
    rider_pose.remember(rig)
    rider_pose.measure_hands(rig, bpy.data.objects['Human'])
    rider_pose.setup([o for o in meshes if o.name.startswith('Part')], lo_z)
    screen = bpy.data.objects['Part2']
    screen_top = max((screen.matrix_world @ v.co).z for v in screen.data.vertices)

    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_WORKBENCH'
    scn.display.shading.light = 'STUDIO'
    scn.display.shading.color_type = 'MATERIAL'
    scn.display.shading.show_shadows = False
    scn.render.resolution_x = 700
    scn.render.resolution_y = 700
    scn.display.shading.background_type = 'VIEWPORT'
    scn.display.shading.background_color = (0.86, 0.86, 0.86)

    cams = {}
    for name, loc in (('rear', (-6.0, 0.0, lo_z + 0.75)), ('rear34', (-4.5, -3.0, lo_z + 3.2))):
        cd = bpy.data.cameras.new(name)
        cd.type = 'ORTHO'
        cd.ortho_scale = 2.6
        co = bpy.data.objects.new(name, cd)
        scn.collection.objects.link(co)
        co.location = loc
        tgt = Vector((0, 0, lo_z + 0.75))
        co.rotation_euler = (tgt - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        cams[name] = (co, Vector(loc) - tgt)

    for deg in LEANS:
        lean = math.radians(deg)
        lean_e.rotation_euler = (0, 0, 0)                  # pose on the upright bike: the pose works in the bike's axes
        bpy.context.view_layer.update()
        rider_pose.pose(rig, lean, params)
        lean_e.rotation_euler = (-lean, 0, 0)              # then the bike leans as in the game, the rider with it
        bpy.context.view_layer.update()
        lean_e.rotation_euler = (0, 0, 0); bpy.context.view_layer.update()
        head = rig.matrix_world @ rig.pose.bones['Head'].tail
        print('LEAN', deg, 'wrist_gap', rider_pose.wrist_gap(rig), 'head_joint_z', round(head.z - lo_z, 3),
              'screen_top_z', round(screen_top - lo_z, 3), rider_pose._BIKE.get('last', {}) if deg else '')
        lean_e.rotation_euler = (-lean, 0, 0); bpy.context.view_layer.update()
        # the cameras follow the leaned bike: aim at a point 0.6 m up the bike, rolled with it
        aim = Matrix.Rotation(-lean, 3, 'X') @ Vector((0, 0, 0.6)) + Vector((0, 0, lo_z))
        for name, (co, rel) in cams.items():
            co.location = aim + rel
            co.rotation_euler = (-rel).to_track_quat('-Z', 'Y').to_euler()
            scn.camera = co
            scn.render.filepath = os.path.join(out, f'{name}_{deg}.png')
            bpy.ops.render.render(write_still=True)
    print('DONE')


if __name__ == '__main__':
    main()
