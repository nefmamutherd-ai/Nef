// Guía paso a paso del panel del dueño: resalta cada parte, cambia de pestaña sola y explica qué hacer.
// Sale sola la primera vez (por navegador); el botón "Guía" de la barra la repite cuando quiera.
const VISTA = 'nef.panel.guia.v1';

// tab: pestaña que se abre antes del paso · sel: lo que se resalta (si no está visible, el paso se salta)
const PASOS = [
  { titulo: 'Este es tu panel', texto: 'Aquí ves cómo te va y cambias tu carta, tus premios y el PIN de la caja. Te muestro todo en un minuto.' },
  { sel: '#sede-caja', titulo: 'Tus sedes', texto: 'Si tienes varias sedes, aquí eliges cuál ver. Todo lo de abajo cambia según la sede.' },
  { sel: '.n-pestanas', titulo: 'Las secciones', texto: 'Toca cada pestaña para cambiar de sección. Si no ves alguna, desliza a los lados.' },
  { tab: 'resumen', sel: '#r-stats .n-kpis', titulo: 'Cómo te fue', texto: 'Visitas al portal, clientes del club, cada cuánto vuelven y quién está en riesgo. Toca el "?" de cada cuadro para ver qué significa.' },
  { tab: 'resumen', sel: '#periodo-caja', titulo: 'El periodo', texto: 'Cambia entre los últimos 7, 30 o 90 días.' },
  { tab: 'clientes', sel: '#c-riesgo', titulo: 'Clientes en riesgo', texto: 'Quienes dejaron de venir. En horario permitido aparece un botón de WhatsApp para escribirles con un mensaje listo.' },
  { tab: 'clientes', sel: '#i-subir', titulo: 'Entradas del torniquete', texto: 'Sube aquí el archivo de entradas que exporta tu torniquete o huellero. Nef reconoce las columnas solo.' },
  { tab: 'catalogo', sel: '#tab-catalogo .n-tabla-caja', titulo: '¿Se acabó algo?', texto: 'Marca la casilla "Agotado hoy" del producto. El portal lo muestra en gris al instante y "Elige por mí" deja de sugerirlo. Mañana lo desmarcas.' },
  { tab: 'catalogo', sel: '#k-nuevo', titulo: 'Agregar o cambiar', texto: 'Con "Agregar" creas un plato, una clase o una máquina. Con "Editar" cambias el precio, la foto o lo apagas.' },
  { tab: 'club', sel: '#p-agregar', titulo: 'Tus premios', texto: 'Escribe el premio y cuánto vale en pesos. Nef calcula cuántas monedas cuesta.' },
  { tab: 'club', sel: '#form-pin', titulo: 'El PIN de la caja', texto: 'Con este PIN tu cajero entra a la caja para sumar monedas. Si alguien que no debe lo conoce, cámbialo aquí.' },
  { tab: 'informes', sel: '#tab-informes .n-tarjeta', titulo: 'Informes', texto: 'Cada trimestre llega aquí el análisis de tus datos, en PDF y en palabras simples.' },
  { sel: '#guia', titulo: '¿Quieres verla otra vez?', texto: 'Toca "Guía" cuando quieras repetir este recorrido.', fin: true },
];

