/* =====================================================================
   三合棋牌 · 核心：工具 / 存档 / 商城 / 匹配 / 牌桌外壳
   ===================================================================== */
'use strict';

/* 版本号：发版时和 sw.js 里的 CACHE 一起改 */
const APP_VERSION = '2.9.0';
const APP_BUILD = '2026-09-01';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function fmt(n) {
  n = Math.round(n);
  const s = n < 0 ? '-' : '', v = Math.abs(n);
  if (v >= 100000000) return s + (v / 100000000).toFixed(2).replace(/\.?0+$/, '') + '亿';
  if (v >= 10000) return s + (v / 10000).toFixed(2).replace(/\.?0+$/, '') + '万';
  return String(n);
}

/* ---------------- 牌面 ---------------- */
const SUITS = ['S', 'H', 'C', 'D'];
const SUIT_CH = { S: '♠', H: '♥', C: '♣', D: '♦' };
const SUIT_COLOR = { S: 'b', H: 'r', C: 'b', D: 'r' };
const RANK_CH = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
let _cid = 0;
/* kind: 0=普通 1=癞子 2=机会牌 */
const mkCard = (r, s, kind) => ({ id: ++_cid, r: r, s: s, k: kind || 0 });
const isWild = c => c.k > 0;

function cardEl(c, cls) {
  const d = document.createElement('div');
  let k = 'card ' + (cls ? cls + ' ' : '');
  if (c.k === 1) { k += 'wild'; d.className = k; d.innerHTML = '<div class="c-tl">癞</div><div class="c-big">✦</div>'; }
  else if (c.k === 2) { k += 'chance'; d.className = k; d.innerHTML = '<div class="c-tl">机</div><div class="c-big">✧</div>'; }
  else {
    d.className = k + SUIT_COLOR[c.s];
    d.innerHTML = '<div class="c-tl">' + RANK_CH[c.r] + '<small>' + SUIT_CH[c.s] + '</small></div>'
      + '<div class="c-big">' + SUIT_CH[c.s] + '</div>';
  }
  d.dataset.id = c.id;
  return d;
}
function backEl(n) { const d = document.createElement('div'); d.className = 'cardback-count'; d.textContent = n; return d; }
function slotEl(sm) { const d = document.createElement('div'); d.className = 'slot' + (sm ? ' sm' : ''); return d; }
/* 手牌自适应叠放 */
function fitHand(hd, n, cw) {
  cw = cw || 46;
  const avail = (hd.clientWidth || 360) - 12;
  let step = n > 1 ? Math.min(cw * 0.66, (avail - cw) / (n - 1)) : cw;
  hd.style.setProperty('--ov', (Math.max(step, 9) - cw).toFixed(1) + 'px');
}

/* ---------------- 昵称 / 头像 ---------------- */
const NICK_A = ['一枝', '孤独', '天涯', '江南', '塞北', '不见', '半世', '陌上', '风中', '南山', '北海', '醉卧', '独钓', '踏雪', '闲云', '青衫', '白衣', '烈焰', '暴走', '深海', '月下', '云端', '逍遥', '风流', '无敌', '傲天', '冷面', '快乐', '佛系', '摸鱼'];
const NICK_B = ['独秀', '求败', '浪子', '书生', '刀客', '故人', '浮生', '花开', '凌乱', '有雪', '听涛', '沙场', '寻梅', '野鹤', '磊落', '飘飘', '战神', '小子', '老王', '清风', '揽月', '公子', '才子', '天尊', '判官', '大叔', '青年', '达人', '选手', '专家'];
const NICK_C = ['牌桌小霸王', '斗地主之神', '天生一对', '五连炸', '农民翻身', '不服就干', '手气爆棚', '常胜将军', '爱笑的眼睛', '爆牌小王子', '万年老二', '三缺一', '就是玩儿', '欧皇附体', '非酋本酋', '来都来了', '再来亿把', '稳如老狗', '在线摸牌', '牌品好'];
const AVATARS = ['😀', '😎', '🤠', '🧐', '😼', '🐯', '🐼', '🦊', '🐰', '🐲', '👴', '👵', '🧑‍🌾', '👨‍🚀', '🧙', '🥷', '👸', '🤖'];
function randomNick() {
  if (Math.random() < .35) return pick(NICK_C) + (Math.random() < .4 ? rnd(90) + 10 : '');
  return pick(NICK_A) + pick(NICK_B) + (Math.random() < .5 ? '' : rnd(999));
}

/* ---------------- 存档 ---------------- */
const SAVE_KEY = 'sanhe_qipai_v3';
const DEFAULT_SAVE = { name: '', beans: 1000000, avatar: '🀄️', totalRecharge: 0, games: 0, wins: 0, lastRelief: 0 };
let S = null;
function loadSave() {
  try {
    const o = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (o && typeof o.beans === 'number') return Object.assign({}, DEFAULT_SAVE, o);
  } catch (e) { }
  const s = Object.assign({}, DEFAULT_SAVE);
  s.name = randomNick(); s.avatar = pick(AVATARS);
  return s;
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
function refreshMe() {
  $('#myName').textContent = S.name;
  $('#myBeans').textContent = fmt(S.beans);
  $('#myAvatar').textContent = S.avatar;
  $('#tMyName').textContent = S.name;
  $('#tMyAvatar').textContent = S.avatar;
  $('#tMyBeans').textContent = fmt(S.beans);
  save();
}

/* ---------------- 提示 / 弹窗 ---------------- */
function toast(txt, ms) {
  const w = document.createElement('div'); w.className = 'toast-wrap';
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = txt;
  w.appendChild(d);
  ($('#table').classList.contains('on') ? $('#table') : $('#app')).appendChild(w);
  anim(d, { opacity: [0, 1], scale: [.86, 1] }, { duration: .18, ease: EASE_OUT });
  setTimeout(() => w.remove(), ms || 1100);
}
function bigWin(txt, ms) {
  const w = document.createElement('div'); w.className = 'bigwin-wrap';
  const d = document.createElement('div'); d.className = 'bigwin'; d.textContent = txt;
  w.appendChild(d); $('#table').appendChild(w);
  anim(d, { opacity: [0, 1, 1], scale: [.6, 1.1, 1] },
    { duration: .38, ease: MO ? Motion.backOut : EASE_OUT });
  setTimeout(() => w.remove(), ms || 1500);
}
function openModal(html) { $('#modal').innerHTML = html; $('#mask').classList.add('on'); $('#modal').scrollTop = 0; }
function closeModal() { $('#mask').classList.remove('on'); }
/* 主题背景画在 #app 上（铺满整屏，安全区那两条也被它盖住，不会有接缝），
   所以每次切界面要把当前界面的主题类同步给 #app。body 的底色只是兜底。 */
const THEMES = ['th-lobby', 'th-baque', 'th-douxian', 'th-sanguo'];
const PAGE_BG = { 'th-lobby': '#061a11', 'th-baque': '#0d2f5e', 'th-douxian': '#16264a', 'th-sanguo': '#3a120a' };
function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  const on = $('.screen.on'), app = $('#app');
  if (!on || !app) return;
  const th = THEMES.find(k => on.classList.contains(k));
  if (th) { app.className = th; document.body.style.background = PAGE_BG[th]; }
}

