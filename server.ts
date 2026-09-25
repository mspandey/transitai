import "./src/lib/error-capture";

import { consumeLastCapturedError } from "./src/lib/error-capture";
import { renderErrorPage } from "./src/lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const COOKIE_SECRET = process.env.COOKIE_SECRET;
const SESSION_COOKIE = 'transit-admin-session';

async function createSessionToken(): Promise<string> {
  if (!COOKIE_SECRET) throw new Error('COOKIE_SECRET is not configured')
  const payload = JSON.stringify({ role: 'admin', exp: Date.now() + 30 * 60 * 1000 })
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(COOKIE_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return btoa(payload) + '.' + b64
}

async function verifySessionToken(token: string): Promise<boolean> {
  try {
    if (!COOKIE_SECRET) return false
    const [payloadB64, sigB64] = token.split('.')
    if (!payloadB64 || !sigB64) return false
    const payload = atob(payloadB64)
    const { exp } = JSON.parse(payload)
    if (Date.now() > exp) return false
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(COOKIE_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    )
    const sig = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0))
    return await crypto.subtle.verify('HMAC', key, sig, encoder.encode(payload))
  } catch { return false }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      
      if (request.method === 'POST' && url.pathname === '/api/admin-login') {
        const { username, password } = await request.json();
        const validUser = Boolean(ADMIN_USERNAME) && username === ADMIN_USERNAME;
        const validPass = Boolean(ADMIN_PASSWORD) && password === ADMIN_PASSWORD;
        if (validUser && validPass) {
          const token = await createSessionToken();
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=1800`,
            },
          });
        }
        return new Response(JSON.stringify({ success: false }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }

      if (request.method === 'GET' && url.pathname === '/api/admin-verify') {
        const cookies = request.headers.get('cookie') || '';
        const match = cookies.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
        const token = match?.[1] || '';
        const valid = await verifySessionToken(token);
        return new Response(JSON.stringify({ valid }), {
          status: valid ? 200 : 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'POST' && url.pathname === '/api/admin-logout') {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0`,
          },
        });
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
