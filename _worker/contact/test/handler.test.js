import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, SITEVERIFY_URL } from '../src/index.js';

const ORIGIN = 'https://ryo-lab.dev';

function makeEnv(overrides = {}) {
  const sent = [];
  return {
    sent,
    env: {
      ALLOWED_ORIGINS: ORIGIN,
      TURNSTILE_HOSTNAMES: 'ryo-lab.dev',
      CONTACT_FROM: 'noreply@ryo-lab.dev',
      CONTACT_TO: 'owner@example.com',
      TURNSTILE_SECRET: 'secret',
      EMAIL: { send: async (message) => { sent.push(message); return { messageId: 'm1' }; } },
      ...overrides,
    },
  };
}

function siteverify(result) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(result), { status: 200 });
  };
  return { calls, fetchFn };
}

const okVerify = { success: true, action: 'contact', hostname: 'ryo-lab.dev' };

function post(body, headers = {}) {
  return new Request('https://api.ryo-lab.dev/contact', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.1', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const validBody = {
  app: 'scorevault',
  category: 'question',
  email: 'user@example.com',
  message: '使い方を教えてください',
  token: 'tok',
};

const deps = (fetchFn) => ({ fetchFn, now: () => new Date('2026-11-10T00:00:00Z') });

test('正常系：検証を通り、自分宛てに送信して CORS ヘッダーを返す', async () => {
  const { env, sent } = makeEnv();
  const { calls, fetchFn } = siteverify(okVerify);
  const res = await handleRequest(post(validBody), env, deps(fetchFn));

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal(calls[0].url, SITEVERIFY_URL);
  assert.equal(calls[0].init.body.get('remoteip'), '203.0.113.1');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'owner@example.com');
  assert.equal(sent[0].replyTo, 'user@example.com');
  assert.equal(sent[0].subject, '[ScoreVault] 使い方のご質問');
  assert.equal(sent[0].html, undefined);
});

test('許可されていない Origin は拒否し、CORS ヘッダーを返さない', async () => {
  const { env, sent } = makeEnv();
  const { fetchFn } = siteverify(okVerify);
  const res = await handleRequest(post(validBody, { Origin: 'https://evil.example' }), env, deps(fetchFn));
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(sent.length, 0);
});

test('Origin なし（サーバーからの直接送信）は拒否する', async () => {
  const { env } = makeEnv();
  const req = new Request('https://api.ryo-lab.dev/contact', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validBody),
  });
  const res = await handleRequest(req, env, deps(siteverify(okVerify).fetchFn));
  assert.equal(res.status, 403);
});

test('プリフライトは許可 Origin にだけ 204 を返す', async () => {
  const { env } = makeEnv();
  const preflight = (origin) => new Request('https://api.ryo-lab.dev/contact', { method: 'OPTIONS', headers: { Origin: origin } });
  const ok = await handleRequest(preflight(ORIGIN), env, deps(siteverify(okVerify).fetchFn));
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  const ng = await handleRequest(preflight('https://evil.example'), env, deps(siteverify(okVerify).fetchFn));
  assert.equal(ng.status, 403);
});

test('Turnstile の失敗・action 違い・ホスト名違いはすべて拒否する', async () => {
  for (const result of [
    { success: false },
    { success: true, action: 'login', hostname: 'ryo-lab.dev' },
    { success: true, action: 'contact', hostname: 'evil.example' },
  ]) {
    const { env, sent } = makeEnv();
    const res = await handleRequest(post(validBody), env, deps(siteverify(result).fetchFn));
    assert.equal(res.status, 403, JSON.stringify(result));
    assert.equal(sent.length, 0);
  }
});

test('Turnstile への通信が失敗したら拒否する', async () => {
  const { env, sent } = makeEnv();
  const res = await handleRequest(post(validBody), env, deps(async () => { throw new Error('network'); }));
  assert.equal(res.status, 403);
  assert.equal(sent.length, 0);
});

test('ハニーポットに値があれば成功に見せて送信しない', async () => {
  const { env, sent } = makeEnv();
  const { calls, fetchFn } = siteverify(okVerify);
  const res = await handleRequest(post({ ...validBody, website: 'spam' }), env, deps(fetchFn));
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0);
  assert.equal(sent.length, 0);
});

test('入力エラーは Turnstile を呼ぶ前に 400 を返す', async () => {
  const { env } = makeEnv();
  const { calls, fetchFn } = siteverify(okVerify);
  const res = await handleRequest(post({ ...validBody, app: 'other' }), env, deps(fetchFn));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'invalid_app');
  assert.equal(calls.length, 0);
});

test('JSON 以外・壊れた JSON・大きすぎる本文は拒否する', async () => {
  const { env } = makeEnv();
  const f = siteverify(okVerify).fetchFn;
  assert.equal((await handleRequest(post('a=b', { 'Content-Type': 'application/x-www-form-urlencoded' }), env, deps(f))).status, 415);
  assert.equal((await handleRequest(post('{broken'), env, deps(f))).status, 400);
  assert.equal((await handleRequest(post({ ...validBody, message: 'あ'.repeat(6000) }), env, deps(f))).status, 413);
});

test('POST 以外・別パスは拒否する', async () => {
  const { env } = makeEnv();
  const f = siteverify(okVerify).fetchFn;
  const get = new Request('https://api.ryo-lab.dev/contact', { headers: { Origin: ORIGIN } });
  assert.equal((await handleRequest(get, env, deps(f))).status, 405);
  const other = new Request('https://api.ryo-lab.dev/other', { method: 'POST', headers: { Origin: ORIGIN } });
  assert.equal((await handleRequest(other, env, deps(f))).status, 404);
});

test('設定が足りなければ送信せず 500 を返す', async () => {
  const { env, sent } = makeEnv({ CONTACT_TO: '' });
  const res = await handleRequest(post(validBody), env, deps(siteverify(okVerify).fetchFn));
  assert.equal(res.status, 500);
  assert.equal(sent.length, 0);
});

test('送信失敗は 502 を返し、本文をログに出さない', async () => {
  const logs = [];
  const original = console.error;
  console.error = (...args) => logs.push(args.join(' '));
  try {
    const { env } = makeEnv({ EMAIL: { send: async () => { const e = new Error('x'); e.code = 'E_SENDER_NOT_VERIFIED'; throw e; } } });
    const res = await handleRequest(post(validBody), env, deps(siteverify(okVerify).fetchFn));
    assert.equal(res.status, 502);
  } finally {
    console.error = original;
  }
  assert.equal(logs.length, 1);
  assert.match(logs[0], /E_SENDER_NOT_VERIFIED/);
  assert.doesNotMatch(logs[0], /user@example.com|使い方/);
});
