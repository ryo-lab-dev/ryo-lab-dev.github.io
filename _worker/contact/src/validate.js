// 問い合わせ内容の検証とメール本文の組み立て（外部に依存しない純粋関数のみ）

/** 受け付けるアプリ。キーはフォームから送られる識別子、値は件名に使う表示名 */
export const APPS = Object.freeze({
  general: '総合窓口',
  scorevault: 'ScoreVault',
  cloudkata: 'CloudKata',
  nexusdiary: 'NexusDiary',
  fitmap: 'FitMap',
  giftlog: 'GiftLog',
  haguiku: 'はぐ育',
  boxprofit: 'BoxProfit',
  pickandblade: 'ツルハシとツルギ',
  towerclimb: 'タワクライム',
  starpuzzle: '星取りパズル',
});

/** 問い合わせの種別 */
export const CATEGORIES = Object.freeze({
  bug: '不具合の報告',
  request: '機能のご要望',
  question: '使い方のご質問',
  deletion: 'データ削除のご依頼',
  other: 'その他',
});

export const LIMITS = Object.freeze({
  message: 4000,
  email: 254,
  environment: 200,
  token: 2048,
});

// 改行・タブ以外の制御文字
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
// 1 行に収めたい値で禁止する文字（ヘッダーインジェクション対策を兼ねる）
const LINE_BREAKS = /[\r\n\u2028\u2029]/;
// 実用上の妥当性だけを見る簡易チェック。厳密な RFC 準拠は目指さない
const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : null;
}

/**
 * フォームから受け取った JSON を検証し、正規化した値を返す。
 * @param {unknown} input
 * @returns {{ ok: true, value: { app: string, category: string, email: string, message: string, environment: string, token: string } } | { ok: false, error: string }}
 */
export function validateSubmission(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'invalid_body' };
  }

  const app = asTrimmedString(input.app);
  if (!app || !Object.hasOwn(APPS, app)) return { ok: false, error: 'invalid_app' };

  const category = asTrimmedString(input.category);
  if (!category || !Object.hasOwn(CATEGORIES, category)) return { ok: false, error: 'invalid_category' };

  const email = asTrimmedString(input.email);
  if (!email || email.length > LIMITS.email || LINE_BREAKS.test(email) || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: 'invalid_email' };
  }

  const rawMessage = typeof input.message === 'string' ? input.message : null;
  if (rawMessage === null) return { ok: false, error: 'invalid_message' };
  const message = rawMessage.replace(/\r\n?/g, '\n').replace(CONTROL_CHARS, '').trim();
  if (!message || message.length > LIMITS.message) return { ok: false, error: 'invalid_message' };

  let environment = '';
  if (input.environment !== undefined && input.environment !== null && input.environment !== '') {
    const rawEnvironment = asTrimmedString(input.environment);
    if (rawEnvironment === null || LINE_BREAKS.test(rawEnvironment) || rawEnvironment.length > LIMITS.environment) {
      return { ok: false, error: 'invalid_environment' };
    }
    environment = rawEnvironment.replace(CONTROL_CHARS, '');
  }

  const token = asTrimmedString(input.token);
  if (!token || token.length > LIMITS.token) return { ok: false, error: 'missing_token' };

  return { ok: true, value: { app, category, email, message, environment, token } };
}

/**
 * ハニーポット欄に値が入っているか。人には見えない欄なので、入っていれば bot とみなす。
 * @param {unknown} input
 */
export function isHoneypotFilled(input) {
  if (input === null || typeof input !== 'object') return false;
  const value = input.website;
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * 通知メールの件名と本文を組み立てる。HTML は使わずテキストのみ。
 * @param {{ app: string, category: string, email: string, message: string, environment: string }} value
 * @param {{ receivedAt: Date, userAgent?: string | null }} meta
 */
export function buildMail(value, meta) {
  const appName = APPS[value.app];
  const categoryName = CATEGORIES[value.category];
  const userAgent = (meta.userAgent || '').replace(CONTROL_CHARS, '').replace(/[\r\n]/g, ' ').slice(0, 200);

  const subject = `[${appName}] ${categoryName}`;
  const text = [
    `アプリ: ${appName}`,
    `種別: ${categoryName}`,
    `返信先: ${value.email}`,
    `端末・バージョン: ${value.environment || '（未記入）'}`,
    `受付日時: ${formatJst(meta.receivedAt)}`,
    `ブラウザ: ${userAgent || '（不明）'}`,
    '',
    '--- 本文 ---',
    value.message,
    '',
    '---',
    'このメールは ryo-lab.dev のお問い合わせフォームから自動送信されました。',
    '返信すると、上記の返信先に届きます。',
  ].join('\n');

  return { subject, text };
}

function formatJst(date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())} ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())} (JST)`;
}
