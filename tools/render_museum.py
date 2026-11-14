#!/usr/bin/env python3
"""OIBUNG GALLERY — offline museum background generator (Blender 3.6+).

Run: blender --background --python tools/render_museum.py -- --out build/museum
Makes 6 scene views x light/dark x desktop/mobile = 24 PNG renders.
Artwork, plaques and guide illustrations are intentionally NOT baked into walls.
"""
import bpy
import math
import os
import sys
import argparse
from mathutils import Vector


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="build/museum")
    parser.add_argument("--quality", choices=("preview", "final"), default="final")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])


def rgba(color):
    if isinstance(color, str):
        h = color.lstrip("#")
        return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1,)
    return tuple(color) + (1,)


def material(name, base, metallic=0, roughness=.65, emission=None, power=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgba(base)
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = rgba(base)
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    if emission and "Emission Color" in principled.inputs:
        principled.inputs["Emission Color"].default_value = rgba(emission)
        principled.inputs["Emission Strength"].default_value = power
    elif emission and "Emission" in principled.inputs:
        principled.inputs["Emission"].default_value = rgba(emission)
    return mat


def marble(name, base="#dfd7c8", vein="#a6a098"):
    mat = material(name, base, metallic=.07, roughness=.22)
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    shader = nodes.get("Principled BSDF")
    tex = nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 2.2
    tex.inputs["Detail"].default_value = 8.0
    tex.inputs["Roughness"].default_value = .71
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = .42
    ramp.color_ramp.elements[0].color = rgba(base)
    ramp.color_ramp.elements[1].position = .64
    ramp.color_ramp.elements[1].color = rgba(vein)
    middle = ramp.color_ramp.elements.new(.53)
    middle.color = rgba("#f1ece1")
    links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    return mat


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


def box(name, position, scale, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    if bevel:
        mod = obj.modifiers.new("Hand-finished edge", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        obj.modifiers.new("Weighted bevel normals", "WEIGHTED_NORMAL")
    return obj


def cylinder(name, location, radius, height, mat, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=height, location=location)
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    bevel = obj.modifiers.new("Round polished edges", "BEVEL")
    bevel.width = .018
    bevel.segments = 2
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj


def sphere(name, location, radius, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.shade_smooth()
    return assign(obj, mat)


def arch(name, x, y, foot, radius, mat, thickness=.12):
    curve = bpy.data.curves.new(name, type="CURVE")
    curve.dimensions = "3D"
    curve.bevel_resolution = 3
    curve.bevel_depth = thickness
    poly = curve.splines.new("POLY")
    steps = 28
    poly.points.add(steps)
    for i in range(steps + 1):
        theta = math.pi - math.pi * i / steps
        poly.points[i].co = (x + radius * math.cos(theta), y,
                             foot + radius * math.sin(theta), 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    assign(obj, mat)
    return obj


def light(name, position, power, color, size=3):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power
    data.color = tuple(color)
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    # Area lights emit along local -Z; leave them facing down into the hall.
    obj.rotation_euler = (0, 0, 0)
    return obj


def point_light(name, position, power, color, radius=1):
    data = bpy.data.lights.new(name, "POINT")
    data.energy = power
    data.color = color
    data.shadow_soft_size = radius
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    return obj


def build():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    world = bpy.data.worlds.new("Gallery atmosphere") if not bpy.data.worlds else bpy.data.worlds[0]
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (.60, .64, .67, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = .16

    ivory = material("Ivory lime plaster", "#e9ddc7", roughness=.88)
    plaster = material("Mottled warm plaster", "#d8c7ae", roughness=.85)
    pale_stone = marble("Veined honed marble", "#e5dfd3", "#bbb6ab")
    dark_stone = marble("Midnight marble inlay", "#606771", "#303b47")
    gold = material("Brushed antique gilt", "#b99961", metallic=.75, roughness=.30)
    trim = material("Champagne gold trim", "#d0b17e", metallic=.68, roughness=.33)
    walnut = material("Dark smoked walnut", "#513728", roughness=.44)
    bronze = material("Patinated bronze", "#594833", metallic=.67, roughness=.34)
    glass = material("Opalescent luminaire", "#fff4da", roughness=.22)
    red = material("Red emergency lens", "#91221b", roughness=.28)

    # One genuinely connected building; all views use this unchanged geometry.
    box("Polished marble floor", (0, 0, -.16), (18, 38, .32), pale_stone)
    box("Inlaid entry carpet", (0, 10, .012), (3.5, 8, .018), dark_stone)
    box("Decorated coffered ceiling", (0, 0, 8.6), (18, 38, .4), ivory)
    box("Back exhibition wall", (0, -19, 4.2), (18, .4, 8.4), plaster)
    box("West hall wall", (-9, 0, 4.2), (.4, 38, 8.4), ivory)
    box("East hall wall", (9, 0, 4.2), (.4, 38, 8.4), ivory)

    # Marble tiles: hairline grout visible close-up, but cheap to render.
    for i in range(-8, 9):
        box("Marble joint along gallery", (i + .5, 0, .009), (.012, 38, .003), dark_stone)
    for j in range(-18, 19):
        box("Marble transverse joint", (0, j + .5, .01), (18, .012, .003), dark_stone)
    for x in (-8.4, 8.4):
        box("Marble border", (x, 0, .017), (.22, 38, .028), dark_stone, .016)

    # Ceiling cross beams and coffer frames.
    for y in range(-17, 19, 4):
        box("Ceiling transverse gold cornice", (0, y, 8.25), (17.5, .24, .28), gold, .045)
        box("Sub-ceiling molding", (0, y, 8.12), (17.5, .12, .13), trim, .02)
    for x in (-7.7, -3.9, 0, 3.9, 7.7):
        box("Longitudinal coffer beam", (x, 0, 8.25), (.17, 37, .28), gold, .025)
    for x in (-8.7, 8.7):
        for z in (.6, 7.75, 8.16):
            box("Continuous cornice", (x, 0, z), (.3 if z != 8.16 else .6, 37.7, .19), trim, .045)
    for y in (-18.5, 18.5):
        box("Back cornice", (0, y, 7.75), (17.6, .36, .22), trim, .04)

    # Pilasters and rounded column drums; columns are repeated along the same hall.
    for y in (-15, -8, -1, 6, 13):
        for x in (-7.6, 7.6):
            cylinder("Carved gallery column", (x, y, 4.05), .49, 7.35, pale_stone)
            cylinder("Column plinth", (x, y, .23), .75, .46, dark_stone)
            cylinder("Column foot molding", (x, y, .58), .65, .22, gold)
            cylinder("Column gilded capital", (x, y, 7.8), .71, .42, trim)
            cylinder("Capital crown", (x, y, 8.02), .82, .20, ivory)
            for dz in (.78, 7.42):
                cylinder("Capital fillet", (x, y, dz), .54, .10, gold)
    # Gilt wall framing creates texture and realistic depth, not baked text.
    for y in (-15.5, -8.5, -1.5, 5.5, 12.5):
        for x in (-8.78, 8.78):
            box("Recessed wall panel", (x, y, 4.4), (.08, 4.45, 5.65), plaster, .035)
            for offset in (-2.13, 2.13):
                box("Vertical wall-panel frame", (x + (-.04 if x < 0 else .04), y + offset, 4.35),
                    (.11, .08, 5.6), trim, .016)
            for height in (1.62, 7.10):
                box("Horizontal wall-panel frame", (x + (-.04 if x < 0 else .04), y, height),
                    (.11, 4.28, .10), trim, .018)
    for z in (1.25, 7.7):
        box("Grand back-wall gilded rail", (0, -18.72, z), (16.2, .16, .14), trim, .02)
    # Dark walnut arches: distinguish entrance, central lobby and special gallery.
    for x, radius in ((0, 2.4), (-5.3, 1.6), (5.3, 1.6)):
        foot = 3.9
        box("Portal dark interior", (x, -18.76, 2.85), (radius * 1.6, .1, 4.2), walnut, .035)
        arch("Sculpted stone doorway arch", x, -18.54, foot, radius, trim, .13)
        for edge in (-radius, radius):
            box("Door limestone jamb", (x + edge, -18.53, 2.1), (.18, .26, 4.2), pale_stone, .032)

    # Warm classic museum lights and ornate chandeliers; low-intensity backup red bulbs.
    ceiling_lights, emergency_lights = [], []
    for y in (-12, -3, 6):
        cylinder("Chandelier gilded center rod", (0, y, 7.5), .045, 1.95, gold)
        for ring_z, ring_radius in ((6.35, 1.0), (6.8, .72)):
            arch("Chandelier silhouette", 0, y, ring_z, ring_radius, gold, .025)
            for k in range(12):
                phi = 2 * math.pi * k / 12
                sx = ring_radius * math.cos(phi)
                sy = ring_radius * math.sin(phi)
                sphere("Faceted chandelier lamp", (sx, y + sy, ring_z), .10, glass)
        ceiling_lights.append(point_light("Warm chandelier illumination", (0,y,6.4), 1150,
                                          (1.0,.75,.47), 2.2))
    for y in (-16, -9, -2, 5, 12):
        for x in (-8.25, 8.25):
            sphere("Opaque wall sconce", (x,y,5.2), .17, glass)
            box("Sconce mount", (x,y,5.0), (.18,.16,.47), bronze, .025)
            ceiling_lights.append(point_light("Wall sconce glow", (x*.87,y,5.3), 260,
                                              (1.0,.74,.47), 1.05))
    for y in (-18, -2, 14):
        for x in (-8.3, 8.3):
            sphere("Emergency lamp lens", (x,y,7.6), .1, red)
            emergency_lights.append(point_light("Emergency illumination", (x,y,7.5), 0,
                                                 (1.0,.03,.014), .9))
    ceiling_lights.append(light("Architectural luminous sky", (0,-4,8.2), 1700,
                                (1.0,.88,.73), 8))
    return ceiling_lights, emergency_lights


def look_at(camera, point):
    target = Vector(point)
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def make_camera():
    camera_data = bpy.data.cameras.new("Fixed exhibition camera")
    camera = bpy.data.objects.new("Fixed exhibition camera", camera_data)
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    camera_data.type = "PERSP"
    camera_data.clip_end = 100
    camera_data.lens = 32
    return camera


# Changes ONLY the camera and lights. Architecture does not move between views.
VIEWS = {
    "entrance": ((0, 16, 2.5), (0, -10, 3.2), 28),
    "lobby": ((0, 9, 2.5), (0, -17, 3.5), 32),
    "left": ((-4.2, 4, 2.6), (-4.1, -17, 3.4), 34),
    "right": ((4.2, 4, 2.6), (4.1, -17, 3.4), 34),
    "special": ((0, -1, 2.5), (0, -18, 4.4), 31),
    "focus": ((0, -7.5, 2.7), (0, -18, 4.6), 52),
}


def set_lighting(is_dark, ceiling_lights, emergency_lights):
    world_bg = bpy.context.scene.world.node_tree.nodes["Background"].inputs["Strength"]
    world_bg.default_value = .013 if is_dark else .16
    for obj in ceiling_lights:
        # Area and point lights have substantially different nominal intensities.
        default = 1700 if obj.data.type == "AREA" else (260 if "sconce" in obj.name.lower() else 1150)
        obj.data.energy = default * (.003 if is_dark else 1.0)
    for obj in emergency_lights:
        obj.data.energy = 80 if is_dark else 0


def configure_render(quality):
    scene = bpy.context.scene
    # Eevee rasterization is fast; this is *offline* and requires no runtime 3D.
    engines = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    if hasattr(scene, "eevee") and hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = 24 if quality == "final" else 8
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "AgX" if "AgX" in {e.identifier for e in scene.view_settings.bl_rna.properties["view_transform"].enum_items} else "Filmic"
    scene.view_settings.look = "Medium High Contrast" if scene.view_settings.view_transform == "AgX" else "Medium High Contrast"
    scene.render.image_settings.color_depth = "8"


def main():
    args = parse_args()
    os.makedirs(args.out, exist_ok=True)
    configure_render(args.quality)
    lights, emergency = build()
    camera = make_camera()
    scene = bpy.context.scene

    for mobile in (False, True):
        if mobile:
            scene.render.resolution_x = 720 if args.quality == "final" else 360
            scene.render.resolution_y = 1280 if args.quality == "final" else 640
        else:
            scene.render.resolution_x = 1600 if args.quality == "final" else 800
            scene.render.resolution_y = 900 if args.quality == "final" else 450
        for area, (origin, target, focal) in VIEWS.items():
            camera.location = origin
            camera.data.lens = focal * (.68 if mobile else 1.0)
            look_at(camera, target)
            for lighting in ("light", "dark"):
                set_lighting(lighting == "dark", lights, emergency)
                name = area + "-" + lighting + ("-mobile" if mobile else "")
                scene.render.filepath = os.path.abspath(os.path.join(args.out, name + ".png"))
                print("Rendering", name, "=>", scene.render.filepath, flush=True)
                bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
