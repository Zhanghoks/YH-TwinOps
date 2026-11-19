"""Headless Blender studio QA of app-derived shelf GLBs (not app screenshots).

Usage: blender -b -t 4 --python-exit-code 1 -P scripts/render-yh-shelf-preview.py -- OUTPUT_DIR
"""
from pathlib import Path
import sys
import bpy
from mathutils import Vector

directory = Path(sys.argv[sys.argv.index("--") + 1]).resolve()


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def light(name, location, energy, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    aim(obj, (0, 0, .8))


for sample in ("grocery", "household"):
    for stock in ("empty", "stocked"):
        variant = f"{sample}-{stock}"
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(directory / f"{variant}.glb"))
        model_mesh_count = sum(obj.type == "MESH" for obj in bpy.context.scene.objects)
        if model_mesh_count < 10:
            raise RuntimeError(f"Incomplete import: {variant} ({model_mesh_count} meshes)")
        scene = bpy.context.scene
        bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.001))
        floor = bpy.context.object
        matte = bpy.data.materials.new("Studio floor")
        matte.diffuse_color = (.16, .19, .22, 1)
        floor.data.materials.append(matte)
        light("Key softbox", (2.0, -3.5, 4.5), 300, 3.2)
        light("Fill softbox", (-3.5, -1.5, 3.0), 200, 3.2)
        light("Rim softbox", (1.5, 2.8, 3.3), 230, 2.6)
        world = bpy.data.worlds.new("Studio")
        world.use_nodes = True
        world.node_tree.nodes["Background"].inputs[0].default_value = (.24, .29, .39, 1)
        world.node_tree.nodes["Background"].inputs[1].default_value = .38
        scene.world = world

        camera_data = bpy.data.cameras.new("Matched preview camera")
        camera_data.type = "ORTHO"
        camera_data.ortho_scale = 2.55
        camera = bpy.data.objects.new("Matched preview camera", camera_data)
        bpy.context.collection.objects.link(camera)
        camera.location = (2.2, -5.7, 2.35)
        aim(camera, (0, 0, .89))
        scene.camera = camera

        scene.render.engine = "CYCLES"
        scene.cycles.samples = 48
        scene.cycles.use_denoising = False
        scene.render.resolution_x = 720
        scene.render.resolution_y = 615
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = "PNG"
        scene.render.filepath = str(directory / f"{variant}.png")
        print(f"Rendering {variant}: {model_mesh_count} imported app meshes", flush=True)
        bpy.ops.render.render(write_still=True)
