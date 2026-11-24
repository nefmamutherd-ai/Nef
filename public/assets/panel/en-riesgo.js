// "En riesgo" (lo usan /admin y /panel): nombre, días sin venir y botón de WhatsApp.
// El botón solo aparece en horario legal (Ley 2300); fuera de horario dice cuándo se puede.
// Datos → textContent (nunca innerHTML).
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };

export function pintarEnRiesgo(cont, g, nombreNegocio, { limite = 50, titulo = 'En riesgo' } = {}) {
  cont.textContent = '';
  if (!g) return;
  const t = el('div', 'n-tarjeta');
  t.append(el('h2', '', titulo), el('p', '', g.puede_escribir ? 'Escríbeles hoy. El botón solo aparece en horario permitido.' : 'Ahora no se puede escribir: fuera del horario permitido (Ley 2300).'));
  const proxima = g.proxima ? new Date(g.proxima) : null;
  const disponible = proxima
    ? `Disponible el ${proxima.toLocaleDateString('es-CO', { weekday: 'long', timeZone: 'America/Bogota' })} a las ${proxima.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })}`
    : '';
  const lista = g.en_riesgo || [];
  const ul = el('ul', 'n-lista');
  for (const p of lista.slice(0, limite)) {
    const li = el('li');
    const pr = el('div', 'n-principal');
    pr.append(el('b', '', p.nombre || 'Sin nombre'), el('span', '', `${p.dias} días sin venir · ${p.visitas} visitas`));
    li.append(pr);
    let tel = String(p.telefono || '').replace(/\D/g, '');
    if (tel.length === 10 && tel[0] === '3') tel = '57' + tel;
    if (g.puede_escribir && tel.length >= 12) {
      const a = el('a', 'n-btn chico secundario', 'WhatsApp');
      const msg = `Hola ${String(p.nombre || '').split(' ')[0]}, te extrañamos en ${nombreNegocio}. ¿Todo bien? Aquí te esperamos cuando quieras.`;
      a.href = `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`; a.target = '_blank'; a.rel = 'noopener';
      li.append(a);
    } else if (!g.puede_escribir) li.append(el('span', 'n-estado', disponible));
    ul.append(li);
  }
  if (!lista.length) t.append(el('div', 'n-vacio', 'Nadie en riesgo por ahora.'));
  else {
    t.append(ul);
    if (lista.length > limite) t.append(el('p', 'n-ayuda', `Y ${lista.length - limite} más.`));
  }
  cont.append(t);
}