/* ---------------- 强制刷新 / 版本信息 ---------------- */
const CORE_FILES = ['index.html', 'js/core.js', 'js/baque.js', 'js/douxian.js',
  'js/sanguo.js', 'js/vendor/motion.js', 'sw.js'];
/* 开机静默比一次版本号：线上比本地新就自动清缓存重载，不用手点强制刷新。 */
async function checkUpdate() {
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'reload' });
    if (!r.ok) return;
    const v = (await r.json()).v;
    if (v && v !== APP_VERSION) {
      toast('发现新版本 v' + v + '，正在更新…', 2000);
      setTimeout(hardReload, 600);
    }
  } catch (e) { }
}
async function hardReload() {
  toast('正在清理缓存…', 1500);
  try {
    if (navigator.serviceWorker) {
      const rs = await navigator.serviceWorker.getRegistrations();
      for (const r of rs) await r.unregister();
    }
    if (window.caches) {
      const ks = await caches.keys();
      for (const k of ks) await caches.delete(k);
    }
  } catch (e) { }
  // 光清 SW 缓存不够：浏览器自己的 HTTP 缓存还会拿旧 js。
  // 逐个 cache:'reload' 重取一遍，把 HTTP 缓存条目也换成新的。
  try {
    await Promise.all(CORE_FILES.map(f =>
      fetch(f + '?hr=' + Date.now(), { cache: 'reload' }).catch(() => { })));
  } catch (e) { }
  // 只清离线缓存，不动 localStorage（欢乐豆和昵称都保留）
  location.replace(location.origin + location.pathname + '?v=' + Date.now());
}
async function openVersion() {
  let sw = '未注册', cache = '无';
  try {
    if (navigator.serviceWorker) {
      const rs = await navigator.serviceWorker.getRegistrations();
      sw = rs.length ? (navigator.serviceWorker.controller ? '已生效（可离线玩）' : '已注册，刷新后生效') : '未注册';
    }
    if (window.caches) { const ks = await caches.keys(); if (ks.length) cache = ks.join('、'); }
  } catch (e) { sw = '不可用（需 https 或 localhost）'; }
  const td = 'style="text-align:left;color:#e2f2e8;font-weight:400"';
  openModal('<h2>版本信息</h2>'
    + '<table class="rt"><tr><th>项目</th><th>内容</th></tr>'
    + '<tr><td>版本号</td><td ' + td + '>v' + APP_VERSION + '</td></tr>'
    + '<tr><td>构建日期</td><td ' + td + '>' + APP_BUILD + '</td></tr>'
    + '<tr><td>离线缓存</td><td ' + td + '>' + cache + '</td></tr>'
    + '<tr><td>Service Worker</td><td ' + td + '>' + sw + '</td></tr>'
    + '<tr><td>存档键</td><td ' + td + '>' + SAVE_KEY + '</td></tr>'
    + '</table>'
    + '<h4>拿不到新版本？</h4>'
    + '<p>页面会被离线缓存，改动后手机上可能还是旧版。点 <b class="gold-txt">强制刷新</b> 会清掉离线缓存重新下载，'
    + '<b>欢乐豆和昵称不会丢</b>。</p>'
    + '<div class="foot"><button class="btn sm red" data-hr>强制刷新</button>'
    + '<button class="btn sm grey" data-close>关闭</button></div>');
  $('#modal [data-hr]').onclick = () => { closeModal(); hardReload(); };
  $('#modal [data-close]').onclick = closeModal;
}

