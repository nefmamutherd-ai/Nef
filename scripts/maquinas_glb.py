# Máquinas de gimnasio en 3D (.glb), ANIMADAS, para el tutorial de cada máquina y el plano del gimnasio (Jacobo, 26/11/2026).
# Estilo artístico sencillo (pedido de Jacobo: "o realista o artístico sencillo"): estructura gris carbón, cojines morados,
# cubiertas blancas; medidas reales (1 unidad = 1 metro); materiales sin texturas, así pesan muy poco.
# Cada máquina se mueve como si la estuvieran usando, en bucle (3 s por repetición): brazos, carro, barra y pesas.
# (Se probó con un muñeco haciendo el ejercicio; Jacobo prefirió solo la máquina: el video real lo pone cada gimnasio.)
# Uso: blender --background --factory-startup --python maquinas_glb.py -- <maquina|todas|recorrido> <carpeta_salida> [color_hex]
import bpy, math, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
QUE = argv[0] if argv else 'todas'
SALIDA = argv[1] if len(argv) > 1 else '.'
# Color de los cojines y las franjas: el de la marca del gimnasio (3.er argumento, hex). Por defecto, morado.
_HEX = argv[2].lstrip('#') if len(argv) > 2 else '8b3dff'
MORADO = tuple(int(_HEX[i:i + 2], 16) / 255 for i in (0, 2, 4))
FPS, CICLO, PASO = 24, 72, 3   # una repetición cada 3 s; un cuadro clave cada 3 cuadros


def srgb(c):
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


MAT = {}


def mat(nombre, color, metal=0.0, rugo=0.5, emision=0.0):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*srgb(color), 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rugo
    if emision:
        b.inputs['Emission Color'].default_value = (*srgb(color), 1)
        b.inputs['Emission Strength'].default_value = emision
    MAT[nombre] = m


def materiales():
    MAT.clear()
    mat('estructura', (0.16, 0.16, 0.19), 0.35, 0.45)     # acero pintado gris carbón
    mat('cromo', (0.86, 0.86, 0.88), 1.0, 0.12)
    mat('cojin', MORADO, 0.0, 0.55)                       # cojines morados (la marca)
    mat('acento', (0.93, 0.92, 0.96), 0.0, 0.4)           # cubiertas blancas
    mat('placa', (0.19, 0.19, 0.21), 0.55, 0.42)          # placas de la torre de pesas
    mat('caucho', (0.06, 0.06, 0.065), 0.0, 0.85)
    mat('agarre', (0.12, 0.12, 0.13), 0.0, 0.9)
    mat('piso', (0.11, 0.11, 0.12), 0.0, 0.92)
    mat('linea', MORADO, 0.0, 0.6, 1.5)


def limpiar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    materiales()
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 0, CICLO


def asignar(o, m, bisel=0.0, seg=2):
    o.data.materials.clear()
    o.data.materials.append(MAT[m])
    if bisel:
        b = o.modifiers.new('bisel', 'BEVEL')
        b.width = bisel; b.segments = seg; b.limit_method = 'ANGLE'
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def caja(dim, pos, m, bisel=0.006, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos, rotation=rot)
    o = bpy.context.object
    o.scale = dim
    bpy.ops.object.transform_apply(scale=True)
    return asignar(o, m, bisel)


def cojin(dim, pos, rot=(0, 0, 0)):
    return caja(dim, pos, 'cojin', bisel=min(dim) * 0.35, rot=rot)


def tubo(a, b, r, m='estructura', lados=16):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=lados, radius=r, depth=d.length, location=(a + b) / 2)
    o = bpy.context.object
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return asignar(o, m)


def perfil(a, b, lado=0.075, m='estructura'):
    """Tubo cuadrado de acero con bordes redondeados."""
    o = tubo(a, b, lado * 0.7, m, lados=4)
    b2 = o.modifiers.new('bisel', 'BEVEL'); b2.width = 0.018; b2.segments = 3
    return o


def cilindro(r, alto, pos, m, lados=32, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=lados, radius=r, depth=alto, location=pos, rotation=rot)
    return asignar(bpy.context.object, m)


# ---------- Animación ----------
def fase(f):
    """0 → 1 → 0 en un ciclo, suave (empuja y vuelve despacio)."""
    return 0.5 - 0.5 * math.cos(2 * math.pi * f / CICLO)


