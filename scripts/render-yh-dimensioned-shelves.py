"""Render four QA views directly from exported dimensioned shelf GLBs, not an app screenshot.

blender -b -t 6 --python-exit-code 1 -P scripts/render-yh-dimensioned-shelves.py -- OUTPUT_DIR
"""
from pathlib import Path
import json
import sys
import bpy
from mathutils import Vector

directory = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
manifest = json.loads((directory / "shelf-dimensions.json").read_text())
mode = sys.argv[sys.argv.index("--") + 2:]
selected = set(mode or ("wall", "island"))

def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

def area(name, location, energy, size, target):
    light = bpy.data.lights.new(name, "AREA")
    light.energy = energy
    light.shape = "DISK"
    light.size = size
    obj = bpy.data.objects.new(name, light)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    aim(obj, target)

for variant in manifest["models"]:
    identifier = variant["id"]
    if identifier not in selected:
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(directory / variant["file"]))
    scene = bpy.context.scene
    bpy.context.view_layer.update()
    meshes = [o for o in scene.objects if o.type == "MESH"]
    points = [o.matrix_world @ Vector(corner) for o in meshes for corner in o.bound_box]
    bounds = [(min(p[i] for p in points), max(p[i] for p in points)) for i in range(3)]
    expected = [d / 1000 for d in variant["sizeMm"]]
    for index, axis in enumerate((0, 2, 1)): # Blender X/Y/Z becomes W/D/H
        if abs((bounds[index][1] - bounds[index][0]) - expected[axis]) > .0001:
            raise RuntimeError(f"Unexpected imported extent in {identifier}: {bounds}")
    center = Vector([(a+b)/2 for a,b in bounds])

    world = bpy.data.worlds.new("Studio")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (.73,.8,.93,1)
    world.node_tree.nodes["Background"].inputs[1].default_value = .48
    scene.world = world
    scene.render.film_transparent = True
    area("Key", (2,-4,6), 520, 4.0, center)
    area("Fill", (-4,-2,4), 400, 4.5, center)
    area("Rim", (1,3,5), 450, 4.0, center)

    cam = bpy.data.objects.new("Model verification camera", bpy.data.cameras.new("Verification"))
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 48
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = .04
    scene.cycles.use_denoising = False
    scene.render.resolution_x = 624
    scene.render.resolution_y = 544
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    for view, offset in [("front",(0,-7,0)),("side",(7,0,0)),("top",(0,0,7)),("perspective",(3.3,-5.8,2.8))]:
        cam.data.type = "PERSP" if view == "perspective" else "ORTHO"
        cam.data.lens = 56
        cam.data.ortho_scale = 2.96
        cam.location = center + Vector(offset)
        if view == "top":
            cam.rotation_euler = (0,0,0)
        else:
            aim(cam, center)
        scene.render.filepath = str(directory / f"{identifier}-{view}.png")
        print(f"{identifier} {view}: {len(meshes)} imported meshes; bounds {bounds}", flush=True)
        bpy.ops.render.render(write_still=True)