/* ---------------- 商城 ---------------- */
const SHOP = [
  { amt: 60000, price: 6, bonus: 0, label: '小试牛刀' },
  { amt: 300000, price: 30, bonus: 20000, label: '欢乐畅玩' },
  { amt: 680000, price: 68, bonus: 80000, label: '牌桌新贵' },
  { amt: 1280000, price: 128, bonus: 220000, label: '土豪专属' },
  { amt: 3280000, price: 328, bonus: 720000, label: '一掷千金' },
  { amt: 6480000, price: 648, bonus: 1800000, label: '至尊王者' }
];
function openShop() {
  let h = '<h2>欢乐豆商城</h2><p style="text-align:center;font-size:12px" class="gold-txt">模拟充值 · 不涉及任何真实支付</p>'
    + '<div class="shop-list" style="margin-top:10px">';
  SHOP.forEach((p, i) => {
    h += '<div class="shop-item" data-buy="' + i + '"><div style="font-size:20px">💰</div>'
      + '<div class="amt">' + fmt(p.amt + p.bonus) + '</div>'
      + (p.bonus ? '<div class="bonus">含赠送 ' + fmt(p.bonus) + '</div>' : '<div class="bonus">&nbsp;</div>')
      + '<div class="px">¥ ' + p.price + '　' + p.label + '</div></div>';
  });
  h += '</div><h4>破产补助</h4><p>欢乐豆低于 50,000 时可免费领取 <b class="gold-txt">200,000</b>，每 10 分钟一次。</p>'
    + '<div class="foot"><button class="btn sm" data-relief>领取补助</button><button class="btn sm grey" data-close>关闭</button></div>';
  openModal(h);
  $$('#modal [data-buy]').forEach(el => el.onclick = () => {
    const p = SHOP[+el.dataset.buy];
    S.beans += p.amt + p.bonus; S.totalRecharge += p.price;
    refreshMe(); closeModal(); toast('充值成功 +' + fmt(p.amt + p.bonus) + ' 豆', 1400);
  });
  $('#modal [data-relief]').onclick = () => {
    if (S.beans >= 50000) return toast('豆子还够，不能领补助');
    if (Date.now() - S.lastRelief < 600000) return toast('补助冷却中，请稍后');
    S.beans += 200000; S.lastRelief = Date.now(); refreshMe(); closeModal(); toast('补助到账 +200,000');
  };
  $('#modal [data-close]').onclick = closeModal;
}
function openMe() {
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  openModal('<h2>我的资料</h2>'
    + '<h4>昵称</h4>'
    + '<div class="row-in"><input class="txt-in" id="nameInput" maxlength="12" value="' + esc(S.name) + '" placeholder="输入你的昵称">'
    + '<button class="btn sm" data-save>保存</button></div>'
    + '<p style="font-size:11px;opacity:.75;margin-top:5px">最多 12 个字，改完会一直用这个名字，不会被随机改掉。</p>'
    + '<h4>头像</h4><p><span id="mav" style="font-size:22px">' + S.avatar + '</span> '
    + '<button class="btn xs grey" data-ra>随机换头像</button> '
    + '<button class="btn xs grey" data-rn>随机起个名</button></p>'
    + '<h4>数据</h4><ul><li>欢乐豆：<b class="gold-txt">' + fmt(S.beans) + '</b></li>'
    + '<li>累计对局：' + S.games + ' 局，胜 ' + S.wins + ' 局</li>'
    + '<li>模拟充值：¥ ' + S.totalRecharge + '</li></ul>'
    + '<div class="foot"><button class="btn sm" data-close>关闭</button></div>');
  const inp = $('#nameInput');
  const saveName = () => {
    const v = (inp.value || '').trim().slice(0, 12);
    if (!v) return toast('昵称不能为空');
    S.name = v; refreshMe(); toast('昵称已保存：' + v, 1200);
  };
  $('#modal [data-save]').onclick = saveName;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveName(); } });
  $('#modal [data-rn]').onclick = () => { inp.value = randomNick(); };
  $('#modal [data-ra]').onclick = () => { S.avatar = pick(AVATARS); $('#mav').textContent = S.avatar; refreshMe(); };
  $('#modal [data-close]').onclick = () => { saveNameIfChanged(inp); closeModal(); };
  function saveNameIfChanged(el) {
    const v = (el.value || '').trim().slice(0, 12);
    if (v && v !== S.name) { S.name = v; refreshMe(); }
  }
}

/* =====================================================================
   匹配人机
   ===================================================================== */
const GAMES = {};
let curGameKey = null, tablePlayers = null, matchTimer = null;

/* 人机携带的欢乐豆：按该玩法的进场门槛缩放，保证经得起本玩法的输赢波动 */
function aiBeans(g) {
  const k = Math.random() < .12 ? 8 + Math.random() * 22 : 1.2 + Math.random() * 6;
  return Math.round(g.entry * k / 1000) * 1000;
}
function buildTable(gkey) {
  const g = GAMES[gkey];
  const arr = [{ name: S.name, avatar: S.avatar, beans: S.beans, isMe: true }];
  const used = new Set([S.name]);
  while (arr.length < g.seats) {
    const a = { name: randomNick(), avatar: pick(AVATARS), beans: aiBeans(g), isMe: false };
    if (used.has(a.name)) continue;
    used.add(a.name); arr.push(a);
  }
  return arr;
}
function gotoMatch(gkey) {
  const g = GAMES[gkey];
  if (S.beans < g.entry) { toast('欢乐豆不足，先去充值吧', 1500); return openShop(); }
  curGameKey = gkey;
  $('#matchGameName').textContent = g.name + ' · 底分 ' + fmt(g.base);
  show('match'); runMatch();
}
function runMatch() {
  tablePlayers = buildTable(curGameKey);
  $('#btnMatchStart').disabled = true;
  $('#matchTip').textContent = '正在匹配对手';
  const seats = $('#seats'); seats.innerHTML = '';
  const fill = (d, p) => d.innerHTML = '<div style="font-size:24px">' + p.avatar + '</div><div class="nm">' + p.name
    + '</div><div class="bean gold-txt"><i></i>' + fmt(p.beans) + '</div>';
  tablePlayers.forEach((p, i) => {
    const d = document.createElement('div');
    d.className = 'seat' + (i === 0 ? ' filled' : '');
    if (i === 0) fill(d, p); else d.innerHTML = '<div style="font-size:20px">🔍</div><div>等待中</div>';
    seats.appendChild(d);
  });
  clearInterval(matchTimer);
  let i = 1;
  matchTimer = setInterval(() => {
    if (i >= tablePlayers.length) {
      clearInterval(matchTimer);
      $('#matchTip').textContent = '匹配完成'; $('#btnMatchStart').disabled = false; return;
    }
    const d = seats.children[i]; d.className = 'seat filled'; fill(d, tablePlayers[i]); i++;
  }, 340 + rnd(280));
}

/* =====================================================================
   牌桌外壳
   ===================================================================== */
