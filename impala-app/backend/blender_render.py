"""
EXPERIMENTAL - NOT USED IN PROD

blender_render.py — Blender bpy render script for Impala.

Called via:
    blender --background --python blender_render.py -- '<json_config>'

Coordinate system notes:
  Nerfstudio camera_to_world matrices use OpenGL convention:
    X right, Y up, -Z forward (camera looking along -Z)
  Blender world uses Z-up, Y-forward by default, BUT camera matrix_world
  uses the same OpenGL convention (camera looks down -Z in local space).
  We apply identical conversion as CameraSync.tsx:
    worldMat = Rx(-90°) × nerfstudio_mat
  Then flip the camera-local Y and Z axes (OpenGL→Blender camera convention).
"""

import bpy
import math
import sys
import os
import json

# Parse config from CLI args

arg_sep = sys.argv.index("--") + 1 if "--" in sys.argv else len(sys.argv)
config_source = sys.argv[arg_sep] if arg_sep < len(sys.argv) else "{}"
if config_source.endswith(".json"):
    with open(config_source, "r") as f:
        config = json.load(f)
else:
    config = json.loads(config_source)

ENGINE    = config.get("engine", "eevee")
SAMPLES   = config.get("samples", 64)
WIDTH     = config.get("width", 1920)
HEIGHT    = config.get("height", 1080)
MODEL_PATH = config.get("model_path", "")
OUTPUT_DIR = config.get("output_dir", "/tmp/impala_frames")
FRAMES    = config.get("frames", [])
FOV_DEG   = config.get("fov", 45.0)

OBJ_POS   = config.get("obj_pos",   [0, 0, 0])
OBJ_ROT   = config.get("obj_rot",   [0, 0, 0])
OBJ_SCALE = config.get("obj_scale", [1, 1, 1])

SCENE_POS   = config.get("scene_pos",   [0, 0, 0])
SCENE_ROT   = config.get("scene_rot",   [0, 0, 0])
SCENE_SCALE = config.get("scene_scale", [1, 1, 1])

INCLUDE_SHADOWS = config.get("include_shadows", True)
RENDER_OCCLUSION = config.get("render_occlusion", True)
PROXY_PATH       = config.get("proxy_path", "")

ENV_INTENSITY  = config.get("env_intensity", 1.0)
ENV_ROTATION   = config.get("env_rotation",  0.0)
LIGHT_ELEVATION = config.get("light_elevation", 45.0)
ENV_TINT       = config.get("env_tint", "#ffffff")
SHADOW_BLUR    = config.get("shadow_blur", 0.5)
SHADOW_OPACITY = config.get("shadow_opacity", 0.4)

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Mathutils shorthand

from mathutils import Matrix, Vector, Euler, Color
import mathutils

def hex_to_rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))

# Clear default scene

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()

for block in list(bpy.data.meshes):
    bpy.data.meshes.remove(block)

# Render settings

scene = bpy.context.scene
scene.render.resolution_x = WIDTH
scene.render.resolution_y = HEIGHT
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"

if ENGINE == "cycles":
    scene.render.engine = "CYCLES"
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = True
    # GPU preference (CUDA, HIP, Metal, CPU fallback)
    prefs = bpy.context.preferences.addons.get("cycles")
    if prefs:
        cp = prefs.preferences
        for dev_type in ("CUDA", "HIP", "METAL"):
            try:
                cp.compute_device_type = dev_type
                break
            except Exception:
                pass
else:
    # Eevee Next (Blender 4.2+, 5.x default)
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except Exception:
        scene.render.engine = "BLENDER_EEVEE"

# World / sky lighting
# Uses Blender's Nishita sky model to match real outdoor scenes.

world = bpy.data.worlds.new("ImpalaWorld")
scene.world = world
world.use_nodes = True
wnt = world.node_tree
wnt.nodes.clear()
sky_node = wnt.nodes.new("ShaderNodeTexSky")

theta = math.radians(ENV_ROTATION)
phi   = math.radians(LIGHT_ELEVATION)

# Different Blender versions/builds rename the Nishita enum or default to different sky models.
try:
    sky_node.sun_elevation = phi
    sky_node.sun_rotation  = theta
except Exception:
    pass

# Safely try setting Preetham/Hosek-style sun direction vector:
try:
    sky_node.sun_direction = (
        math.cos(phi) * math.sin(-theta),
        math.cos(phi) * math.cos(-theta),
        math.sin(phi)
    )
except Exception:
    pass

bg_node  = wnt.nodes.new("ShaderNodeBackground")
out_node = wnt.nodes.new("ShaderNodeOutputWorld")

r, g, b = hex_to_rgb(ENV_TINT)
tint_node = wnt.nodes.new("ShaderNodeMixRGB")
tint_node.blend_type = "MULTIPLY"
tint_node.inputs[0].default_value = 1.0
tint_node.inputs[2].default_value = (r, g, b, 1.0)

wnt.links.new(sky_node.outputs["Color"], tint_node.inputs[1])
wnt.links.new(tint_node.outputs["Color"], bg_node.inputs["Color"])
wnt.links.new(bg_node.outputs["Background"], out_node.inputs["Surface"])
bg_node.inputs["Strength"].default_value = ENV_INTENSITY

# Sun lamp

bpy.ops.object.light_add(type="SUN", location=(0, 0, 10))
sun = bpy.context.active_object
sun.data.energy = ENV_INTENSITY * 5.0
sun.data.angle  = max(0.01, SHADOW_BLUR * 0.4)   # larger → softer shadow
sun.data.use_shadow = True

