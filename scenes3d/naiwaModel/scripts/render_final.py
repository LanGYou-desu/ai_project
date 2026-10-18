# -*- coding: utf-8 -*-
"""
Final renders for the Naiwa character.
Usage:
  blender -b model/naiwa.blend --python scripts/render_final.py -- --views hero,face
  blender -b model/naiwa.blend --python scripts/render_final.py -- --views sheet,turntable
"""

import bpy
import math
import os
import sys
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "renders")
os.makedirs(OUT, exist_ok=True)

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
VIEWS = "hero,face,sheet,turntable"
for i, a in enumerate(ARGS):
    if a == "--views" and i + 1 < len(ARGS):
        VIEWS = ARGS[i + 1]
WANT = {v.strip() for v in VIEWS.split(",")}


def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def setup(scene, samples=256, res=(1600, 2000)):
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = -1.18


def camera():
    return bpy.context.scene.camera


def set_cam(loc, target, lens=85, ortho=False, ortho_scale=1.55):
    cam = camera()
    cam.location = loc
    cam.data.type = "ORTHO" if ortho else "PERSP"
    if ortho:
        cam.data.ortho_scale = ortho_scale
    else:
        cam.data.lens = lens
    look_at(cam, target)
    return cam


def render(path, res, samples=256):
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.cycles.samples = samples
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("[render]", path)


def brighten_backdrop():
    mat = bpy.data.materials.get("Backdrop")
    if not mat:
        return
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Emission Color"].default_value = (0.93, 0.90, 0.84, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 0.22
    world = bpy.context.scene.world
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.55


def main():
    scene = bpy.context.scene
    brighten_backdrop()
    mat = bpy.data.materials.get("Naiwa_Yellow")
    if mat:
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Roughness"].default_value = 0.50
        bsdf.inputs["Coat Weight"].default_value = 0.05
    setup(scene)
    cyclo = bpy.data.objects.get("Cyclorama")

    if "hero" in WANT:
        scene.render.film_transparent = False
        if cyclo:
            cyclo.hide_render = False
        set_cam((1.60, -3.40, 1.08), (0, 0, 0.61), lens=76)
        render(os.path.join(OUT, "hero.png"), (1600, 2000), 384)

    if "face" in WANT:
        scene.render.film_transparent = False
        if cyclo:
            cyclo.hide_render = False
        set_cam((0.45, -1.75, 1.30), (0, -0.04, 1.12), lens=95)
        render(os.path.join(OUT, "face.png"), (1400, 1400), 320)

    if "sheet" in WANT:
        scene.render.film_transparent = True
        if cyclo:
            cyclo.hide_render = True
        views = {
            "front": ((0, -4.5, 0.66), (0, 0, 0.66)),
            "side": ((4.5, 0, 0.66), (0, 0, 0.66)),
            "back": ((0, 4.5, 0.66), (0, 0, 0.66)),
        }
        for name, (loc, tgt) in views.items():
            set_cam(loc, tgt, ortho=True, ortho_scale=1.55)
            render(os.path.join(OUT, name + ".png"), (1000, 1400), 256)

    if "turntable" in WANT:
        scene.render.film_transparent = True
        if cyclo:
            cyclo.hide_render = True
        frames_dir = os.path.join(OUT, "turntable")
        os.makedirs(frames_dir, exist_ok=True)
        scene.render.engine = "BLENDER_EEVEE_NEXT"
        scene.eevee.taa_render_samples = 32
        n = 36
        radius = 3.5
        for i in range(n):
            ang = math.radians(-32 + 360 * i / n)
            loc = (radius * math.sin(ang), -radius * math.cos(ang), 1.20)
            set_cam(loc, (0, 0, 0.68), lens=80)
            scene.render.resolution_x = 640
            scene.render.resolution_y = 820
            scene.eevee.taa_render_samples = 32
            scene.render.filepath = os.path.join(frames_dir, f"{i:03d}.png")
            bpy.ops.render.render(write_still=True)
            print("[turntable]", i)


if __name__ == "__main__":
    main()






