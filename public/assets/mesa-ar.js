// "Verlo en tu mesa" desde la web, sin apps (Android y demás; en iPhone se usa Quick Look).
// La cámara trasera de fondo y un mundo 3D cuya orientación sigue al celular (giroscopio): la mesa es un plano a ~35 cm
// por debajo del teléfono. Tocar la pantalla pone el plato donde ese toque cae sobre la mesa; al girar el celular para
// mirar alrededor, el plato se queda en su sitio. Límite: sin "Servicios de Google Play para RA" no se rastrea el
// desplazamiento del teléfono (si caminas, el plato se desliza un poco). Plato a tamaño real (el .glb viene en metros).
import * as THREE from '/assets/vendor/three/three.module.min.js';
import { GLTFLoader } from '/assets/vendor/three/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from '/assets/vendor/three/jsm/environments/RoomEnvironment.js';

const ALTURA = 0.35; // m: del celular a la mesa, sentado
const quieto = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Orientación del celular → cuaternión de la cámara (método clásico de DeviceOrientationControls de three.js)
const EJE_Z = new THREE.Vector3(0, 0, 1);
const Q_PANTALLA = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90° en X: la cámara mira por detrás del teléfono
function orientar(q, alpha, beta, gamma, giroPantalla) {
  q.setFromEuler(new THREE.Euler(beta, alpha, -gamma, 'YXZ'));
  q.multiply(Q_PANTALLA);
  q.multiply(new THREE.Quaternion().setFromAxisAngle(EJE_Z, -giroPantalla));
}

