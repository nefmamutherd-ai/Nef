# Miniatura de una máquina (PNG con fondo transparente) a partir de su .glb, para la tarjeta "Está aquí" del plano.
# Uso: blender --background --factory-startup --python maquina_foto.py -- <entrada.glb> <salida.png> [tam]
import bpy, sys, math
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
GLB, PNG = a[0], a[1]
TAM = int(a[2]) if len(a) > 2 else 360
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
for o in objs:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
cen = (mn + mx) / 2
tam = (mx - mn).length
# Piso invisible que solo recibe la sombra
bpy.ops.mesh.primitive_plane_add(size=30, location=(cen.x, cen.y, mn.z))
bpy.context.object.is_shadow_catcher = True
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
bpy.context.scene.collection.objects.link(cam)
cam.data.lens = 50
d = Vector((-1.0, -1.25, 0.8)).normalized()
cam.location = cen + d * tam * 1.55
cam.rotation_euler = (cen - cam.location).to_track_quat('-Z', 'Y').to_euler()
bpy.context.scene.camera = cam
sol = bpy.data.objects.new('sol', bpy.data.lights.new('sol', 'SUN'))
sol.data.energy = 3.2; sol.data.angle = math.radians(12)
sol.rotation_euler = (math.radians(38), math.radians(8), math.radians(-35))
bpy.context.scene.collection.objects.link(sol)
mundo = bpy.data.worlds.new('mundo'); mundo.use_nodes = True
mundo.node_tree.nodes['Background'].inputs[1].default_value = 0.9
bpy.context.scene.world = mundo
s = bpy.context.scene
s.render.engine = 'CYCLES'; s.cycles.samples = 24; s.cycles.device = 'CPU'; s.cycles.use_denoising = True
s.render.film_transparent = True
s.view_settings.view_transform = 'AgX'
s.render.resolution_x = s.render.resolution_y = TAM
s.render.image_settings.file_format = 'PNG'; s.render.image_settings.color_mode = 'RGBA'
s.render.filepath = PNG
bpy.ops.render.render(write_still=True)
