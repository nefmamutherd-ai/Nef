// "Verlo en tu mesa" en Android con la realidad aumentada de Google (ARCore) dentro de Chrome (WebXR).
// El usuario decide dónde va el plato: un círculo del tamaño del plato sigue la mesa; mueve el celular hasta donde
// lo quiere y toca "Listo". Solo entonces aparece el plato, a tamaño real (el .glb viene en metros) y quieto en la mesa.
import * as THREE from '/assets/vendor/three/three.module.min.js';
import { GLTFLoader } from '/assets/vendor/three/jsm/loaders/GLTFLoader.js';

// Sombra suave bajo el plato: hace que se vea apoyado y no flotando
function sombra(diametro) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  r.addColorStop(0, 'rgba(0,0,0,.5)'); r.addColorStop(.6, 'rgba(0,0,0,.22)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(diametro, diametro).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.position.y = 0.001;
  return m;
}

export async function ponerEnMesa(p) {
  // Capa de botones encima de la cámara (dom-overlay de WebXR)
  const capa = document.createElement('div');
  capa.className = 'pt-xr';
  capa.innerHTML = `<p class="pt-xr-msg">Apunta a tu mesa y mueve el celular despacio</p>
    <button type="button" class="pt-xr-cerrar" aria-label="Cerrar">✕</button>
    <button type="button" class="pt-xr-listo" disabled>Listo, ponerlo aquí</button>`;
  document.body.append(capa);
  const msg = capa.querySelector('.pt-xr-msg');
  const listo = capa.querySelector('.pt-xr-listo');

  let sesion;
  try {
    sesion = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: capa },
    });
  } catch (e) {
    capa.remove();
    throw e;
  }

  const render = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  render.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  render.outputColorSpace = THREE.SRGBColorSpace;
  render.toneMapping = THREE.ACESFilmicToneMapping;
  render.xr.enabled = true;
  render.xr.setReferenceSpaceType('local');
  await render.xr.setSession(sesion);

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera();
  escena.add(new THREE.HemisphereLight(0xffffff, 0x8a6a50, 1.6));
  const sol = new THREE.DirectionalLight(0xffffff, 1.3); sol.position.set(0.3, 1, 0.4); escena.add(sol);

  // El plato (cargado mientras el usuario elige el sitio)
  const plato = new THREE.Group();
  plato.visible = false;
  escena.add(plato);
  let radio = 0.13;
  const cargado = new GLTFLoader().loadAsync(p.modelo_url).then((gltf) => {
    const m = gltf.scene;
    const caja = new THREE.Box3().setFromObject(m);
    const centro = caja.getCenter(new THREE.Vector3());
    m.position.set(-centro.x, -caja.min.y, -centro.z); // centrado y apoyado en la mesa
    radio = Math.max(caja.max.x - caja.min.x, caja.max.z - caja.min.z) / 2;
    plato.add(sombra(radio * 2.4), m);
    circulo.scale.setScalar(radio / 0.13);
  });

  // Círculo de colocación: blanco, del tamaño del plato
  const circulo = new THREE.Group();
  circulo.visible = false;
  circulo.add(
    new THREE.Mesh(new THREE.RingGeometry(0.12, 0.13, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff })),
    new THREE.Mesh(new THREE.CircleGeometry(0.12, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false })),
  );
  escena.add(circulo);

  const local = render.xr.getReferenceSpace();
  const vista = await sesion.requestReferenceSpace('viewer');
  const fuente = await sesion.requestHitTestSource({ space: vista });
  let puesto = false;

  listo.addEventListener('click', async () => {
    if (puesto) { // "Cambiar de lugar": vuelve el círculo
      puesto = false;
      plato.visible = false;
      listo.textContent = 'Listo, ponerlo aquí';
      return;
    }
    if (!circulo.visible) return;
    listo.disabled = true;
    msg.textContent = 'Cargando tu plato…';
    try { await cargado; } catch { msg.textContent = 'No se pudo cargar el plato. Revisa tu internet.'; return; }
    plato.position.copy(circulo.position);
    plato.quaternion.copy(circulo.quaternion);
    plato.visible = true;
    circulo.visible = false;
    puesto = true;
    msg.textContent = 'Acércate o rodéalo para verlo desde cualquier lado';
    listo.textContent = 'Cambiar de lugar';
    listo.disabled = false;
  });
  capa.querySelector('.pt-xr-cerrar').addEventListener('click', () => sesion.end());
  sesion.addEventListener('end', () => {
    try { fuente.cancel(); } catch { /* ya cerrada */ }
    render.setAnimationLoop(null);
    render.dispose();
    capa.remove();
  });

  const matriz = new THREE.Matrix4();
  render.setAnimationLoop((t, frame) => {
    if (frame && !puesto) {
      const res = frame.getHitTestResults(fuente);
      const pose = res.length && res[0].getPose(local);
      if (pose) {
        matriz.fromArray(pose.transform.matrix);
        matriz.decompose(circulo.position, circulo.quaternion, new THREE.Vector3());
        if (!circulo.visible) msg.textContent = 'Mueve el celular hasta donde quieres el plato y toca Listo';
        circulo.visible = true;
        listo.disabled = false;
      } else {
        circulo.visible = false;
        listo.disabled = true;
      }
    }
    render.render(escena, camara);
  });
}
