"""Render four QA views directly from exported retail fixture GLBs, not an app screenshot.

blender -b -t 6 --python-exit-code 1 -P scripts/render-yh-retail-fixtures.py -- OUTPUT_DIR
"""
from pathlib import Path
import json
import sys
import bpy
from mathutils import Vector

directory = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
manifest = json.loads((directory / "retail-dimensions.json").read_text())
mode = sys.argv[sys.argv.index("--") + 2:]
selected = set(mode or ("produce", "service", "checkout"))

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
    scene.cycles.samples = 40
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = .035
    scene.cycles.use_denoising = False
    scene.render.resolution_x = 624
    scene.render.resolution_y = 544
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    views = [
        ("front", (0,-7,0)), ("side",(7,0,0)), ("top",(0,0,7)),
        ("perspective",(3.6,-5.6,3.5)),
    ]
    if identifier == "checkout":
        views.append(("operator", (-3.6,5.6,3.5)))

    for view, offset in views:
        cam.data.type = "PERSP" if view in ("perspective", "operator") else "ORTHO"
        cam.data.lens = 70 if identifier == "produce" else (65 if identifier == "service" else 56)
        cam.data.ortho_scale = max({"produce": 2.22, "service": 2.65, "checkout": 3.15}[identifier], max(expected) * 1.22)
        cam.location = center + Vector(offset)
        if view == "top":
            cam.rotation_euler = (0,0,0)
        else:
            aim(cam, center)
        scene.render.filepath = str(directory / f"{identifier}-{view}.png")
        print(f"{identifier} {view}: {len(meshes)} imported meshes; bounds {bounds}", flush=True)
        bpy.ops.render.render(write_still=True)