def cuadros():
    return range(0, CICLO + 1, PASO)


def marca():
    return set(o.name for o in bpy.context.scene.objects)


def unir(antes, pivote, nombre):
    """Junta en un solo objeto lo creado desde `antes`, con el origen en el pivote (para girarlo o moverlo)."""
    objs = [o for o in bpy.context.scene.objects if o.name not in antes and o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.convert(target='MESH')
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = nombre
    bpy.context.scene.cursor.location = pivote
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    o.rotation_mode = 'XYZ'
    return o


def animar(o, fn, desfase=0):
    """fn(u) → (desplazamiento, giro_x) con u de 0 a 1; se guarda como cuadros clave del ciclo."""
    base = o.location.copy()
    for f in cuadros():
        d, gx = fn(fase(f + desfase))
        o.location = base + Vector(d)
        o.rotation_euler = (gx, 0, 0)
        o.keyframe_insert('location', frame=f)
        o.keyframe_insert('rotation_euler', frame=f)


def girar_x(p, piv, a):
    """Gira el punto p alrededor del eje X que pasa por piv (y, z)."""
    y, z = p[1] - piv[0], p[2] - piv[1]
    return Vector((p[0], piv[0] + y * math.cos(a) - z * math.sin(a), piv[1] + y * math.sin(a) + z * math.cos(a)))


# ---------- Torre de pesas (común a varias máquinas) ----------
def torre(x, y, alto=1.95, placas=14, giro=0.0):
    """Torre con placas y guías cromadas, cubierta blanca. Devuelve las placas de arriba (las que suben al entrenar)."""
    c, s = math.cos(giro), math.sin(giro)
    P = lambda dx, dy, z: (x + dx * c - dy * s, y + dx * s + dy * c, z)
    for dx in (-0.25, 0.25):
        perfil(P(dx, 0, 0), P(dx, 0, alto))
    perfil(P(-0.28, 0, alto), P(0.28, 0, alto))
    perfil(P(-0.28, 0, 0.03), P(0.28, 0, 0.03))
    for dx in (-0.1, 0.1):
        tubo(P(dx, 0, 0.06), P(dx, 0, alto - 0.05), 0.011, 'cromo')
    quedan = placas - 5
    for i in range(quedan):
        caja((0.36, 0.22, 0.022), P(0, 0, 0.08 + i * 0.027), 'placa', 0.004, rot=(0, 0, giro))
    caja((0.5, 0.012, alto * 0.55), P(0, -0.14, alto * 0.62), 'acento', 0.004, rot=(0, 0, giro))
    caja((0.5, 0.014, 0.05), P(0, -0.15, alto * 0.33), 'linea', 0.002, rot=(0, 0, giro))
    cilindro(0.06, 0.04, P(0, 0, alto + 0.02), 'cromo')
    antes = marca()
    for i in range(quedan, placas):
        caja((0.36, 0.22, 0.022), P(0, 0, 0.08 + i * 0.027), 'placa', 0.004, rot=(0, 0, giro))
    tubo(P(0, 0, 0.08), P(0, 0, 0.08 + placas * 0.027 + 0.12), 0.008, 'cromo')
    return unir(antes, P(0, 0, 0.08), 'pesas')


def subir_pesas(pila, desfase, alto=0.14):
    animar(pila, lambda u: ((0, 0, alto * u), 0), desfase)


# ---------- Las 5 máquinas (cada una con su muñeco y sus piezas que se mueven) ----------
def press_pecho(ox=0, oy=0, desfase=0):
    """Press de pecho sentado: ~1,4 m de fondo × 1,1 de ancho × 2 de alto. Empuja las manijas al frente."""
    perfil((ox - 0.45, oy - 0.55, 0.03), (ox + 0.45, oy - 0.55, 0.03))
    perfil((ox, oy - 0.55, 0.03), (ox, oy + 0.45, 0.03))
    perfil((ox, oy - 0.45, 0.03), (ox, oy - 0.45, 0.45))
    cojin((0.42, 0.40, 0.09), (ox, oy - 0.45, 0.5))
    perfil((ox, oy - 0.25, 0.03), (ox, oy - 0.2, 1.15))
    cojin((0.40, 0.09, 0.62), (ox, oy - 0.2, 0.98), rot=(math.radians(-6), 0, 0))
    pesas = torre(ox, oy + 0.45)
    piv = (oy - 0.12, 1.75)
    perfil((ox, piv[0], piv[1]), (ox, oy + 0.45, 1.75))
    antes = marca()
    for lado in (1, -1):
        h = (ox + lado * 0.36, oy - 0.85, 1.12)
        perfil((ox + lado * 0.3, piv[0], piv[1]), h, 0.05)
        tubo(h, (h[0], h[1], 0.98), 0.018, 'agarre')
    perfil((ox - 0.32, piv[0], piv[1]), (ox + 0.32, piv[0], piv[1]), 0.06)
    brazos = unir(antes, (ox, piv[0], piv[1]), 'brazos')
    atras = -0.42                                       # manijas junto al pecho; 0 = brazos estirados
    giro = lambda u: atras * (1 - u)
    animar(brazos, lambda u: ((0, 0, 0), giro(u)), desfase)
    subir_pesas(pesas, desfase)


def mancuernas(ox=0, oy=0, desfase=0):
    """Rack de dos niveles de 1,8 m con 10 pares de mancuernas hexagonales (de 2 a 20 kg). No tiene piezas que se muevan."""
    for dx in (-0.85, 0, 0.85):
        perfil((ox + dx, oy - 0.3, 0.03), (ox + dx, oy + 0.3, 0.03))
        perfil((ox + dx, oy - 0.2, 0.03), (ox + dx, oy - 0.2, 0.55))
        perfil((ox + dx, oy + 0.2, 0.03), (ox + dx, oy + 0.2, 0.82))
    for z, y in ((0.55, -0.2), (0.82, 0.2)):
        for dy in (-0.08, 0.08):
            perfil((ox - 0.9, oy + y + dy, z), (ox + 0.9, oy + y + dy, z), 0.045)
    caja((1.8, 0.02, 0.06), (ox, oy - 0.29, 0.5), 'acento', 0.004)

    def mancuerna(x, y, z, kg, eje='y'):
        r = 0.045 + kg * 0.0028
        largo = 0.24 + kg * 0.004
        d = Vector((0, 1, 0)) if eje == 'y' else Vector((1, 0, 0))
        c = Vector((x, y, z))
        tubo(c - d * largo / 2, c + d * largo / 2, 0.016, 'cromo')
        for s in (-1, 1):
            p = c + d * s * (largo / 2 + 0.01)
            o = cilindro(r, 0.05 + kg * 0.002, p, 'caucho', lados=6)
            o.rotation_mode = 'QUATERNION'
            o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)

    for i, kg in enumerate([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]):
        z, y = ((0.55, -0.2), (0.82, 0.2))[0 if i < 5 else 1]
        x = ox - 0.7 + (i % 5) * 0.35
        for par in (-0.075, 0.075):
            mancuerna(x + par, oy + y, z + 0.045 + kg * 0.0028, kg)