let ctx = null;
function startGame() {
  const g = GAMES[curGameKey];
  tablePlayers[0].beans = S.beans;
  ctx = { game: g, players: tablePlayers, base: g.base, body: $('#tBody'), hand: $('#myHand'), zone: $('#myZone'), act: $('#actBar'), over: false };
  $('#table').className = 'screen on th-' + g.key;
  $('#tGame').textContent = g.name;
  $('#tInfo').textContent = '底分 ' + fmt(g.base);
  $('#tMyExtra').textContent = '';
  $('#tBody').style.cssText = ''; $('#tBody').innerHTML = '';
  $('#myHand').innerHTML = ''; $('#actBar').innerHTML = ''; $('#myZone').innerHTML = '';
  refreshMe(); show('table');
  g.start(ctx);
}
function quitGame() { if (ctx) ctx.over = true; ctx = null; show('lobby'); refreshMe(); }

function seatBox(p, extraHTML, posCls) {
  const d = document.createElement('div');
  d.className = 'player ' + posCls;
  d.innerHTML = '<div class="avatar" style="width:32px;height:32px;font-size:16px">' + p.avatar + '</div>'
    + '<div class="box"><div class="nm">' + p.name + '</div>'
    + '<div class="bean gold-txt"><i></i><span class="bn">' + fmt(p.beans) + '</span></div>'
    + '<div class="ex">' + (extraHTML || '') + '</div></div>';
  return d;
}
function say(seatEl, txt) {
  if (!seatEl) return;
  const b = document.createElement('div'); b.className = 'bubble'; b.textContent = txt;
  seatEl.appendChild(b); setTimeout(() => b.remove(), 1100);
}
function settle(rows, title, subtitle) {
  ctx.over = true; S.games++;
  const meRow = rows.find(r => r.p.isMe);
  if (meRow && meRow.delta > 0) S.wins++;
  rows.forEach(r => { r.p.beans = Math.max(0, r.p.beans + r.delta); if (r.p.isMe) S.beans = r.p.beans; });
  refreshMe();
  let h = '<h2>' + title + '</h2>';
  if (subtitle) h += '<p style="text-align:center;font-size:12px;margin-bottom:6px">' + subtitle + '</p>';
  rows.slice().sort((a, b) => b.delta - a.delta).forEach(r => {
    h += '<div class="res-row"><span style="font-size:17px">' + r.p.avatar + '</span>'
      + '<span>' + (r.p.isMe ? '<b class="gold-txt">' + r.p.name + '</b>' : r.p.name) + '</span>'
      + (r.tag ? '<span class="pill" style="font-size:10px;padding:1px 7px">' + r.tag + '</span>' : '')
      + '<span class="d ' + (r.delta >= 0 ? 'up' : 'dn') + '">' + (r.delta >= 0 ? '+' : '') + fmt(r.delta) + '</span></div>';
  });
  h += '<div class="foot"><button class="btn sm" data-again>再来一局</button><button class="btn sm grey" data-lobby>返回大厅</button></div>';
  openModal(h);
  $('#modal [data-again]').onclick = () => {
    closeModal();
    if (S.beans < ctx.game.entry) { show('lobby'); toast('欢乐豆不足'); return openShop(); }
    startGame();
  };
  $('#modal [data-lobby]').onclick = () => { closeModal(); quitGame(); };
}
/* =====================================================================
   横屏围桌：座位环 / 出牌区 / 飞牌 / 飞豆
   ===================================================================== */
/* 每种人数的座位与出牌区坐标（0 号是自己，坐在下方） */
const RING = {
  4: [
    { play: { left: '50%', bottom: '2%', tx: -50 } },
    { chip: { right: '2px', top: '12%' }, rev: true, play: { right: '21%', top: '42%' } },
    { chip: { left: '50%', top: '2px', tx: -50 }, play: { left: '50%', top: '34%', tx: -50 } },
    { chip: { left: '2px', top: '12%' }, play: { left: '21%', top: '42%' } }
  ],
  5: [
    { play: { left: '50%', bottom: '2%', tx: -50 } },
    { chip: { right: '2px', top: '30%' }, rev: true, play: { right: '20%', top: '54%' } },
    { chip: { right: '19%', top: '2px' }, rev: true, play: { right: '30%', top: '30%' } },
    { chip: { left: '19%', top: '2px' }, play: { left: '30%', top: '30%' } },
    { chip: { left: '2px', top: '30%' }, play: { left: '20%', top: '54%' } }
  ]
};
function applyPos(el, pos) {
  if (!pos) return el;
  ['left', 'right', 'top', 'bottom'].forEach(k => { if (pos[k] != null) el.style[k] = pos[k]; });
  if (pos.tx != null) el.style.transform = 'translateX(' + pos.tx + '%)';
  return el;
}
/* 座位牌：头像 + 昵称 + 豆数 + 自定义信息 */
function mkSeat(p, cfg, extraHTML) {
  const d = document.createElement('div');
  d.className = 'seat-chip' + (cfg.rev ? ' rev' : '');
  d.innerHTML = '<div class="av">' + p.avatar + '</div>'
    + '<div class="info"><div class="nm">' + p.name + '</div>'
    + '<div class="bean gold-txt"><i></i><span class="bn">' + fmt(p.beans) + '</span></div>'
    + '<div class="ex">' + (extraHTML || '') + '</div></div>';
  return applyPos(d, cfg.chip);
}
function mkPlaySlot(cfg) {
  const d = document.createElement('div'); d.className = 'play-slot';
  return applyPos(d, cfg.play);
}
/* 强制横屏时 #app 带 transform，它就成了内部 position:fixed 元素的包含块，
   于是「视口坐标」和「#app 内部坐标」差了一个 90° 旋转 + 一个安全区偏移。
   飞豆、光圈这些都按 #app 内部坐标定位，所以量到的 rect 要换算回去：
   视口(vx,vy) → 内部(x,y) = (vy − 上安全区, 视口宽 − 右安全区 − vx)。 */
