// AXIONA EVALÚA · Candado de ingreso para todo el sitio (revisión privada antes del lanzamiento).
// El código vive en la variable ACCESO_CODIGO y la firma de la cookie en ACCESO_SECRETO (Netlify).
// Con CANDADO=off se abre el sitio al público sin tocar el código.
const COOKIE = 'axiona_acceso';
const DIAS = 30;
const enc = new TextEncoder();

async function hmac(secreto, texto) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const f = await crypto.subtle.sign('HMAC', k, enc.encode(texto));
  return btoa(String.fromCharCode(...new Uint8Array(f))).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' })[c]);
}
async function iguales(a, b) {
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', enc.encode(String(s)))));
  const A = new Uint8Array(x), B = new Uint8Array(y);
  let d = 0; for (let i = 0; i < A.length; i++) d |= A[i] ^ B[i];
  return d === 0;
}
const leerCookie = (req, n) => (req.headers.get('cookie') || '').split(/;\s*/).map(c => c.split('=')).find(([k]) => k === n)?.[1];

async function cookieValida(req, secreto) {
  const v = leerCookie(req, COOKIE);
  if (!v) return false;
  const [exp, firma] = v.split('.');
  if (!exp || !firma || Number(exp) < Date.now()) return false;
  return iguales(firma, await hmac(secreto, `v1|${exp}`));
}

const pagina = (error = '', destino = '/') => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>AXIONA EVALÚA · Acceso</title>
<style>
:root{--f:#05080d;--c:#0d141e;--b:#1d2a3a;--t:#e8eef6;--s:#8ea0b6;--a:#19d3c5;--e:#ff6b6b}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(1200px 600px at 70% -10%,#0e2a33 0%,var(--f) 55%);color:var(--t);font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px}
.c{width:100%;max-width:400px;background:var(--c);border:1px solid var(--b);border-radius:20px;padding:28px;box-shadow:0 30px 80px rgba(0,0,0,.5)}
.m{font-weight:800;letter-spacing:.14em;font-size:13px;color:var(--a)}h1{margin:6px 0 4px;font-size:24px}p{color:var(--s);margin:0 0 20px;font-size:14px}
label{display:block;font-size:13px;color:var(--s);margin-bottom:6px}input{width:100%;padding:14px 16px;border-radius:12px;border:1px solid var(--b);background:#070c13;color:var(--t);font-size:18px;letter-spacing:.08em;text-transform:uppercase}
input:focus{outline:2px solid var(--a);border-color:transparent}button{margin-top:14px;width:100%;padding:14px;border:0;border-radius:12px;background:linear-gradient(135deg,#19d3c5,#2f7bff);color:#041016;font-weight:800;font-size:16px;cursor:pointer}
.e{color:var(--e);font-size:14px;margin:12px 0 0}.n{margin-top:18px;font-size:12px;color:#5f7186}
</style></head><body><form class="c" method="post" action="/__candado"><div class="m">AXIONA EVALÚA</div><h1>Revisión privada</h1><p>Plataforma de evaluación y reconstrucción post-sismo · Quibdó y Pereira. Escriba el código de acceso.</p>
<label for="codigo">Código de acceso</label><input id="codigo" name="codigo" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" required autofocus>
<input type="hidden" name="destino" value="${destino.replace(/[^\w/?=&.%-]/g, '')}"><button type="submit">Entrar</button>${error ? `<div class="e">${error}</div>` : ''}<div class="n">Axiona Desarrollos Inteligentes · acceso restringido</div></form></body></html>`;

export default async (req, context) => {
  if ((Netlify.env.get('CANDADO') || '').toLowerCase() === 'off') return context.next();
  const codigo = Netlify.env.get('ACCESO_CODIGO'), secreto = Netlify.env.get('ACCESO_SECRETO');
  if (!codigo || !secreto) return new Response('Sitio cerrado: falta configurar el acceso.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const url = new URL(req.url);

  if (url.pathname === '/__candado' && req.method === 'POST') {
    const f = await req.formData().catch(() => null);
    const dado = String(f?.get('codigo') || '').trim().toUpperCase();
    const destino = String(f?.get('destino') || '/');
    if (!(await iguales(dado, codigo.trim().toUpperCase()))) {
      await new Promise(ok => setTimeout(ok, 600)); // frena la fuerza bruta
      return new Response(pagina('Código incorrecto.', destino), { status: 401, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    const exp = Date.now() + DIAS * 86400000;
    const valor = `${exp}.${await hmac(secreto, `v1|${exp}`)}`;
    return new Response(null, { status: 303, headers: { location: destino.startsWith('/') && !destino.startsWith('//') ? destino : '/', 'set-cookie': `${COOKIE}=${valor}; Path=/; Max-Age=${DIAS * 86400}; HttpOnly; Secure; SameSite=Lax`, 'cache-control': 'no-store' } });
  }
  if (await cookieValida(req, secreto)) return context.next();

  const html = (req.headers.get('accept') || '').includes('text/html');
  if (!html) return new Response(JSON.stringify({ error: 'acceso', mensaje: 'Requiere el código de acceso.' }), { status: 401, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  return new Response(pagina('', url.pathname + url.search), { status: 401, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
};


