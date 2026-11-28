# Renders 3D de los platos de la demo de Nef (Blender 5.x, Eevee). Todo procedural, sin archivos externos.
# Uso: blender --background --factory-startup --python platos.py -- <plato|todos> <carpeta_salida> [tam]
import bpy, bmesh, math, random, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
QUE = argv[0] if argv else 'calentado'
SALIDA = argv[1] if len(argv) > 1 else '.'
TAM = int(argv[2]) if len(argv) > 2 else 900
MUESTRAS = int(argv[3]) if len(argv) > 3 else 72
# Recursos reales (Poly Haven, CC0) si están en el PC: HDRI de estudio y madera de roble. Sin ellos, todo procedural como antes.
RECURSOS = os.environ.get('NEF_RECURSOS', 'D:/Herramientas/assets-polyhaven')
HDRI = os.path.join(RECURSOS, 'hdri', 'brown_photostudio_02_2k.hdr')
ROBLE = os.path.join(RECURSOS, 'tex', 'oak_veneer_01')

# ---------- utilidades ----------
def limpiar():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(nombre, color, rough=0.5, sss=0.0, metal=0.0, ruido=None, bump=0.0, escala_ruido=8.0, color2=None, transm=0.0, coat=0.0):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if sss:
        b.inputs['Subsurface Weight'].default_value = sss
        b.inputs['Subsurface Radius'].default_value = (1.0, 0.5, 0.3)
        b.inputs['Subsurface Scale'].default_value = 0.05
    if transm:
        b.inputs['Transmission Weight'].default_value = transm
    if coat:
        b.inputs['Coat Weight'].default_value = coat
    tc = nt.nodes.new('ShaderNodeTexCoord')
    if color2 is not None:
        n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = escala_ruido; n.inputs['Detail'].default_value = 6
        nt.links.new(tc.outputs['Object'], n.inputs['Vector'])
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
        mix.inputs[6].default_value = (*color, 1); mix.inputs[7].default_value = (*color2, 1)
        nt.links.new(n.outputs['Fac'], mix.inputs[0])
        nt.links.new(mix.outputs[2], b.inputs['Base Color'])
    if bump:
        n2 = nt.nodes.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = escala_ruido * 4; n2.inputs['Detail'].default_value = 8
        nt.links.new(tc.outputs['Object'], n2.inputs['Vector'])
        bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump
        nt.links.new(n2.outputs['Fac'], bp.inputs['Height'])
        nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m

def asignar(obj, m):
    obj.data.materials.clear(); obj.data.materials.append(m)
    for p in obj.data.polygons: p.use_smooth = True
    return obj

def esfera(x, y, z, sx, sy, sz, m, seg=32, rot=0.0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, location=(x, y, z))
    o = bpy.context.object; o.scale = (sx, sy, sz); o.rotation_euler[2] = rot
    return asignar(o, m)

def cilindro(x, y, z, r, h, m, seg=64, bisel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=h, location=(x, y, z), rotation=rot)
    o = bpy.context.object
    if bisel:
        mod = o.modifiers.new('bisel', 'BEVEL'); mod.width = bisel; mod.segments = 4
    return asignar(o, m)

def caja(x, y, z, sx, sy, sz, m, rot=0.0, bisel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=(x, y, z)); o = bpy.context.object
    o.scale = (sx, sy, sz); o.rotation_euler[2] = rot
    if bisel:
        mod = o.modifiers.new('bisel', 'BEVEL'); mod.width = bisel; mod.segments = 3
    return asignar(o, m)

def torno(perfil, m, seg=96, loc=(0, 0, 0)):
    # perfil: lista (radio, altura) de adentro hacia afuera; se gira alrededor de Z
    me = bpy.data.meshes.new('torno'); bm = bmesh.new()
    anillos = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        anillos.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in perfil])
    for i in range(seg):
        A, B = anillos[i], anillos[(i + 1) % seg]
        for j in range(len(perfil) - 1):
            bm.faces.new((A[j], A[j + 1], B[j + 1], B[j]))
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('torno', me); bpy.context.collection.objects.link(o)
    o.location = loc
    sub = o.modifiers.new('suave', 'SUBSURF'); sub.levels = 2; sub.render_levels = 2
    return asignar(o, m)

def plato(m, r=1.0, loc=(0, 0, 0)):
    # plato llano con ala
    perfil = [(0.0, 0.012), (r * 0.62, 0.012), (r * 0.7, 0.03), (r * 0.93, 0.085), (r, 0.09), (r * 0.99, 0.07), (r * 0.9, 0.055), (r * 0.66, 0.0), (r * 0.5, -0.005), (0.0, -0.005)]
    return torno(perfil, m, loc=loc)

def tazon(m, r=0.78, h=0.42, loc=(0, 0, 0)):
    perfil = [(0.0, 0.04), (r * 0.55, 0.05), (r * 0.85, h * 0.45), (r * 0.98, h), (r, h), (r * 1.04, h * 0.98), (r * 0.92, h * 0.4), (r * 0.6, 0.0), (0.0, 0.0)]
    return torno(perfil, m, loc=loc)

def taza(m, r=0.42, h=0.5, loc=(0, 0, 0)):
    o = tazon(m, r=r, h=h, loc=loc)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.16, minor_radius=0.04, location=(loc[0] + r + 0.12, loc[1], loc[2] + h * 0.55), rotation=(math.pi / 2, 0, 0))
    asignar(bpy.context.object, m)
    return o

def ruido_mesh(obj, fuerza=0.03, escala=1.5):
    tex = bpy.data.textures.new('ruido', 'CLOUDS'); tex.noise_scale = escala
    d = obj.modifiers.new('desplazar', 'DISPLACE'); d.texture = tex; d.strength = fuerza
    return obj

def huevo(x, y, z, s=1.0, rot=0.0):
    bpy.ops.mesh.primitive_circle_add(vertices=24, radius=0.34 * s, fill_type='NGON', location=(x, y, z))
    o = bpy.context.object
    bm = bmesh.new(); bm.from_mesh(o.data)
    for v in bm.verts:
        k = 1 + random.uniform(-0.18, 0.18); v.co.x *= k; v.co.y *= k * 0.88
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
    bm.to_mesh(o.data); bm.free()
    sol = o.modifiers.new('grosor', 'SOLIDIFY'); sol.thickness = 0.035
    sub = o.modifiers.new('suave', 'SUBSURF'); sub.levels = 2; sub.render_levels = 2
    o.rotation_euler[2] = rot
    asignar(o, MAT['clara'])
    esfera(x + 0.04 * s, y - 0.02 * s, z + 0.03, 0.15 * s, 0.15 * s, 0.09 * s, MAT['yema'])

