import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProblemReport, validateForm, buildProblemMail, LIMITS } from '../src/validate.js';
import { handleRequest } from '../src/index.js';

const valid = () => ({
  form: 'problem',
  app: 'cloudkata',
  problemId: 'bundled-001',
  issue: 'wrong_answer',
  detail: '正解は B ではなく C だと思います',
  source: 'https://cloud.google.com/compute/docs',
  token: 'tok',
});

test('正しい問題報告を受け付ける（メール・指摘内容・ソースは任意）', () => {
  assert.equal(validateProblemReport(valid()).ok, true);
  const minimal = validateProblemReport({ app: 'cloudkata', problemId: 'q_1', issue: 'typo', token: 'tok' });
  assert.equal(minimal.ok, true);
  assert.deepEqual(
    { detail: minimal.value.detail, source: minimal.value.source, email: minimal.value.email },
    { detail: '', source: '', email: '' },
  );
});

test('CloudKata 以外のアプリは問題報告を受け付けない', () => {
  assert.equal(validateProblemReport({ ...valid(), app: 'scorevault' }).error, 'invalid_app');
});

test('問題 ID は必須で、英数字・ハイフン・アンダースコアのみ', () => {
  for (const problemId of ['', undefined, 'bad id', 'id\nBcc: x', '<script>', 'a'.repeat(LIMITS.problemId + 1), 1]) {
    assert.equal(validateProblemReport({ ...valid(), problemId }).error, 'invalid_problem_id', String(problemId));
  }
  assert.equal(validateProblemReport({ ...valid(), problemId: '  bundled-002  ' }).value.problemId, 'bundled-002');
});

test('指摘の種類は決められた値のみ', () => {
  assert.equal(validateProblemReport({ ...valid(), issue: 'spam' }).error, 'invalid_issue');
  assert.equal(validateProblemReport({ ...valid(), issue: undefined }).error, 'invalid_issue');
});

test('指摘内容とソースの上限・形式', () => {
  assert.equal(validateProblemReport({ ...valid(), detail: 'a'.repeat(LIMITS.message + 1) }).error, 'invalid_detail');
  assert.equal(validateProblemReport({ ...valid(), detail: 1 }).error, 'invalid_detail');
  assert.equal(validateProblemReport({ ...valid(), source: 'a\nb' }).error, 'invalid_source');
  assert.equal(validateProblemReport({ ...valid(), source: 'a'.repeat(LIMITS.source + 1) }).error, 'invalid_source');
});

test('メールアドレスは任意だが、入力されたら形式を検証する', () => {
  assert.equal(validateProblemReport({ ...valid(), email: 'user@example.com' }).value.email, 'user@example.com');
  assert.equal(validateProblemReport({ ...valid(), email: 'bad' }).error, 'invalid_email');
});

test('form の振り分け：未指定は通常の問い合わせ、未知の値は拒否', () => {
  assert.equal(validateForm(valid()).kind, 'problem');
  const contact = validateForm({ app: 'scorevault', category: 'bug', message: 'x', token: 'tok' });
  assert.equal(contact.kind, 'contact');
  assert.equal(validateForm({ ...valid(), form: 'other' }).error, 'invalid_form');
  assert.equal(validateForm(null).error, 'invalid_body');
});

test('問題報告のメールは件名に問題 ID と指摘の種類を入れる', () => {
  const { value } = validateProblemReport(valid());
  const mail = buildProblemMail(value, { receivedAt: new Date('2026-11-10T12:00:00Z') });
  assert.equal(mail.subject, '[CloudKata] 問題の指摘 bundled-001：解答が間違っている');
  assert.match(mail.text, /問題ID: bundled-001/);
  assert.match(mail.text, /--- 具体的な指摘内容 ---\n正解は B ではなく C だと思います/);
  assert.match(mail.text, /--- 証拠となる情報のソース ---\nhttps:\/\/cloud\.google\.com/);
  assert.match(mail.text, /返信はできません/);
});

test('未記入の項目はメールに（未記入）と書く', () => {
  const { value } = validateProblemReport({ app: 'cloudkata', problemId: 'q1', issue: 'other', token: 'tok' });
  const mail = buildProblemMail(value, { receivedAt: new Date() });
  assert.match(mail.text, /--- 具体的な指摘内容 ---\n（未記入）/);
  assert.match(mail.text, /--- 証拠となる情報のソース ---\n（未記入）/);
});

test('受付処理：問題報告を検証して送信する', async () => {
  const sent = [];
  const env = {
    ALLOWED_ORIGINS: 'https://ryo-lab.dev',
    TURNSTILE_HOSTNAMES: 'ryo-lab.dev',
    CONTACT_FROM: 'noreply@ryo-lab.dev',
    CONTACT_TO: 'owner@example.com',
    TURNSTILE_SECRET: 'secret',
    EMAIL: { send: async (m) => { sent.push(m); } },
  };
  const fetchFn = async () => new Response(JSON.stringify({ success: true, action: 'contact', hostname: 'ryo-lab.dev' }));
  const request = new Request('https://api.ryo-lab.dev/contact', {
    method: 'POST',
    headers: { Origin: 'https://ryo-lab.dev', 'Content-Type': 'application/json' },
    body: JSON.stringify(valid()),
  });
  const res = await handleRequest(request, env, { fetchFn, now: () => new Date() });
  assert.equal(res.status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].subject, '[CloudKata] 問題の指摘 bundled-001：解答が間違っている');
  assert.equal('replyTo' in sent[0], false);
});
