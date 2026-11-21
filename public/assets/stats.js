// Dibuja las estadísticas de un negocio. Lo usan el panel (/admin) y el link del cliente (/stats).
const fmt = new Intl.NumberFormat('es-CO');
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function fecha(iso, conDia = false) {
  const [y, m, d] = iso.split('-').map(Number);
  const f = new Date(y, m - 1, d);
  return `${conDia ? DIAS[f.getDay()] + ' ' : ''}${d} ${MESES[m - 1]}`;
}
const hora = (h) => (h === 0 ? '12 am' : h < 12 ? `${h} am` : h === 12 ? '12 m' : `${h - 12} pm`);

function nombreBoton(b, links) {
  const m = /^link(\d+)$/.exec(b);
  if (m) return (links && links[+m[1]] && links[+m[1]].titulo) || `Enlace ${+m[1] + 1}`;
  return { menu: 'Ver el menú', resena: 'Reseña en Google', whatsapp: 'WhatsApp', instagram: 'Instagram', wifi: 'WiFi' }[b] || b;
}

const CSS = `
.viz-root{color-scheme:light;--surface-1:#fcfcfb;--text-primary:#0b0b0b;--text-secondary:#52514e;--text-muted:#7a7975;--grid:#e6e5e1;--series-1:#2a78d6;
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--text-primary)}
.viz-root .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:18px}
.viz-root .tile{background:var(--surface-1);border:1px solid var(--grid);border-radius:14px;padding:14px 16px}
.viz-root .tile small{display:block;color:var(--text-secondary);font-size:13px}
.viz-root .tile b{display:block;font-size:30px;letter-spacing:-.02em;margin-top:4px;font-variant-numeric:tabular-nums}
.viz-root .tile span{color:var(--text-muted);font-size:12.5px}
.viz-root .card{background:var(--surface-1);border:1px solid var(--grid);border-radius:14px;padding:16px;margin-bottom:14px}
.viz-root h3{margin:0 0 2px;font-size:15px}
.viz-root .sub{margin:0 0 14px;color:var(--text-secondary);font-size:13px}
.viz-root .cols{position:relative;height:150px;display:flex;align-items:flex-end;gap:2px;border-bottom:1px solid #c9c8c3;padding-top:14px}
.viz-root .cols .tope{position:absolute;left:0;right:0;top:14px;border-top:1px dashed var(--grid);font-size:11px;color:var(--text-muted)}
.viz-root .cols .tope span{position:absolute;right:0;top:-14px}
.viz-root .col{position:relative;z-index:1;flex:1;display:flex;justify-content:center;align-items:flex-end;height:100%;cursor:default}
.viz-root .col i{display:block;width:100%;max-width:24px;background:var(--series-1);border-radius:4px 4px 0 0;min-height:0}
.viz-root .col:hover i,.viz-root .col:focus i{filter:brightness(.85)}
.viz-root .ejes{display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-muted);margin-top:6px}
.viz-root .filas{display:grid;gap:9px}
.viz-root .fila{display:grid;grid-template-columns:minmax(90px,38%) 1fr auto;align-items:center;gap:10px;font-size:14px}
.viz-root .fila .et{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary)}
.viz-root .fila .barra{display:block;height:14px}
.viz-root .fila .barra i{display:block;height:100%;background:var(--series-1);border-radius:0 4px 4px 0;min-width:2px}
.viz-root .fila .v{font-variant-numeric:tabular-nums;font-weight:600;min-width:2ch;text-align:right}
.viz-root .vacio{color:var(--text-muted);font-size:14px;padding:6px 0}
.viz-tip{position:fixed;pointer-events:none;background:#1b1b1b;color:#fff;font:13px/1.35 system-ui,sans-serif;padding:7px 10px;border-radius:8px;z-index:50;transform:translate(-50%,calc(-100% - 10px));white-space:nowrap;display:none}
`;

let tip;
function tooltip() {
  if (tip) return tip;
  tip = document.createElement('div');
  tip.className = 'viz-tip';
  document.body.appendChild(tip);
  return tip;
}
function conectarTooltips(root) {
  const t = tooltip();
  root.querySelectorAll('[data-tip]').forEach((el) => {
    const mostrar = () => {
      const r = el.getBoundingClientRect();
      t.innerHTML = el.dataset.tip;
      t.style.left = r.left + r.width / 2 + 'px';
      t.style.top = (el.firstElementChild ? el.firstElementChild.getBoundingClientRect().top : r.top) + 'px';
      t.style.display = 'block';
    };
    const ocultar = () => (t.style.display = 'none');
    el.addEventListener('mouseenter', mostrar);
    el.addEventListener('focus', mostrar);
    el.addEventListener('mouseleave', ocultar);
    el.addEventListener('blur', ocultar);
    el.addEventListener('touchstart', mostrar, { passive: true });
  });
}

