// Botón "Ver" dentro del campo de contraseña (login de /panel y /admin): muestra u oculta lo escrito.
document.querySelectorAll('.n-clave').forEach((caja) => {
  const input = caja.querySelector('input');
  const boton = caja.querySelector('.n-ver');
  boton.addEventListener('click', () => {
    const ver = input.type === 'password';
    input.type = ver ? 'text' : 'password';
    boton.textContent = ver ? 'Ocultar' : 'Ver';
    boton.setAttribute('aria-pressed', String(ver));
    boton.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
    input.focus();
  });
  // Al enviar el formulario vuelve a ocultarse (que no quede a la vista en el celular)
  if (input.form) input.form.addEventListener('submit', () => { if (input.type === 'text') boton.click(); });
});