# Convert spherical coords to Blender sun euler rotation
# Blender sun direction: -Z of the lamp points toward lit surfaces
# elevation=90° → straight down → rotation_euler = (0, 0, ...)
sun.rotation_euler = Euler((
    math.pi / 2.0 - phi,
    0.0,
    -theta,
), "XYZ")

# Import 3D model (GLTF / OBJ)

model_obj = None
if MODEL_PATH and os.path.isfile(MODEL_PATH):
    ext = os.path.splitext(MODEL_PATH)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=MODEL_PATH)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=MODEL_PATH)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=MODEL_PATH)

    imported = [o for o in bpy.context.selected_objects if o.type == "MESH"]
    if imported:
        # Parent all into a single root
        bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
        root = bpy.context.active_object
        root.name = "ImpalaModelRoot"
        for ob in imported:
            ob.parent = root

        root.location = Vector(OBJ_POS)
        root.rotation_euler = Euler(OBJ_ROT, "XYZ")
        root.scale = Vector(OBJ_SCALE)
        model_obj = root

        # Enable shadow casting on all mesh children
        for ob in imported:
            try:
                ob.visible_shadow = True
            except AttributeError:
                pass

# Occlusion Proxy Mesh 
# The proxy represents the scene geometry. We assign it a Holdout material so it
# punches a transparent hole in the render to accurately occlude the custom object/shadows.

if RENDER_OCCLUSION and PROXY_PATH and os.path.isfile(PROXY_PATH):
    print(f"[IMPALA] Importing occlusion proxy from {PROXY_PATH}")
    ext = os.path.splitext(PROXY_PATH)[1].lower()
    
    pre_import = set(bpy.context.scene.objects)
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=PROXY_PATH)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=PROXY_PATH)
    elif ext == ".ply":
        bpy.ops.import_mesh.ply(filepath=PROXY_PATH)
    
    post_import = set(bpy.context.scene.objects)
    proxy_objs = list(post_import - pre_import)
    
    if proxy_objs:
        bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
        proxy_root = bpy.context.active_object
        proxy_root.name = "ImpalaProxyRoot"
        
        for ob in proxy_objs:
            ob.parent = proxy_root
        
        proxy_root.location = Vector(SCENE_POS)
        proxy_root.rotation_euler = Euler(SCENE_ROT, "XYZ")
        proxy_root.scale = Vector(SCENE_SCALE)
        
        hout_mat = bpy.data.materials.new(name="Holdout_Mat")
        hout_mat.use_nodes = True
        for node in hout_mat.node_tree.nodes:
            hout_mat.node_tree.nodes.remove(node)
        hn = hout_mat.node_tree.nodes.new("ShaderNodeHoldout")
        out = hout_mat.node_tree.nodes.new("ShaderNodeOutputMaterial")
        hout_mat.node_tree.links.new(hn.outputs[0], out.inputs[0])
        
        for ob in proxy_objs:
            if ob.type == "MESH":
                ob.data.materials.clear()
                ob.data.materials.append(hout_mat)
                # Eevee holdout needs blend_method = 'BLEND' or it won't actually be transparent
                hout_mat.blend_method = 'BLEND'

# Shadow catcher plane

if INCLUDE_SHADOWS:
    bpy.ops.mesh.primitive_plane_add(size=30, location=(OBJ_POS[0], OBJ_POS[1], OBJ_POS[2]))
    shadow_plane = bpy.context.active_object
    shadow_plane.name = "ImpalaShadowCatcher"
    shadow_plane.is_shadow_catcher = True   # Blender 3.0+

# Camera setup
# Nerfstudio Blender matrix conversion (same as CameraSync.tsx)

WORLD_ROT  = Matrix.Rotation(-math.pi / 2, 4, "X")
COORD_FLIP = Matrix([
    [1,  0,  0, 0],
    [0, -1,  0, 0],
    [0,  0, -1, 0],
    [0,  0,  0, 1],
])

cam_data = bpy.data.cameras.new("ImpalaCamera")
cam_data.lens_unit = "FOV"
cam_data.angle = math.radians(FOV_DEG)
cam_data.clip_start = 0.001
cam_data.clip_end = 1000.0

cam_obj = bpy.data.objects.new("ImpalaCamera", cam_data)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj

# Per-frame render loop

for frame_data in FRAMES:
    idx = frame_data["index"]
    mat_raw = frame_data.get("matrix", [])

    if not mat_raw:
        print(f"[IMPALA] Frame {idx}: no matrix, skipping.")
        continue

    # Flatten nested list or use flat
    if mat_raw and isinstance(mat_raw[0], list):
        flat = [v for row in mat_raw for v in row]
    else:
        flat = list(mat_raw)

    if len(flat) < 12:
        print(f"[IMPALA] Frame {idx}: matrix too short ({len(flat)}), skipping.")
        continue

    # Pad to 4×4 if 3×4
    if len(flat) == 12:
        flat = flat[:4] + flat[4:8] + flat[8:12] + [0.0, 0.0, 0.0, 1.0]

    ns_mat = Matrix((
        flat[0:4],
        flat[4:8],
        flat[8:12],
        flat[12:16],
    ))

    blender_mat = WORLD_ROT @ ns_mat @ COORD_FLIP
    cam_obj.matrix_world = blender_mat
    bpy.context.view_layer.update()

    output_path = os.path.join(OUTPUT_DIR, f"frame_{idx:05d}.png")
    scene.render.filepath = output_path
    bpy.ops.render.render(write_still=True)
    print(f"[IMPALA] Rendered frame {idx + 1}/{len(FRAMES)}: {output_path}")

print("[IMPALA] All frames rendered.")