export function montarTutorial({ ir, pestanaVisible }) {
  let i = 0;
  let pasos = [];
  const capa = document.createElement('div');
  capa.className = 'n-guia-capa';
  capa.hidden = true;
  const foco = document.createElement('div');
  foco.className = 'n-guia-foco';
  const caja = document.createElement('div');
  caja.className = 'n-guia';
  caja.setAttribute('role', 'dialog');
  caja.setAttribute('aria-modal', 'true');
  caja.setAttribute('aria-labelledby', 'guia-titulo');
  caja.innerHTML = `<div class="n-guia-cuenta" id="guia-cuenta"></div>
    <h2 id="guia-titulo"></h2><p id="guia-texto"></p>
    <div class="n-guia-puntos" id="guia-puntos" aria-hidden="true"></div>
    <div class="n-guia-acciones">
      <button type="button" class="n-btn fantasma chico" id="guia-saltar">Saltar</button>
      <span class="n-espacio"></span>
      <button type="button" class="n-btn secundario chico" id="guia-atras">Atrás</button>
      <button type="button" class="n-btn chico" id="guia-siguiente">Siguiente</button>
    </div>`;
  capa.append(foco, caja);
  document.body.append(capa);
  const $ = (id) => caja.querySelector('#' + id);

  const visible = (el) => el && el.getClientRects().length > 0 && !el.closest('[hidden]');

  function ubicar() {
    const p = pasos[i];
    const el = p.sel && document.querySelector(p.sel);
    const movil = window.innerWidth < 640;
    if (!visible(el)) {
      foco.hidden = true;
      caja.dataset.lugar = 'centro';
      caja.style.removeProperty('top'); caja.style.removeProperty('left');
      return;
    }
    foco.hidden = false;
    const r = el.getBoundingClientRect();
    const m = 8;
    const techo = movil ? window.innerHeight - caja.offsetHeight - 24 - Math.max(4, r.top - m) : window.innerHeight * 0.55;
    const alto = Math.max(40, Math.min(r.height + m * 2, techo));
    foco.style.transform = `translate(${Math.max(4, r.left - m)}px, ${Math.max(4, r.top - m)}px)`;
    foco.style.width = Math.min(window.innerWidth - 8, r.width + m * 2) + 'px';
    foco.style.height = alto + 'px';
    if (movil) { caja.dataset.lugar = 'abajo'; caja.style.removeProperty('top'); caja.style.removeProperty('left'); return; }
    caja.dataset.lugar = 'flota';
    const ancho = 360;
    const left = Math.min(Math.max(16, r.left), window.innerWidth - ancho - 16);
    const debajo = r.top + alto + 12;
    const cabe = debajo + caja.offsetHeight + 16 < window.innerHeight;
    caja.style.left = left + 'px';
    caja.style.top = (cabe ? debajo : Math.max(16, r.top - caja.offsetHeight - 20)) + 'px';
  }

  async function pintar() {
    const p = pasos[i];
    if (p.tab) ir(p.tab);
    $('guia-cuenta').textContent = `Paso ${i + 1} de ${pasos.length}`;
    $('guia-titulo').textContent = p.titulo;
    $('guia-texto').textContent = p.texto;
    $('guia-puntos').innerHTML = pasos.map((_, k) => `<i class="${k === i ? 'activo' : ''}"></i>`).join('');
    $('guia-atras').hidden = i === 0;
    $('guia-siguiente').textContent = i === pasos.length - 1 ? 'Listo' : 'Siguiente';
    $('guia-saltar').hidden = i === pasos.length - 1;
    caja.classList.remove('entra'); void caja.offsetWidth; caja.classList.add('entra');
    // Espera a que la pestaña pinte (las estadísticas llegan por red) y lleva el elemento a la vista
    const llevar = () => {
      const el = p.sel && document.querySelector(p.sel);
      if (!el || !visible(el)) return;
      if (window.innerWidth < 640) window.scrollBy({ top: el.getBoundingClientRect().top - 84, behavior: 'instant' }); // arriba: la tarjeta tapa la parte de abajo
      else el.scrollIntoView({ block: 'center', behavior: 'instant' });
    };
    llevar();
    ubicar();
    setTimeout(() => { llevar(); ubicar(); }, 450);
    setTimeout(ubicar, 1300); // las listas llegan por red: vuelve a medir
    $('guia-siguiente').focus({ preventScroll: true });
  }

  function cerrar() {
    capa.hidden = true;
    document.body.classList.remove('n-guiando');
    try { localStorage.setItem(VISTA, '1'); } catch { /* sin almacenamiento */ }
    window.removeEventListener('resize', ubicar);
    window.removeEventListener('scroll', ubicar, true);
    ir('resumen');
    window.scrollTo({ top: 0 });
  }

  function abrir() {
    // Solo los pasos que aplican a este negocio (sin sedes, sin gimnasio, sin club… se saltan)
    pasos = PASOS.filter((p) => (!p.tab || pestanaVisible(p.tab)) && (!p.sel || p.fin || p.tab || visible(document.querySelector(p.sel))) && !(p.sel === '#i-subir' && !pestanaVisible('entradas')));
    i = 0;
    capa.hidden = false;
    document.body.classList.add('n-guiando');
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', ubicar, true);
    pintar();
  }

  $('guia-siguiente').addEventListener('click', () => { if (i < pasos.length - 1) { i++; pintar(); } else cerrar(); });
  $('guia-atras').addEventListener('click', () => { if (i > 0) { i--; pintar(); } });
  $('guia-saltar').addEventListener('click', cerrar);
  document.addEventListener('keydown', (e) => {
    if (capa.hidden) return;
    if (e.key === 'Escape') cerrar();
    if (e.key === 'ArrowRight') $('guia-siguiente').click();
    if (e.key === 'ArrowLeft' && i > 0) $('guia-atras').click();
  });

  const yaVista = () => { try { return localStorage.getItem(VISTA) === '1'; } catch { return true; } };
  return { abrir, primeraVez: () => { if (!yaVista()) setTimeout(abrir, 700); } };
}
