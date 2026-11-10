// お問い合わせフォーム（全アプリ共通）
// 使い方: <div id="contact-root" data-app="scorevault" data-privacy="./privacy-policy.html"></div> を置き、このスクリプトを読み込む。
// 送信先は Cloudflare Worker（api.ryo-lab.dev）。アプリの識別子は data-app で固定し、利用者には選ばせない。
// アプリ内リンクからは ?os=Android&version=1.2.3&category=deletion のように渡すと、端末情報と種別を事前に入れられる。
(function () {
  'use strict';

  var ENDPOINT = 'https://api.ryo-lab.dev/contact';
  // Turnstile のサイトキー（公開前提の値）。空のあいだはフォームを「準備中」として送信させない
  var TURNSTILE_SITE_KEY = '0x4AAAAAAF7VXWSBaB5m02Iq';
  var TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__ryoLabTurnstileReady';

  var CATEGORIES = [
    ['feedback', 'アプリの感想・応援'],
    ['request', '機能のご要望'],
    ['bug', '不具合の報告'],
    ['question', '使い方のご質問'],
    ['deletion', 'データ削除のご依頼'],
    ['other', 'その他'],
  ];
  var LIMITS = { email: 254, environment: 200, message: 4000 };
  // メールアドレスが必須になる種別（Worker の EMAIL_REQUIRED_CATEGORIES と揃える）
  var EMAIL_REQUIRED_CATEGORIES = ['deletion'];

  var ERROR_MESSAGES = {
    invalid_category: 'お問い合わせの種類を選んでください。',
    invalid_email: 'メールアドレスの形式が正しくありません。返信が不要な場合は空欄のままで送れます。',
    email_required: 'データ削除のご依頼には、アプリでログインしたアカウントのメールアドレスが必要です。',
    invalid_message: '内容を入力してください（' + LIMITS.message + '文字まで）。',
    invalid_environment: '端末・バージョンは1行・' + LIMITS.environment + '文字までで入力してください。',
    missing_token: '下の確認が終わるまでお待ちください。',
    verification_failed: '確認に失敗しました。お手数ですが、もう一度送信してください。',
    too_large: '内容が長すぎます。短くしてから送信してください。',
  };
  var GENERIC_ERROR = '送信できませんでした。時間をおいて、もう一度お試しください。';

  var root = document.getElementById('contact-root');
  if (!root) return;
  var app = root.getAttribute('data-app') || 'general';
  var privacyHref = root.getAttribute('data-privacy') || '/privacy-policy.html';

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === 'text') node.textContent = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  function field(id, labelText, required, control, hint) {
    var label = el('label', { for: id }, [document.createTextNode(labelText)]);
    label.appendChild(el('span', { class: required ? 'contact-badge is-required' : 'contact-badge', text: required ? '必須' : '任意' }));
    return el('div', { class: 'contact-field' }, [label, control, hint ? el('p', { class: 'contact-hint', text: hint }) : null]);
  }

  // ── フォームを組み立てる ──
  var params = new URLSearchParams(window.location.search);

  var category = el('select', { id: 'cf-category', name: 'category', required: '' });
  category.appendChild(el('option', { value: '', text: '選択してください' }));
  CATEGORIES.forEach(function (c) { category.appendChild(el('option', { value: c[0], text: c[1] })); });
  if (CATEGORIES.some(function (c) { return c[0] === params.get('category'); })) category.value = params.get('category');

  var email = el('input', { id: 'cf-email', name: 'email', type: 'email', maxlength: String(LIMITS.email), autocomplete: 'email', inputmode: 'email', placeholder: 'example@example.com' });

  var environment = el('input', { id: 'cf-environment', name: 'environment', type: 'text', maxlength: String(LIMITS.environment), autocomplete: 'off', placeholder: '例：Android 15 / バージョン 1.2.3' });
  var prefill = [params.get('os'), params.get('version') ? 'バージョン ' + params.get('version') : '']
    .filter(Boolean).join(' / ').replace(/[\r\n]/g, ' ').slice(0, LIMITS.environment);
  if (prefill) environment.value = prefill;

  var message = el('textarea', { id: 'cf-message', name: 'message', required: '', rows: '8', maxlength: String(LIMITS.message), placeholder: '不具合の場合は、起きた操作の手順や画面をできるだけ具体的に書いてください。' });
  var counter = el('p', { class: 'contact-hint contact-counter', 'aria-live': 'polite', text: '0 / ' + LIMITS.message });

  // 人には見えない欄。bot が埋めたら Worker 側で破棄する
  var honeypot = el('input', { name: 'website', type: 'text', tabindex: '-1', autocomplete: 'off' });
  var honeypotWrap = el('div', { class: 'contact-hp', 'aria-hidden': 'true' }, [el('label', { text: 'Website' }, [honeypot])]);

  // メールアドレス欄は種別によって必須・任意が切り替わるため、個別に組み立てる
  var EMAIL_HINT_OPTIONAL = '個別に回答が必要な場合のみご記入ください。通常は開発の参考にさせていただき、返信はいたしません。';
  var EMAIL_HINT_REQUIRED = 'データ削除のご依頼では、アプリでログインしたアカウントのメールアドレスをご記入ください。本人確認のうえ対応します。';
  var emailBadge = el('span', { class: 'contact-badge', text: '任意' });
  var emailHint = el('p', { class: 'contact-hint', text: EMAIL_HINT_OPTIONAL });
  var emailField = el('div', { class: 'contact-field' }, [
    el('label', { for: 'cf-email' }, [document.createTextNode('返信用のメールアドレス'), emailBadge]),
    email,
    emailHint,
  ]);

  function isEmailRequired() {
    return EMAIL_REQUIRED_CATEGORIES.indexOf(category.value) !== -1;
  }
  function syncEmailRequirement() {
    var required = isEmailRequired();
    email.required = required;
    emailBadge.textContent = required ? '必須' : '任意';
    emailBadge.classList.toggle('is-required', required);
    emailHint.textContent = required ? EMAIL_HINT_REQUIRED : EMAIL_HINT_OPTIONAL;
  }
  category.addEventListener('change', syncEmailRequirement);
  syncEmailRequirement();

  var turnstileBox = el('div', { class: 'contact-turnstile' });
  var note = el('p', { class: 'contact-note' }, [
    document.createTextNode('いただいた内容とメールアドレスは、アプリの改善と返信・対応のためだけに使います。詳しくは'),
    el('a', { href: privacyHref, text: 'プライバシーポリシー' }),
    document.createTextNode('をご確認ください。'),
  ]);
  var submit = el('button', { type: 'submit', class: 'contact-submit', text: '送信する' });
  var status = el('p', { class: 'contact-status', role: 'status', 'aria-live': 'polite' });

  var form = el('form', { class: 'contact-form', novalidate: '' }, [
    field('cf-category', 'お問い合わせの種類', true, category),
    emailField,
    field('cf-environment', '端末・アプリのバージョン', false, environment, '不具合のときは書いていただけると、調査が早くなります。'),
    field('cf-message', '内容', true, message),
    counter,
    honeypotWrap,
    turnstileBox,
    note,
    submit,
    status,
  ]);

  var doneText = el('p');
  var done = el('div', { class: 'contact-done', hidden: '' }, [
    el('p', { class: 'contact-done-title', text: '送信しました' }),
    doneText,
  ]);

  root.textContent = '';
  root.appendChild(form);
  root.appendChild(done);

  message.addEventListener('input', function () {
    counter.textContent = message.value.length + ' / ' + LIMITS.message;
  });

  function setStatus(text, isError) {
    status.textContent = text;
    status.classList.toggle('is-error', !!isError);
  }

  // ── Turnstile ──
  var widgetId = null;
  var token = '';

  if (!TURNSTILE_SITE_KEY) {
    submit.disabled = true;
    setStatus('現在フォームを準備中です。しばらくしてから再度アクセスしてください。', true);
    return;
  }

  window.__ryoLabTurnstileReady = function () {
    widgetId = window.turnstile.render(turnstileBox, {
      sitekey: TURNSTILE_SITE_KEY,
      action: 'contact',
      theme: 'auto',
      language: 'ja',
      callback: function (t) { token = t; if (status.classList.contains('is-error')) setStatus(''); },
      'expired-callback': function () { token = ''; },
      'error-callback': function () { token = ''; setStatus('確認を読み込めませんでした。ページを再読み込みしてください。', true); },
    });
  };
  var script = document.createElement('script');
  script.src = TURNSTILE_SCRIPT;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);

  function resetTurnstile() {
    token = '';
    if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
  }

  // ── 送信 ──
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (submit.disabled) return;

    if (!category.value) return setStatus(ERROR_MESSAGES.invalid_category, true), category.focus();
    var emailValue = email.value.trim();
    if (!emailValue && isEmailRequired()) return setStatus(ERROR_MESSAGES.email_required, true), email.focus();
    if (emailValue && !email.checkValidity()) return setStatus(ERROR_MESSAGES.invalid_email, true), email.focus();
    if (!message.value.trim()) return setStatus(ERROR_MESSAGES.invalid_message, true), message.focus();
    if (!token) return setStatus(ERROR_MESSAGES.missing_token, true);

    submit.disabled = true;
    submit.textContent = '送信中…';
    setStatus('');

    fetch(ENDPOINT, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app: app,
        category: category.value,
        email: emailValue,
        environment: environment.value.trim(),
        message: message.value,
        website: honeypot.value,
        token: token,
      }),
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, body: body }; });
      })
      .then(function (result) {
        if (result.ok && result.body.ok) {
          doneText.textContent = emailValue
            ? 'お問い合わせありがとうございます。内容を確認のうえ、必要に応じてご入力のメールアドレスに返信します。返信まで数日かかる場合があります。迷惑メールフォルダもあわせてご確認ください。'
            : 'お問い合わせありがとうございます。いただいた内容は、今後の開発の参考にさせていただきます。';
          form.hidden = true;
          done.hidden = false;
          done.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (typeof window.gtag === 'function') window.gtag('event', 'contact_submit', { app_name: app });
          return;
        }
        setStatus(ERROR_MESSAGES[result.body.error] || GENERIC_ERROR, true);
        resetTurnstile();
      })
      .catch(function () {
        setStatus(GENERIC_ERROR, true);
        resetTurnstile();
      })
      .then(function () {
        submit.disabled = false;
        submit.textContent = '送信する';
      });
  });
})();