function columnas(valores, etiquetaTip, ejes) {
  const max = Math.max(1, ...valores);
  const cols = valores
    .map((v, i) => {
      const h = v === 0 ? 0 : Math.max(2, Math.round((v / max) * 100));
      const tipTxt = etiquetaTip(i, v);
      return `<div class="col" tabindex="0" role="img" aria-label="${esc(tipTxt.replace(/<[^>]+>/g, ''))}" data-tip="${esc(tipTxt)}"><i style="height:${h}%"></i></div>`;
    })
    .join('');
  return `<div class="cols"><div class="tope"><span>${fmt.format(max)}</span></div>${cols}</div>
          <div class="ejes">${ejes.map((e) => `<span>${esc(e)}</span>`).join('')}</div>`;
}

function filas(items) {
  if (!items.length) return '<div class="vacio">Todavía no hay datos en este periodo.</div>';
  const max = Math.max(1, ...items.map((x) => x.n));
  return `<div class="filas">${items
    .map(
      (x) => `<div class="fila"><span class="et" title="${esc(x.et)}">${esc(x.et)}</span>
        <span class="barra"><i style="width:${x.n ? Math.max(1, (x.n / max) * 100) : 0}%"></i></span><span class="v">${fmt.format(x.n)}</span></div>`
    )
    .join('')}</div>`;
}

export function renderStats(el, s) {
  if (!document.getElementById('viz-css')) {
    const st = document.createElement('style');
    st.id = 'viz-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const pct = (a) => (s.total ? Math.round((a / s.total) * 100) + '%' : '—');
  const d = s.dispositivos || {};
  const dias = s.por_dia || [];
  const ejesDias = dias.length ? [fecha(dias[0].dia), dias.length > 2 ? fecha(dias[Math.floor(dias.length / 2)].dia) : '', fecha(dias[dias.length - 1].dia)] : [];
  const pico = (s.por_hora || []).reduce((best, v, h) => (v > best.v ? { h, v } : best), { h: -1, v: 0 });

  el.innerHTML = `<div class="viz-root">
    <div class="tiles">
      <div class="tile"><small>Toques en ${s.dias} días</small><b>${fmt.format(s.total)}</b><span>veces que abrieron tu portal</span></div>
      <div class="tile"><small>Acercando el celular (NFC)</small><b>${fmt.format(s.nfc)}</b><span>${pct(s.nfc)} del total</span></div>
      <div class="tile"><small>Escaneando el QR</small><b>${fmt.format(s.qr)}</b><span>${pct(s.qr)} del total</span></div>
      <div class="tile"><small>Fueron a dejar reseña</small><b>${fmt.format(s.resenas)}</b><span>clics al botón de Google</span></div>
    </div>
    <div class="card"><h3>Toques por día</h3><p class="sub">Últimos ${s.dias} días · Android ${fmt.format(d.android || 0)} · iPhone ${fmt.format(d.ios || 0)} · otros ${fmt.format(d.otro || 0)}</p>
      ${columnas(dias.map((x) => x.n), (i, v) => `<b>${fecha(dias[i].dia, true)}</b><br>${fmt.format(v)} toque${v === 1 ? '' : 's'}`, ejesDias)}
    </div>
    <div class="card"><h3>Horas pico</h3><p class="sub">${pico.h >= 0 ? `La hora con más movimiento es ${hora(pico.h)}` : 'Aún no hay toques en este periodo'}</p>
      ${columnas(s.por_hora || [], (h, v) => `<b>${hora(h)}–${hora((h + 1) % 24)}</b><br>${fmt.format(v)} toque${v === 1 ? '' : 's'}`, ['12 am', '6 am', '12 m', '6 pm', '11 pm'])}
    </div>
    <div class="card"><h3>¿Qué tocaron en la página?</h3><p class="sub">Clics en cada botón</p>
      ${filas((s.clicks || []).map((c) => ({ et: nombreBoton(c.boton, s.links), n: c.n })))}
    </div>
    <div class="card"><h3>Toques por ubicación</h3><p class="sub">Cada sticker o placa por separado</p>
      ${filas((s.por_tag || []).map((t) => ({ et: t.nombre, n: t.n })))}
    </div>
  </div>`;
  conectarTooltips(el);
}