// Sombra de contacto: lo que hace que el plato parezca apoyado y no flotando
function sombra() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(.55, 'rgba(0,0,0,.28)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

export async function abrirMesa(p, { alAbrir } = {}) {
  const capa = document.createElement('div');
  capa.className = 'pt-camara';
  capa.setAttribute('role', 'dialog');
  capa.setAttribute('aria-label', `${p.nombre} en tu mesa`);
  const video = document.createElement('video');
  video.playsInline = true; video.muted = true; video.autoplay = true;
  const msg = document.createElement('p'); msg.className = 'pt-camara-msg'; msg.textContent = 'Abriendo la cámara…';
  const listo = document.createElement('button'); listo.type = 'button'; listo.className = 'pt-camara-cerrar'; listo.textContent = 'Listo';
  capa.append(video, msg, listo);
  document.body.append(capa);
  if (alAbrir) alAbrir();

  let stream = null, render = null, cuadro = 0;
  const limpiar = [];
  const salir = () => {
    cancelAnimationFrame(cuadro);
    limpiar.forEach((f) => f());
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (render) render.dispose();
    capa.remove();
  };
  listo.addEventListener('click', salir);

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  } catch {
    msg.textContent = 'Para verlo en tu mesa, permite el uso de la cámara.';
    return;
  }
  video.srcObject = stream;

  // Mundo 3D transparente encima del video
  render = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  render.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  render.toneMapping = THREE.ACESFilmicToneMapping;
  render.outputColorSpace = THREE.SRGBColorSpace;
  render.domElement.className = 'pt-camara-3d';
  capa.insertBefore(render.domElement, msg);
  const escena = new THREE.Scene();
  escena.environment = new THREE.PMREMGenerator(render).fromScene(new RoomEnvironment(), 0.04).texture;
  const luz = new THREE.DirectionalLight(0xffffff, 1.2); luz.position.set(0.4, 1, 0.3); escena.add(luz);
  const camara = new THREE.PerspectiveCamera(63, 1, 0.01, 20); // ~ campo de visión de la cámara trasera
  const tam = () => {
    const w = capa.clientWidth, h = capa.clientHeight;
    render.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix();
  };
  tam();
  window.addEventListener('resize', tam);
  limpiar.push(() => window.removeEventListener('resize', tam));

  // El plato (escala real) con su sombra, dentro de un grupo que se mueve sobre la mesa
  const plato = new THREE.Group();
  plato.visible = false;
  escena.add(plato);
  const piso = sombra();
  plato.add(piso);
  let gltf;
  try { gltf = await new GLTFLoader().loadAsync(p.modelo_url); } catch {
    msg.textContent = 'No pudimos cargar el plato. Revisa tu internet.';
    return;
  }
  const modelo = gltf.scene;
  const caja = new THREE.Box3().setFromObject(modelo);
  const centro = caja.getCenter(new THREE.Vector3());
  modelo.position.set(-centro.x, -caja.min.y, -centro.z); // centrado y apoyado en la mesa
  const ancho = Math.max(caja.max.x - caja.min.x, caja.max.z - caja.min.z);
  piso.scale.setScalar(ancho * 1.25);
  piso.position.y = 0.001;
  plato.add(modelo);

  // Giroscopio → cámara
  let giro = null;
  const alGirar = (e) => { if (e.alpha != null) giro = e; };
  window.addEventListener('deviceorientation', alGirar);
  limpiar.push(() => window.removeEventListener('deviceorientation', alGirar));
  const anguloPantalla = () => THREE.MathUtils.degToRad((screen.orientation && screen.orientation.angle) || window.orientation || 0);

  // Poner el plato donde el rayo (centro de la pantalla o el toque) corta la mesa
  const mesa = new THREE.Plane(new THREE.Vector3(0, 1, 0), ALTURA);
  const rayo = new THREE.Raycaster();
  const poner = (nx, ny) => {
    camara.updateMatrixWorld(); // la orientación pudo cambiar después del último cuadro
    rayo.setFromCamera(new THREE.Vector2(nx, ny), camara);
    const punto = new THREE.Vector3();
    if (!rayo.ray.intersectPlane(mesa, punto) || punto.length() > 2.5) return false; // mirando al techo o muy lejos
    plato.position.copy(punto);
    if (!plato.visible && !quieto()) { plato.scale.setScalar(0.01); crece = performance.now(); }
    plato.visible = true;
    msg.textContent = 'Gíralo con un dedo · cámbialo de tamaño con dos';
    return true;
  };
  let crece = 0, escala = 1;

  // Gestos: tocar = poner; un dedo = girar el plato; dos dedos = tamaño
  const toques = new Map();
  let inicio = null;
  const lienzo = render.domElement;
  lienzo.style.touchAction = 'none';
  lienzo.addEventListener('pointerdown', (e) => { toques.set(e.pointerId, { x: e.clientX, y: e.clientY }); inicio = { x: e.clientX, y: e.clientY, t: Date.now(), giro: plato.rotation.y, escala, d: null }; });
  lienzo.addEventListener('pointermove', (e) => {
    if (!toques.has(e.pointerId) || !inicio) return;
    toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const lista = [...toques.values()];
    if (lista.length >= 2) {
      const d = Math.hypot(lista[0].x - lista[1].x, lista[0].y - lista[1].y);
      if (!inicio.d) inicio.d = d;
      escala = Math.max(0.6, Math.min(1.8, inicio.escala * (d / inicio.d)));
    } else if (plato.visible) {
      plato.rotation.y = inicio.giro + (e.clientX - inicio.x) * 0.012;
    }
  });
  const soltar = (e) => {
    const r = lienzo.getBoundingClientRect();
    if (inicio && toques.size === 1 && Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) < 10 && Date.now() - inicio.t < 350) {
      poner(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    }
    toques.delete(e.pointerId);
    if (!toques.size) inicio = null;
  };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', (e) => { toques.delete(e.pointerId); if (!toques.size) inicio = null; });

  msg.textContent = 'Apunta a tu mesa y toca donde quieres el plato';
  // Sin giroscopio (computador): cámara mirando la mesa a 45° y el plato al frente
  const sinGiro = setTimeout(() => {
    if (giro) return;
    camara.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 4, 0, 0));
    poner(0, 0);
  }, 1200);
  limpiar.push(() => clearTimeout(sinGiro));

  let primero = true;
  const pintar = () => {
    cuadro = requestAnimationFrame(pintar);
    if (giro) {
      orientar(camara.quaternion, THREE.MathUtils.degToRad(giro.alpha), THREE.MathUtils.degToRad(giro.beta), THREE.MathUtils.degToRad(giro.gamma || 0), anguloPantalla());
      if (primero) { primero = false; setTimeout(() => { if (!plato.visible) poner(0, -0.25); }, 900); } // aparece solo frente a ti
    }
    const k = crece ? Math.min(1, (performance.now() - crece) / 350) : 1;
    plato.scale.setScalar(escala * (k < 1 ? 1 - Math.pow(1 - k, 3) : 1));
    render.render(escena, camara);
  };
  pintar();
}
