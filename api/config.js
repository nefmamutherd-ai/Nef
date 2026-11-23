// SOLO para la vista en Vercel (mientras no esté en Cloudflare Pages): la misma configuración pública que
// functions/api/config.js. Las variables se ponen en Vercel → Settings → Environment Variables.
// La "anon key" de Supabase es pública por diseño; la seguridad está en las reglas (RLS) de la base.
export default function handler(req, res) {
  const cfg = {
    url: process.env.SUPABASE_URL || '',
    anon: process.env.SUPABASE_ANON_KEY || '',
    marca: process.env.MARCA || 'Nef',
    contacto: process.env.CONTACTO_WHATSAPP || '',
  };
  res.setHeader('content-type', 'application/javascript; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.status(200).send(`window.TOQUE = ${JSON.stringify(cfg)};`);
}
