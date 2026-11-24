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

def p_croissant():
    plato(MAT['ceramica_azul'], 1.0)
    for k in range(-3, 4):
        a = math.radians(k * 22 - 90 + 180)
        x, y = math.cos(a) * 0.42, math.sin(a) * 0.42 + 0.3
        t = 0.24 - abs(k) * 0.03
        e = esfera(x, y, 0.1 + t * 0.4, t * 0.75, t, t * 0.7, MAT['hojaldre'], rot=a)
    granitos(0, 0.05, 0.3, 0.3, 20, MAT['queso'], tam=(0.012, 0.02))

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

def p_changua():
    tazon(MAT['barro'], r=0.95, h=0.42)
    cilindro(0, 0, 0.34, 0.86, 0.02, MAT['leche'])
    huevo(0.05, 0.05, 0.36, 0.85, 1.2)
    for _ in range(14):
        x, y = random.uniform(-0.6, 0.6), random.uniform(-0.6, 0.6)
        if x * x + y * y < 0.45:
            bpy.ops.mesh.primitive_torus_add(major_radius=0.035, minor_radius=0.012, location=(x, y, 0.36))
            asignar(bpy.context.object, MAT['cebolla'])
    for _ in range(6):
        x, y = random.uniform(-0.55, 0.55), random.uniform(-0.55, 0.55)
        if x * x + y * y < 0.4:
            caja(x, y, 0.38, 0.06, 0.05, 0.04, MAT['pan'], rot=random.uniform(0, 3), bisel=0.01)

def p_tostada():
    plato(MAT['ceramica_azul'], 1.1)
    caja(0, 0, 0.08, 0.62, 0.45, 0.06, MAT['corteza'], rot=0.25, bisel=0.06)
    caja(0, 0, 0.1, 0.56, 0.39, 0.05, MAT['pan'], rot=0.25, bisel=0.04)
    for k in range(6):
        esfera(-0.38 + k * 0.15, -0.05 + (k % 2) * 0.05, 0.17, 0.09, 0.2, 0.035, MAT['aguacate'], rot=0.25 + 0.2)
    huevo(0.1, 0.05, 0.2, 0.65, 0.2)
    granitos(0, 0, 0.21, 0.4, 20, MAT['salsa'], tam=(0.008, 0.012))

def p_natas():
    tazon(MAT['barro'], r=0.85, h=0.38)
    c = cilindro(0, 0, 0.3, 0.77, 0.04, MAT['crema']); ruido_mesh(c, 0.025, 0.25)
    granitos(0, 0, 0.33, 0.55, 18, MAT['pasa'], tam=(0.035, 0.045), forma=(1, 0.7, 0.5))

PLATOS = {
    'calentado': p_calentado, 'capuchino': p_capuchino, 'tinto': p_tinto, 'cafe-filtrado': p_cafe_filtrado,
    'chocolate': p_chocolate, 'torta-chocolate': p_torta, 'croissant': p_croissant, 'galleta-avena': p_galletas,
    'huevos-rancheros': p_huevos_rancheros, 'changua': p_changua, 'tostada-aguacate': p_tostada, 'natas': p_natas,
}

def render(nombre):
    random.seed(nombre)
    MAT.clear()
    escena()
    materiales()
    PLATOS[nombre]()
    bpy.context.scene.render.filepath = f'{SALIDA}/{nombre}.png'
    bpy.ops.render.render(write_still=True)
    print('RENDER', nombre)

for n in (PLATOS if QUE == 'todos' else [QUE]):
    render(n)
