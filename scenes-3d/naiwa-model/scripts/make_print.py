# -*- coding: utf-8 -*-
"""Build a watertight, 120 mm tall STL from the display model."""

import bpy
import bmesh
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND = os.path.join(ROOT, "model", "naiwa.blend")
OUT = os.path.join(ROOT, "exports", "naiwa_print.stl")


def active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    char = bpy.data.collections["NAIWA"]
    src = [o for o in char.objects
           if o.type == "MESH" and not o.name.startswith("EyeHL")]

    copies = []
    for o in src:
        c = o.copy()
        c.data = o.data.copy()
        bpy.context.scene.collection.objects.link(c)
        copies.append(c)

    bpy.ops.object.select_all(action="DESELECT")
    for c in copies:
        c.select_set(True)
    bpy.context.view_layer.objects.active = copies[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = "Naiwa_Print"
    active(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    rm = obj.modifiers.new("Remesh", "REMESH")
    rm.mode = "VOXEL"
    rm.voxel_size = 0.0030
    rm.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=rm.name)

    sm = obj.modifiers.new("Smooth", "SMOOTH")
    sm.factor = 0.30
    sm.iterations = 1
    bpy.ops.object.modifier_apply(modifier=sm.name)

    active(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=1e-6)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    bm = bmesh.new()
    bm.from_mesh(obj.data)
    non_manifold = sum(1 for e in bm.edges if not e.is_manifold)
    tris = sum(len(f.verts) - 2 for f in bm.faces)
    bm.free()

    zmax = max(v.co.z for v in obj.data.vertices)
    scale = 120.0 / zmax
    for v in obj.data.vertices:
        v.co *= scale
    obj.data.update()

    bpy.context.view_layer.update()\n    dims = obj.dimensions
    print(f"[print] tris={tris} non_manifold={non_manifold}")
    print(f"[print] size {dims.x:.2f} x {dims.y:.2f} x {dims.z:.2f} mm")

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.wm.stl_export(filepath=OUT, export_selected_objects=True,
                          global_scale=1.0, apply_modifiers=True)
    print("[print] saved", OUT)


if __name__ == "__main__":
    main()

