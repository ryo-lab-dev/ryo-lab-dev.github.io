# お問い合わせ受付 Worker（ryo-lab-contact）

ryo-lab.dev のお問い合わせフォーム（`/contact.html`、`/<app>/contact.html`）から送られた内容を受け取り、運営者宛てにメールで転送する Cloudflare Worker です。

- 受付 URL：`https://api.ryo-lab.dev/contact`
- 送信の流れ：Origin の確認 → サイズと形式のチェック → ハニーポット → 入力の検証 → Turnstile のサーバー側検証 → Email Routing の確認済み宛先へ送信
- ユーザーへの自動返信は**しません**（他人のアドレスにメールを送らせる踏み台にされるのを防ぐため）。返信は届いたメールに返信する形で行い、Reply-To にユーザーのアドレスが入っています。

## 費用（すべて無料枠で、上限を超えると止まるだけ）

| サービス | プラン | 上限と超えたときの動き |
|---|---|---|
| Workers | Free | 1 日 10 万リクエストまで。超えると Error 1027 で止まり、UTC 0 時（日本時間 9 時）に戻る。課金はされない |
| Turnstile | Free | 件数の上限なし（ウィジェットは 20 個まで） |
| Email Routing（確認済み宛先への送信） | 全プラン無料 | 月間の送信枠には数えられない |

Workers Paid（月 5 ドル）にはしないでください。Paid にすると上限で止まらず、従量課金になります。

## 秘密値と設定値

| 名前 | 種類 | 置き場所 |
|---|---|---|
| `TURNSTILE_SECRET` | 秘密 | `npx wrangler secret put`（リポジトリには入れない） |
| `CONTACT_TO` | 秘密（運営者のメールアドレス） | `npx wrangler secret put`（リポジトリには入れない） |
| `CONTACT_FROM` | 設定値 | `wrangler.jsonc`（`noreply@ryo-lab.dev`） |
| `ALLOWED_ORIGINS` / `TURNSTILE_HOSTNAMES` | 設定値 | `wrangler.jsonc` |
| Turnstile のサイトキー | 公開値 | `assets/js/contact-form.js` の `TURNSTILE_SITE_KEY`（ページのソースに必ず出る値なので公開して問題ない） |

## 初回セットアップ手順（運営者が手作業で実施）

### 1. Email Routing の宛先を確認する

ryo-lab.dev では Email Routing が有効になっていて、MX は Cloudflare（route1〜3.mx.cloudflare.net）を向いています。追加の DNS 設定はいりません。

1. Cloudflare ダッシュボード →「メールルーティング」→ ryo-lab.dev →「宛先アドレス」を開く
2. 受信用の Gmail が **「確認済み」** になっていることを確認する。なければ追加し、届いた確認メールのリンクを開く
3. 既存のルーティングルールは変更しなくてかまいません。送信元の `noreply@ryo-lab.dev` 用にルールを作る必要もありません

### 2. Turnstile のウィジェットを作る

1. ダッシュボード →「Turnstile」→「ウィジェットを追加」
2. 名前：`ryo-lab-contact`、ホスト名：`ryo-lab.dev`、ウィジェットモード：「マネージド」
3. 表示された **サイトキー** と **シークレットキー** を控える（シークレットキーはチャットやリポジトリに貼らない）

### 3. Worker をデプロイする

```bash
cd _worker/contact
npx wrangler login          # ブラウザで Cloudflare にログイン
npx wrangler deploy         # api.ryo-lab.dev のカスタムドメインも同時に作成される
```

- `api.ryo-lab.dev` という DNS レコードがすでにあると失敗します。そのときは既存のレコードを確認してください
- 秘密値を入れるまでは、送信しても 500（misconfigured）を返すだけで、メールは送られません

### 4. 秘密値を登録する

```bash
npx wrangler secret put TURNSTILE_SECRET   # プロンプトにシークレットキーを貼り付け
npx wrangler secret put CONTACT_TO         # プロンプトに受信用の Gmail アドレスを入力
```

プロンプトに入力する方式なので、値はシェルの履歴に残りません。

### 5. サイトキーをサイトに入れる

`assets/js/contact-form.js` の `TURNSTILE_SITE_KEY` にサイトキーを入れて PR を出し、マージします。空のあいだは、フォームが「準備中」の表示になり、送信できません。

### 6. 動作を確認する

1. `https://ryo-lab.dev/scorevault/contact.html` から実際に送信する
2. Gmail に「[ScoreVault] ○○」という件名のメールが届くことを確認する（迷惑メールフォルダも見る）
3. そのメールに返信し、宛先がフォームに入力したアドレスになっていることを確認する
4. 届かないときは `npx wrangler tail` でログを見る。`E_SENDER_NOT_VERIFIED` が出る場合は、送信元ドメインの設定に問題があります

### 7.（任意）レート制限ルールを追加する

Turnstile があるので必須ではありません。さらに絞りたい場合は、ダッシュボードの「セキュリティ」→「WAF」→「レート制限ルール」で、ホスト名 `api.ryo-lab.dev` を対象に同一 IP からの連続送信を制限します。無料プランはルール数や条件の選択肢が限られるので、画面で選べる範囲で設定してください。

## 開発

```bash
cd _worker/contact
npm test        # node --test（追加のパッケージは不要）
```

- フォームが送る項目：`app`（固定）、`category`、`email`（任意。データ削除の依頼 `deletion` のときだけ必須）、`environment`（任意）、`message`、`website`（ハニーポット）、`token`（Turnstile）
- メールアドレスが未記入のときは Reply-To を付けずに送り、本文に「返信できない」旨を書く
- メールアドレスを必須にする種別を変えるときは、`src/validate.js` の `EMAIL_REQUIRED_CATEGORIES` と `assets/js/contact-form.js` の同名の定数を揃える
- アプリを追加するときは、`src/validate.js` の `APPS` と、そのアプリの `contact.html`（`data-app`）の両方に追加する
- アプリ内からフォームを開くときは、`contact.html?os=Android&version=1.2.3` のように渡すと、端末情報が事前に入る。データ削除の依頼では `&category=deletion` も付けられる
