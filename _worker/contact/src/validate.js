// 問い合わせ内容の検証とメール本文の組み立て（外部に依存しない純粋関数のみ）
// フォームは 2 種類：通常のお問い合わせ（form: 'contact'、既定）と、CloudKata の問題報告（form: 'problem'）

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
  feedback: 'アプリの感想・応援',
  request: '機能のご要望',
  bug: '不具合の報告',
  question: '使い方のご質問',
  deletion: 'データ削除のご依頼',
  other: 'その他',
});

/** メールアドレスが必須の種別（本人確認と返信が必要なもの） */
export const EMAIL_REQUIRED_CATEGORIES = Object.freeze(['deletion']);

/** 問題報告を受け付けるアプリ */
export const PROBLEM_REPORT_APPS = Object.freeze(['cloudkata']);

/** 問題報告の指摘の種類 */
export const PROBLEM_ISSUES = Object.freeze({
  wrong_answer: '解答が間違っている',
  outdated_explanation: '解説の内容が古い・誤っている',
  unclear_question: '問題文の意味が不明瞭・不自然',
  typo: '誤字脱字がある',
  broken_link: 'リンク（公式ドキュメント）が切れている',
  other: 'その他',
});

export const LIMITS = Object.freeze({
  message: 4000,
  email: 254,
  environment: 200,
  token: 2048,
  problemId: 64,
  source: 500,
});

// 改行・タブ以外の制御文字
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
// 1 行に収めたい値で禁止する文字（ヘッダーインジェクション対策を兼ねる）
const LINE_BREAKS = /[\r\n\u2028\u2029]/;
// 実用上の妥当性だけを見る簡易チェック。厳密な RFC 準拠は目指さない
const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;
// 問題 ID（例：bundled-001）。件名に入れるので英数字・ハイフン・アンダースコアに限る
const PROBLEM_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : null;
}

function isBlank(value) {
  return value === undefined || value === null || value === '';
}

function isPlainObject(input) {
  return input !== null && typeof input === 'object' && !Array.isArray(input);
}

/**
 * 任意の 1 行テキスト。未記入なら ''、不正なら null。
 * @param {unknown} value
 * @param {number} max
 */
function parseOptionalLine(value, max) {
  if (isBlank(value)) return '';
  const text = asTrimmedString(value);
  if (text === null || LINE_BREAKS.test(text) || text.length > max) return null;
  return text.replace(CONTROL_CHARS, '');
}

/**
 * 複数行テキスト。改行を LF にそろえ、制御文字を除く。未記入なら ''、型が違えば null。
 * @param {unknown} value
 */
function normalizeMultiline(value) {
  if (isBlank(value)) return '';
  if (typeof value !== 'string') return null;
  return value.replace(/\r\n?/g, '\n').replace(CONTROL_CHARS, '').trim();
}

/**
 * 任意のメールアドレス。未記入なら ''、不正なら null。
 * @param {unknown} value
 */
