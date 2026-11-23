// Estadísticas nivel 1 de un negocio (PRODUCTO.md §8). Lo usan /admin y el link del dueño (/stats).
// Clases de nef-ui.css; cada número con su "?" y la definición EXACTA. Datos → siempre textContent.
// Qué números ve cada sector lo dice su paquete (lib/sectores/*.json → /api/sectores).
const fmt = new Intl.NumberFormat('es-CO');
const pesos = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const pct = (x) => (x === null || x === undefined ? '—' : `${fmt.format(Math.round(Number(x) * 1000) / 10)} %`);
const num = (x, dec = 0) => (x === null || x === undefined ? '—' : fmt.format(Math.round(Number(x) * 10 ** dec) / 10 ** dec));
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const hora12 = (h) => (h === 0 ? '12 a. m.' : h < 12 ? `${h} a. m.` : h === 12 ? '12 m.' : `${h - 12} p. m.`);

// Definiciones exactas (PRODUCTO.md §8)
const DEF = {
  visitas_portal: 'Toques + escaneos en el periodo.',
  inscritos: 'Membresías creadas (total y nuevas en el periodo).',
  frecuencia: 'Visitas registradas por cliente en los últimos 30 días (promedio y mediana).',
  recencia: 'Días desde la última visita, por cliente.',
  retorno_30: '% de clientes con ≥ 2 visitas en 30 días.',
  activos: 'Socios con ≥ 1 entrada en los últimos 14 días.',
  abandono: 'Activos al inicio del mes que no registran entradas en todo el mes ÷ activos al inicio.',
  en_riesgo: (d) => `Clientes con ≥ 4 visitas históricas y sin venir hace ≥ ${d} días.`,
  horas_pico: 'Visitas por hora y día de la semana (hora Bogotá).',
  conversion_resena: 'Clics en "Déjanos tu reseña" ÷ visitas al portal.',
  devolucion_real: 'Valor de premios canjeados ÷ ventas registradas en caja.',
  uso_maquinas: 'Escaneos por máquina.',
};
const POR_DEFECTO = ['visitas_portal', 'inscritos', 'frecuencia', 'retorno_30', 'en_riesgo', 'conversion_resena'];

let sectores = null;
async function cargarSectores() {
  if (sectores) return sectores;
  try { sectores = await (await fetch('/api/sectores')).json(); } catch { sectores = {}; }
  return sectores;
}

const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };

function kpi(titulo, valor, def, sub, destacado) {
  const k = el('div', 'n-kpi tile' + (destacado ? ' destacado' : ''));
  const sm = el('small', '', titulo);
  const d = el('button', 'n-def', '?');
  d.type = 'button';
  d.dataset.def = def;
  d.setAttribute('aria-label', 'Qué significa: ' + def);
  sm.append(d);
  k.append(sm, el('b', 'n-num', valor));
  if (sub) k.append(el('div', 'n-cambio', sub));
  return k;
}

function tarjeta(titulo, subtitulo) {
  const t = el('div', 'n-tarjeta');
  t.append(el('h2', '', titulo));
  if (subtitulo) t.append(el('p', '', subtitulo));
  return t;
}

// Barras sin librerías: cada una con --v (0–1)
function barras(valores, etiquetas, destacar) {
  const max = Math.max(1, ...valores);
  const caja = el('div', 'n-barras');
  valores.forEach((v, i) => {
    const b = el('div', destacar === i ? 'destacada' : '');
    b.style.setProperty('--v', String(v / max));
    b.title = `${etiquetas[i] || ''}: ${fmt.format(v)}`;
    b.append(el('i'), el('span', '', etiquetas[i] || ''));
    caja.append(b);
  });
  return caja;
}

function fila(nombre, valor) {
  const li = el('li');
  const p = el('div', 'n-principal');
  p.append(el('b', '', nombre));
  li.append(p, el('span', 'n-estado', valor));
  return li;
}

