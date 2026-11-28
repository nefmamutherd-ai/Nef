// Filas que se deslizan de lado (pestañas de la carta, "Los favoritos", días de clases): en celular van con el dedo; en
// computador no había cómo moverlas (27/11/2026). Aquí: arrastrar con el mouse y la rueda del mouse las mueve de lado.
// Solo con mouse (pointerType 'mouse'); en pantallas táctiles no cambia nada.
const FILAS = '.pt-pestanas, .pt-carrusel, .pt-dias';

function preparar(fila) {
  if (fila.dataset.arrastre) return;
  fila.dataset.arrastre = '1';
  let x0 = 0, inicio = 0, movio = false, activo = false;
  fila.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || fila.scrollWidth <= fila.clientWidth) return;
    activo = true; movio = false; x0 = e.clientX; inicio = fila.scrollLeft;
  });
  window.addEventListener('pointermove', (e) => {
    if (!activo) return;
    const dx = e.clientX - x0;
    if (!movio && Math.abs(dx) > 5) { movio = true; fila.classList.add('arrastrando'); }
    if (movio) fila.scrollLeft = inicio - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!activo) return;
    activo = false; fila.classList.remove('arrastrando');
  });
  // Si fue un arrastre, el clic que viene al soltar no abre el plato ni cambia de pestaña
  fila.addEventListener('click', (e) => { if (movio) { e.preventDefault(); e.stopPropagation(); movio = false; } }, true);
  // Rueda vertical → desliza de lado mientras la fila tenga para dónde moverse (si no, la página baja normal)
  fila.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const max = fila.scrollWidth - fila.clientWidth;
    if (max <= 0) return;
    const sig = Math.min(max, Math.max(0, fila.scrollLeft + e.deltaY));
    if (sig === fila.scrollLeft) return;
    e.preventDefault(); fila.scrollLeft = sig;
  }, { passive: false });
  fila.addEventListener('dragstart', (e) => e.preventDefault()); // que las fotos no se "arrastren" como imagen
}

if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const todas = () => document.querySelectorAll(FILAS).forEach(preparar);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', todas); else todas();
}
