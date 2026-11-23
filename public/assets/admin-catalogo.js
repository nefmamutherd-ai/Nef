// Catálogo en el admin: máquinas (video + 3 pasos), clases (horario), platos y servicios.
// La carta completa del café (categorías, fotos, agotado) llega en la Fase 5.
const TIPOS = { maquina: 'Máquina', clase: 'Clase', plato: 'Plato', servicio: 'Servicio' };
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const pesos = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

export function montarCatalogo({ sb, toast, esc, negocioActual, alCambiar }) {
  const $ = (s) => document.querySelector(s);
  const f = $('#form-producto');
  const dlg = $('#dlg-producto');
  let lista = [];
  let editando = null;

  const detalle = (p) => {
    if (p.tipo === 'maquina') return `${(p.pasos || []).length} pasos${p.video_url ? ' · con video' : ' · sin video'}`;
    if (p.tipo === 'clase') return (p.horario || []).map((h) => `${DIAS[h.dia].slice(0, 3)} ${h.hora}`).join(', ') || 'Sin horario';
    return pesos(p.precio);
  };

  async function cargar() {
    const id = negocioActual();
    const tb = $('#lista-productos');
    if (!id) { tb.innerHTML = '<tr><td colspan="5"><div class="n-vacio"><b>Primero crea un negocio</b></div></td></tr>'; return; }
    const { data, error } = await sb.from('productos').select('*').eq('negocio_id', id).order('tipo').order('orden').order('nombre');
    if (error) { toast('No se cargó el catálogo: ' + error.message); return; }
    lista = data;
    if (!lista.length) { tb.innerHTML = '<tr><td colspan="5"><div class="n-vacio"><b>Aún no hay nada</b>Agrega una máquina o una clase.</div></td></tr>'; return; }
    tb.innerHTML = lista.map((p) => `<tr>
      <td><b>${esc(p.nombre)}</b>${p.descripcion ? `<br>${esc(p.descripcion)}` : ''}</td>
      <td>${esc(TIPOS[p.tipo] || p.tipo)}</td>
      <td>${esc(detalle(p))}</td>
      <td><span class="n-estado ${p.activo ? 'ok' : 'alerta'}">${p.activo ? 'Activo' : 'Apagado'}</span></td>
      <td><button class="n-btn secundario chico" data-editar-producto="${esc(p.id)}">Editar</button></td></tr>`).join('');
    tb.querySelectorAll('[data-editar-producto]').forEach((b) => b.addEventListener('click', () => abrir(lista.find((p) => p.id === b.dataset.editarProducto))));
  }

  function mostrarPorTipo() {
    const tipo = f.tipo.value;
    f.querySelectorAll('[data-para]').forEach((x) => (x.hidden = !x.dataset.para.split(' ').includes(tipo)));
  }

  function filaHorario(h = { dia: 1, hora: '18:00', duracion: 60, cupo: 20 }) {
    const fila = document.createElement('div');
    fila.className = 'n-fila';
    fila.dataset.horario = '';
    fila.innerHTML = `
      <div class="n-campo"><label>Día</label><select data-h="dia"></select></div>
      <div class="n-campo"><label>Hora</label><input data-h="hora" type="time" required></div>
      <div class="n-campo"><label>Minutos</label><input data-h="duracion" type="number" min="10" max="240"></div>
      <div class="n-campo"><label>Cupo</label><input data-h="cupo" type="number" min="1" max="500"></div>`;
    DIAS.forEach((d, i) => fila.querySelector('[data-h=dia]').append(new Option(d, String(i))));
    fila.querySelector('[data-h=dia]').value = String(h.dia);
    fila.querySelector('[data-h=hora]').value = h.hora;
    fila.querySelector('[data-h=duracion]').value = h.duracion ?? '';
    fila.querySelector('[data-h=cupo]').value = h.cupo ?? '';
    $('#k-horario').append(fila);
  }

  function abrir(p = null) {
    editando = p;
    f.reset();
    $('#k-error').hidden = true;
    $('#k-titulo').textContent = p ? `Editar · ${p.nombre}` : 'Agregar';
    $('#k-eliminar').hidden = !p;
    $('#k-horario').textContent = '';
    if (p) {
      f.querySelectorAll('input[name=tipo]').forEach((r) => (r.checked = r.value === p.tipo));
      f.nombre.value = p.nombre; f.descripcion.value = p.descripcion || ''; f.precio.value = p.precio || 0;
      f.video_url.value = p.video_url || '';
      ['paso1', 'paso2', 'paso3'].forEach((k, i) => (f[k].value = (p.pasos || [])[i] || ''));
      (p.horario || []).forEach(filaHorario);
      f.activo.checked = p.activo;
    }
    mostrarPorTipo();
    dlg.showModal();
  }

  f.querySelectorAll('input[name=tipo]').forEach((r) => r.addEventListener('change', mostrarPorTipo));
  $('#k-mas-horario').addEventListener('click', () => filaHorario());
  $('#k-nuevo').addEventListener('click', () => { if (negocioActual()) abrir(); else toast('Primero crea un negocio'); });
  $('#k-cancelar').addEventListener('click', () => dlg.close());

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = (m) => { $('#k-error').textContent = m; $('#k-error').hidden = false; };
    const tipo = f.tipo.value;
    const nombre = f.nombre.value.trim();
    if (!nombre) return err('Escribe el nombre.');
    const video = f.video_url.value.trim();
    if (tipo === 'maquina' && video && !/^https?:\/\//i.test(video)) return err('El video debe ser un link que empiece por https://');
    const horario = [...$('#k-horario').querySelectorAll('[data-horario]')].map((x) => ({
      dia: +x.querySelector('[data-h=dia]').value,
      hora: x.querySelector('[data-h=hora]').value,
      duracion: +x.querySelector('[data-h=duracion]').value || null,
      cupo: +x.querySelector('[data-h=cupo]').value || null,
    })).filter((h) => /^\d{2}:\d{2}$/.test(h.hora));
    const datos = {
      negocio_id: negocioActual(), tipo, nombre,
      descripcion: f.descripcion.value.trim() || null,
      precio: ['plato', 'servicio'].includes(tipo) ? Math.max(0, parseInt(f.precio.value, 10) || 0) : 0,
      video_url: tipo === 'maquina' ? video || null : null,
      pasos: tipo === 'maquina' ? ['paso1', 'paso2', 'paso3'].map((k) => f[k].value.trim()).filter(Boolean) : [],
      horario: tipo === 'clase' ? horario : [],
      activo: f.activo.checked,
    };
    const q = editando ? sb.from('productos').update(datos).eq('id', editando.id) : sb.from('productos').insert(datos);
    const { error } = await q;
    if (error) return err('No se pudo guardar: ' + error.message);
    dlg.close();
    toast(`${TIPOS[tipo]} guardada`);
    await cargar();
    if (alCambiar) alCambiar();
  });

  $('#k-eliminar').addEventListener('click', async () => {
    if (!editando || !confirm(`¿Eliminar "${editando.nombre}"?`)) return;
    const { error } = await sb.from('productos').delete().eq('id', editando.id);
    if (error) { toast(error.message); return; }
    dlg.close();
    toast('Eliminado');
    await cargar();
    if (alCambiar) alCambiar();
  });

  return { cargar };
}