def prensa_45(ox=0, oy=0, desfase=0):
    """Prensa de piernas 45°: ~2,2 m de largo × 1,5 de ancho × 1,5 de alto. Empuja el carro con los pies."""
    for dx in (-0.45, 0.45):
        perfil((ox + dx, oy - 1.1, 0.04), (ox + dx, oy + 1.1, 0.04), 0.08)
    for y in (-1.0, 0.0, 1.0):
        perfil((ox - 0.45, oy + y, 0.04), (ox + 0.45, oy + y, 0.04), 0.07)
    for dx in (-0.28, 0.28):
        perfil((ox + dx, oy - 0.4, 0.15), (ox + dx, oy + 1.0, 1.5), 0.07)
        perfil((ox + dx, oy + 1.0, 0.04), (ox + dx, oy + 1.0, 1.5), 0.07)
    perfil((ox, oy - 1.0, 0.04), (ox, oy - 0.9, 0.38))
    cojin((0.5, 0.45, 0.09), (ox, oy - 0.85, 0.42), rot=(math.radians(-12), 0, 0))
    cojin((0.5, 0.09, 0.75), (ox, oy - 1.18, 0.72), rot=(math.radians(-38), 0, 0))
    for dx in (-0.32, 0.32):
        tubo((ox + dx, oy - 0.85, 0.48), (ox + dx, oy - 0.65, 0.48), 0.018, 'agarre')
    # Carro (plataforma de los pies + cuernos con discos): se arma en t=0,4 y se mueve por los rieles
    t0 = 0.4
    riel = Vector((0, 1.4, 1.35))
    cy, cz = oy - 0.4 + riel.y * t0, 0.15 + riel.z * t0
    antes = marca()
    caja((0.8, 0.5, 0.05), (ox, cy, cz + 0.08), 'acento', 0.006, rot=(math.radians(-45), 0, 0))
    caja((0.7, 0.04, 0.55), (ox, cy - 0.25, cz + 0.32), 'estructura', 0.01, rot=(math.radians(-45), 0, 0))
    caja((0.66, 0.012, 0.5), (ox, cy - 0.28, cz + 0.3), 'agarre', 0.004, rot=(math.radians(-45), 0, 0))
    for dx in (-0.45, 0.45):
        tubo((ox + dx * 0.75, cy + 0.05, cz + 0.12), (ox + dx * 1.15, cy + 0.05, cz + 0.12), 0.025, 'cromo')
        for k in range(2):
            cilindro(0.22, 0.04, (ox + dx * (0.88 + k * 0.1), cy + 0.05, cz + 0.12), 'caucho', lados=40,
                     rot=(0, math.radians(90), 0))
    carro = unir(antes, (ox, cy, cz), 'carro')
    t = lambda u: t0 + 0.2 * u - 0.1                   # rodillas dobladas (0,3) → piernas casi estiradas (0,5)
    mover = lambda u: riel * (t(u) - t0)
    animar(carro, lambda u: (tuple(mover(u)), 0), desfase)