def granitos(cx, cy, cz, rad, n, m, tam=(0.025, 0.04), alto=0.6, forma=(1.0, 0.6, 0.5)):
    for _ in range(n):
        a = random.uniform(0, 2 * math.pi); d = math.sqrt(random.random()) * rad
        t = random.uniform(*tam)
        esfera(cx + math.cos(a) * d, cy + math.sin(a) * d, cz + random.uniform(0, t * alto),
               t * forma[0], t * forma[1], t * forma[2], m, seg=10, rot=random.uniform(0, math.pi))

def hierbas(cx, cy, cz, rad, n):
    for _ in range(n):
        a = random.uniform(0, 2 * math.pi); d = math.sqrt(random.random()) * rad
        esfera(cx + math.cos(a) * d, cy + math.sin(a) * d, cz, 0.04, 0.022, 0.006, MAT['hierba'], seg=8, rot=random.uniform(0, 3.14))

# ---------- escena común ----------
def escena(madera=(0.32, 0.17, 0.08), madera2=(0.12, 0.06, 0.03)):
    limpiar()
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = MUESTRAS
    # Rápido sin perder realismo (este PC no tiene tarjeta gráfica útil): muestreo adaptativo, sin cáusticas, limpieza de ruido de Intel
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.02
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    try: sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception: pass
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6
    sc.render.resolution_x = TAM; sc.render.resolution_y = TAM
    sc.render.image_settings.file_format = 'PNG'
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Punchy'
    sc.view_settings.exposure = -0.15
    try:
        sc.eevee.use_shadows = True
        sc.eevee.use_raytracing = True
        sc.eevee.taa_render_samples = 64
    except Exception:
        pass
    # mesa de madera
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, -0.01))
    mesa = bpy.context.object
    m = bpy.data.materials.new('madera'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1, 12, 1)
    w = nt.nodes.new('ShaderNodeTexNoise'); w.inputs['Scale'].default_value = 2.2; w.inputs['Detail'].default_value = 10; w.inputs['Distortion'].default_value = 3
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], w.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (*madera2, 1); ramp.color_ramp.elements[1].color = (*madera, 1)
    nt.links.new(w.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.55
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.15
    nt.links.new(w.outputs['Fac'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    if os.path.exists(os.path.join(ROBLE, 'diff.jpg')):
        # Mesa de roble real: color, relieve y rugosidad de foto (escala: tablas de ~15 cm)
        m = bpy.data.materials.new('roble'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
        tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.6, 1.6, 1.6)
        nt.links.new(tc.outputs['Generated'], mp.inputs['Vector'])
        def img(nombre, color=True):
            n = nt.nodes.new('ShaderNodeTexImage'); n.image = bpy.data.images.load(os.path.join(ROBLE, nombre))
            if not color: n.image.colorspace_settings.name = 'Non-Color'
            nt.links.new(mp.outputs['Vector'], n.inputs['Vector']); return n
        dif = img('diff.jpg'); ru = img('rough.jpg', False); no = img('nor.jpg', False)
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.6
        nt.links.new(dif.outputs['Color'], b.inputs['Base Color'])
        nt.links.new(ru.outputs['Color'], b.inputs['Roughness'])
        nt.links.new(no.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    mesa.data.materials.append(m)
    # luz de ventana (área grande al costado) + relleno
    bpy.ops.object.light_add(type='AREA', location=(-3.6, 2.6, 2.4)); l = bpy.context.object
    l.data.energy = 1300; l.data.size = 2.2; l.data.color = (1.0, 0.95, 0.88)
    l.rotation_euler = Vector((0, 0, 0)).to_track_quat('Z', 'Y').to_euler()
    direc = Vector((0, 0, 0)) - l.location; l.rotation_euler = direc.to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.light_add(type='AREA', location=(3, -2.5, 2.5)); f = bpy.context.object
    f.data.energy = 70; f.data.size = 4; f.data.color = (0.9, 0.93, 1.0)
    direc = Vector((0, 0, 0)) - f.location; f.rotation_euler = direc.to_track_quat('-Z', 'Y').to_euler()
    world = bpy.data.worlds.new('mundo'); sc.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.5, 0.45, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.18
    if os.path.exists(HDRI):
        # Luz de estudio real: reflejos creíbles en la cerámica, el café y las salsas; la ventana sigue siendo la luz principal
        wt = world.node_tree; env = wt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(HDRI)
        wt.links.new(env.outputs['Color'], wt.nodes['Background'].inputs['Color'])
        wt.nodes['Background'].inputs['Strength'].default_value = 0.28
        l.data.energy = 1150
        sc.view_settings.exposure = -0.35
    # cámara a 50°, con desenfoque de fondo
    bpy.ops.object.camera_add(location=(0, -2.25, 2.35)); cam = bpy.context.object
    direc = Vector((0, 0.05, 0.05)) - cam.location; cam.rotation_euler = direc.to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 62
    cam.data.dof.use_dof = True; cam.data.dof.focus_distance = (Vector((0, 0, 0.1)) - cam.location).length; cam.data.dof.aperture_fstop = 1.6
    sc.camera = cam
    return sc

MAT = {}
def materiales():
    MAT.update({
        'ceramica': mat('ceramica', (0.86, 0.84, 0.8), rough=0.18, coat=0.6, color2=(0.88, 0.86, 0.82), escala_ruido=3),
        'ceramica_azul': mat('ceramica_azul', (0.62, 0.72, 0.74), rough=0.2, coat=0.6, color2=(0.52, 0.63, 0.66), escala_ruido=3),
        'barro': mat('barro', (0.62, 0.36, 0.22), rough=0.35, coat=0.3, color2=(0.5, 0.28, 0.16), escala_ruido=4),
        'clara': mat('clara', (0.96, 0.95, 0.92), rough=0.3, sss=0.4),
        'yema': mat('yema', (1.0, 0.55, 0.05), rough=0.15, sss=0.6, coat=0.4),
        'arroz': mat('arroz', (0.95, 0.94, 0.9), rough=0.6, sss=0.3, bump=0.6, escala_ruido=30),
        'frijol': mat('frijol', (0.22, 0.06, 0.03), rough=0.18, coat=0.8, color2=(0.38, 0.12, 0.05), escala_ruido=12),
        'arepa': mat('arepa', (0.9, 0.55, 0.16), rough=0.55, bump=0.6, color2=(0.62, 0.3, 0.06), escala_ruido=6),
        'quemado': mat('quemado', (0.12, 0.05, 0.02), rough=0.7),
        'hierba': mat('hierba', (0.05, 0.22, 0.03), rough=0.35, sss=0.2),
        'cafe': mat('cafe', (0.12, 0.05, 0.02), rough=0.06, coat=0.8),
        'espuma': mat('espuma', (0.52, 0.33, 0.18), rough=0.5, sss=0.12, color2=(0.7, 0.52, 0.33), escala_ruido=4),
        'leche': mat('leche', (0.97, 0.93, 0.85), rough=0.35, sss=0.4),
        'chocolate': mat('chocolate', (0.2, 0.08, 0.03), rough=0.12, coat=0.5),
        'bizcocho': mat('bizcocho', (0.17, 0.07, 0.03), rough=0.75, bump=0.6, escala_ruido=20),
        'arequipe': mat('arequipe', (0.72, 0.38, 0.1), rough=0.12, coat=0.7, sss=0.2),
        'hojaldre': mat('hojaldre', (0.85, 0.55, 0.2), rough=0.35, coat=0.3, bump=0.5, color2=(0.6, 0.32, 0.08), escala_ruido=5),
        'galleta': mat('galleta', (0.74, 0.5, 0.26), rough=0.7, bump=0.9, color2=(0.6, 0.38, 0.18), escala_ruido=10),
        'chips': mat('chips', (0.12, 0.05, 0.02), rough=0.3),
        'salsa': mat('salsa', (0.62, 0.1, 0.04), rough=0.25, coat=0.4, bump=0.3, color2=(0.75, 0.2, 0.06), escala_ruido=6),
        'queso': mat('queso', (0.97, 0.95, 0.86), rough=0.55, sss=0.3, bump=0.3, escala_ruido=15),
        'pan': mat('pan', (0.82, 0.62, 0.36), rough=0.7, bump=0.8, escala_ruido=12),
        'corteza': mat('corteza', (0.48, 0.28, 0.12), rough=0.6, bump=0.5, escala_ruido=8),
        'aguacate': mat('aguacate', (0.55, 0.65, 0.2), rough=0.4, sss=0.4, color2=(0.75, 0.8, 0.35), escala_ruido=3),
        'cebolla': mat('cebolla', (0.35, 0.6, 0.2), rough=0.4, sss=0.3),
        'canela': mat('canela', (0.45, 0.22, 0.1), rough=0.7, bump=0.7, escala_ruido=25),
        'panela': mat('panela', (0.55, 0.3, 0.08), rough=0.5, sss=0.2, bump=0.4, escala_ruido=10),
        'grano': mat('grano', (0.22, 0.1, 0.04), rough=0.3, coat=0.4),
        'crema': mat('crema', (0.98, 0.92, 0.76), rough=0.3, sss=0.5, color2=(0.94, 0.84, 0.62), escala_ruido=3),
        'pasa': mat('pasa', (0.18, 0.06, 0.04), rough=0.4),
        'almojabana': mat('almojabana', (0.92, 0.72, 0.38), rough=0.6, bump=0.5, color2=(0.8, 0.55, 0.22), escala_ruido=5),
    })

# ---------- platos ----------
def p_calentado():
    plato(MAT['ceramica'], 1.15)
    esfera(-0.32, 0.25, 0.06, 0.33, 0.27, 0.11, MAT['arroz'])
    granitos(-0.32, 0.25, 0.1, 0.3, 260, MAT['arroz'], tam=(0.022, 0.026), alto=3.0, forma=(1.0, 0.42, 0.42))
    fr = esfera(0.3, -0.22, 0.07, 0.34, 0.28, 0.1, MAT['frijol']); ruido_mesh(fr, 0.03, 0.2)
    granitos(0.3, -0.22, 0.13, 0.26, 45, MAT['frijol'], tam=(0.035, 0.05), forma=(1, 0.65, 0.55))
    huevo(0.33, 0.3, 0.05, 1.0, 0.4)
    a = cilindro(-0.32, -0.33, 0.07, 0.27, 0.09, MAT['arepa'], bisel=0.035)
    for k in range(3):
        caja(-0.32 + (k - 1) * 0.1, -0.33, 0.116, 0.018, 0.2, 0.006, MAT['quemado'], rot=0.6, bisel=0.004)
    hierbas(0, 0, 0.18, 0.6, 14)

def p_capuchino():
    plato(MAT['ceramica'], 0.75, loc=(0, 0, 0))
    taza(MAT['ceramica'], loc=(0, 0, 0.07))
    cilindro(0, 0, 0.53, 0.39, 0.02, MAT['espuma'])
    # corazón de espuma (dos círculos + un triángulo, muy finos)
    for dx in (-0.07, 0.07):
        cilindro(dx, 0.04, 0.545, 0.1, 0.006, MAT['leche'])
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.16, depth=0.006, location=(0, -0.06, 0.545), rotation=(0, 0, -math.pi / 2))
    asignar(bpy.context.object, MAT['leche'])
    granitos(0.95, -0.6, 0.02, 0.25, 12, MAT['grano'], tam=(0.05, 0.06), forma=(1, 0.7, 0.45))

def p_tinto():
    plato(MAT['ceramica'], 0.6)
    taza(MAT['ceramica'], r=0.32, h=0.4, loc=(0, 0, 0.07))
    cilindro(0, 0, 0.43, 0.3, 0.02, MAT['cafe'])
    for k, (x, y) in enumerate([(0.85, -0.25), (0.92, -0.1)]):
        cilindro(x, y, 0.04, 0.035, 0.6, MAT['canela'], seg=16, rot=(math.pi / 2, 0, 0.4 + k * 0.15))
    caja(-0.85, -0.4, 0.06, 0.13, 0.1, 0.06, MAT['panela'], rot=0.5, bisel=0.02)

def p_cafe_filtrado():
    taza(MAT['ceramica_azul'], r=0.4, h=0.62, loc=(0, 0, 0))
    cilindro(0, 0, 0.58, 0.38, 0.02, MAT['cafe'])
    granitos(0.85, 0.45, 0.02, 0.3, 14, MAT['grano'], tam=(0.05, 0.06), forma=(1, 0.7, 0.45))
    granitos(-0.9, -0.5, 0.02, 0.3, 10, MAT['grano'], tam=(0.05, 0.06), forma=(1, 0.7, 0.45))

def p_chocolate():
    plato(MAT['ceramica'], 0.62, loc=(-0.25, 0.1, 0))
    taza(MAT['ceramica'], r=0.36, h=0.45, loc=(-0.25, 0.1, 0.07))
    cilindro(-0.25, 0.1, 0.48, 0.34, 0.02, MAT['chocolate'])
    for k in range(3):
        caja(0.55 + k * 0.08, -0.45 + k * 0.12, 0.06 + k * 0.01, 0.07, 0.07, 0.06, MAT['queso'], rot=0.3 * k, bisel=0.01)
    esfera(0.6, 0.55, 0.12, 0.2, 0.2, 0.15, MAT['almojabana'])

def p_torta():
    plato(MAT['ceramica'], 1.0)
    me = bpy.data.meshes.new('cuna'); bm = bmesh.new()
    pts = [(0, 0.45), (-0.36, -0.35), (0.36, -0.35)]
    abajo = [bm.verts.new((x, y, 0.03)) for x, y in pts]; arriba = [bm.verts.new((x, y, 0.42)) for x, y in pts]
    bm.faces.new(abajo[::-1]); bm.faces.new(arriba)
    for i in range(3):
        j = (i + 1) % 3; bm.faces.new((abajo[i], abajo[j], arriba[j], arriba[i]))
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('torta', me); bpy.context.collection.objects.link(o)
    mb = o.modifiers.new('bisel', 'BEVEL'); mb.width = 0.03; mb.segments = 3
    asignar(o, MAT['bizcocho'])
    for z in (0.16, 0.3):
        caja(0, -0.355, z, 0.34, 0.005, 0.018, MAT['arequipe'])
    for k in range(3):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.12 + k * 0.05, minor_radius=0.014, location=(0, 0.0 - k * 0.08, 0.43))
        asignar(bpy.context.object, MAT['arequipe'])
    hierbas(0.45, 0.3, 0.05, 0.1, 3)

def croissant_malla(m, rc=0.4, centro=(0.0, 0.3, 0.0), arco=250, n=140, lados=40, capas=7):
    # Media luna enrollada: un tubo que sigue un arco; el grosor crece al centro y adelgaza en las puntas,
    # con "capas" (bultos del hojaldre enrollado) y la base aplanada donde toca el plato.
    me = bpy.data.meshes.new('croissant'); bm = bmesh.new()
    a0 = math.radians(270 - arco / 2)
    anillos = []
    for i in range(n + 1):
        t = i / n
        a = a0 + math.radians(arco) * t
        cx, cy = centro[0] + rc * math.cos(a), centro[1] + rc * math.sin(a)
        nx, ny = math.cos(a), math.sin(a)                     # hacia afuera del arco
        perfil = math.sin(math.pi * t) ** 0.95                # gordo al centro, puntas finas
        capa = None                                           # los rollos van en diagonal (dependen del ángulo)
        w = 0.03 + 0.27 * perfil
        h = 0.025 + 0.21 * perfil
        anillo = []
        for j in range(lados):
            th = 2 * math.pi * j / lados
            # Rollo en diagonal: el bulto avanza con el ángulo, como la masa enrollada en espiral
            capa = 0.8 + 0.2 * abs(math.cos(math.pi * capas * t + 0.9 * th))
            dx, dz = math.cos(th) * w * capa, math.sin(th) * h * capa
            z = max(dz, -0.25 * h) + 0.25 * h + 0.012          # base plana sobre el plato
            anillo.append(bm.verts.new((cx + nx * dx, cy + ny * dx, centro[2] + z)))
        anillos.append(anillo)
    for i in range(n):
        A, B = anillos[i], anillos[i + 1]
        for j in range(lados):
            k = (j + 1) % lados
            bm.faces.new((A[j], A[k], B[k], B[j]))
    for anillo, invertir in ((anillos[0], True), (anillos[-1], False)):  # tapas de las puntas
        bm.faces.new(anillo[::-1] if invertir else anillo)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('croissant', me); bpy.context.collection.objects.link(o)
    sub = o.modifiers.new('suave', 'SUBSURF'); sub.levels = 1; sub.render_levels = 2
    ruido_mesh(o, 0.008, 0.25)
    return asignar(o, m)

def p_croissant():
    plato(MAT['ceramica_azul'], 1.0)
    # Hojaldre horneado: dorado oscuro arriba, más claro en los pliegues; brillo de huevo batido
    MAT['croissant'] = mat('croissant', (0.24, 0.08, 0.015), rough=0.42, coat=0.2, bump=0.45, color2=(0.5, 0.22, 0.04), escala_ruido=6)
    croissant_malla(MAT['croissant'])
    granitos(0.0, -0.05, 0.03, 0.45, 14, MAT['hojaldre'], tam=(0.012, 0.022), alto=0.2)   # migas sobre el plato

def p_galletas():
    plato(MAT['ceramica'], 1.0)
    for (x, y, rz) in [(-0.28, 0.2, 0.06), (0.3, 0.12, 0.08), (0.0, -0.32, 0.1)]:
        g = cilindro(x, y, rz, 0.3, 0.07, MAT['galleta'], bisel=0.03); ruido_mesh(g, 0.015, 0.4)
        granitos(x, y, rz + 0.04, 0.24, 9, MAT['chips'], tam=(0.025, 0.035), alto=0.2)

def p_huevos_rancheros():
    plato(MAT['barro'], 1.1)
    s = cilindro(0, 0, 0.04, 0.78, 0.05, MAT['salsa'], bisel=0.04); ruido_mesh(s, 0.02, 0.3)
    huevo(-0.22, 0.15, 0.08, 1.0, 0.3); huevo(0.25, -0.2, 0.08, 1.0, -0.8)
    granitos(0, 0, 0.1, 0.6, 30, MAT['queso'], tam=(0.025, 0.04))
    hierbas(0, 0, 0.12, 0.6, 18)

def p_tostada():
    plato(MAT['ceramica_azul'], 1.1)
    caja(0, 0, 0.08, 0.62, 0.45, 0.06, MAT['corteza'], rot=0.25, bisel=0.06)
    caja(0, 0, 0.1, 0.56, 0.39, 0.05, MAT['pan'], rot=0.25, bisel=0.04)
    for k in range(6):
        esfera(-0.38 + k * 0.15, -0.05 + (k % 2) * 0.05, 0.17, 0.09, 0.2, 0.035, MAT['aguacate'], rot=0.25 + 0.2)
    huevo(0.1, 0.05, 0.2, 0.65, 0.2)
    granitos(0, 0, 0.21, 0.4, 20, MAT['salsa'], tam=(0.008, 0.012))

def superficie(o, fuerza, escala):
    # Malla fina para que el desplazamiento haga ondas/arrugas (la tapa del cilindro trae muy pocos puntos)
    s = o.modifiers.new('malla', 'SUBSURF'); s.subdivision_type = 'SIMPLE'; s.levels = 4; s.render_levels = 4
    return ruido_mesh(o, fuerza, escala)

def p_changua():
    tazon(MAT['barro'], r=0.95, h=0.42)
    superficie(cilindro(0, 0, 0.34, 0.86, 0.03, MAT['leche'], seg=96), 0.012, 0.35)   # caldo de leche, con ondas
    huevo(0.05, 0.05, 0.37, 0.95, 1.2)
    hierbas(0.0, 0.0, 0.37, 0.6, 26)                                                  # cilantro picado
    for _ in range(22):                                                               # cebollín en rodajas
        x, y = random.uniform(-0.62, 0.62), random.uniform(-0.62, 0.62)
        if x * x + y * y < 0.42:
            bpy.ops.mesh.primitive_torus_add(major_radius=0.035, minor_radius=0.012, location=(x, y, 0.37))
            asignar(bpy.context.object, MAT['cebolla'])
    for (x, y, r) in [(-0.42, 0.22, 0.4), (-0.25, -0.42, 1.3), (0.4, -0.3, 2.2), (0.36, 0.4, 0.9), (-0.5, -0.1, 2.8)]:  # pan calado
        superficie(caja(x, y, 0.38, 0.09, 0.075, 0.06, MAT['corteza'], rot=r, bisel=0.015), 0.01, 0.3)

def p_natas():
    tazon(MAT['barro'], r=0.85, h=0.38)
    MAT['natilla'] = mat('natilla', (0.88, 0.7, 0.42), rough=0.38, sss=0.35, coat=0.15, bump=0.5, color2=(0.97, 0.87, 0.64), escala_ruido=4)
    superficie(cilindro(0, 0, 0.3, 0.77, 0.05, MAT['natilla'], seg=96), 0.035, 0.12)  # la "piel" arrugada de las natas
    granitos(0, 0, 0.345, 0.62, 140, MAT['canela'], tam=(0.006, 0.01), alto=0.1)       # canela espolvoreada
    granitos(0.05, -0.05, 0.35, 0.5, 14, MAT['pasa'], tam=(0.04, 0.055), forma=(1, 0.75, 0.55))
    cilindro(0.5, -0.66, 0.42, 0.03, 0.55, MAT['canela'], seg=16, rot=(math.pi / 2, 0, 0.7))  # astilla de canela en el borde

# ---------- Platos nuevos (26/11/2026): hamburguesa con papas, desayuno de cafetería y malteada. Solo 3D (sin "en tu mesa") ----------
def lamina(cx, cy, cz, lado, m, rot=0.0, borde=0.3, caida=0.9, grosor=0.014, ondas=0.0, redonda=False):
    """Lámina que se descuelga por los bordes (queso derretido, lechuga): malla fina, los puntos fuera del borde bajan."""
    if redonda:
        bpy.ops.mesh.primitive_circle_add(vertices=48, radius=lado, fill_type='NGON', location=(cx, cy, cz))
        o = bpy.context.object
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3, use_grid_fill=True)
        bm.to_mesh(o.data); bm.free()
    else:
        bpy.ops.mesh.primitive_grid_add(x_subdivisions=24, y_subdivisions=24, size=lado * 2, location=(cx, cy, cz))
        o = bpy.context.object
    o.rotation_euler[2] = rot
    for v in o.data.vertices:
        d = math.hypot(v.co.x, v.co.y)
        a = math.atan2(v.co.y, v.co.x)
        if ondas:
            k = 1 + ondas * math.sin(a * 7 + random.uniform(-0.3, 0.3)) * min(1, d / lado)
            v.co.x *= k; v.co.y *= k
            d = math.hypot(v.co.x, v.co.y)
            v.co.z += ondas * 0.25 * math.sin(a * 11) * (d / lado)
        if d > borde:
            v.co.z -= (d - borde) ** 1.4 * caida
    sol = o.modifiers.new('grosor', 'SOLIDIFY'); sol.thickness = grosor
    sub = o.modifiers.new('suave', 'SUBSURF'); sub.levels = 1; sub.render_levels = 2
    return asignar(o, m)

def palito(x, y, z, largo, grueso, m, rx=0.0, ry=0.0, rz=0.0):
    bpy.ops.mesh.primitive_cube_add(location=(x, y, z)); o = bpy.context.object
    o.scale = (grueso, grueso, largo / 2); o.rotation_euler = (rx, ry, rz)
    mod = o.modifiers.new('bisel', 'BEVEL'); mod.width = grueso * 0.35; mod.segments = 2
    return asignar(o, m)

def p_hamburguesa():
    MAT['bollo'] = mat('bollo', (0.5, 0.17, 0.025), rough=0.55, coat=0.0, sss=0.1, bump=0.35, color2=(0.32, 0.1, 0.015), escala_ruido=3)
    MAT['carne'] = mat('carne', (0.07, 0.028, 0.014), rough=0.55, bump=1.6, color2=(0.19, 0.07, 0.025), escala_ruido=14)
    MAT['cheddar'] = mat('cheddar', (1.0, 0.4, 0.0), rough=0.22, sss=0.5, coat=0.5)
    MAT['lechuga'] = mat('lechuga', (0.08, 0.38, 0.02), rough=0.35, sss=0.4, coat=0.3, color2=(0.28, 0.62, 0.06), escala_ruido=6)
    MAT['tomate'] = mat('tomate', (0.75, 0.06, 0.03), rough=0.15, sss=0.6, coat=0.6, color2=(0.9, 0.2, 0.08), escala_ruido=5)
    MAT['papa'] = mat('papa', (0.88, 0.48, 0.07), rough=0.42, sss=0.25, bump=0.6, coat=0.2, color2=(0.62, 0.26, 0.03), escala_ruido=7)
    MAT['ajonjoli'] = mat('ajonjoli', (0.95, 0.86, 0.66), rough=0.45, sss=0.3)
    plato(MAT['ceramica'], 1.2)
    x, y = -0.28, 0.14
    cilindro(x, y, 0.1, 0.42, 0.13, MAT['bollo'], bisel=0.05)                       # pan de abajo
    superficie(cilindro(x, y, 0.22, 0.45, 0.12, MAT['carne'], bisel=0.04), 0.035, 0.15)  # carne
    lamina(x, y, 0.285, 0.36, MAT['cheddar'], rot=0.7, borde=0.36, caida=1.1)        # queso derretido
    lamina(x, y, 0.305, 0.5, MAT['lechuga'], borde=0.38, caida=0.8, grosor=0.01, ondas=0.12, redonda=True)
    for dx, dy in ((-0.11, 0.05), (0.13, -0.04)):
        cilindro(x + dx, y + dy, 0.34, 0.25, 0.045, MAT['tomate'], bisel=0.012)
    torno([(0.0, 0.62), (0.18, 0.605), (0.32, 0.55), (0.41, 0.46), (0.445, 0.4), (0.43, 0.37), (0.3, 0.36), (0.0, 0.36)],
          MAT['bollo'], loc=(x, y, 0))                                                 # pan de arriba
    esfera(x, y, 0.605, 0.14, 0.14, 0.018, MAT['bollo'])                               # tapa el punto del torno en la cima
    for _ in range(46):                                                               # ajonjolí sobre la cúpula
        a = random.uniform(0, 2 * math.pi); d = math.sqrt(random.random()) * 0.34
        z = 0.36 + 0.26 * math.sqrt(max(0.0, 1 - (d / 0.445) ** 2))
        esfera(x + math.cos(a) * d, y + math.sin(a) * d, z, 0.026, 0.014, 0.009, MAT['ajonjoli'], seg=8, rot=random.uniform(0, 3.14))
    for k in range(60):                                                               # papas a la francesa, apiladas
        a = random.uniform(0, 2 * math.pi); d = math.sqrt(random.random()) * 0.3
        palito(0.45 + math.cos(a) * d, -0.28 + math.sin(a) * d, 0.06 + random.uniform(0, 0.16), random.uniform(0.34, 0.52), 0.022,
               MAT['papa'], rx=math.radians(random.uniform(70, 95)), ry=random.uniform(-0.4, 0.4), rz=random.uniform(0, math.pi))
    tazon(MAT['ceramica'], r=0.2, h=0.16, loc=(0.42, 0.52, 0.03))                     # salsa de tomate
    MAT['ketchup'] = mat('ketchup', (0.42, 0.015, 0.008), rough=0.08, coat=0.9, sss=0.3)
    superficie(cilindro(0.42, 0.52, 0.16, 0.18, 0.02, MAT['ketchup'], seg=48), 0.008, 0.4)

def p_desayuno():
    MAT['pericos'] = mat('pericos', (0.95, 0.45, 0.01), rough=0.5, sss=0.3, bump=1.2, color2=(1.0, 0.65, 0.08), escala_ruido=12)
    MAT['tomate'] = mat('tomate', (0.75, 0.06, 0.03), rough=0.15, sss=0.6, coat=0.6)
    MAT['papaya'] = mat('papaya', (0.95, 0.28, 0.02), rough=0.25, sss=0.5, coat=0.4)
    MAT['pina'] = mat('pina', (0.95, 0.68, 0.04), rough=0.25, sss=0.5, coat=0.4)
    MAT['fresa'] = mat('fresa', (0.55, 0.0, 0.02), rough=0.2, sss=0.4, coat=0.6)
    MAT['banano'] = mat('banano', (0.93, 0.8, 0.45), rough=0.35, sss=0.4)
    MAT['quesito'] = mat('quesito', (0.97, 0.86, 0.56), rough=0.3, sss=0.4, coat=0.35)
    plato(MAT['ceramica'], 1.25)
    # Pericos: huevo revuelto con tomate y cebolla larga (un montón irregular, no bolitas)
    superficie(esfera(-0.33, 0.27, 0.05, 0.37, 0.31, 0.13, MAT['pericos'], seg=48), 0.06, 0.14)
    superficie(esfera(-0.28, 0.3, 0.1, 0.24, 0.2, 0.08, MAT['pericos'], seg=32), 0.04, 0.2)
    granitos(-0.33, 0.27, 0.15, 0.26, 34, MAT['tomate'], tam=(0.022, 0.035), alto=0.6, forma=(1, 0.9, 0.6))
    granitos(-0.33, 0.27, 0.15, 0.26, 24, MAT['cebolla'], tam=(0.015, 0.025), alto=0.6, forma=(1, 0.6, 0.5))
    # Arepa con queso derretido
    MAT['arepa_asada'] = mat('arepa_asada', (0.82, 0.42, 0.06), rough=0.6, bump=0.8, color2=(0.55, 0.22, 0.02), escala_ruido=6)
    cilindro(0.36, 0.3, 0.07, 0.31, 0.1, MAT['arepa_asada'], bisel=0.04)
    for k in range(3):
        caja(0.36 + (k - 1) * 0.11, 0.3, 0.118, 0.016, 0.22, 0.005, MAT['quemado'], rot=0.6, bisel=0.004)
    superficie(esfera(0.36, 0.3, 0.125, 0.25, 0.23, 0.028, MAT['quesito'], seg=48), 0.012, 0.3)   # queso derretido encima
    # Pan: mogolla dorada
    MAT['mogolla'] = mat('mogolla', (0.42, 0.16, 0.03), rough=0.6, bump=0.6, color2=(0.62, 0.3, 0.07), escala_ruido=5)
    p = esfera(0.4, -0.3, 0.13, 0.27, 0.22, 0.15, MAT['mogolla']); ruido_mesh(p, 0.015, 0.5)
    granitos(0.4, -0.3, 0.255, 0.14, 30, MAT['ajonjoli'] if 'ajonjoli' in MAT else MAT['queso'], tam=(0.012, 0.018), alto=0.1, forma=(1, 0.55, 0.4))
    # Fruta picada en un platico
    tazon(MAT['ceramica_azul'], r=0.3, h=0.18, loc=(-0.34, -0.36, 0.01))
    frutas = [MAT['papaya']] * 6 + [MAT['pina']] * 6 + [MAT['fresa']] * 4
    for m in frutas:
        a = random.uniform(0, 2 * math.pi); d = math.sqrt(random.random()) * 0.17
        c = caja(-0.34 + math.cos(a) * d, -0.36 + math.sin(a) * d, 0.17 + random.uniform(0, 0.05), 0.05, 0.05, 0.045, m,
                 rot=random.uniform(0, 3), bisel=0.012)
        c.rotation_euler[0] = random.uniform(-0.4, 0.4)
    for k in range(3):
        cilindro(-0.3 + k * 0.06, -0.3 - k * 0.05, 0.23, 0.055, 0.025, MAT['banano'], seg=24, rot=(0.3, 0.2, 0))
    hierbas(-0.33, 0.27, 0.15, 0.2, 6)

def p_malteada():
    # Vidrio sutil (casi transparente): con transmisión real el vaso salía como metal cromado y tapaba el color
    MAT['vidrio'] = mat('vidrio', (0.95, 0.97, 1.0), rough=0.06, coat=1.0)
    MAT['vidrio'].node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 0.16
    MAT['malteada'] = mat('malteada', (0.88, 0.3, 0.42), rough=0.4, sss=0.4, coat=0.25, color2=(0.95, 0.5, 0.6), escala_ruido=3)
    MAT['batida'] = mat('batida', (0.99, 0.97, 0.93), rough=0.45, sss=0.6)
    MAT['cereza'] = mat('cereza', (0.55, 0.01, 0.04), rough=0.08, coat=1.0, sss=0.3)
    MAT['pitillo'] = mat('pitillo', (0.5, 0.22, 0.95), rough=0.3, coat=0.4)
    MAT['chispa1'] = mat('chispa1', (0.55, 0.24, 1.0), rough=0.3)
    MAT['chispa2'] = mat('chispa2', (1.0, 0.75, 0.1), rough=0.3)
    MAT['chispa3'] = mat('chispa3', (0.2, 0.75, 0.9), rough=0.3)
    plato(MAT['ceramica'], 0.62)
    torno([(0.0, 0.05), (0.26, 0.05), (0.28, 0.09), (0.31, 1.15), (0.345, 1.3), (0.33, 1.3), (0.295, 1.15), (0.265, 0.12), (0.0, 0.12)],
          MAT['vidrio'], loc=(0, 0, 0.02))
    torno([(0.0, 0.12), (0.26, 0.12), (0.29, 1.15), (0.315, 1.24), (0.0, 1.24)], MAT['malteada'], loc=(0, 0, 0.02))
    for k in range(120):                                                              # crema batida en espiral
        t = k / 120
        a = k * 0.42
        r = 0.27 * (1 - t) ** 0.9
        esfera(math.cos(a) * r, math.sin(a) * r, 1.3 + t * 0.32, 0.085 * (1 - t * 0.6), 0.085 * (1 - t * 0.6), 0.07 * (1 - t * 0.5),
               MAT['batida'], seg=16)
    for k in range(26):                                                               # chispitas de colores
        a = random.uniform(0, 2 * math.pi); d = math.sqrt(random.random()) * 0.24
        z = 1.42 + 0.26 * (1 - d / 0.27) + 0.02
        esfera(math.cos(a) * d, math.sin(a) * d, z, 0.022, 0.007, 0.007, MAT['chispa' + str(1 + k % 3)], seg=6, rot=random.uniform(0, 3.14))
    esfera(0.02, 0.0, 1.71, 0.085, 0.085, 0.08, MAT['cereza'])
    cilindro(0.04, 0.0, 1.82, 0.008, 0.2, MAT['hierba'], seg=8, rot=(0, 0.4, 0))
    cilindro(0.12, 0.08, 1.3, 0.034, 1.3, MAT['pitillo'], seg=20, rot=(0.12, 0.22, 0))


# ---------- Los Fuertes (27/11/2026): pizza y pasta para su demo ----------
def p_pizza():
    MAT['masa'] = mat('masa', (0.6, 0.27, 0.05), rough=0.6, bump=1.0, color2=(0.32, 0.11, 0.015), escala_ruido=6)
    MAT['mozzarella'] = mat('mozzarella', (0.93, 0.58, 0.12), rough=0.3, sss=0.4, coat=0.4, bump=0.6, color2=(0.5, 0.19, 0.02), escala_ruido=9)
    MAT['peperoni'] = mat('peperoni', (0.17, 0.01, 0.005), rough=0.45, coat=0.25, sss=0.1, bump=1.2, color2=(0.34, 0.025, 0.012), escala_ruido=11)
    MAT['albahaca'] = mat('albahaca', (0.02, 0.16, 0.015), rough=0.3, sss=0.3, coat=0.5, color2=(0.05, 0.3, 0.03), escala_ruido=4)
    MAT['tabla'] = mat('tabla', (0.55, 0.33, 0.15), rough=0.55, bump=0.4, color2=(0.42, 0.24, 0.1), escala_ruido=2)
    cilindro(0, 0, 0.03, 1.12, 0.06, MAT['tabla'], bisel=0.02)                          # tabla de madera
    perfil = [(0.0, 0.09), (0.8, 0.09), (0.88, 0.1), (0.94, 0.135), (0.955, 0.165), (0.93, 0.19), (0.88, 0.195), (0.84, 0.17), (0.8, 0.13), (0.0, 0.12)]
    ruido_mesh(torno(perfil, MAT['masa']), 0.012, 3.0)                                  # base con borde inflado
    cilindro(0, 0, 0.125, 0.83, 0.014, MAT['salsa'], seg=96)                            # salsa de tomate (se ve en el borde)
    ruido_mesh(esfera(0, 0, 0.128, 0.76, 0.76, 0.03, MAT['mozzarella'], seg=64), 0.014, 3.0)  # queso derretido, borde irregular
    for k in range(13):                                                                 # peperoni
        a = k * 2.4; d = 0.2 + 0.52 * ((k * 0.618) % 1)
        ruido_mesh(esfera(math.cos(a) * d, math.sin(a) * d, 0.15, 0.1, 0.1, 0.022, MAT['peperoni'], seg=24), 0.006, 4.0)
    for k in range(6):                                                                  # hojas de albahaca
        a = k * 1.05 + 0.4; d = 0.28 + 0.3 * (k % 2)
        esfera(math.cos(a) * d, math.sin(a) * d, 0.175, 0.075, 0.036, 0.008, MAT['albahaca'], seg=16, rot=a)
    granitos(0, 0, 0.17, 0.7, 40, MAT['queso'], tam=(0.008, 0.013), alto=0.02)          # parmesano


def fideo(puntos, m, grosor=0.011):
    cu = bpy.data.curves.new('fideo', 'CURVE'); cu.dimensions = '3D'
    cu.bevel_depth = grosor; cu.bevel_resolution = 1; cu.resolution_u = 3
    sp = cu.splines.new('NURBS'); sp.points.add(len(puntos) - 1)
    for p, (x, y, z) in zip(sp.points, puntos):
        p.co = (x, y, z, 1.0)
    sp.use_endpoint_u = True; sp.order_u = 4
    ob = bpy.data.objects.new('fideo', cu); bpy.context.collection.objects.link(ob)
    cu.materials.append(m)
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target='MESH')
    for pol in ob.data.polygons:
        pol.use_smooth = True
    return ob


