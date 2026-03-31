# Project UNKNOWN — ARG System

Misskey風インターフェースに X (Twitter) OAuth2認証を実装したARG運用システムです。

---

## セットアップ手順

### 1. X Developer App を作成

1. [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard) にアクセス
2. **「+ Add App」** または **「Create Project」** をクリック
3. アプリ名を入力（例：`project-unknown-arg`）
4. **「User authentication settings」** を設定：
   - **App permissions**: `Read`
   - **Type of App**: `Web App, Automated App or Bot`
   - **Callback URI / Redirect URL**: `http://localhost:3000/auth/callback`
   - **Website URL**: `http://localhost:3000`
5. **「Keys and Tokens」** タブから以下をコピー：
   - `Client ID`
   - `Client Secret`

> ⚠️ **本番環境では** Callback URIを実際のドメインに変更してください  
> 例: `https://your-domain.com/auth/callback`

---

### 2. 環境変数を設定

```bash
cp .env.example .env
```

`.env` を編集：
```
X_CLIENT_ID=ここにClient IDを貼り付け
X_CLIENT_SECRET=ここにClient Secretを貼り付け
REDIRECT_URI=http://localhost:3000/auth/callback
SESSION_SECRET=ランダムな長い文字列（例：openssl rand -hex 32 の出力）
PORT=3000
```

---

### 3. インストール & 起動

```bash
npm install
npm start
```

ブラウザで `http://localhost:3000` を開く。

---

## 機能一覧

| 機能 | 説明 |
|------|------|
| **X OAuth2認証** | PKCEフロー実装、セッション管理付き |
| **タイムライン** | ARGキャラクターの投稿表示、投稿・リプライ |
| **Botトリガー** | キーワードで自動リプライ（管理者設定可） |
| **通知** | リプライ/いいね/フォロー/システム通知（タブフィルター付き） |
| **チャンネル** | カテゴリ別チャット（general/cipher/座標調査/考察） |
| **クリップ** | 投稿をブックマーク保存・管理 |
| **ドライブ** | テキストファイルのアップロード・管理 |
| **検索** | 投稿・ユーザー全文検索 |
| **管理者パネル** | ARGキャラとしての投稿作成、Botトリガー設定 |

---

## ファイル構成

```
arg-app/
├── server.js          # Express + OAuth2 バックエンド
├── package.json
├── .env               # 環境変数（要作成）
├── .env.example       # サンプル
└── public/
    ├── index.html     # ランディング（ログイン前）
    └── app.html       # メインアプリ（ログイン後）
```

---

## 本番デプロイ時の注意

- `SESSION_SECRET` を強力なランダム文字列に変更
- `cookie.secure: true` に変更（HTTPS必須）
- データをメモリではなく DB（PostgreSQL/SQLite等）に保存
- `REDIRECT_URI` を本番ドメインに変更し、Developer Portalにも登録

---

## APIエンドポイント一覧

| Method | Path | 説明 |
|--------|------|------|
| GET | `/auth/login` | X認証開始 |
| GET | `/auth/callback` | OAuth2コールバック |
| GET | `/auth/logout` | ログアウト |
| GET | `/auth/me` | 現在のユーザー情報 |
| GET | `/api/posts` | 投稿一覧 |
| POST | `/api/posts` | 投稿作成 |
| POST | `/api/posts/:id/like` | いいね |
| GET/POST/DELETE | `/api/triggers` | Botトリガー管理 |
| GET | `/api/channels` | チャンネル一覧 |
| GET/POST | `/api/channels/:id/posts` | チャンネル投稿 |
| GET/POST/DELETE | `/api/clips` | クリップ管理 |
| GET/POST/DELETE | `/api/drive` | ドライブ管理 |
