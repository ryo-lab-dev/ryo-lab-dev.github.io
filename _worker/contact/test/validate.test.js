import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSubmission, isHoneypotFilled, buildMail, LIMITS } from '../src/validate.js';

const valid = () => ({
  app: 'scorevault',
  category: 'bug',
  email: 'user@example.com',
  message: '保存できません',
  environment: 'Android 15 / 1.2.3',
  token: 'tok',
});

test('正しい入力は正規化して受け付ける', () => {
  const result = validateSubmission({ ...valid(), message: '  1行目\r\n2行目\u0007  ' });
  assert.equal(result.ok, true);
  assert.equal(result.value.message, '1行目\n2行目');
});

test('未知のアプリ・種別は拒否する', () => {
  assert.deepEqual(validateSubmission({ ...valid(), app: 'unknown' }), { ok: false, error: 'invalid_app' });
  assert.deepEqual(validateSubmission({ ...valid(), app: '__proto__' }), { ok: false, error: 'invalid_app' });
  assert.deepEqual(validateSubmission({ ...valid(), category: 'spam' }), { ok: false, error: 'invalid_category' });
});

test('メールアドレスの改行や不正形式は拒否する', () => {
  for (const email of ['a@b.com\nBcc: x@y.com', 'no-at-mark', 'a@b', '', 'a b@c.com']) {
    assert.equal(validateSubmission({ ...valid(), email }).error, 'invalid_email', email);
  }
  assert.equal(validateSubmission({ ...valid(), email: `${'a'.repeat(250)}@b.co` }).error, 'invalid_email');
});

test('本文は必須で上限を超えると拒否する', () => {
  assert.equal(validateSubmission({ ...valid(), message: '   ' }).error, 'invalid_message');
  assert.equal(validateSubmission({ ...valid(), message: 1 }).error, 'invalid_message');
  assert.equal(validateSubmission({ ...valid(), message: 'a'.repeat(LIMITS.message + 1) }).error, 'invalid_message');
  assert.equal(validateSubmission({ ...valid(), message: 'a'.repeat(LIMITS.message) }).ok, true);
});

test('端末情報は任意で、改行を含むと拒否する', () => {
  assert.equal(validateSubmission({ ...valid(), environment: undefined }).ok, true);
  assert.equal(validateSubmission({ ...valid(), environment: '' }).value.environment, '');
  assert.equal(validateSubmission({ ...valid(), environment: 'a\nb' }).error, 'invalid_environment');
  assert.equal(validateSubmission({ ...valid(), environment: 'a'.repeat(LIMITS.environment + 1) }).error, 'invalid_environment');
});

test('トークンがなければ拒否する', () => {
  assert.equal(validateSubmission({ ...valid(), token: '' }).error, 'missing_token');
  assert.equal(validateSubmission({ ...valid(), token: 'x'.repeat(LIMITS.token + 1) }).error, 'missing_token');
});

test('オブジェクト以外は拒否する', () => {
  for (const input of [null, [], 'str', 1]) {
    assert.equal(validateSubmission(input).error, 'invalid_body');
  }
});

test('ハニーポットの判定', () => {
  assert.equal(isHoneypotFilled({ website: 'http://spam' }), true);
  assert.equal(isHoneypotFilled({ website: '  ' }), false);
  assert.equal(isHoneypotFilled({}), false);
});

test('メールの件名と本文を組み立てる', () => {
  const { value } = validateSubmission(valid());
  const mail = buildMail(value, { receivedAt: new Date('2026-11-10T12:00:00Z'), userAgent: 'UA\r\nX' });
  assert.equal(mail.subject, '[ScoreVault] 不具合の報告');
  assert.match(mail.text, /受付日時: 2026-11-10 21:00 \(JST\)/);
  assert.match(mail.text, /ブラウザ: UA  X/);
  assert.match(mail.text, /--- 本文 ---\n保存できません/);
});
