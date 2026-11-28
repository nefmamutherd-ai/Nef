// Catálogo en el admin: categorías, platos (foto WebP, etiquetas, destacado, "Agotado hoy" de un toque),
// máquinas (video + 3 pasos), clases (horario) y servicios.
const TIPOS = { maquina: 'Máquina', clase: 'Clase', plato: 'Plato', servicio: 'Servicio' };
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const pesos = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

// Recorta al centro a cuadrado, redimensiona a 1000×1000 y convierte a WebP (calidad 0,82)
export async function fotoWebp(file) {
  const img = await createImageBitmap(file);
  const lado = Math.min(img.width, img.height);
  const c = document.createElement('canvas');
  c.width = 1000; c.height = 1000;
  c.getContext('2d').drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 1000, 1000);
  return new Promise((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo convertir la foto'))), 'image/webp', 0.82));
}

export function montarCatalogo({ sb, toast, esc, negocioActual, alCambiar }) {
  const $ = (s) => document.querySelector(s);
  const f = $('#form-producto');
  const dlg = $('#dlg-producto');
  let lista = [];
  let categorias = [];
  let editando = null;
  let fotoNueva = null; // Blob WebP listo para subir
  let modeloNuevo = null; // archivo .glb listo para subir

  const detalle = (p) => {
    if (p.tipo === 'maquina') return `${(p.pasos || []).length} pasos${p.video_url ? ' · con video' : ' · sin video'}`;
    if (p.tipo === 'clase') return (p.horario || []).map((h) => `${DIAS[h.dia].slice(0, 3)} ${h.hora}`).join(', ') || 'Sin horario';
    const cat = categorias.find((c) => c.id === p.categoria_id);
    return `${pesos(p.precio)}${cat ? ' · ' + cat.nombre : ''}${p.destacado ? ' · destacado' : ''}`;
  };

  async function cargarCategorias(id) {
    const { data } = await sb.from('categorias').select('*').eq('negocio_id', id).order('orden').order('nombre');
    categorias = data || [];
    const ul = $('#k-cat-lista');
    ul.textContent = '';
    for (const c of categorias) {
      const li = document.createElement('li');
      const p = document.createElement('div'); p.className = 'n-principal';
      const b = document.createElement('b'); b.textContent = c.nombre;
      const s = document.createElement('span'); s.textContent = `${lista.filter((x) => x.categoria_id === c.id).length} productos`;
      p.append(b, s);
      const chk = document.createElement('input');
      chk.type = 'checkbox'; chk.checked = c.activo; chk.setAttribute('aria-label', 'Categoría activa');
      chk.addEventListener('change', async () => {
        const { error } = await sb.from('categorias').update({ activo: chk.checked }).eq('id', c.id);
        toast(error ? 'No se guardó: ' + error.message : 'Categoría guardada');
      });
      li.append(p, chk);
      ul.append(li);
    }
    const sel = $('#k-categoria');
    sel.textContent = '';
    sel.append(new Option('— Sin categoría —', ''));
    categorias.forEach((c) => sel.append(new Option(c.nombre, c.id)));
  }

  async function cargar() {
    const id = negocioActual();
    const tb = $('#lista-productos');
    if (!id) { tb.innerHTML = '<tr><td colspan="6"><div class="n-vacio"><b>Primero crea un negocio</b></div></td></tr>'; return; }
    const { data, error } = await sb.from('productos').select('*').eq('negocio_id', id).order('tipo').order('orden').order('nombre');
    if (error) { toast('No se cargó el catálogo: ' + error.message); return; }
    lista = data;
    await cargarCategorias(id);
    if (!lista.length) { tb.innerHTML = '<tr><td colspan="6"><div class="n-vacio"><b>Aún no hay nada</b>Agrega un plato, una máquina o una clase.</div></td></tr>'; return; }
    tb.innerHTML = lista.map((p) => `<tr data-id="${esc(p.id)}">
      <td><b>${esc(p.nombre)}</b>${p.descripcion ? `<br>${esc(p.descripcion)}` : ''}</td>
      <td>${esc(TIPOS[p.tipo] || p.tipo)}</td>
      <td>${esc(detalle(p))}</td>
      <td>${['plato', 'servicio'].includes(p.tipo) ? `<input type="checkbox" class="k-agotado" aria-label="Agotado hoy" ${p.agotado ? 'checked' : ''}>`
        : p.tipo === 'maquina' ? `<label class="k-mant"><input type="checkbox" class="k-mantenimiento" aria-label="En mantenimiento" ${p.mantenimiento ? 'checked' : ''}> En mantenimiento</label>` : ''}</td>
      <td><span class="n-estado ${p.activo ? 'ok' : 'alerta'}">${p.activo ? 'Activo' : 'Apagado'}</span></td>
      <td><button class="n-btn secundario chico" data-editar-producto="${esc(p.id)}">Editar</button></td></tr>`).join('');
    tb.querySelectorAll('[data-editar-producto]').forEach((b) => b.addEventListener('click', () => abrir(lista.find((p) => p.id === b.dataset.editarProducto))));
    // "Agotado hoy" de un toque: es lo que más se usa en el día a día
    tb.querySelectorAll('.k-agotado').forEach((chk) => chk.addEventListener('change', async () => {
      const id = chk.closest('tr').dataset.id;
      const { error: err } = await sb.from('productos').update({ agotado: chk.checked }).eq('id', id);
      if (err) { chk.checked = !chk.checked; toast('No se guardó: ' + err.message); return; }
      lista.find((p) => p.id === id).agotado = chk.checked;
      toast(chk.checked ? 'Marcado como agotado hoy' : 'Disponible otra vez');
    }));
    // "En mantenimiento" (máquinas) de un toque, igual que "Agotado hoy"; al apagarlo se borra la fecha de regreso
    tb.querySelectorAll('.k-mantenimiento').forEach((chk) => chk.addEventListener('change', async () => {
      const id = chk.closest('tr').dataset.id;
      const cambio = chk.checked ? { mantenimiento: true } : { mantenimiento: false, vuelve: null };
      const { error: err } = await sb.from('productos').update(cambio).eq('id', id);
      if (err) { chk.checked = !chk.checked; toast('No se guardó: ' + err.message); return; }
      Object.assign(lista.find((p) => p.id === id), cambio);
      toast(chk.checked ? 'Máquina en mantenimiento' : 'Máquina disponible otra vez');
    }));
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
    fotoNueva = null;
    modeloNuevo = null;
    f.reset();
    $('#k-error').hidden = true;
    $('#k-titulo').textContent = p ? `Editar · ${p.nombre}` : 'Agregar';
    $('#k-eliminar').hidden = !p;
    $('#k-horario').textContent = '';
    $('#k-foto-txt').textContent = p && p.foto_url ? 'Cambiar foto' : 'Subir foto';
    $('#k-modelo-txt').textContent = p && p.modelo_url ? 'Cambiar modelo 3D (.glb)' : 'Subir modelo 3D (.glb)';
    f.querySelectorAll('#k-etiquetas input').forEach((c) => (c.checked = false));
    if (p) {
      f.querySelectorAll('input[name=tipo]').forEach((r) => (r.checked = r.value === p.tipo));
      f.nombre.value = p.nombre; f.descripcion.value = p.descripcion || ''; f.precio.value = p.precio || 0;
      f.categoria_id.value = p.categoria_id || '';
      f.video_url.value = p.video_url || '';
      f.modelo_url.value = p.modelo_url || '';
      ['paso1', 'paso2', 'paso3'].forEach((k, i) => (f[k].value = (p.pasos || [])[i] || ''));
      (p.horario || []).forEach(filaHorario);
      f.querySelectorAll('#k-etiquetas input').forEach((c) => (c.checked = (p.etiquetas || []).includes(c.value)));
      f.destacado.checked = p.destacado; f.agotado.checked = p.agotado; f.activo.checked = p.activo;
      f.mantenimiento.checked = !!p.mantenimiento; f.vuelve.value = p.vuelve || '';
    } else {
      // Por defecto, según el sector del negocio activo en el selector: lo más común primero
      const tipo = categorias.length ? 'plato' : 'maquina';
      f.querySelectorAll('input[name=tipo]').forEach((r) => (r.checked = r.value === tipo));
    }
    mostrarPorTipo();
    dlg.showModal();
  }

  $('#k-modelo-archivo').addEventListener('change', (e) => {
    const file = e.target.files[0];
    modeloNuevo = null;
    if (!file) return;
    if (!/\.glb$/i.test(file.name)) { $('#k-modelo-txt').textContent = 'Debe ser un archivo .glb'; return; }
    if (file.size > 5 * 1024 * 1024) { $('#k-modelo-txt').textContent = 'Pesa más de 5 MB: expórtalo en calidad media'; return; }
    modeloNuevo = file;
    $('#k-modelo-txt').textContent = `Modelo listo (${(file.size / 1048576).toFixed(1)} MB)`;
  });
  $('#k-foto').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      fotoNueva = await fotoWebp(file);
      $('#k-foto-txt').textContent = `Foto lista (${Math.round(fotoNueva.size / 1024)} KB)`;
    } catch (err) { toast(err.message); }
  });

  f.querySelectorAll('input[name=tipo]').forEach((r) => r.addEventListener('change', mostrarPorTipo));
  $('#k-mas-horario').addEventListener('click', () => filaHorario());
  $('#k-nuevo').addEventListener('click', () => { if (negocioActual()) abrir(); else toast('Primero crea un negocio'); });
  $('#k-cancelar').addEventListener('click', () => dlg.close());
  $('#k-cat-agregar').addEventListener('click', async () => {
    const nombre = $('#k-cat-nueva').value.trim();
    if (!nombre || !negocioActual()) return;
    const { error } = await sb.from('categorias').insert({ negocio_id: negocioActual(), nombre, orden: categorias.length + 1 });
    if (error) { toast('No se agregó: ' + error.message); return; }
    $('#k-cat-nueva').value = '';
    toast('Categoría agregada');
    cargar();
  });

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = (m) => { $('#k-error').textContent = m; $('#k-error').hidden = false; };
    const tipo = f.tipo.value;
    const nombre = f.nombre.value.trim();
    if (!nombre) return err('Escribe el nombre.');
    const video = f.video_url.value.trim();
    if (tipo === 'maquina' && video && !/^https?:\/\//i.test(video)) return err('El video debe ser un link que empiece por https://');
    const modelo = f.modelo_url.value.trim();
    if (modelo && !/^(https:\/\/\S+|\/assets\/[\w\-/.]+)\.glb$/i.test(modelo)) return err('El modelo 3D debe ser un link https que termine en .glb');
    const horario = [...$('#k-horario').querySelectorAll('[data-horario]')].map((x) => ({
      dia: +x.querySelector('[data-h=dia]').value,
      hora: x.querySelector('[data-h=hora]').value,
      duracion: +x.querySelector('[data-h=duracion]').value || null,
      cupo: +x.querySelector('[data-h=cupo]').value || null,
    })).filter((h) => /^\d{2}:\d{2}$/.test(h.hora));
    const esCarta = ['plato', 'servicio'].includes(tipo);
    const datos = {
      negocio_id: negocioActual(), tipo, nombre,
      descripcion: f.descripcion.value.trim() || null,
      precio: esCarta ? Math.max(0, parseInt(f.precio.value, 10) || 0) : 0,
      categoria_id: esCarta ? f.categoria_id.value || null : null,
      etiquetas: esCarta ? [...f.querySelectorAll('#k-etiquetas input:checked')].map((c) => c.value) : [],
      destacado: esCarta && f.destacado.checked,
      agotado: esCarta && f.agotado.checked,
      mantenimiento: tipo === 'maquina' && f.mantenimiento.checked,
      vuelve: tipo === 'maquina' && f.mantenimiento.checked ? f.vuelve.value || null : null,
      video_url: tipo === 'maquina' ? video || null : null,
      modelo_url: esCarta ? modelo || null : (editando && editando.modelo_url) || null,
      pasos: tipo === 'maquina' ? ['paso1', 'paso2', 'paso3'].map((k) => f[k].value.trim()).filter(Boolean) : [],
      horario: tipo === 'clase' ? horario : [],
      activo: f.activo.checked,
    };
    if (modeloNuevo && esCarta) {
      const rutaM = `${negocioActual()}/${crypto.randomUUID()}.glb`;
      const { error: errM } = await sb.storage.from('modelos').upload(rutaM, modeloNuevo, { contentType: 'model/gltf-binary' });
      if (errM) return err('No se subió el modelo 3D: ' + errM.message);
      datos.modelo_url = sb.storage.from('modelos').getPublicUrl(rutaM).data.publicUrl;
    }
    if (fotoNueva && esCarta) {
      const ruta = `${negocioActual()}/${crypto.randomUUID()}.webp`;
      const { error: errFoto } = await sb.storage.from('fotos').upload(ruta, fotoNueva, { contentType: 'image/webp' });
      if (errFoto) return err('No se subió la foto: ' + errFoto.message);
      datos.foto_url = sb.storage.from('fotos').getPublicUrl(ruta).data.publicUrl;
    }
    const q = editando ? sb.from('productos').update(datos).eq('id', editando.id) : sb.from('productos').insert(datos);
    const { error } = await q;
    if (error) return err('No se pudo guardar: ' + error.message);
    dlg.close();
    toast(`${TIPOS[tipo]} guardado`);
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
