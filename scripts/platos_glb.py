# Modelos 3D (.glb) de los platos de la demo para la vista 3D y la realidad aumentada del portal.
# Reutiliza las piezas y materiales de platos_blender.py (sin mesa, luces ni cámara), hornea los materiales procedurales
# en imágenes (color, rugosidad, relieve), deja el plato a escala real (1 unidad de Blender = 13 cm) y exporta GLB.
# Uso: blender --background --factory-startup --python platos_glb.py -- <plato|todos> <carpeta_salida> [tam_textura] [max_triangulos]
import bpy, bmesh, math, random, sys, os

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
QUE = argv[0] if argv else 'capuchino'
SALIDA = argv[1] if len(argv) > 1 else '.'
TEX = int(argv[2]) if len(argv) > 2 else 1024
MAX_TRIS = int(argv[3]) if len(argv) > 3 else 45000
ESCALA = 0.13  # el plato de radio 1.0 mide 26 cm

# Carga las definiciones de platos_blender.py (todo lo anterior a "def render(")
fuente = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'platos_blender.py'), encoding='utf-8').read()
fuente = fuente[:fuente.index('def render(')]
sys.argv = [sys.argv[0], '--', QUE, SALIDA]  # el script lee sus propios argumentos al cargarse
exec(compile(fuente, 'platos_blender.py', 'exec'), globals())


def triangulos(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def hornear(o, tipo, img, filtro=None):
    for m in o.data.materials:
        nt = m.node_tree
        n = nt.nodes.get('__hornear') or nt.nodes.new('ShaderNodeTexImage')
        n.name = '__hornear'; n.image = img
        nt.nodes.active = n
    kw = {'type': tipo, 'margin': 6, 'use_clear': True}
    if filtro is not None:
        kw['pass_filter'] = filtro
    bpy.ops.object.bake(**kw)


def exportar(nombre):
    limpiar()
    random.seed(nombre)
    MAT.clear()
    materiales()
    PLATOS[nombre]()
    # El vidrio (vaso de la malteada) no se puede hornear en una imagen: en el 3D se ve la bebida sin el vaso
    for o in [o for o in bpy.context.scene.objects if o.type == 'MESH' and any(m and m.name.startswith('vidrio') for m in o.data.materials)]:
        bpy.data.objects.remove(o, do_unlink=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 8

    # 1) Todo a malla (aplica bisel, subdivisión, desplazamiento) y una sola pieza
    mallas = [o for o in sc.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in mallas:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mallas[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = nombre

    # 2) Liviano para el celular: reduce triángulos si hace falta
    t = triangulos(o)
    if t > MAX_TRIS:
        d = o.modifiers.new('reducir', 'DECIMATE'); d.ratio = MAX_TRIS / t
        bpy.ops.object.modifier_apply(modifier=d.name)
    for p in o.data.polygons:
        p.use_smooth = True

    # 3) UV automático para hornear
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')

    # 4) Hornear color (con las manchas y mezclas), rugosidad y relieve
    color = bpy.data.images.new('color', TEX, TEX)
    rugo = bpy.data.images.new('rugosidad', TEX // 2, TEX // 2); rugo.colorspace_settings.name = 'Non-Color'
    normal = bpy.data.images.new('normal', TEX, TEX); normal.colorspace_settings.name = 'Non-Color'
    hornear(o, 'DIFFUSE', color, {'COLOR'})
    hornear(o, 'ROUGHNESS', rugo)
    hornear(o, 'NORMAL', normal)

    # 5) Un solo material sencillo con las tres imágenes (lo que entiende glTF)
    m = bpy.data.materials.new('plato'); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexImage'); tc.image = color
    tr = nt.nodes.new('ShaderNodeTexImage'); tr.image = rugo
    tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = normal
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(tc.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(tr.outputs['Color'], b.inputs['Roughness'])
    nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    o.data.materials.clear(); o.data.materials.append(m)

    # 6) Escala real, apoyado en z = 0 y centrado
    o.scale = (ESCALA, ESCALA, ESCALA)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    zmin = min(v.co.z for v in o.data.vertices)
    for v in o.data.vertices:
        v.co.z -= zmin

    ruta = os.path.join(SALIDA, f'{nombre}.glb')
    bpy.ops.export_scene.gltf(filepath=ruta, export_format='GLB', use_selection=True, export_image_format='JPEG',
                              export_jpeg_quality=82, export_apply=True, export_yup=True)
    print('GLB', nombre, triangulos(o), 'triangulos', round(os.path.getsize(ruta) / 1024), 'KB')


for n in (PLATOS if QUE == 'todos' else [QUE]):
    exportar(n)
