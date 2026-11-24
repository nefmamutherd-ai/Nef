// Club en /panel: premios (valor en pesos → costo en monedas), devolución real y PIN de la caja.
// Las políticas de la base (dueno_todo) solo dejan tocar los premios de sus negocios.
const pesos = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

export function montarClub({ sb, toast, esc, negocio, alCambiarPin }) {
  const $ = (s) => document.querySelector(s);
  let valorMoneda = 100;
  sb.rpc('valor_moneda').then(({ data }) => { if (data) valorMoneda = data; });
  const costo = (valor) => Math.ceil((+valor || 0) / valorMoneda);
  let premios = [];

  async function cargar() {
    const n = negocio();
    $('#pin-estado').textContent = n.tiene_pin ? 'La caja ya tiene PIN. Si alguien más lo conoce, cámbialo.' : 'Tu caja todavía no tiene PIN: ponle uno para empezar a dar monedas.';
    const { data, error } = await sb.from('premios').select('*').eq('negocio_id', n.id).order('valor_pesos');
    if (error) { toast('No se cargaron los premios'); return; }
    premios = data;
    pintar();
  }

  function pintar() {
    const tb = $('#lista-premios');
    if (!premios.length) { tb.innerHTML = '<li><div class="n-vacio n-principal"><b>Sin premios</b>Agrega el primero abajo.</div></li>'; return; }
    // Una fila por premio: nombre a lo ancho; debajo valor, costo en monedas y si está activo (cabe en 390 px)
    tb.innerHTML = premios.map((p) => `<li data-id="${esc(p.id)}">
        <div class="n-campo"><input data-campo="nombre" value="${esc(p.nombre)}" maxlength="80" aria-label="Nombre del premio"></div>
        <div class="n-premio-pie">
          <div class="n-campo"><input data-campo="valor_pesos" type="number" min="100" step="100" value="${esc(p.valor_pesos)}" aria-label="Valor en pesos"></div>
          <span class="costo">= ${costo(p.valor_pesos)} monedas</span>
          <label class="n-interruptor"><span>Activo</span><input type="checkbox" data-campo="activo" ${p.activo ? 'checked' : ''}></label>
        </div>
      </li>`).join('');
    tb.querySelectorAll('[data-campo]').forEach((el) => el.addEventListener('change', async () => {
      const tr = el.closest('li');
      const campo = el.dataset.campo;
      const valor = el.type === 'checkbox' ? el.checked : campo === 'valor_pesos' ? +el.value : el.value.trim();
      const { error } = await sb.from('premios').update({ [campo]: valor }).eq('id', tr.dataset.id);
      if (error) { toast('No se guardó: ' + error.message); return; }
      const p = premios.find((x) => x.id === tr.dataset.id);
      Object.assign(p, { [campo]: valor });
      tr.querySelector('.costo').textContent = `= ${costo(p.valor_pesos)} monedas`;
      toast('Premio guardado');
    }));
  }

  $('#p-agregar').addEventListener('click', async () => {
    const nombre = $('#p-nombre').value.trim();
    const valor = +$('#p-valor').value;
    if (!nombre || !(valor > 0)) { toast('Escribe el nombre y el valor en pesos'); return; }
    const { error } = await sb.from('premios').insert({ negocio_id: negocio().id, nombre, valor_pesos: valor });
    if (error) { toast('No se agregó: ' + error.message); return; }
    $('#p-nombre').value = ''; $('#p-valor').value = '';
    toast(`Premio agregado: cuesta ${costo(valor)} monedas`);
    cargar();
  });

  $('#form-pin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = $('#pin').value.trim();
    if (!/^[0-9]{4,6}$/.test(pin)) { toast('El PIN debe tener de 4 a 6 números'); return; }
    const { error } = await sb.rpc('fijar_pin_caja', { p_negocio: negocio().id, p_pin: pin });
    if (error) { toast('No se guardó el PIN'); return; }
    $('#pin').value = '';
    alCambiarPin(negocio());
    toast('PIN guardado. La caja ya puede entrar con él.');
    cargar();
  });

  // Devolución real: lo que los clientes se llevaron en premios frente a lo que compraron (PRODUCTO.md §8)
  function devolucion(d) {
    const c = $('#devolucion');
    c.textContent = '';
    const h = document.createElement('h2'); h.textContent = 'Devolución real';
    const n = document.createElement('div'); n.className = 'n-num';
    n.textContent = d && d.tasa != null ? new Intl.NumberFormat('es-CO', { style: 'percent', maximumFractionDigits: 1 }).format(d.tasa) : '—';
    const p = document.createElement('p');
    p.textContent = d && d.ventas ? `${pesos(d.premios)} en premios sobre ${pesos(d.ventas)} en compras registradas en la caja.` : 'Aparece cuando la caja registre compras con valor.';
    c.append(h, n, p);
  }

  return { cargar, devolucion };
}
