// お問い合わせフォーム（全アプリ共通）
// 使い方: <div id="contact-root" data-app="scorevault" data-privacy="./privacy-policy.html"></div> を置き、このスクリプトを読み込む。
// 送信先は Cloudflare Worker（api.ryo-lab.dev）。アプリの識別子は data-app で固定し、利用者には選ばせない。
//
// フォームは 2 種類（data-form で切り替え）
//   contact（既定）: 通常のお問い合わせ。?category=deletion で種別を事前選択できる
//   problem        : CloudKata の問題報告。?qid=bundled-001 で問題 ID を事前入力する
// どちらも ?os=Android&version=1.2.3 を渡すと、端末・バージョン欄に自動で入る。
// 英語: assets/js/lang.js で <html data-lang="en">（?lang=en）になっているページでは、通常のお問い合わせを英語で出す
// （問題報告のフォームは日本語のみ）。送る値（種別のコードなど）は日本語と同じ。
(function () {
  'use strict';

  var EN = document.documentElement.getAttribute('data-lang') === 'en';
  function t(ja, en) { return EN ? en : ja; }

  var ENDPOINT = 'https://api.ryo-lab.dev/contact';
  // Turnstile のサイトキー（公開前提の値）。空のあいだはフォームを「準備中」として送信させない
  var TURNSTILE_SITE_KEY = '0x4AAAAAAF7VXWSBaB5m02Iq';
  var TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__ryoLabTurnstileReady';

  // 選択肢と上限は Worker（_worker/contact/src/validate.js）と揃える
  var CATEGORIES = [
    ['feedback', t('アプリの感想・応援', 'Feedback')],
    ['request', t('機能のご要望', 'Feature request')],
    ['bug', t('不具合の報告', 'Bug report')],
    ['question', t('使い方のご質問', 'Question about using the app')],
    ['deletion', t('データ削除のご依頼', 'Data deletion request')],
    ['other', t('その他', 'Other')],
  ];
  var PROBLEM_ISSUES = [
    ['wrong_answer', '解答が間違っている'],
    ['outdated_explanation', '解説の内容が古い・誤っている'],
    ['unclear_question', '問題文の意味が不明瞭・不自然'],
    ['typo', '誤字脱字がある'],
    ['broken_link', 'リンク（公式ドキュメント）が切れている'],
    ['other', 'その他'],
  ];
  var LIMITS = { email: 254, environment: 200, message: 4000, problemId: 64, source: 500 };
  // メールアドレスが必須になる種別（Worker の EMAIL_REQUIRED_CATEGORIES と揃える）
  var EMAIL_REQUIRED_CATEGORIES = ['deletion'];
  var PROBLEM_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

  var ERROR_MESSAGES = {
    invalid_category: t('お問い合わせの種類を選んでください。', 'Please choose a topic.'),
    invalid_email: t('メールアドレスの形式が正しくありません。返信が不要な場合は空欄のままで送れます。', 'That email address doesn\'t look right. If you don\'t need a reply, you can leave it blank.'),
    email_required: t('データ削除のご依頼には、アプリでログインしたアカウントのメールアドレスが必要です。', 'For a data deletion request, please enter the email address of the account you logged in with in the app.'),
    invalid_message: t('内容を入力してください（' + LIMITS.message + '文字まで）。', 'Please enter your message (up to ' + LIMITS.message + ' characters).'),
    invalid_environment: t('端末・バージョンは1行・' + LIMITS.environment + '文字までで入力してください。', 'Please keep the device and version to one line of up to ' + LIMITS.environment + ' characters.'),
    invalid_problem_id: '問題IDを正しく入力してください（英数字・ハイフン・アンダースコアのみ）。',
    invalid_issue: '指摘の種類を選んでください。',
    invalid_detail: '指摘内容は' + LIMITS.message + '文字までで入力してください。',
    invalid_source: '情報のソースは1行・' + LIMITS.source + '文字までで入力してください。',
    missing_token: t('下の確認が終わるまでお待ちください。', 'Please wait until the check below is complete.'),
    verification_failed: t('確認に失敗しました。お手数ですが、もう一度送信してください。', 'The check failed. Please try sending again.'),
    too_large: t('内容が長すぎます。短くしてから送信してください。', 'Your message is too long. Please shorten it and try again.'),
  };
  var GENERIC_ERROR = t('送信できませんでした。時間をおいて、もう一度お試しください。', 'Your message couldn\'t be sent. Please try again later.');

  var root = document.getElementById('contact-root');
  if (!root) return;
  var app = root.getAttribute('data-app') || 'general';
  var formKind = root.getAttribute('data-form') === 'problem' ? 'problem' : 'contact';
  var privacyHref = root.getAttribute('data-privacy') || '/privacy-policy.html';
  var params = new URLSearchParams(window.location.search);

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === 'text') node.textContent = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  function badge(required) {
    return el('span', { class: required ? 'contact-badge is-required' : 'contact-badge', text: required ? t('必須', 'Required') : t('任意', 'Optional') });
  }

  function field(id, labelText, required, control, hint) {
    var label = el('label', { for: id }, [document.createTextNode(labelText), badge(required)]);
    return el('div', { class: 'contact-field' }, [label, control, hint ? el('p', { class: 'contact-hint', text: hint }) : null]);
  }

  function select(id, name, options, placeholder) {
    var node = el('select', { id: id, name: name, required: '' });
    node.appendChild(el('option', { value: '', text: placeholder }));
    options.forEach(function (o) { node.appendChild(el('option', { value: o[0], text: o[1] })); });
    return node;
  }

  function counterFor(textarea) {
    var counter = el('p', { class: 'contact-hint contact-counter', 'aria-live': 'polite', text: '0 / ' + LIMITS.message });
    textarea.addEventListener('input', function () {
      counter.textContent = textarea.value.length + ' / ' + LIMITS.message;
    });
    return counter;
  }

  // ── 両フォームに共通する項目 ──
  var email = el('input', { id: 'cf-email', name: 'email', type: 'email', maxlength: String(LIMITS.email), autocomplete: 'email', inputmode: 'email', placeholder: 'example@example.com' });
  var emailBadge = badge(false);
  var emailHint = el('p', { class: 'contact-hint' });
  var emailField = el('div', { class: 'contact-field' }, [
    el('label', { for: 'cf-email' }, [document.createTextNode(t('返信用のメールアドレス', 'Email for replies')), emailBadge]),
    email,
    emailHint,
  ]);
  function setEmailRequired(required, hint) {
    email.required = required;
    emailBadge.textContent = required ? t('必須', 'Required') : t('任意', 'Optional');
    emailBadge.classList.toggle('is-required', required);
    emailHint.textContent = hint;
  }

  var environment = el('input', { id: 'cf-environment', name: 'environment', type: 'text', maxlength: String(LIMITS.environment), autocomplete: 'off', placeholder: t('例：Android 15 / バージョン 1.2.3', 'e.g. Android 15 / version 1.2.3') });
  var prefill = [params.get('os'), params.get('version') ? t('バージョン ', 'version ') + params.get('version') : '']
    .filter(Boolean).join(' / ').replace(/[\r\n]/g, ' ').slice(0, LIMITS.environment);
  if (prefill) environment.value = prefill;

  // ── フォームごとの項目・検証・送信内容 ──
  // fields: 画面に並べる要素 / check(): 不備があれば [エラーコード, フォーカス先] / payload(): 送信する値 / doneMessage(): 完了文言
  var spec = formKind === 'problem' ? buildProblemSpec() : buildContactSpec();

  function buildContactSpec() {
    var EMAIL_HINT_OPTIONAL = t('個別に回答が必要な場合のみご記入ください。通常は開発の参考にさせていただき、返信はいたしません。', 'Only needed if you want a personal reply. We read every message to improve the app, but usually don\'t reply.');
    var EMAIL_HINT_REQUIRED = t('データ削除のご依頼では、アプリでログインしたアカウントのメールアドレスをご記入ください。本人確認のうえ対応します。', 'For a data deletion request, enter the email address of the account you logged in with in the app. We will verify it before deleting.');

    var category = select('cf-category', 'category', CATEGORIES, t('選択してください', 'Please choose'));
    if (CATEGORIES.some(function (c) { return c[0] === params.get('category'); })) category.value = params.get('category');

    var message = el('textarea', { id: 'cf-message', name: 'message', required: '', rows: '8', maxlength: String(LIMITS.message), placeholder: t('不具合の場合は、起きた操作の手順や画面をできるだけ具体的に書いてください。', 'For a bug, please describe what you did and which screen it happened on, as specifically as you can.') });

    function isEmailRequired() {
      return EMAIL_REQUIRED_CATEGORIES.indexOf(category.value) !== -1;
    }
    function sync() {
      setEmailRequired(isEmailRequired(), isEmailRequired() ? EMAIL_HINT_REQUIRED : EMAIL_HINT_OPTIONAL);
    }
    category.addEventListener('change', sync);
    sync();

    return {
      fields: [
        field('cf-category', t('お問い合わせの種類', 'Topic'), true, category),
        emailField,
        field('cf-environment', t('端末・アプリのバージョン', 'Device and app version'), false, environment, t('不具合のときは書いていただけると、調査が早くなります。', 'For bugs, this helps us look into it faster.')),
        field('cf-message', t('内容', 'Message'), true, message),
        counterFor(message),
      ],
      check: function (emailValue) {
        if (!category.value) return ['invalid_category', category];
        if (!emailValue && isEmailRequired()) return ['email_required', email];
        if (!message.value.trim()) return ['invalid_message', message];
        return null;
      },
      payload: function () {
        return { category: category.value, message: message.value };
      },
      doneMessage: function (emailValue) {
        return emailValue
          ? t('お問い合わせありがとうございます。内容を確認のうえ、必要に応じてご入力のメールアドレスに返信します。返信まで数日かかる場合があります。迷惑メールフォルダもあわせてご確認ください。', 'Thank you for contacting us. We will read your message and reply to the email address you entered if needed. It may take a few days, and please check your spam folder too.')
          : t('お問い合わせありがとうございます。いただいた内容は、今後の開発の参考にさせていただきます。', 'Thank you for your message. We will use it to make the app better.');
      },
    };
  }

  function buildProblemSpec() {
    var problemId = el('input', { id: 'cf-problem-id', name: 'problemId', type: 'text', required: '', maxlength: String(LIMITS.problemId), autocomplete: 'off', spellcheck: 'false', placeholder: '例：bundled-001' });
    var qid = (params.get('qid') || '').trim();
    if (PROBLEM_ID_PATTERN.test(qid)) {
      // アプリから渡された ID は書き換えられないようにする（取り違え防止）
      problemId.value = qid;
      problemId.readOnly = true;
    }

    var issue = select('cf-issue', 'issue', PROBLEM_ISSUES, '選択してください');
    var detail = el('textarea', { id: 'cf-detail', name: 'detail', rows: '6', maxlength: String(LIMITS.message), placeholder: '例：「正解は B ではなく C だと思います。公式ドキュメントの〜ページに〜と記載があります。」' });
    var source = el('input', { id: 'cf-source', name: 'source', type: 'text', maxlength: String(LIMITS.source), autocomplete: 'off', inputmode: 'url', placeholder: 'https://cloud.google.com/...' });

    setEmailRequired(false, '指摘の内容について確認させていただく場合のみ連絡します。不要な場合は空欄のままで送れます。');

    return {
      fields: [
        field('cf-problem-id', '問題ID', true, problemId, problemId.readOnly ? 'アプリの回答画面から自動で入力されています。' : 'アプリの回答画面に表示されている問題IDを入力してください。'),
        field('cf-issue', '指摘の種類', true, issue),
        field('cf-detail', '具体的な指摘内容', false, detail),
        counterFor(detail),
        field('cf-source', '証拠となる情報のソース', false, source, 'URL など、参考になる情報源があれば添えていただけると助かります。'),
        emailField,
        field('cf-environment', '端末・アプリのバージョン', false, environment),
      ],
      check: function () {
        if (!PROBLEM_ID_PATTERN.test(problemId.value.trim())) return ['invalid_problem_id', problemId];
        if (!issue.value) return ['invalid_issue', issue];
        if (/[\r\n]/.test(source.value)) return ['invalid_source', source];
        return null;
      },
      payload: function () {
        return {
          form: 'problem',
          problemId: problemId.value.trim(),
          issue: issue.value,
          detail: detail.value,
          source: source.value.trim(),
        };
      },
      doneMessage: function (emailValue) {
        return emailValue
          ? 'ご指摘ありがとうございます。内容を確認し、問題の修正に役立てます。確認したいことがある場合は、ご入力のメールアドレスにご連絡します。'
          : 'ご指摘ありがとうございます。内容を確認し、問題の修正に役立てます。';
      },
    };
  }

  // ── 画面を組み立てる ──
  // 人には見えない欄。bot が埋めたら Worker 側で破棄する
  var honeypot = el('input', { name: 'website', type: 'text', tabindex: '-1', autocomplete: 'off' });
  var honeypotWrap = el('div', { class: 'contact-hp', 'aria-hidden': 'true' }, [el('label', { text: 'Website' }, [honeypot])]);

  var turnstileBox = el('div', { class: 'contact-turnstile' });
  var note = el('p', { class: 'contact-note' }, [
    document.createTextNode(t('いただいた内容とメールアドレスは、アプリの改善と返信・対応のためだけに使います。詳しくは', 'We use your message and email address only to improve the app and to reply. See the ')),
    el('a', { href: privacyHref, text: t('プライバシーポリシー', 'Privacy Policy') }),
    document.createTextNode(t('をご確認ください。', ' for details.')),
  ]);
  var submit = el('button', { type: 'submit', class: 'contact-submit', text: t('送信する', 'Send') });
  var status = el('p', { class: 'contact-status', role: 'status', 'aria-live': 'polite' });

  var form = el('form', { class: 'contact-form', novalidate: '' },
    spec.fields.concat([honeypotWrap, turnstileBox, note, submit, status]));

  var doneText = el('p');
  var done = el('div', { class: 'contact-done', hidden: '' }, [
    el('p', { class: 'contact-done-title', text: t('送信しました', 'Message sent') }),
    doneText,
  ]);

  root.textContent = '';
  root.appendChild(form);
  root.appendChild(done);

  function setStatus(text, isError) {
    status.textContent = text;
    status.classList.toggle('is-error', !!isError);
  }

  // ── Turnstile ──
  var widgetId = null;
  var token = '';

  if (!TURNSTILE_SITE_KEY) {
    submit.disabled = true;
    setStatus(t('現在フォームを準備中です。しばらくしてから再度アクセスしてください。', 'The form is not available yet. Please come back later.'), true);
    return;
  }

  window.__ryoLabTurnstileReady = function () {
    widgetId = window.turnstile.render(turnstileBox, {
      sitekey: TURNSTILE_SITE_KEY,
      action: 'contact',
      theme: 'auto',
      language: EN ? 'en' : 'ja',
      callback: function (t) { token = t; if (status.classList.contains('is-error')) setStatus(''); },
      'expired-callback': function () { token = ''; },
      'error-callback': function () { token = ''; setStatus(t('確認を読み込めませんでした。ページを再読み込みしてください。', 'The check couldn\'t load. Please reload the page.'), true); },
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

    var emailValue = email.value.trim();
    var problem = spec.check(emailValue);
    if (!problem && emailValue && !email.checkValidity()) problem = ['invalid_email', email];
    if (problem) {
      setStatus(ERROR_MESSAGES[problem[0]], true);
      problem[1].focus();
      return;
    }
    if (!token) {
      setStatus(ERROR_MESSAGES.missing_token, true);
      return;
    }

    submit.disabled = true;
    submit.textContent = t('送信中…', 'Sending…');
    setStatus('');

    var body = spec.payload();
    body.app = app;
    body.email = emailValue;
    body.environment = environment.value.trim();
    body.website = honeypot.value;
    body.token = token;

    fetch(ENDPOINT, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, body: data }; });
      })
      .then(function (result) {
        if (result.ok && result.body.ok) {
          doneText.textContent = spec.doneMessage(emailValue);
          form.hidden = true;
          done.hidden = false;
          done.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (typeof window.gtag === 'function') window.gtag('event', 'contact_submit', { app_name: app, form_kind: formKind });
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
        submit.textContent = t('送信する', 'Send');
      });
  });
})();