def jalon(ox=0, oy=0, desfase=0):
    """Jalón al pecho: ~2,3 m de alto × 1,4 de largo; barra ancha de 1,2 m que baja al pecho."""
    perfil((ox - 0.4, oy - 0.65, 0.03), (ox + 0.4, oy - 0.65, 0.03))
    perfil((ox, oy - 0.65, 0.03), (ox, oy + 0.4, 0.03))
    perfil((ox, oy - 0.45, 0.03), (ox, oy - 0.45, 0.45))
    cojin((0.42, 0.38, 0.09), (ox, oy - 0.45, 0.5))
    perfil((ox, oy - 0.2, 0.03), (ox, oy - 0.2, 0.75))
    for dx in (-0.14, 0.14):
        cilindro(0.06, 0.26, (ox + dx, oy - 0.3, 0.8), 'cojin', rot=(0, math.radians(90), 0))
    perfil((ox - 0.2, oy - 0.3, 0.74), (ox + 0.2, oy - 0.3, 0.74), 0.04)
    perfil((ox, oy - 0.2, 0.74), (ox, oy - 0.3, 0.74), 0.04)
    pesas = torre(ox, oy + 0.4, alto=2.2)
    perfil((ox, oy + 0.4, 2.2), (ox, oy - 0.55, 2.3), 0.07)
    for y in (oy - 0.5, oy + 0.3):
        cilindro(0.06, 0.03, (ox, y, 2.22), 'cromo', rot=(0, math.radians(90), 0))
    arriba, abajo = 1.78, 1.22
    # Cable: origen arriba, se estira hasta la barra
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.004, depth=1, location=(ox, oy - 0.52, -0.5))
    cable = asignar(bpy.context.object, 'cromo')
    bpy.context.scene.cursor.location = (ox, oy - 0.52, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    cable.location = (ox, oy - 0.52, 2.18)
    barra = 1.2
    antes = marca()
    tubo((ox - barra / 2 + 0.1, oy - 0.52, arriba), (ox + barra / 2 - 0.1, oy - 0.52, arriba), 0.014, 'cromo')
    for s in (-1, 1):
        tubo((ox + s * (barra / 2 - 0.1), oy - 0.52, arriba), (ox + s * barra / 2, oy - 0.52, arriba - 0.08), 0.016, 'agarre')
    b = unir(antes, (ox, oy - 0.52, arriba), 'barra')
    alto = lambda u: arriba - (arriba - abajo) * u
    animar(b, lambda u: ((0, 0, alto(u) - arriba), 0), desfase)
    for f in cuadros():
        cable.scale = (1, 1, 2.18 - alto(fase(f + desfase)))
        cable.keyframe_insert('scale', frame=f)
    subir_pesas(pesas, desfase, 0.18)


def extension(ox=0, oy=0, desfase=0):
    """Extensión de piernas: ~1,3 m de fondo × 1 de ancho × 1,5 de alto. Sube el rodillo con los tobillos."""
    perfil((ox - 0.35, oy - 0.5, 0.03), (ox + 0.35, oy - 0.5, 0.03))
    perfil((ox, oy - 0.5, 0.03), (ox, oy + 0.5, 0.03))
    perfil((ox, oy - 0.1, 0.03), (ox, oy - 0.1, 0.42))
    cojin((0.45, 0.48, 0.1), (ox, oy - 0.12, 0.48))
    perfil((ox, oy + 0.2, 0.03), (ox, oy + 0.18, 0.9))
    cojin((0.42, 0.1, 0.62), (ox, oy + 0.17, 0.85), rot=(math.radians(-10), 0, 0))
    for dx in (-0.3, 0.3):
        tubo((ox + dx, oy - 0.05, 0.47), (ox + dx, oy + 0.15, 0.47), 0.018, 'agarre')
    piv = (oy - 0.38, 0.5)
    cilindro(0.05, 0.12, (ox + 0.3, piv[0], piv[1]), 'acento', rot=(0, math.radians(90), 0))
    antes = marca()
    perfil((ox + 0.32, piv[0], piv[1]), (ox + 0.32, oy - 0.55, 0.12), 0.05)
    perfil((ox + 0.32, oy - 0.55, 0.12), (ox - 0.1, oy - 0.55, 0.12), 0.04)
    cilindro(0.055, 0.32, (ox + 0.02, oy - 0.55, 0.14), 'cojin', rot=(0, math.radians(90), 0))
    brazo = unir(antes, (ox, piv[0], piv[1]), 'brazo')
    giro = lambda u: -1.25 * u
    animar(brazo, lambda u: ((0, 0, 0), giro(u)), desfase)
    pesas = torre(ox + 0.7, oy + 0.1, alto=1.5, placas=10, giro=math.radians(90))
    subir_pesas(pesas, desfase)


MAQUINAS = {'press-pecho': press_pecho, 'mancuernas': mancuernas, 'prensa-45': prensa_45,
            'jalon': jalon, 'extension': extension}


def exportar(nombre, ruta):
    bpy.ops.object.select_all(action='DESELECT')
    # Todas las piezas que se mueven en UNA animación llamada "uso" (el visor reproduce una sola a la vez):
    # cada acción va a una pista NLA con ese nombre y el exportador las junta.
    for o in bpy.context.scene.objects:
        o.select_set(o.type == 'MESH')
        ad = o.animation_data
        if ad and ad.action:
            pista = ad.nla_tracks.new(); pista.name = 'uso'
            pista.strips.new('uso', 0, ad.action)
            ad.action = None
    bpy.ops.export_scene.gltf(filepath=ruta, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_animations=True, export_animation_mode='NLA_TRACKS', export_frame_range=True,
                              export_force_sampling=True, export_optimize_animation_size=True)
    print('GLB', nombre, round(os.path.getsize(ruta) / 1024), 'KB')


# Plano del gimnasio: posiciones (x, y) de cada máquina; la página del recorrido usa las mismas (ver recorrido.js)
PLANO = {'press-pecho': (-2.7, 1.5), 'jalon': (0, 1.6), 'extension': (2.6, 1.6), 'prensa-45': (-2.7, -1.6),
         'mancuernas': (2.6, -2.1)}


def recorrido():
    """Piso de 8 × 6 m con las 5 máquinas funcionando (cada una a su ritmo) y caminos marcados en morado."""
    caja((8, 6, 0.04), (0, 0, -0.02), 'piso', 0.0)
    for x in (-1.3, 1.3):
        caja((0.06, 5.6, 0.005), (x, 0, 0.003), 'linea', 0.0)
    caja((8, 0.12, 0.6), (0, 3.0, 0.3), 'acento', 0.0)
    for k, (n, (x, y)) in enumerate(PLANO.items()):
        MAQUINAS[n](x, y, desfase=k * 13)


os.makedirs(SALIDA, exist_ok=True)
if QUE == 'recorrido':
    limpiar(); recorrido(); exportar('recorrido', os.path.join(SALIDA, 'recorrido.glb'))
else:
    for n in (MAQUINAS if QUE == 'todas' else [QUE]):
        limpiar(); MAQUINAS[n](); exportar(n, os.path.join(SALIDA, n + '.glb'))
