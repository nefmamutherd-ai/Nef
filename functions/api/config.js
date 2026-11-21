// Entrega la configuración pública al panel y a la página de estadísticas.
// La "anon key" de Supabase es pública por diseño: la seguridad está en las reglas (RLS) de la base.
export function onRequestGet({ env }) {
  const cfg = {
    url: env.SUPABASE_URL,
    anon: env.SUPABASE_ANON_KEY,
    marca: env.MARCA || 'Nef',
    contacto: env.CONTACTO_WHATSAPP || '',
  };
  return new Response(`window.TOQUE = ${JSON.stringify(cfg)};`, {
    headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' },
  });
}