def p_pasta():
    # Spaghetti a la parmesana con albóndigas (un nido de hebras de verdad, salsa napolitana, parmesano y albahaca)
    MAT['espagueti'] = mat('espagueti', (0.9, 0.52, 0.09), rough=0.28, sss=0.4, coat=0.4, color2=(0.76, 0.36, 0.03), escala_ruido=6)
    MAT['albondiga'] = mat('albondiga', (0.14, 0.045, 0.02), rough=0.45, bump=1.8, coat=0.3, color2=(0.3, 0.09, 0.03), escala_ruido=16)
    MAT['napolitana'] = mat('napolitana', (0.4, 0.025, 0.008), rough=0.38, coat=0.25, sss=0.3, bump=1.4, color2=(0.62, 0.08, 0.02), escala_ruido=12)
    MAT['albahaca'] = mat('albahaca', (0.02, 0.16, 0.015), rough=0.3, sss=0.3, coat=0.5, color2=(0.05, 0.3, 0.03), escala_ruido=4)
    plato(MAT['ceramica'], 1.15)
    ruido_mesh(esfera(0, 0, 0.06, 0.62, 0.62, 0.2, MAT['espagueti']), 0.02, 2.0)        # relleno bajo el nido
    for k in range(80):                                                                 # hebras en espiral, formando el nido
        a = random.uniform(0, 2 * math.pi); r0 = random.uniform(0.08, 0.62); pts = []
        for i in range(22):
            ang = a + i * 0.32 * (1 if k % 2 else -1)
            r = min(0.66, max(0.04, r0 + 0.07 * math.sin(i * 0.7 + k)))
            z = 0.07 + 0.3 * max(0.0, 1 - (r / 0.68) ** 2) + random.uniform(-0.012, 0.012)
            pts.append((math.cos(ang) * r, math.sin(ang) * r, z))
        fideo(pts, MAT['espagueti'])
    superficie(esfera(0.02, -0.02, 0.33, 0.34, 0.3, 0.06, MAT['napolitana']), 0.06, 2.4)   # salsa encima
    superficie(esfera(0.0, -0.05, 0.27, 0.44, 0.4, 0.05, MAT['napolitana']), 0.07, 3.0)   # salsa que baja por el nido
    for x, y, z in ((0.0, 0.08, 0.42), (-0.15, -0.1, 0.4), (0.17, -0.1, 0.39)):          # albóndigas
        superficie(esfera(x, y, z, 0.135, 0.135, 0.12, MAT['albondiga']), 0.05, 5.0)
    granitos(0, 0, 0.4, 0.38, 30, MAT['queso'], tam=(0.008, 0.014), alto=0.12)         # parmesano rallado
    for x, y, a in ((0.08, 0.2, 0.5), (-0.05, 0.24, 2.1), (0.22, 0.05, 1.2)):           # albahaca
        esfera(x, y, 0.52, 0.07, 0.034, 0.008, MAT['albahaca'], seg=16, rot=a)