let ROT = false;                    // 是否处于强制横屏（旋转）状态
function rectOf(el) {
  const r = el.getBoundingClientRect();
  if (!ROT) return r;
  const Vw = window.innerWidth;     // #app 铺满整屏，只差一个 90° 旋转
  return { left: r.top, top: Vw - r.left - r.width, width: r.height, height: r.width,
    right: r.top + r.height, bottom: Vw - r.left };
}
/* ---------------------------------------------------------------
   动画统一走 Motion（js/vendor/motion.js，MIT）。
   Motion 底层用 Web Animations API，动画交给合成器，
   不会每帧回到主线程改样式，手机上明显更稳。
   只动 transform / opacity，绝不动 box-shadow / width 这类会重绘重排的属性。
   --------------------------------------------------------------- */
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const MO = (window.Motion && Motion.animate) ? Motion : null;
const EASE_OUT = [.22, .68, .28, 1];
/* Motion 的关键帧对象 → 原生 WAAPI 关键帧（没加载到 Motion 时的降级路径） */
function kfToWaapi(kf) {
  let len = 1;
  for (const k in kf) if (Array.isArray(kf[k])) len = Math.max(len, kf[k].length);
  const at = v => Array.isArray(v) ? v[Math.min(len - 1, v.length - 1)] : v;
  const out = [];
  for (let i = 0; i < len; i++) {
    const pick = v => Array.isArray(v) ? v[Math.min(i, v.length - 1)] : v;
    const f = {}; let tr = '';
    if (kf.x != null || kf.y != null) tr += 'translate3d(' + (pick(kf.x) || 0) + 'px,' + (pick(kf.y) || 0) + 'px,0) ';
    if (kf.scale != null) tr += 'scale(' + pick(kf.scale) + ') ';
    if (kf.rotateY != null) tr += 'rotateY(' + pick(kf.rotateY) + 'deg) ';
    if (kf.rotate != null) tr += 'rotate(' + pick(kf.rotate) + 'deg) ';
    if (tr) f.transform = tr.trim();
    if (kf.opacity != null) f.opacity = pick(kf.opacity);
    out.push(f);
  }
  void at; return out;
}
/* 统一的动画入口。
   注意：Motion 11 的 animate() 返回值既不是 Promise，也没有 .finished，
   而且它那个 then 在本环境里不会 resolve —— 所以时序一律用时长驱动，
   绝不能 await 它的返回值，否则整条流程会卡死。 */
function anim(el, kf, opt) {
  opt = opt || {};
  const ms = Math.round(((opt.duration || .4) + (opt.delay || 0)) * 1000);
  if (!REDUCED && el) {
    if (MO) { try { MO.animate(el, kf, opt); } catch (e) { } }
    else if (typeof el.animate === 'function') {
      try {
        el.animate(kfToWaapi(kf), {
          duration: (opt.duration || .4) * 1000, delay: (opt.delay || 0) * 1000, fill: 'forwards'
        });
      } catch (e) { }
    }
  }
  return { finished: new Promise(r => setTimeout(r, REDUCED ? 0 : ms + 40)) };
}
const done = a => (a && a.finished) ? a.finished : Promise.resolve();
/* 动画播完后移除临时元素 */
function removeAfter(el, a) { done(a).then(() => el.remove()); }

/* 一叠牌从 a 飞到 b */
function flyCards(cards, fromRect, toRect, opts) {
  opts = opts || {};
  if (!cards.length) return Promise.resolve();
  const layer = $('#flyLayer'), step = opts.step || 12;
  const dur = (opts.dur || 430) / 1000, stagger = (opts.stagger || 55) / 1000;
  const dx = toRect.left - fromRect.left, dy = toRect.top - fromRect.top;
  const frag = document.createDocumentFragment(), els = [];
  cards.forEach(c => {                              // 先一次性建好，避免边建边读布局
    const e = opts.back ? backEl('') : cardEl(c, opts.cls || 'tiny');
    if (opts.cw) {
      e.style.setProperty('--cw', opts.cw + 'px');
      if (opts.back) { e.style.width = opts.cw + 'px'; e.style.height = Math.round(opts.cw * 1.44) + 'px'; }
    }
    e.classList.add('fly-card');
    e.style.left = fromRect.left + 'px'; e.style.top = fromRect.top + 'px';
    frag.appendChild(e); els.push(e);
  });
  layer.appendChild(frag);
  return Promise.all(els.map((e, i) => {
    const kf = { x: [0, dx + i * step], y: [0, dy] };
    if (opts.fade) kf.opacity = [1, 0];
    const a = anim(e, kf, { duration: dur, delay: i * stagger, ease: EASE_OUT });
    removeAfter(e, a);
    return done(a);
  }));
}
/* 一张牌飞进手牌里它排好序之后的位置 */
async function flyIntoHand(card, fromRect, handEl, cw) {
  const sel = '[data-id="' + card.id + '"]';
  const el = handEl.querySelector(sel);
  if (!el) return;
  const to = rectOf(el);
  el.style.visibility = 'hidden';          // 先藏起来，等飞过去的那张落位再显出来
  try {
    await flyCards([card], fromRect, to, { step: 0, cw: cw || 42 });
  } finally {
    // 飞行途中手牌可能被重排过，按 id 再找一遍；只靠旧引用会把牌留在隐藏状态，
    // 手牌里就空出一个缝。
    el.style.visibility = '';
    handEl.querySelectorAll(sel).forEach(e => { e.style.visibility = ''; });
  }
}
/* 起终点光圈：赢家金色、输家红色。只动 opacity/scale */
function pulseRingRect(r, kind) {
  if (!r || REDUCED) return;
  const d = document.createElement('div');
  d.className = 'pulse-ring' + (kind === 'lose' ? ' lose' : '');
  d.style.cssText = 'left:' + (r.left - 4) + 'px;top:' + (r.top - 4) + 'px;'
    + 'width:' + (r.width + 8) + 'px;height:' + (r.height + 8) + 'px';
  $('#flyLayer').appendChild(d);
  removeAfter(d, anim(d, { opacity: [0, 1, 0], scale: [.9, 1.05, 1.2] }, { duration: 1, ease: EASE_OUT }));
}
const pulseRing = el => { if (el) pulseRingRect(rectOf(el)); };
/* 按输赢豆的多少决定飞豆的「规模」：颗数、大小、飞行时间、散开幅度都跟着变。
   既看绝对数量级（几百 vs 几万），也看这次结算里的相对大小（谁付得最多）。 */
