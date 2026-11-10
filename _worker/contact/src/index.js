// ryo-lab.dev のお問い合わせフォームを受け付ける Cloudflare Worker
// 流れ: Origin 確認 → サイズ・形式チェック → ハニーポット → 入力検証 → Turnstile 検証 → 自分宛てにメール送信

import { validateSubmission, isHoneypotFilled, buildMail } from './validate.js';

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_ACTION = 'contact';
const MAX_BODY_BYTES = 16 * 1024;
const SENDER_NAME = 'Ryo-Lab. お問い合わせ';

export default {
  async fetch(request, env) {
    return handleRequest(request, env, { fetchFn: fetch, now: () => new Date() });
  },
};

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(status, body, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(origin ? corsHeaders(origin) : { Vary: 'Origin' }),
    },
  });
}

/**
 * Turnstile のトークンをサーバー側で検証する。
 * success に加えて action とホスト名も照合し、別サイトで発行されたトークンを弾く。
 */
export async function verifyTurnstile({ token, ip, secret, hostnames, fetchFn }) {
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);

  let response;
  try {
    response = await fetchFn(SITEVERIFY_URL, { method: 'POST', body: form });
  } catch {
    return false;
  }
  if (!response.ok) return false;

  let data;
  try {
    data = await response.json();
  } catch {
    return false;
  }
  return data?.success === true && data.action === TURNSTILE_ACTION && hostnames.includes(data.hostname);
}

/**
 * @param {Request} request
 * @param {Record<string, any>} env
 * @param {{ fetchFn: typeof fetch, now: () => Date }} deps
 */
export async function handleRequest(request, env, deps) {
  const url = new URL(request.url);
  if (url.pathname !== '/contact') return json(404, { ok: false, error: 'not_found' });

  const origin = request.headers.get('Origin');
  const allowedOrigin = origin && splitList(env.ALLOWED_ORIGINS).includes(origin) ? origin : null;

  if (request.method === 'OPTIONS') {
    if (!allowedOrigin) return new Response(null, { status: 403, headers: { Vary: 'Origin' } });
    return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
  }
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' }, allowedOrigin);
  if (!allowedOrigin) return json(403, { ok: false, error: 'forbidden_origin' });

  // 設定漏れのまま動かさない（必ず失敗側に倒す）
  if (!env.TURNSTILE_SECRET || !env.CONTACT_TO || !env.CONTACT_FROM || !env.EMAIL) {
    console.error('contact: 必要な設定値が不足しています');
    return json(500, { ok: false, error: 'misconfigured' }, allowedOrigin);
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return json(415, { ok: false, error: 'unsupported_media_type' }, allowedOrigin);
  }
  const declaredLength = Number(request.headers.get('Content-Length') || '0');
  if (declaredLength > MAX_BODY_BYTES) return json(413, { ok: false, error: 'too_large' }, allowedOrigin);

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: 'too_large' }, allowedOrigin);
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, error: 'invalid_json' }, allowedOrigin);
  }

  // bot には成功に見せて、何もしない
  if (isHoneypotFilled(input)) return json(200, { ok: true }, allowedOrigin);

  const result = validateSubmission(input);
  if (!result.ok) return json(400, { ok: false, error: result.error }, allowedOrigin);

  const verified = await verifyTurnstile({
    token: result.value.token,
    ip: request.headers.get('CF-Connecting-IP'),
    secret: env.TURNSTILE_SECRET,
    hostnames: splitList(env.TURNSTILE_HOSTNAMES),
    fetchFn: deps.fetchFn,
  });
  if (!verified) return json(403, { ok: false, error: 'verification_failed' }, allowedOrigin);

  const { subject, text } = buildMail(result.value, {
    receivedAt: deps.now(),
    userAgent: request.headers.get('User-Agent'),
  });

  try {
    await env.EMAIL.send({
      to: env.CONTACT_TO,
      from: { email: env.CONTACT_FROM, name: SENDER_NAME },
      replyTo: result.value.email,
      subject,
      text,
    });
  } catch (error) {
    // 本文や連絡先はログに残さない（エラーコードのみ）
    console.error('contact: メール送信に失敗しました', error?.code || 'unknown');
    return json(502, { ok: false, error: 'send_failed' }, allowedOrigin);
  }

  return json(200, { ok: true }, allowedOrigin);
}