PLATOS_NUEVOS = {'hamburguesa': p_hamburguesa, 'desayuno': p_desayuno, 'malteada': p_malteada, 'pizza': p_pizza, 'pasta': p_pasta}
# Cámara propia: la malteada es alta (se ve completa, un poco más de lejos)
CAMARA = {'malteada': ((0, -3.4, 2.35), (0, 0, 0.95))}

PLATOS = {
    'calentado': p_calentado, 'capuchino': p_capuchino, 'tinto': p_tinto, 'cafe-filtrado': p_cafe_filtrado,
    'chocolate': p_chocolate, 'torta-chocolate': p_torta, 'croissant': p_croissant, 'galleta-avena': p_galletas,
    'huevos-rancheros': p_huevos_rancheros, 'changua': p_changua, 'tostada-aguacate': p_tostada, 'natas': p_natas,
    **PLATOS_NUEVOS,
}

def render(nombre):
    random.seed(nombre)
    MAT.clear()
    escena()
    materiales()
    PLATOS[nombre]()
    if nombre in CAMARA:
        cam = bpy.context.scene.camera; cam.location = CAMARA[nombre][0]
        direc = Vector(CAMARA[nombre][1]) - cam.location; cam.rotation_euler = direc.to_track_quat('-Z', 'Y').to_euler()
        cam.data.dof.focus_distance = direc.length
    bpy.context.scene.render.filepath = f'{SALIDA}/{nombre}.png'
    bpy.ops.render.render(write_still=True)
    print('RENDER', nombre)

for n in (PLATOS if QUE == 'todos' else [QUE]):
    render(n)