function beanScale(amount, ref, streams) {
  const rel = ref ? Math.min(1, amount / ref) : .5;
  const mag = Math.min(1, Math.log10(Math.max(10, amount)) / 5);   // 100 豆≈.4，10 万≈1
  const t = Math.max(rel * .85, mag * .9);
  const div = streams > 6 ? 2 : streams > 3 ? 1.5 : 1;
  return {
    t: t,
    n: Math.max(8, Math.round((12 + t * 40) / div)),   // 一大堆小豆子
    size: Math.round(9 + t * 7),                       // 9 ~ 16px
    dur: 1.15 + t * .3,
    spread: 22 + t * 26                                // 横向散开幅度
  };
}
/* 欢乐豆从输家的账户「流」到赢家的账户：一大堆小豆子沿直线连续飞过去，
   每颗有一点随机偏移，整体像一股豆流。 */
function flyBeansRect(a, b, amount, streams, ref, durSec) {
  if (!a || !b || REDUCED) return;
  const layer = $('#flyLayer');
  const sc = beanScale(amount, ref, streams || 1);
  const n = sc.n, half = sc.size / 2;
  const ax = a.left + a.width / 2 - half, ay = a.top + a.height / 2 - half;
  const dx = (b.left + b.width / 2 - half) - ax, dy = (b.top + b.height / 2 - half) - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;                 // 垂直方向，只用来做小幅散开
  const frag = document.createDocumentFragment(), els = [];
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'fly-bean';
    d.style.cssText = 'left:' + ax + 'px;top:' + ay + 'px;width:' + sc.size + 'px;height:' + sc.size + 'px';
    frag.appendChild(d); els.push(d);
  }
  layer.appendChild(frag);
  const dur = durSec || sc.dur;
  els.forEach((d, i) => {
    const off = (Math.random() - .5) * sc.spread;      // 每颗豆偏离直线一点点
    const off2 = (Math.random() - .5) * sc.spread * .5;
    const mx = dx * .5 + nx * off, my = dy * .5 + ny * off;
    removeAfter(d, anim(d, {
      x: [0, mx, dx + nx * off2], y: [0, my, dy + ny * off2],
      scale: [.35, 1, .55], opacity: [0, 1, 1, 0]
    }, { duration: dur, delay: i * (.75 / n), ease: 'linear' }));   // 密集连续，像一股流
  });
}
function flyBeans(fromEl, toEl, amount) {
  if (!fromEl || !toEl) return;
  const a = rectOf(fromEl), b = rectOf(toEl);
  pulseRingRect(a, 'lose'); flyBeansRect(a, b, amount, 1, amount); pulseRingRect(b);
}
/* ---------------- 结算标（三种玩法共用） ----------------
   一枚徽章 + 牌型/说明，外面裹一圈火（名次越靠前烧得越旺），
   输赢豆单独一行放在标的外面 —— 放里面数字一出现会把框撑大。
   火焰素材 icons/flamering.png 里预先画好了 5 个档位的整圈火。 */
function fireLevel(fire) {
  if (!fire || fire <= .04) return 0;
  return Math.max(1, Math.min(5, 6 - Math.round(fire * 5)));
}
/* 名次 → 火势：第 1 名满格，最后一名最弱（n 是参与比较的人数） */
function rankFire(rank, n) {
  n = Math.max(1, n || 4);
  return Math.max(0, Math.min(1, (n - rank + 1) / n));
}
function ensureResultTag(host, atTop, side, amtHost) {
  let wrap = host.querySelector(':scope > .tag-wrap');
  if (wrap) return wrap;
  wrap = document.createElement('div');
  wrap.className = 'tag-wrap';
  wrap.style.visibility = 'hidden';
  wrap.innerHTML = '<div class="flames"><i style="animation-delay:-'
    + (Math.random() * 1.4).toFixed(2) + 's"></i></div><div class="reveal-tag"></div>';
  if (Math.random() < .5) wrap.dataset.mir = '1';      // 左右翻一下，几家的火不至于一模一样
  const amt = document.createElement('div');
  amt.className = 'amt-line'; amt.style.visibility = 'hidden';
  if (side) amt.dataset.side = side;
  if (amtHost && amtHost !== host) {            // 输赢豆挂到另一个容器（斗仙放在这一界的底标行）
    host.appendChild(wrap); amtHost.appendChild(amt);
  } else if (atTop) { host.insertBefore(amt, host.firstChild); host.insertBefore(wrap, host.firstChild); }
  else { host.appendChild(wrap); host.appendChild(amt); }
  wrap._amt = amt;
  return wrap;
}
/* o = { badge, rk, html, fire, delta, first, atTop, sm, amtSide }
   badge 为 null 时不画徽章；徽章变了会弹一下（名次被后面的人挤动时用）。 */
