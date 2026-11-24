// Admin › Dueños: quién entra a /panel y a qué empresa. La persona primero crea su cuenta en /panel;
// después el admin le da acceso con su correo (RPC dar_acceso). Quitar = borrar la fila de `accesos` (RLS: solo admin).
const ROLES = { dueno: 'Dueño', gerente: 'Gerente' };

export function montarAccesos({ sb, toast }) {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  let empresas = [];

  async function cargar() {
    const [{ data: emp, error: e1 }, { data: acc, error: e2 }] = await Promise.all([sb.rpc('mensualidades_admin'), sb.rpc('accesos_admin')]);
    const tb = $('#lista-accesos');
    tb.textContent = '';
    if (e1 || e2) { toast('No se cargaron los accesos: ' + (e1 || e2).message); return; }
    empresas = emp || [];
    const sel = $('#a-empresa');
    const antes = sel.value;
    sel.textContent = '';
    empresas.forEach((e) => { const sedes = e.negocios.map((n) => n.nombre).filter((x) => x !== e.nombre); sel.append(new Option(sedes.length ? `${e.nombre} · ${sedes.join(', ')}` : e.nombre, e.id)); });
    if ([...sel.options].some((o) => o.value === antes)) sel.value = antes;
    if (!acc.length) {
      const td = el('td', 'n-vacio', 'Nadie tiene acceso todavía.'); td.colSpan = 4;
      const tr = el('tr'); tr.append(td); tb.append(tr);
      return;
    }
    for (const a of acc) {
      const tr = el('tr');
      const empresa = empresas.find((e) => e.id === a.empresa_id);
      const quitar = el('button', 'n-btn fantasma chico', 'Quitar');
      quitar.addEventListener('click', async () => {
        if (quitar.dataset.seguro !== '1') { quitar.dataset.seguro = '1'; quitar.textContent = '¿Seguro? Toca otra vez'; return; }
        const { error } = await sb.from('accesos').delete().eq('user_id', a.user_id).eq('empresa_id', a.empresa_id);
        toast(error ? 'No se quitó: ' + error.message : 'Acceso quitado');
        cargar();
      });
      for (const c of [el('b', '', a.email || '(sin correo)'), el('span', '', empresa ? empresa.nombre : '—'), el('span', 'n-estado', ROLES[a.rol] || a.rol), quitar]) {
        const td = el('td'); td.append(c); tr.append(td);
      }
      tb.append(tr);
    }
  }

  $('#form-acceso').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#a-email').value.trim();
    const { error } = await sb.rpc('dar_acceso', { p_email: email, p_empresa: $('#a-empresa').value, p_rol: $('#a-rol').value });
    if (error) { toast(/todavía no tiene cuenta/.test(error.message) ? 'Ese correo todavía no tiene cuenta: que la cree en /panel' : 'No se dio el acceso: ' + error.message); return; }
    $('#a-email').value = '';
    toast(`Listo: ${email} ya entra por /panel`);
    cargar();
  });

  return { cargar };
}