export async function renderStats(cont, s) {
  const sec = await cargarSectores();
  const n1 = s.nivel1 || {};
  const g = s.gimnasio || {};
  const lista = (sec[s.sector] && sec[s.sector].estadisticas) || POR_DEFECTO;
  const riesgoDias = g.en_riesgo_dias || (sec[s.sector] && sec[s.sector].en_riesgo_dias) || 21;

  const KPIS = {
    visitas_portal: () => kpi('Visitas al portal', fmt.format(n1.visitas_portal ?? s.total ?? 0), DEF.visitas_portal, `NFC ${fmt.format(s.nfc || 0)} · QR ${fmt.format(s.qr || 0)}`),
    inscritos: () => kpi('Clientes inscritos', num(n1.inscritos_total), DEF.inscritos, `+${fmt.format(n1.inscritos_nuevos || 0)} en el periodo`),
    frecuencia: () => kpi('Frecuencia (30 días)', num(n1.frecuencia && n1.frecuencia.promedio, 1), DEF.frecuencia,
      n1.frecuencia && n1.frecuencia.clientes ? `mediana ${num(n1.frecuencia.mediana, 1)} visitas` : 'sin visitas registradas'),
    recencia: () => kpi('Recencia', n1.recencia && n1.recencia.clientes ? `${num(n1.recencia.mediana)} días` : '—', DEF.recencia,
      n1.recencia && n1.recencia.clientes ? `mediana · promedio ${num(n1.recencia.promedio, 1)} días` : ''),
    retorno_30: () => kpi('Retorno a 30 días', pct(n1.retorno_30), DEF.retorno_30),
    activos: () => kpi('Activos', num(n1.activos), DEF.activos),
    abandono: () => kpi('Abandono del mes', pct(n1.abandono_mensual && n1.abandono_mensual.tasa), DEF.abandono,
      n1.abandono_mensual ? `${fmt.format(n1.abandono_mensual.abandonaron || 0)} de ${fmt.format(n1.abandono_mensual.activos_inicio || 0)}` : ''),
    en_riesgo: () => kpi('En riesgo', num(n1.en_riesgo), DEF.en_riesgo(riesgoDias), '', Number(n1.en_riesgo) > 0),
    conversion_resena: () => kpi('Conversión a reseña', pct(n1.conversion_resena), DEF.conversion_resena, `${fmt.format(n1.clics_resena || 0)} ${Number(n1.clics_resena) === 1 ? 'clic' : 'clics'}`),
    devolucion_real: () => kpi('Devolución real', pct(n1.devolucion_real && n1.devolucion_real.tasa), DEF.devolucion_real,
      n1.devolucion_real ? `${pesos(n1.devolucion_real.premios)} de ${pesos(n1.devolucion_real.ventas)}` : ''),
    uso_maquinas: () => kpi('Uso de máquinas', fmt.format((n1.uso_maquinas || []).reduce((a, m) => a + m.n, 0)), DEF.uso_maquinas,
      (n1.uso_maquinas || [])[0] ? `la más usada: ${n1.uso_maquinas[0].nombre}` : 'sin escaneos'),
  };

  const raiz = el('div', 'viz-root n-rejilla');
  const kpis = el('div', 'n-kpis');
  lista.forEach((k) => KPIS[k] && kpis.append(KPIS[k]()));
  raiz.append(kpis);

  // Visitas al portal por día
  const serie = n1.serie_visitas_portal || [];
  if (serie.length) {
    const t = tarjeta('Visitas al portal por día', `Del ${serie[0].dia} al ${serie[serie.length - 1].dia}.`);
    const paso = serie.length > 14 ? 7 : 1;
    t.append(barras(serie.map((x) => x.n), serie.map((x, i) => (i % paso === 0 || i === serie.length - 1 ? x.dia.slice(8, 10) : ''))));
    raiz.append(t);
  }

  // Horas pico (suma de los días de la semana)
  const hp = n1.horas_pico || [];
  if (hp.length === 7) {
    const porHora = Array.from({ length: 24 }, (_, h) => hp.reduce((a, fila) => a + (fila[h] || 0), 0));
    let mejor = { d: 0, h: 0, n: -1 };
    hp.forEach((f, d) => f.forEach((n, h) => { if (n > mejor.n) mejor = { d, h, n }; }));
    const maxH = porHora.indexOf(Math.max(...porHora));
    const t = tarjeta('Horas pico', mejor.n > 0 ? `El momento con más visitas: ${DIAS[mejor.d]} a las ${hora12(mejor.h)}`.replace(/([^.])$/, '$1.') : 'Aún no hay visitas registradas en el periodo.');
    const def = el('button', 'n-def', '?');
    def.type = 'button'; def.dataset.def = DEF.horas_pico; def.setAttribute('aria-label', DEF.horas_pico);
    t.firstChild.append(' ', def);
    t.append(barras(porHora, porHora.map((_, h) => (h % 3 === 0 ? String(h) : '')), mejor.n > 0 ? maxH : -1));
    raiz.append(t);
  }

  const dos = el('div', 'n-rejilla dos');
  if ((s.por_tag || []).length) {
    const t = tarjeta('Dónde tocan', 'Cada sticker o placa por separado.');
    const ul = el('ul', 'n-lista');
    s.por_tag.forEach((x) => ul.append(fila(x.nombre, fmt.format(x.n))));
    t.append(ul);
    dos.append(t);
  }
  if ((s.clicks || []).length) {
    const nombres = { menu: 'Carta', resena: 'Reseña en Google', whatsapp: 'WhatsApp', instagram: 'Instagram', wifi: 'WiFi' };
    const t = tarjeta('Qué tocan en el portal', 'Clics en cada enlace.');
    const ul = el('ul', 'n-lista');
    s.clicks.forEach((x) => {
      const m = /^link(\d+)$/.exec(x.boton);
      const nom = m ? ((s.links || [])[+m[1]] || {}).titulo || `Enlace ${+m[1] + 1}` : nombres[x.boton] || x.boton;
      ul.append(fila(nom, fmt.format(x.n)));
    });
    t.append(ul);
    dos.append(t);
  }
  if ((n1.uso_maquinas || []).length) {
    const t = tarjeta('Uso de máquinas', DEF.uso_maquinas);
    const ul = el('ul', 'n-lista');
    n1.uso_maquinas.forEach((m) => ul.append(fila(m.nombre, fmt.format(m.n))));
    t.append(ul);
    dos.append(t);
  }
  if (dos.childNodes.length) raiz.append(dos);

  cont.textContent = '';
  cont.append(raiz);
}