function setResultTag(host, o) {
  const wrap = ensureResultTag(host, o.atTop, o.amtSide, o.amtHost);
  const tag = wrap.querySelector('.reveal-tag');
  const firstShow = wrap.style.visibility === 'hidden';
  const key = o.badge == null ? '' : String(o.badge);
  const bumped = !firstShow && wrap.dataset.badge !== undefined && wrap.dataset.badge !== key;
  wrap.dataset.badge = key;
  wrap.style.visibility = 'visible';
  wrap.className = 'tag-wrap' + (o.sm ? ' sm' : '');
  tag.className = 'reveal-tag' + (o.first ? ' first' : '');
  tag.innerHTML = (o.badge == null ? ''
    : '<span class="rank-badge rank-big rk' + (o.rk || Math.min(4, +o.badge || 1)) + '">' + o.badge + '</span>')
    + (o.html || '');
  const lv = fireLevel(o.fire);
  const fl = wrap.querySelector('.flames');
  fl.className = 'flames' + (lv ? ' lv' + lv : '') + (wrap.dataset.mir ? ' mir' : '');
  fl.style.display = lv ? '' : 'none';
  const amt = wrap._amt || wrap.parentNode.querySelector(':scope > .amt-line');
  if (amt) {
    if (o.delta) {
      const isNew = amt.style.visibility === 'hidden';
      amt.className = 'amt-line ' + (o.delta > 0 ? 'up' : 'dn') + (o.sm ? ' sm' : '')
        + (amt.dataset.side ? ' at-' + amt.dataset.side : '');
      amt.style.visibility = 'visible';
      amt.textContent = (o.delta > 0 ? '+' : '') + fmt(o.delta);
      if (isNew) anim(amt, { opacity: [0, 1], scale: [.5, 1.25, 1] },
        { duration: .5, ease: MO ? Motion.backOut : 'ease-out' });
    } else {
      amt.className = 'amt-line' + (o.sm ? ' sm' : '')
        + (amt.dataset.side ? ' at-' + amt.dataset.side : '');
      amt.style.visibility = 'hidden'; amt.textContent = '';
    }
  }
  if (firstShow) anim(wrap, { opacity: [0, 1], scale: [.6, 1] },
    { duration: .34, ease: MO ? Motion.backOut : 'ease-out' });
  else if (bumped) {
    anim(wrap, { scale: [1, 1.22, 1] }, { duration: .42, ease: 'ease-out' });
    const b = tag.querySelector('.rank-badge');
    if (b) anim(b, { rotate: [0, -14, 10, 0], scale: [1, 1.35, 1] }, { duration: .5, ease: 'ease-out' });
  }
  return wrap;
}
function clearResultTag(host) {
  if (!host) return;
  host.querySelectorAll(':scope > .tag-wrap, :scope > .amt-line').forEach(e => e.remove());
}
/* 并列同名次：cmp(a,b) > 0 表示 a 强 */
function rankList(idx, cmp) {
  const ord = idx.slice().sort((a, b) => cmp(b, a));
  const rk = {}; let cur = 1;
  ord.forEach((p, k) => { if (k > 0 && cmp(p, ord[k - 1]) !== 0) cur = k + 1; rk[p] = cur; });
  return rk;
}

/* 结算演示：豆从输家的「账户」飞到赢家的「账户」，分三步走清楚
   1) 输家亮红圈 + 冒 −N          （看清豆从谁那儿出去）
   2) 稍等一下再发豆，慢慢飞过去   （看清路线）
   3) 到账时赢家亮金圈 + 冒 +N，同时豆数滚动
   anchors 传各家显示豆数的那个元素，deltas 是本次每家的净输赢。
   opt.labels=false 时不冒 ±N 的字（三国牌已经在名次牌旁边显示过了，
   账户上再冒一遍就重复了），高亮圈还留着，起点终点仍然看得清。
   返回整段演示需要的毫秒数。 */
function settleBeans(anchors, deltas, onArrive, opt) {
  const showLabel = !(opt && opt.labels === false);
  const wins = [], loses = [];
  deltas.forEach((d, i) => { if (d > 0) wins.push([i, d]); else if (d < 0) loses.push([i, -d]); });
  if (!wins.length || !loses.length) { if (onArrive) onArrive(); return 0; }
  const rects = anchors.map(e => e ? rectOf(e) : null);   // 坐标只读这一次
  const totalWin = wins.reduce((s, w) => s + w[1], 0) || 1;
  const streams = wins.length * loses.length;
  const ref = Math.max.apply(null, deltas.map(Math.abs));
  const FLY = 1500, LEAD = 420;                          // 飞行时长 / 起飞前的停顿

  /* 1) 先标出「豆从这几家出去」 */
  loses.forEach(([li, la]) => {
    pulseRingRect(rects[li], 'lose');
    if (showLabel) floatBean(anchors[li], -la);
  });
  /* 2) 停一下再发豆，让人看清起点 */
  setTimeout(() => {
    loses.forEach(([li, la]) => {
      wins.forEach(([wi, wa]) => {
        const share = la * (wa / totalWin);
        if (share > 0) flyBeansRect(rects[li], rects[wi], share, streams, ref, FLY / 1000);
      });
    });
  }, LEAD);
  /* 3) 到账 */
  setTimeout(() => {
    wins.forEach(([wi, wa]) => { pulseRingRect(rects[wi]); if (showLabel) floatBean(anchors[wi], wa); });
    if (onArrive) onArrive();
  }, LEAD + FLY - 120);
  return LEAD + FLY + 700;
}
/* 兼容旧调用 */
function beanFlow(anchors, deltas) { settleBeans(anchors, deltas); }

