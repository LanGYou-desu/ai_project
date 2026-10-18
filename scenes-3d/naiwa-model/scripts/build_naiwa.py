# -*- coding: utf-8 -*-
"""
婵傛儼娲?(Naiwa) - official-design character build, Blender 4.5
==========================================================
Reference: the front / side / back turnaround supplied by the user.
The character is an independent yellow frog-like meme figure:
  * golden-yellow pear body, narrow shoulders, huge cream belly
  * small domed head, big green eyes with black pupils, subtle smile
  * arms hanging at the sides, dark brown three-fingered hands
  * short tapered legs, wide tan three-toed feet

Method: ellipsoid block-out -> voxel remesh -> relax
        -> conformal / puffy belly -> sculpted eyes & smile -> studio render.

Run:
  blender -b --factory-startup --python build_naiwa.py -- [--preview]
"""

import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MODEL_DIR = os.path.join(ROOT, "model")
EXPORT_DIR = os.path.join(ROOT, "exports")
RENDER_DIR = os.path.join(ROOT, "renders")
for d in (MODEL_DIR, EXPORT_DIR, RENDER_DIR, os.path.join(RENDER_DIR, "preview")):
    os.makedirs(d, exist_ok=True)

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PREVIEW = "--preview" in ARGS
NO_EXPORT = "--no-export" in ARGS

# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------
def srgb(hex_str, alpha=1.0):
    hex_str = hex_str.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(hex_str[i:i + 2], 16) / 255.0
        c = c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
        out.append(c)
    return (*out, alpha)


def purge():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves,
                  bpy.data.lights, bpy.data.cameras, bpy.data.objects):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    return obj


def apply_mod(obj, mod):
    active(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def move_to_coll(ob, coll):
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    coll.objects.link(ob)


def add_ellipsoid(name, loc, scale, rot=(0, 0, 0), coll=None,
                  segments=64, rings=32):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, radius=1.0,
        location=loc, rotation=rot)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if coll:
        move_to_coll(ob, coll)
    return ob


def add_capsule(name, p1, p2, r1, r2=None, coll=None, segs=32):
    if r2 is None:
        r2 = r1
    p1, p2 = Vector(p1), Vector(p2)
    d = p2 - p1
    mid = (p1 + p2) * 0.5
    rot = d.to_track_quat("Z", "Y").to_euler()
    bpy.ops.mesh.primitive_cone_add(
        vertices=segs, radius1=r1, radius2=r2, depth=d.length,
        location=mid, rotation=rot)
    cone = bpy.context.object
    cone.name = name
    s1 = add_ellipsoid(name + "_c1", p1, (r1, r1, r1), coll=coll,
                       segments=24, rings=12)
    s2 = add_ellipsoid(name + "_c2", p2, (r2, r2, r2), coll=coll,
                       segments=24, rings=12)
    for ob in (cone, s1, s2):
        if coll:
            move_to_coll(ob, coll)
    return [cone, s1, s2]


def add_finger(name, pts, radii, coll):
    objs = []
    for i in range(len(pts) - 1):
        objs += add_capsule(f"{name}_{i}", pts[i], pts[i + 1],
                            radii[i], radii[i + 1], coll)
    return objs


def join(objs, name):
    active(objs[0])
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.object
    ob.name = name
    return ob


