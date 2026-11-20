"""Render four QA views directly from exported pilot shelf GLBs, not an app screenshot.

blender -b -t 6 --python-exit-code 1 -P scripts/render-yh-replacement-pilot.py -- OUTPUT_DIR
"""
from pathlib import Path
import json
import sys
import bpy
from mathutils import Vector

directory = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
manifest = json.loads((directory / "fixture-pilot.json").read_text())
mode = sys.argv[sys.argv.index("--") + 2:]
detail_only = "--freezer-detail-only" in mode
selected = {"F050"} if detail_only else set(mode or [r["fixtureId"] for r in manifest["rows"]])

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

for source in manifest["rows"]:
    if source["fixtureId"] not in selected:
        continue
    for variant in source["models"]:
        if variant["variant"] not in ("before", "after"):
            continue
        identifier = source["fixtureId"] + "-" + variant["variant"]
        if detail_only and identifier != "F050-after":
            continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(directory / variant["file"]))
        scene = bpy.context.scene
        bpy.context.view_layer.update()
        meshes = [o for o in scene.objects if o.type == "MESH"]
        points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
        bounds = [(min(p[i] for p in points), max(p[i] for p in points)) for i in range(3)]
        expected = [d / 1000 for d in variant["actualSizeMm"]]
        for index, axis in enumerate((0, 2, 1)): # Blender X/Y/Z becomes W/D/H
            if abs((bounds[index][1] - bounds[index][0]) - expected[axis]) > .0001:
                raise RuntimeError(f"Unexpected imported extent in {identifier}: {bounds}")
        center = Vector((0, 0, .8)) # identical framing before/after

        world = bpy.data.worlds.new("Studio")
        world.use_nodes = True
        world.node_tree.nodes["Background"].inputs[0].default_value = (.73,.8,.93,1)
        world.node_tree.nodes["Background"].inputs[1].default_value = .48
        scene.world = world
        scene.render.film_transparent = True
        area("Key", (2,-5,7), 880, 5.0, center)
        area("Fill", (-4,-3,5), 680, 5.0, center)
        area("Rim", (1,4,6), 690, 4.5, center)

        cam = bpy.data.objects.new("Model verification camera", bpy.data.cameras.new("Verification"))
        bpy.context.collection.objects.link(cam)
        scene.camera = cam
        scene.render.engine = "CYCLES"
        scene.cycles.samples = 32
        scene.cycles.use_adaptive_sampling = True
        scene.cycles.adaptive_threshold = .035
        scene.cycles.use_denoising = False
        scene.render.resolution_x = 900
        scene.render.resolution_y = 390
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = "PNG"
        scene.render.image_settings.color_mode = "RGBA"

        # Camera and framing fixed per pair, independent of replacement extents.
        cam.data.type = "ORTHO"
        # The same scale is used for both variants in each row.
        cam.data.ortho_scale = max(2.7, max(max(v["actualSizeMm"][0], v["actualSizeMm"][2]) for v in source["models"]) * (.00130 if source["fixtureId"] == "F029" else .00122))
        cam.location = center + Vector((3.4,-11,7.8 if source["fixtureId"] in ("F029", "F050") else 3.6))
        aim(cam, center)
        scene.render.filepath = str(directory / f"{identifier}.png")
        print(f"{identifier}: {len(meshes)} imported meshes; bounds {bounds}", flush=True)
        if not detail_only:
            bpy.ops.render.render(write_still=True)
        if identifier == "F050-after":
            # Compare the same two middle modules at a high angle; only the glass
            # pane objects are hidden for the second diagnostic render.
            detail_center = Vector((0,0,.48))
            cam.data.ortho_scale = 5.75
            cam.location = detail_center + Vector((1.9,-5.2,8.2))
            aim(cam, detail_center)
            panes = [o for o in meshes if "sliding-pane-" in o.name]
            if len(panes) != 16:
                raise RuntimeError(f"Expected 16 panes, found {len(panes)}")
            for state in ("closed", "glass-hidden"):
                if state == "glass-hidden":
                    for pane in panes:
                        pane.hide_render = True
                scene.render.filepath = str(directory / f"F050-detail-{state}.png")
                bpy.ops.render.render(write_still=True)