/* 结算封顶：每次结算不能超过场次封顶，也不能超过输家全部欢乐豆 */
function capPay(amount, loserBeans, cap) {
  amount = Math.max(0, Math.round(amount));
  if (cap) amount = Math.min(amount, cap);
  if (typeof loserBeans === 'number') amount = Math.min(amount, Math.max(0, loserBeans));
  return amount;
}
/* 数字滚动 + 飘豆动画（斗仙牌结算用） */
function animNumber(el, from, to, ms) {
  if (!el) return;
  if (REDUCED || from === to) { el.textContent = fmt(to); return; }
  ms = ms || 900;
  el.style.fontVariantNumeric = 'tabular-nums';   // 等宽数字，滚动时宽度不变，不会带动重排
  const t0 = performance.now();
  let last = -1;
  (function tick(now) {
    const k = Math.min(1, (now - t0) / ms);
    if (now - last > 45 || k === 1) {             // 限到 ~22fps，够顺且省一半的排版开销
      last = now;
      el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    }
    if (k < 1) requestAnimationFrame(tick);
  })(t0);
}
function floatBean(anchor, delta) {
  if (!anchor || !delta) return;
  if (getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';
  const w = document.createElement('div'); w.className = 'float-wrap';
  const d = document.createElement('div');
  d.className = 'float-bean ' + (delta > 0 ? 'up' : 'dn');
  d.innerHTML = '<span class="bean"><i></i></span>' + (delta > 0 ? '+' : '') + fmt(delta);
  w.appendChild(d); anchor.appendChild(w);
  removeAfter(w, anim(d, {
    y: [14, 0, -4, -26, -44],
    scale: [.55, 1.3, 1, 1, 1],
    opacity: [0, 1, 1, 1, 0]
  }, { duration: 1.9, ease: EASE_OUT }));
}
/* 通用按钮生成 */
function actBtn(txt, cls, fn) {
  const b = document.createElement('button');
  b.className = 'btn sm' + (cls ? ' ' + cls : ''); b.textContent = txt; b.onclick = fn;
  $('#actBar').appendChild(b); return b;
}

/* =====================================================================
   启动
   ===================================================================== */
/* 横屏时大厅用三栏布局 */
/* 量一次 env(safe-area-inset-*)：CSS 里取不到数值，只能靠一个探针元素 */
function safeInsets() {
  let p = $('#safeProbe');
  if (!p) {
    p = document.createElement('div'); p.id = 'safeProbe';
    p.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;height:0;visibility:hidden;'
      + 'padding:env(safe-area-inset-top) env(safe-area-inset-right)'
      + ' env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(p);
  }
  const c = getComputedStyle(p);
  return { t: parseFloat(c.paddingTop) || 0, r: parseFloat(c.paddingRight) || 0,
    b: parseFloat(c.paddingBottom) || 0, l: parseFloat(c.paddingLeft) || 0 };
}
function fitLayout() {
  const vw = window.innerWidth, vh = window.innerHeight, rot = vh > vw;
  document.body.classList.toggle('force-rot', rot);
  document.body.classList.add('land');            // 永远按横屏排版
  const app = $('#app');
  if (!app) return;
  const st = document.body.style;
  if (!rot) {
    ROT = false; app.style.width = ''; app.style.height = '';
    ['--rot-t', '--rot-r', '--rot-b', '--rot-l'].forEach(k => st.removeProperty(k));
    return;
  }
  ROT = true;
  app.style.width = vh + 'px';                     // 旋转 90°，宽高对调；铺满整屏
  app.style.height = vw + 'px';
  const si = safeInsets();
  // 转过来之后：屏幕上边 = 界面左边（灵动岛那条），屏幕下边 = 界面右边（home 条）。
  // 灵动岛这侧留个底，env 万一取不到 0 也不至于压住头像。
  st.setProperty('--rot-l', Math.max(si.t, 34) + 'px');
  st.setProperty('--rot-r', Math.max(si.b, 12) + 'px');
  st.setProperty('--rot-t', Math.max(si.r, 4) + 'px');
  st.setProperty('--rot-b', Math.max(si.l, 4) + 'px');
}
function bootstrap() {
  S = loadSave();
  fitLayout();
  window.addEventListener('resize', fitLayout);
  window.addEventListener('orientationchange', () => setTimeout(fitLayout, 200));
  $$('.gcard').forEach(el => el.onclick = () => gotoMatch(el.dataset.game));
  $('#btnShop').onclick = openShop;
  $('#btnMe').onclick = openMe;
  $('#myName').onclick = openMe;
  $('#btnRematch').onclick = runMatch;
  $('#btnMatchBack').onclick = () => { clearInterval(matchTimer); show('lobby'); };
  $('#btnMatchStart').onclick = () => { clearInterval(matchTimer); startGame(); };
  $('#mask').addEventListener('click', e => { if (e.target.id === 'mask') closeModal(); });
  $('#btnRulesTable').onclick = () => { if (ctx) showRules(ctx.game.key); };
  $('#btnQuit').onclick = () => {
    if (ctx && !ctx.over) {
      openModal('<h2>退出牌局</h2><p>牌局尚未结束，中途退出将不结算本局输赢。确定退出？</p>'
        + '<div class="foot"><button class="btn red sm" data-y>确定退出</button><button class="btn grey sm" data-n>继续游戏</button></div>');
      $('#modal [data-y]').onclick = () => { closeModal(); quitGame(); };
      $('#modal [data-n]').onclick = closeModal;
    } else quitGame();
  };
  $('#btnRulesLobby').onclick = () => {
    openModal('<h2>玩法说明</h2><p>点击查看各玩法的详细规则。</p>'
      + '<div class="foot"><button class="btn sm" data-g="baque">八雀牌</button>'
      + '<button class="btn sm" data-g="douxian">斗仙牌</button>'
      + '<button class="btn sm" data-g="sanguo">三国牌</button></div>'
      + '<p style="margin-top:12px;font-size:11px;color:#9fc9b1">本作为离线单机娱乐版本，欢乐豆与充值均为模拟数据，不涉及任何真实货币或账号。</p>');
    $$('#modal [data-g]').forEach(b => b.onclick = () => showRules(b.dataset.g));
  };
  $('#btnHardReload').onclick = hardReload;
  $('#verTag').onclick = openVersion;
  $('#verTag').textContent = 'v' + APP_VERSION;
  $('#btnReset').onclick = () => {
    openModal('<h2>重置数据</h2><p>将清空昵称、欢乐豆与战绩，恢复初始 1,000,000 豆。确定？</p>'
      + '<div class="foot"><button class="btn red sm" data-y>确定重置</button><button class="btn grey sm" data-n>取消</button></div>');
    $('#modal [data-y]').onclick = () => { localStorage.removeItem(SAVE_KEY); S = loadSave(); refreshMe(); closeModal(); toast('已重置'); };
    $('#modal [data-n]').onclick = closeModal;
  };
  refreshMe();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http'))
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
  // 支持的平台（安卓 / 桌面 PWA）直接锁横屏；iOS 不支持，靠上面的旋转兜底
  try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { }); } catch (e) { }
  setTimeout(checkUpdate, 1200);
}
function showRules(k) {
  openModal(GAMES[k].rules + '<div class="foot"><button class="btn sm" data-ok>知道了</button></div>');
  $('#modal [data-ok]').onclick = closeModal;
}