function parseOptionalEmail(value) {
  if (isBlank(value)) return '';
  const email = asTrimmedString(value);
  if (email === null) return null;
  if (email === '') return '';
  if (email.length > LIMITS.email || LINE_BREAKS.test(email) || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

/** 両フォームに共通する項目（メールアドレス・端末情報・トークン）を検証する */
function parseCommon(input) {
  const email = parseOptionalEmail(input.email);
  if (email === null) return { ok: false, error: 'invalid_email' };

  const environment = parseOptionalLine(input.environment, LIMITS.environment);
  if (environment === null) return { ok: false, error: 'invalid_environment' };

  const token = asTrimmedString(input.token);
  if (!token || token.length > LIMITS.token) return { ok: false, error: 'missing_token' };

  return { ok: true, value: { email, environment, token } };
}

/**
 * 通常のお問い合わせを検証し、正規化した値を返す。
 * @param {unknown} input
 * @returns {{ ok: true, value: { app: string, category: string, email: string, message: string, environment: string, token: string } } | { ok: false, error: string }}
 */
export function validateSubmission(input) {
  if (!isPlainObject(input)) return { ok: false, error: 'invalid_body' };

  const app = asTrimmedString(input.app);
  if (!app || !Object.hasOwn(APPS, app)) return { ok: false, error: 'invalid_app' };

  const category = asTrimmedString(input.category);
  if (!category || !Object.hasOwn(CATEGORIES, category)) return { ok: false, error: 'invalid_category' };

  // メールアドレスは任意。ただし入力された場合は形式を検証し、削除依頼では必須にする
  const email = parseOptionalEmail(input.email);
  if (email === null) return { ok: false, error: 'invalid_email' };
  if (!email && EMAIL_REQUIRED_CATEGORIES.includes(category)) return { ok: false, error: 'email_required' };

  const message = normalizeMultiline(input.message);
  if (!message || message.length > LIMITS.message) return { ok: false, error: 'invalid_message' };

  const common = parseCommon(input);
  if (!common.ok) return common;

  return { ok: true, value: { app, category, message, ...common.value } };
}

/**
 * 問題報告（CloudKata）を検証し、正規化した値を返す。指摘内容とソースは任意。
 * @param {unknown} input
 * @returns {{ ok: true, value: { app: string, problemId: string, issue: string, detail: string, source: string, email: string, environment: string, token: string } } | { ok: false, error: string }}
 */
export function validateProblemReport(input) {
  if (!isPlainObject(input)) return { ok: false, error: 'invalid_body' };

  const app = asTrimmedString(input.app);
  if (!app || !PROBLEM_REPORT_APPS.includes(app)) return { ok: false, error: 'invalid_app' };

  const problemId = asTrimmedString(input.problemId);
  if (!problemId || problemId.length > LIMITS.problemId || !PROBLEM_ID_PATTERN.test(problemId)) {
    return { ok: false, error: 'invalid_problem_id' };
  }

  const issue = asTrimmedString(input.issue);
  if (!issue || !Object.hasOwn(PROBLEM_ISSUES, issue)) return { ok: false, error: 'invalid_issue' };

  const detail = normalizeMultiline(input.detail);
  if (detail === null || detail.length > LIMITS.message) return { ok: false, error: 'invalid_detail' };

  const source = parseOptionalLine(input.source, LIMITS.source);
  if (source === null) return { ok: false, error: 'invalid_source' };

  const common = parseCommon(input);
  if (!common.ok) return common;

  return { ok: true, value: { app, problemId, issue, detail, source, ...common.value } };
}

/**
 * form の値で検証を振り分ける。未指定は通常のお問い合わせとして扱う。
 * @param {unknown} input
 * @returns {{ ok: true, kind: 'contact' | 'problem', value: object } | { ok: false, error: string }}
 */
export function validateForm(input) {
  if (!isPlainObject(input)) return { ok: false, error: 'invalid_body' };
  const form = isBlank(input.form) ? 'contact' : input.form;
  if (form === 'contact') {
    const result = validateSubmission(input);
    return result.ok ? { ...result, kind: 'contact' } : result;
  }
  if (form === 'problem') {
    const result = validateProblemReport(input);
    return result.ok ? { ...result, kind: 'problem' } : result;
  }
  return { ok: false, error: 'invalid_form' };
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

function metaLines(value, meta) {
  const userAgent = (meta.userAgent || '').replace(CONTROL_CHARS, '').replace(/[\r\n]/g, ' ').slice(0, 200);
  return [
    `返信先: ${value.email || '（未記入・返信不要）'}`,
    `端末・バージョン: ${value.environment || '（未記入）'}`,
    `受付日時: ${formatJst(meta.receivedAt)}`,
    `ブラウザ: ${userAgent || '（不明）'}`,
  ];
}

function footerLines(value) {
  return [
    '---',
    'このメールは ryo-lab.dev のお問い合わせフォームから自動送信されました。',
    value.email ? '返信すると、上記の返信先に届きます。' : 'メールアドレスの記入がないため、返信はできません。',
  ];
}

/**
 * 通常のお問い合わせの通知メールを組み立てる。HTML は使わずテキストのみ。
 * @param {{ app: string, category: string, email: string, message: string, environment: string }} value
 * @param {{ receivedAt: Date, userAgent?: string | null }} meta
 */
export function buildMail(value, meta) {
  const appName = APPS[value.app];
  const categoryName = CATEGORIES[value.category];

  const subject = `[${appName}] ${categoryName}`;
  const text = [
    `アプリ: ${appName}`,
    `種別: ${categoryName}`,
    ...metaLines(value, meta),
    '',
    '--- 本文 ---',
    value.message,
    '',
    ...footerLines(value),
  ].join('\n');

  return { subject, text };
}

/**
 * 問題報告の通知メールを組み立てる。件名に問題 ID と指摘の種類を入れ、Gmail で絞り込みやすくする。
 * @param {{ app: string, problemId: string, issue: string, detail: string, source: string, email: string, environment: string }} value
 * @param {{ receivedAt: Date, userAgent?: string | null }} meta
 */
export function buildProblemMail(value, meta) {
  const appName = APPS[value.app];
  const issueName = PROBLEM_ISSUES[value.issue];

  const subject = `[${appName}] 問題の指摘 ${value.problemId}：${issueName}`;
  const text = [
    `アプリ: ${appName}`,
    `問題ID: ${value.problemId}`,
    `指摘の種類: ${issueName}`,
    ...metaLines(value, meta),
    '',
    '--- 具体的な指摘内容 ---',
    value.detail || '（未記入）',
    '',
    '--- 証拠となる情報のソース ---',
    value.source || '（未記入）',
    '',
    ...footerLines(value),
  ].join('\n');

  return { subject, text };
}

/**
 * 検証結果の種類に応じて通知メールを組み立てる。
 * @param {'contact' | 'problem'} kind
 */
export function buildFormMail(kind, value, meta) {
  return kind === 'problem' ? buildProblemMail(value, meta) : buildMail(value, meta);
}

function formatJst(date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())} ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())} (JST)`;
}