def material(name, base, rough=0.4, spec=0.5, coat=0.0, coat_rough=0.1,
             sss=0.0, sss_radius=(0.08, 0.04, 0.02)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = srgb(base)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = spec
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Coat Roughness"].default_value = coat_rough
    if sss > 0:
        bsdf.inputs["Subsurface Weight"].default_value = sss
        bsdf.inputs["Subsurface Radius"].default_value = sss_radius
        try:
            bsdf.inputs["Subsurface Scale"].default_value = 0.02
        except KeyError:
            pass
    return mat


def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def shade_smooth(ob):
    for p in ob.data.polygons:
        p.use_smooth = True


def smoothstep(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def remesh_and_smooth(ob, voxel, smooth_iters=3, smooth_factor=0.35):
    active(ob)
    rm = ob.modifiers.new("Remesh", "REMESH")
    rm.mode = "VOXEL"
    rm.voxel_size = voxel
    rm.use_smooth_shade = True
    apply_mod(ob, rm)
    sm = ob.modifiers.new("Smooth", "SMOOTH")
    sm.factor = smooth_factor
    sm.iterations = smooth_iters
    apply_mod(ob, sm)
    shade_smooth(ob)


# ----------------------------------------------------------------------------
# body
# ----------------------------------------------------------------------------
def catmull(points, z):
    """Catmull-Rom interpolation of (z, value) control points."""
    if z <= points[0][0]:
        return points[0][1]
    if z >= points[-1][0]:
        return points[-1][1]
    for i in range(len(points) - 1):
        if points[i][0] <= z <= points[i + 1][0]:
            break
    p0 = points[max(i - 1, 0)]
    p1 = points[i]
    p2 = points[i + 1]
    p3 = points[min(i + 2, len(points) - 1)]
    t = (z - p1[0]) / (p2[0] - p1[0])
    t2, t3 = t * t, t * t * t
    return 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t
                  + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                  + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)


def build_lathe(name, profile, yscale_pts, yoff_pts, segs=112, steps=170):
    """Smooth pear body: radius profile revolved around Z, then squashed
    in Y and shifted so the belly protrudes while the back stays flatter."""
    z0, z1 = profile[0][0], profile[-1][0]
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for i in range(steps + 1):
        z = z0 + (z1 - z0) * i / steps
        r = max(0.0, catmull(profile, z))
        ys = catmull(yscale_pts, z)
        yo = catmull(yoff_pts, z)
        if r < 1e-4:
            rings.append([bm.verts.new((0, yo, z))])
            continue
        row = []
        for j in range(segs):
            a = 2 * math.pi * j / segs
            row.append(bm.verts.new((math.cos(a) * r,
                                     math.sin(a) * r * ys + yo, z)))
        rings.append(row)
    for i in range(steps):
        a, b = rings[i], rings[i + 1]
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            for j in range(segs):
                bm.faces.new((a[0], b[j], b[(j + 1) % segs]))
        elif len(b) == 1:
            for j in range(segs):
                bm.faces.new((a[j], a[(j + 1) % segs], b[0]))
        else:
            for j in range(segs):
                bm.faces.new((a[j], a[(j + 1) % segs],
                              b[(j + 1) % segs], b[j]))
    # cap the bottom so the lathe is a closed volume for voxel remeshing
    if len(rings[0]) > 1:
        c = bm.verts.new((0, catmull(yoff_pts, z0), z0))
        for j in range(segs):
            bm.faces.new((c, rings[0][(j + 1) % segs], rings[0][j]))

    # make the lathe a consistent closed volume before voxel remeshing
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def build_body(coll):
    # radius profile of the pear / head silhouette
    profile = [
        (0.275, 0.000), (0.292, 0.095), (0.320, 0.175), (0.355, 0.232),
        (0.400, 0.276), (0.455, 0.308), (0.520, 0.332), (0.590, 0.346),
        (0.650, 0.347), (0.710, 0.338), (0.770, 0.323), (0.830, 0.302),
        (0.880, 0.283), (0.930, 0.262), (0.970, 0.246), (1.010, 0.233),
        (1.045, 0.226), (1.075, 0.224), (1.105, 0.218), (1.135, 0.207),
        (1.165, 0.197), (1.195, 0.186), (1.225, 0.172), (1.250, 0.150),
        (1.270, 0.120), (1.285, 0.085), (1.295, 0.045), (1.300, 0.0),
    ]
    yscale = [(0.275, 0.70), (0.45, 0.70), (0.60, 0.70), (0.75, 0.72),
              (0.90, 0.78), (1.00, 0.84), (1.10, 0.90), (1.30, 0.92)]
    yoff = [(0.275, 0.000), (0.45, -0.012), (0.60, -0.018), (0.75, -0.012),
            (0.90, -0.005), (1.05, -0.010), (1.30, -0.012)]

    body = build_lathe("Naiwa_Body", profile, yscale, yoff)
    move_to_coll(body, coll)
    active(body)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    shade_smooth(body)
    remesh_and_smooth(body, 0.0045, smooth_iters=5, smooth_factor=0.35)
    return body


# ----------------------------------------------------------------------------
# limbs (separate smooth volumes that plug into the torso)
# ----------------------------------------------------------------------------
def build_arms(coll):
    arms = []
    for s in (-1, 1):
        parts = []
        parts += add_capsule(f"arm_{s}", (s * 0.160, -0.005, 0.945),
                             (s * 0.318, -0.100, 0.665), 0.100, 0.052, coll)
        arm = join(parts, f"Arm_{'L' if s < 0 else 'R'}")
        move_to_coll(arm, coll)
        active(arm)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        remesh_and_smooth(arm, 0.0032, smooth_iters=2, smooth_factor=0.3)
        paint_yellow(arm)
        arm.data.materials.append(YELLOW_MAT)
        arms.append(arm)
    return arms


def build_legs(coll):
    legs = []
    for s in (-1, 1):
        parts = [add_ellipsoid(f"hip_{s}", (s * 0.155, 0.005, 0.410),
                               (0.130, 0.140, 0.145), coll=coll)]
        parts += add_capsule(f"thigh_{s}", (s * 0.160, 0.010, 0.400),
                             (s * 0.180, -0.010, 0.230), 0.112, 0.075, coll)
        parts += add_capsule(f"calf_{s}", (s * 0.180, -0.010, 0.230),
                             (s * 0.192, -0.020, 0.120), 0.075, 0.055, coll)
        leg = join(parts, f"Leg_{'L' if s < 0 else 'R'}")
        move_to_coll(leg, coll)
        active(leg)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        remesh_and_smooth(leg, 0.0032, smooth_iters=2, smooth_factor=0.3)
        paint_yellow(leg)
        leg.data.materials.append(YELLOW_MAT)
        legs.append(leg)
    return legs


# ----------------------------------------------------------------------------
# belly
# ----------------------------------------------------------------------------
def yellow_at(z):
    top = srgb("#F9B60A")
    bottom = srgb("#EE9C00")
    t = max(0.0, min(1.0, (z - 0.22) / 0.95))
    t = t * t * (3 - 2 * t)
    return [bottom[j] + (top[j] - bottom[j]) * t for j in range(3)]


def paint_yellow(ob):
    me = ob.data
    attr = me.color_attributes.get("Col")
    if attr is None:
        attr = me.color_attributes.new(name="Col", type="FLOAT_COLOR",
                                       domain="POINT")
    for i, v in enumerate(me.vertices):
        attr.data[i].color = (*yellow_at(v.co.z), 1.0)
    return attr


def build_belly_colors(body):
    """Paint the huge cream belly directly into vertex colours.

    A flush colour region avoids a pasted-on geometry look and gives the
    soft edge seen in the reference sheet.  It also exports cleanly as
    COLOR_0 in the glTF.
    """
    me = body.data
    attr = paint_yellow(body)
    cream = srgb("#E7D0AB")
    for i, v in enumerate(me.vertices):
        co = v.co
        base = yellow_at(co.z)
        e = (co.x / 0.286) ** 2 + ((co.z - 0.630) / 0.300) ** 2
        inside = 1.0 - smoothstep((e - 0.90) / 0.15)
        front = smoothstep(((-co.y) - 0.005) / 0.085)
        m = inside * front
        col = [base[j] + (cream[j] - base[j]) * m for j in range(3)]
        attr.data[i].color = (*col, 1.0)
    return attr


# ----------------------------------------------------------------------------
# hands
# ----------------------------------------------------------------------------
def build_hands(coll):
    hands = []
    for s in (-1, 1):
        px = s * 0.322
        parts = [add_ellipsoid(
            f"palm_{s}", (px, -0.148, 0.598), (0.054, 0.041, 0.068),
            rot=(math.radians(-8), 0, math.radians(-4 * s)), coll=coll)]
        for i, off in enumerate((-0.033, 0.0, 0.033)):
            x0 = px + off
            pts = [(x0, -0.172, 0.563),
                   (x0 - s * 0.006, -0.178, 0.528),
                   (x0 - s * 0.010, -0.171, 0.501)]
            parts += add_finger(f"finger_{s}_{i}", pts, (0.019, 0.017, 0.013), coll)
        parts += add_finger(
            f"thumb_{s}",
            [(px - s * 0.038, -0.158, 0.610),
             (px - s * 0.053, -0.170, 0.583)],
            (0.020, 0.015), coll)

        hand = join(parts, f"Hand_{'L' if s < 0 else 'R'}")
        move_to_coll(hand, coll)
        active(hand)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        remesh_and_smooth(hand, 0.0028, smooth_iters=2, smooth_factor=0.3)
        hand.data.materials.append(HAND_MAT)
        hands.append(hand)
    return hands


# ----------------------------------------------------------------------------
# feet
# ----------------------------------------------------------------------------
def build_feet(coll):
    feet = []
    for s in (-1, 1):
        parts = [add_ellipsoid(f"ankle_{s}", (s * 0.186, -0.012, 0.112),
                               (0.064, 0.074, 0.095), coll=coll)]
        rot = Euler((0, 0, math.radians(-7 * s)), "XYZ")
        parts.append(add_ellipsoid(f"foot_{s}", (s * 0.195, -0.072, 0.052),
                                   (0.138, 0.184, 0.056), rot=rot, coll=coll))
        for i, off in enumerate((-0.070, 0.0, 0.070)):
            base = Vector((s * 0.195 + off, -0.146, 0.046))
            tip = Vector((base.x + off * 1.15, -0.318, 0.042))
            parts += add_capsule(f"toe_{s}_{i}", base, tip, 0.044, 0.034, coll)
        foot = join(parts, f"Foot_{'L' if s < 0 else 'R'}")
        move_to_coll(foot, coll)
        active(foot)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        remesh_and_smooth(foot, 0.0024, smooth_iters=1, smooth_factor=0.28)
        foot.data.materials.append(FOOT_MAT)
        feet.append(foot)
    return feet


# ----------------------------------------------------------------------------
# eyes & mouth
# ----------------------------------------------------------------------------
def surface_point(body, x, z):
    origin = Vector((x, -2.0, z))
    hit, loc, nrm, idx = body.ray_cast(origin, Vector((0, 1, 0)))
    if not hit:
        return None, None
    return loc, nrm


def build_eyes(body, coll):
    eyes = []
    for s in (-1, 1):
        x, z = s * 0.095, 1.175
        loc, nrm = surface_point(body, x, z)
        if loc is None:
            loc = Vector((x, -0.20, z))
            nrm = Vector((0.4 * s, -1, 0.15)).normalized()
        # both pupils face straight ahead, like the reference
        n = Vector((0, -1, 0.05)).normalized()
        q = n.to_track_quat("-Y", "Z")

        r = 0.051
        center = loc - n * 0.010
        eye = add_ellipsoid(f"Eye_{s}", center, (r, r * 0.78, r),
                            rot=q.to_euler(), coll=coll, segments=128, rings=64)
        eye.data.materials.append(GREEN_MAT)

        pupil_r = 0.026
        pc = center + n * (r * 0.78 - 0.002)
        pupil = add_ellipsoid(f"Pupil_{s}", pc, (pupil_r, 0.009, pupil_r),
                              rot=q.to_euler(), coll=coll, segments=96, rings=48)
        pupil.data.materials.append(BLACK_MAT)

        up = (q @ Vector((0, 0, 1))).normalized()
        side = (q @ Vector((1, 0, 0))).normalized()
        hc = pc + n * 0.009 + up * 0.012 - side * 0.009
        hl = add_ellipsoid(f"EyeHL_{s}", hc, (0.0055, 0.0035, 0.0055),
                           rot=q.to_euler(), coll=coll, segments=48, rings=24)
        hl.data.materials.append(WHITE_MAT)
        eyes += [eye, pupil, hl]
    return eyes


def build_mouth(body, coll):
    pts = []
    width = 0.055
    steps = 24
    for i in range(steps + 1):
        t = -1 + 2 * i / steps
        x = t * width
        z = 1.078 + 0.007 * t * t
        loc, nrm = surface_point(body, x, z)
        if loc is None:
            continue
        pts.append(loc + nrm * 0.0012)
    cu = bpy.data.curves.new("Smile", "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = 2
    cu.bevel_depth = 0.0032
    cu.bevel_resolution = 4
    cu.use_fill_caps = True
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (*p, 1.0)
    ob = bpy.data.objects.new("Smile", cu)
    bpy.context.scene.collection.objects.link(ob)
    move_to_coll(ob, coll)
    active(ob)
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.object
    shade_smooth(ob)
    ob.data.materials.append(MOUTH_MAT)
    return ob


# ----------------------------------------------------------------------------
# studio
# ----------------------------------------------------------------------------
def build_cyclorama(coll):
    xs = [-10, 10]
    ys = [-8, -3, -1, 0.5, 1.5, 2.2, 2.8, 3.4, 4.0, 4.6, 5.4, 6.5, 8.0]
    verts = []
    for x in xs:
        for y in ys:
            z = -0.004 if y <= 2.2 else -0.004 + (y - 2.2) ** 2 * 0.70
            verts.append((x, y, z))
    faces = []
    n = len(ys)
    for i in range(len(xs) - 1):
        for j in range(n - 1):
            faces.append((i * n + j, i * n + j + 1,
                          (i + 1) * n + j + 1, (i + 1) * n + j))
    me = bpy.data.meshes.new("Cyclorama")
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new("Cyclorama", me)
    coll.objects.link(ob)
    ob.data.materials.append(BACKDROP_MAT)
    shade_smooth(ob)
    return ob


def build_studio():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    scene.cycles.samples = 96 if PREVIEW else 256
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.max_bounces = 8

    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == "OPTIX"

    scene.render.resolution_x = 900 if PREVIEW else 1400
    scene.render.resolution_y = 900 if PREVIEW else 1750
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = -0.95

    world = bpy.data.worlds.new("StudioWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = srgb("#F7F4EE")
    bg.inputs[1].default_value = 0.50

    def area(name, loc, power, size, color, target=(0, 0, 0.75)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = power
        ld.shape = "DISK"
        ld.size = size
        ld.color = color
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = loc
        look_at(lo, target)
        return lo

    area("Key", (-2.6, -3.2, 3.4), 290, 3.4, (1.0, 0.98, 0.95))
    area("Fill", (3.0, -2.2, 1.9), 80, 4.0, (0.90, 0.94, 1.0))
    area("FaceFill", (1.6, -3.0, 1.7), 130, 2.6, (1.0, 0.97, 0.93))
    area("Rim", (1.4, 2.8, 3.2), 230, 2.6, (1.0, 0.90, 0.78))
    area("Top", (0.0, 0.5, 4.6), 120, 3.0, (1.0, 0.99, 0.96))

    cd = bpy.data.cameras.new("Camera")
    cd.lens = 80
    cam = bpy.data.objects.new("Camera", cd)
    scene.collection.objects.link(cam)
    cam.location = (1.75, -3.40, 1.15)
    look_at(cam, (0, 0, 0.72))
    scene.camera = cam


# ----------------------------------------------------------------------------
# materials
# ----------------------------------------------------------------------------
def make_materials():
    global YELLOW_MAT, CREAM_MAT, GREEN_MAT, BLACK_MAT, WHITE_MAT
    global HAND_MAT, FOOT_MAT, MOUTH_MAT, BACKDROP_MAT

    YELLOW_MAT = material("Naiwa_Yellow", "#F6B000", rough=0.42, spec=0.38,
                          coat=0.10, coat_rough=0.25)
    nt = YELLOW_MAT.node_tree
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    vc.location = (-350, 250)
    nt.links.new(vc.outputs["Color"],
                 nt.nodes["Principled BSDF"].inputs["Base Color"])
    CREAM_MAT = material("Naiwa_Belly", "#EAD7B5", rough=0.48, spec=0.32,
                         coat=0.05, coat_rough=0.3)
    GREEN_MAT = material("Eye_Green", "#4E9B50", rough=0.28, spec=0.5,
                         coat=0.45, coat_rough=0.12)
    BLACK_MAT = material("Eye_Black", "#0C0C0C", rough=0.16, spec=0.6,
                         coat=0.6, coat_rough=0.06)
    WHITE_MAT = material("Eye_Highlight", "#FFFFFF", rough=0.15, spec=0.6)
    HAND_MAT = material("Hands", "#6E5B49", rough=0.55, spec=0.3)
    FOOT_MAT = material("Feet", "#B58D63", rough=0.52, spec=0.3)
    MOUTH_MAT = material("Mouth_Line", "#6E4A32", rough=0.55, spec=0.3)
    BACKDROP_MAT = material("Backdrop", "#F2EFE9", rough=0.8, spec=0.15)


# ----------------------------------------------------------------------------
# main
# ----------------------------------------------------------------------------
def main():
    purge()
    make_materials()

    scene = bpy.context.scene
    char = bpy.data.collections.new("NAIWA")
    scene.collection.children.link(char)
    studio = bpy.data.collections.new("STUDIO")
    scene.collection.children.link(studio)

    body = build_body(char)
    body.data.materials.append(YELLOW_MAT)
    build_belly_colors(body)

    arms = build_arms(char)
    legs = build_legs(char)
    eyes = build_eyes(body, char)
    smile = build_mouth(body, char)
    hands = build_hands(char)
    feet = build_feet(char)

    # ground exactly at z = 0 (lowest point of the whole character)
    char_objs = [body, smile, *arms, *legs, *eyes, *hands, *feet]
    zmin = min((ob.matrix_world @ v.co).z
               for ob in char_objs for v in ob.data.vertices)
    for ob in char_objs:
        ob.location.z -= zmin
    print(f"[naiwa] ground offset {zmin:.4f}")

    for ob in list(char.objects):
        active(ob)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    build_cyclorama(studio)
    build_studio()

    active(body)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=1e-5)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    shade_smooth(body)

    bm = bmesh.new()
    bm.from_mesh(body.data)
    non_manifold = sum(1 for e in bm.edges if not e.is_manifold)
    tris = sum(len(f.verts) - 2 for f in bm.faces)
    bm.free()
    dims = body.dimensions
    print(f"[naiwa] body verts={len(body.data.vertices)} tris={tris} "
          f"non_manifold={non_manifold}")
    print(f"[naiwa] W={dims.x:.3f} D={dims.y:.3f} H={dims.z:.3f}")

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(MODEL_DIR, "naiwa.blend"))
    print("[naiwa] saved blend")

    if not NO_EXPORT:
        bpy.ops.object.select_all(action="DESELECT")
        for ob in char.objects:
            ob.select_set(True)
        bpy.context.view_layer.objects.active = body
        bpy.ops.export_scene.gltf(
            filepath=os.path.join(EXPORT_DIR, "naiwa.glb"),
            export_format="GLB", use_selection=True,
            export_apply=True, export_yup=True)
        print("[naiwa] exported GLB")

    if PREVIEW:
        render_previews(scene)


def render_previews(scene):
    cam = scene.camera
    cyclo = bpy.data.objects.get("Cyclorama")
    views = {
        "hero": ((1.75, -3.40, 1.15), (0, 0, 0.72), 80, False, 900, 900),
        "front": ((0.0, -4.2, 0.68), (0, 0, 0.68), 80, True, 700, 950),
        "side": ((4.2, 0.0, 0.68), (0, 0, 0.68), 80, True, 700, 950),
        "back": ((0.0, 4.2, 0.68), (0, 0, 0.68), 80, True, 700, 950),
        "face": ((0.45, -1.45, 1.36), (0, -0.06, 1.16), 95, False, 800, 800),
    }
    for name, (loc, tgt, lens, ortho, rx, ry) in views.items():
        cam.location = loc
        cam.data.lens = lens
        cam.data.type = "ORTHO" if ortho else "PERSP"
        if ortho:
            cam.data.ortho_scale = 1.55
        look_at(cam, tgt)
        scene.render.film_transparent = ortho
        if cyclo:
            cyclo.hide_render = ortho
        scene.render.filepath = os.path.join(RENDER_DIR, "preview", name + ".png")
        scene.render.resolution_x = rx
        scene.render.resolution_y = ry
        scene.cycles.samples = 64
        bpy.ops.render.render(write_still=True)
        print("[naiwa] preview", name)

    # flat white sheet for the orthographic views
    try:
        from PIL import Image
        for name in ("front", "side", "back"):
            path = os.path.join(RENDER_DIR, "preview", name + ".png")
            im = Image.open(path).convert("RGBA")
            bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
            bg.alpha_composite(im)
            bg.convert("RGB").save(path)
    except Exception as exc:
        print("composite skipped", exc)


if __name__ == "__main__":
    main()




