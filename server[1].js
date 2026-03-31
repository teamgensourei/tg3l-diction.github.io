/**
 * Project UNKNOWN — ARG Backend
 * X (Twitter) OAuth 2.0 PKCE 認証サーバー
 *
 * セットアップ手順:
 *  1. https://developer.twitter.com/en/portal/dashboard にアクセス
 *  2. 新しいアプリを作成 → "User authentication settings" を設定
 *     - App permissions: Read
 *     - Type of App: Web App
 *     - Callback URI: http://localhost:3000/auth/callback
 *     - Website URL: http://localhost:3000
 *  3. "OAuth 2.0 Client ID and Client Secret" をコピー
 *  4. .env ファイルに貼り付け（.env.example 参照）
 *  5. npm install && node server.js
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios   = require('axios');
const crypto  = require('crypto');
const path    = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- X OAuth2 設定 ----
const CLIENT_ID     = process.env.X_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.X_CLIENT_SECRET || '';
const REDIRECT_URI  = process.env.REDIRECT_URI    || `http://localhost:${PORT}/auth/callback`;
const SCOPES        = 'tweet.read users.read offline.access';

// ---- セッション ----
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- PKCE ヘルパー ----
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}
function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// ---- ARG 投稿・トリガーデータ（メモリ、本番はDBに置き換え） ----
let argPosts = [
  { id:1, actorIdx:0, time:'1分前',  body:'KHOOR ZRUOG\n\n最初の鍵を見つけよ。', cipher:true,  likes:7,  rp:3,  reacts:['🔍 調査','🔗 連鎖'], replies:[
    { actorIdx:2, time:'1分前', body:'" ·· ···:··::· "', cipher:false }
  ]},
  { id:2, actorIdx:1, time:'3分前',  body:'北緯35.6762、東経139.6503\nこの場所に何かある。', cipher:false, likes:12, rp:5,  reacts:['📍 確認','🔎 調査'], replies:[] },
  { id:3, actorIdx:2, time:'10分前', body:'⚠ システム警告\n01001100 01000001 01011001 01000101 01010010 00110010', cipher:true,  likes:9,  rp:6,  reacts:['💻 解析'], replies:[] },
  { id:4, actorIdx:3, time:'1ヶ月前',body:'【緊急】第二フェーズが開始されました。\n次のメッセージを待て。時間は限られている。', cipher:false, likes:23, rp:11, reacts:['⚡ 確認','🚨 警戒'], replies:[] }
];

let argTriggers = [
  { word:'暗号',       reply:'...お前も気づいたか。ROT3を試せ。',          actorIdx:0 },
  { word:'layer2',    reply:'正しい。次の扉はshadow.layerにある。',        actorIdx:2 },
  { word:'layer2',    reply:'正しい。次の扉はshadow.layerにある。',        actorIdx:2 },
  { word:'hello world',reply:'鍵を手に入れた。次のレイヤーへ進め。',        actorIdx:0 },
];

let argChannels = [
  { id:'general',  name:'general',   desc:'なんでも話せる場所',           posts:[], pinned:false },
  { id:'cipher',   name:'cipher',    desc:'暗号解読専用チャンネル',         posts:[], pinned:true  },
  { id:'coords',   name:'座標調査',  desc:'フィールド調査報告',             posts:[], pinned:false },
  { id:'theories', name:'考察',      desc:'ARG全体の考察・ネタバレ注意',    posts:[], pinned:false },
];

let nextId = 5;
let userClips = [];   // { id, postId, postBody, actorName, savedAt }
let userDrive = [];   // { id, name, type, size, uploadedAt, content }

const ACTORS = [
  { name:'謎の存在', handle:'@unknown@unknown.io',     avCls:'av1', avT:'?' },
  { name:'調査員A',  handle:'@agent_a@agent.space',    avCls:'av2', avT:'A' },
  { name:'システム', handle:'@sys@unknown.io',          avCls:'av3', avT:'S' },
  { name:'緊急放送', handle:'@broadcast@unknown.io',   avCls:'av4', avT:'!' },
];

// ========================================
// 認証エンドポイント
// ========================================

// GET /auth/login → X認証画面へリダイレクト
app.get('/auth/login', (req, res) => {
  if (!CLIENT_ID) {
    return res.redirect('/?error=no_client_id');
  }
  const verifier   = generateCodeVerifier();
  const challenge  = generateCodeChallenge(verifier);
  const state      = crypto.randomBytes(16).toString('hex');

  req.session.codeVerifier = verifier;
  req.session.oauthState   = state;

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             CLIENT_ID,
    redirect_uri:          REDIRECT_URI,
    scope:                 SCOPES,
    state,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  });

  res.redirect(`https://twitter.com/i/oauth2/authorize?${params}`);
});

// GET /auth/callback → トークン取得
app.get('/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) return res.redirect(`/?error=${error}`);
  if (state !== req.session.oauthState) return res.redirect('/?error=state_mismatch');

  try {
    const tokenRes = await axios.post(
      'https://api.twitter.com/2/oauth2/token',
      new URLSearchParams({
        code,
        grant_type:    'authorization_code',
        client_id:     CLIENT_ID,
        redirect_uri:  REDIRECT_URI,
        code_verifier: req.session.codeVerifier,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: { username: CLIENT_ID, password: CLIENT_SECRET },
      }
    );

    const { access_token, refresh_token } = tokenRes.data;

    // ユーザー情報取得
    const userRes = await axios.get('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${access_token}` },
      params: { 'user.fields': 'profile_image_url,description,public_metrics' }
    });

    req.session.user = {
      ...userRes.data.data,
      access_token,
      refresh_token,
    };

    delete req.session.codeVerifier;
    delete req.session.oauthState;

    res.redirect('/app');
  } catch (err) {
    console.error('OAuth error:', err.response?.data || err.message);
    res.redirect('/?error=token_failed');
  }
});

// GET /auth/logout
app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// GET /auth/me → セッションユーザー情報
app.get('/auth/me', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// ========================================
// ARG API
// ========================================

// GET /api/posts
app.get('/api/posts', (req, res) => {
  res.json(argPosts);
});

// POST /api/posts
app.post('/api/posts', requireAuth, (req, res) => {
  const { body, cipher, actorIdx } = req.body;
  if (!body) return res.status(400).json({ error: 'body required' });
  const post = {
    id: nextId++, actorIdx: actorIdx || -1,
    _userPost: true,
    _userName: req.session.user.name,
    _userHandle: '@' + req.session.user.username + '@x.com',
    _userAvatar: req.session.user.profile_image_url,
    time: 'たった今', body, cipher: !!cipher,
    likes: 0, rp: 0, reacts: ['👍'], replies: []
  };
  argPosts.push(post);

  // トリガーチェック
  const bodyLow = body.toLowerCase();
  const fired = argTriggers.filter(t => bodyLow.includes(t.word.toLowerCase()));
  const botReplies = fired.map(t => ({
    actorIdx: t.actorIdx,
    time: 'たった今',
    body: t.reply,
    cipher: false,
    _bot: true
  }));
  if (botReplies.length) {
    post.replies.push(...botReplies);
  }

  res.json({ post, botReplies });
});

// POST /api/posts/:id/like
app.post('/api/posts/:id/like', requireAuth, (req, res) => {
  const post = argPosts.find(p => p.id === parseInt(req.params.id));
  if (!post) return res.status(404).json({ error: 'not found' });
  post.likes++;
  res.json({ likes: post.likes });
});

// GET /api/triggers
app.get('/api/triggers', requireAuth, (req, res) => res.json(argTriggers));

// POST /api/triggers
app.post('/api/triggers', requireAuth, (req, res) => {
  const { word, reply, actorIdx } = req.body;
  if (!word || !reply) return res.status(400).json({ error: 'word and reply required' });
  argTriggers.push({ word, reply, actorIdx: parseInt(actorIdx) || 0 });
  res.json({ ok: true, triggers: argTriggers });
});

// DELETE /api/triggers/:i
app.delete('/api/triggers/:i', requireAuth, (req, res) => {
  argTriggers.splice(parseInt(req.params.i), 1);
  res.json({ ok: true });
});

// GET /api/channels
app.get('/api/channels', (req, res) => res.json(argChannels));

// GET /api/channels/:id/posts
app.get('/api/channels/:id/posts', (req, res) => {
  const ch = argChannels.find(c => c.id === req.params.id);
  if (!ch) return res.status(404).json({ error: 'not found' });
  res.json(ch.posts);
});

// POST /api/channels/:id/posts
app.post('/api/channels/:id/posts', requireAuth, (req, res) => {
  const ch = argChannels.find(c => c.id === req.params.id);
  if (!ch) return res.status(404).json({ error: 'not found' });
  const { body } = req.body;
  if (!body) return res.status(400).json({ error: 'body required' });
  const msg = {
    id: Date.now(),
    userName: req.session.user.name,
    userHandle: '@' + req.session.user.username,
    userAvatar: req.session.user.profile_image_url,
    body, time: new Date().toISOString(), likes: 0
  };
  ch.posts.push(msg);
  res.json(msg);
});

// GET /api/clips
app.get('/api/clips', requireAuth, (req, res) => res.json(userClips));

// POST /api/clips
app.post('/api/clips', requireAuth, (req, res) => {
  const { postId } = req.body;
  const post = argPosts.find(p => p.id === parseInt(postId));
  if (!post) return res.status(404).json({ error: 'not found' });
  if (userClips.find(c => c.postId === post.id)) return res.json({ ok: true, clips: userClips });
  const a = ACTORS[post.actorIdx] || { name: post._userName || '?' };
  userClips.push({ id: Date.now(), postId: post.id, postBody: post.body, actorName: a.name, savedAt: new Date().toISOString() });
  res.json({ ok: true, clips: userClips });
});

// DELETE /api/clips/:id
app.delete('/api/clips/:id', requireAuth, (req, res) => {
  userClips = userClips.filter(c => c.id !== parseInt(req.params.id));
  res.json({ ok: true });
});

// GET /api/drive
app.get('/api/drive', requireAuth, (req, res) => res.json(userDrive));

// POST /api/drive  (テキストファイルのみ対応)
app.post('/api/drive', requireAuth, (req, res) => {
  const { name, content } = req.body;
  if (!name || !content) return res.status(400).json({ error: 'name and content required' });
  const file = { id: Date.now(), name, type: 'text/plain', size: content.length, uploadedAt: new Date().toISOString(), content };
  userDrive.push(file);
  res.json(file);
});

// DELETE /api/drive/:id
app.delete('/api/drive/:id', requireAuth, (req, res) => {
  userDrive = userDrive.filter(f => f.id !== parseInt(req.params.id));
  res.json({ ok: true });
});

// ========================================
// ページルーティング
// ========================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/app', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.listen(PORT, () => {
  console.log(`\n🔮 Project UNKNOWN ARG Server`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`\n   X_CLIENT_ID: ${CLIENT_ID ? '✅ 設定済み' : '❌ 未設定 (.envを確認)'}`);
  console.log(`   X_CLIENT_SECRET: ${CLIENT_SECRET ? '✅ 設定済み' : '❌ 未設定 (.envを確認)'}\n`);
});
