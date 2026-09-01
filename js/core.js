/* =====================================================================
   三合棋牌 · 核心：工具 / 存档 / 商城 / 匹配 / 牌桌外壳
   ===================================================================== */
'use strict';

/* 版本号：发版时和 sw.js 里的 CACHE 一起改 */
const APP_VERSION = '1.7.0';
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
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = txt;
  ($('#table').classList.contains('on') ? $('#table') : $('#app')).appendChild(d);
  setTimeout(() => d.remove(), ms || 1100);
}
function bigWin(txt, ms) {
  const d = document.createElement('div'); d.className = 'bigwin'; d.textContent = txt;
  $('#table').appendChild(d); setTimeout(() => d.remove(), ms || 1500);
}
function openModal(html) { $('#modal').innerHTML = html; $('#mask').classList.add('on'); $('#modal').scrollTop = 0; }
function closeModal() { $('#mask').classList.remove('on'); }
function show(id) { $$('.screen').forEach(s => s.classList.toggle('on', s.id === id)); }

/* ---------------- 强制刷新 / 版本信息 ---------------- */
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
  openModal('<h2>我的资料</h2><p>昵称：<b id="mnm">' + S.name + '</b> <button class="btn xs grey" data-rn>随机换名</button></p>'
    + '<p style="margin-top:7px">头像：<span id="mav" style="font-size:20px">' + S.avatar + '</span> <button class="btn xs grey" data-ra>随机换头像</button></p>'
    + '<h4>数据</h4><ul><li>欢乐豆：<b class="gold-txt">' + fmt(S.beans) + '</b></li>'
    + '<li>累计对局：' + S.games + ' 局，胜 ' + S.wins + ' 局</li>'
    + '<li>模拟充值：¥ ' + S.totalRecharge + '</li></ul>'
    + '<div class="foot"><button class="btn sm" data-close>关闭</button></div>');
  $('#modal [data-rn]').onclick = () => { S.name = randomNick(); $('#mnm').textContent = S.name; refreshMe(); };
  $('#modal [data-ra]').onclick = () => { S.avatar = pick(AVATARS); $('#mav').textContent = S.avatar; refreshMe(); };
  $('#modal [data-close]').onclick = closeModal;
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
const rectOf = el => el.getBoundingClientRect();
/* 一叠牌从 a 飞到 b */
function flyCards(cards, fromRect, toRect, opts) {
  opts = opts || {};
  return new Promise(res => {
    const layer = $('#flyLayer'), step = opts.step || 12, cls = opts.cls || 'tiny';
    if (!cards.length) return res();
    cards.forEach((c, i) => {
      const e = opts.back ? backEl('') : cardEl(c, cls);
      if (opts.cw) {
        e.style.setProperty('--cw', opts.cw + 'px');
        if (opts.back) { e.style.width = opts.cw + 'px'; e.style.height = Math.round(opts.cw * 1.44) + 'px'; }
      }
      e.classList.add('fly-card');
      e.style.left = fromRect.left + 'px'; e.style.top = fromRect.top + 'px';
      layer.appendChild(e);
      const dx = toRect.left - fromRect.left + i * step, dy = toRect.top - fromRect.top;
      requestAnimationFrame(() => {
        e.style.transitionDelay = (i * 70) + 'ms';
        e.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + (opts.scale || 1) + ')';
        if (opts.fade) e.style.opacity = '0';
      });
      setTimeout(() => e.remove(), 620 + i * 70);
    });
    setTimeout(res, 560 + cards.length * 70);
  });
}
/* 一张牌飞进手牌里它排好序之后的位置 */
async function flyIntoHand(card, fromRect, handEl, cw) {
  const el = handEl.querySelector('[data-id="' + card.id + '"]');
  if (!el) return;
  const to = rectOf(el);
  el.style.visibility = 'hidden';
  await flyCards([card], fromRect, to, { step: 0, cw: cw || 42 });
  el.style.visibility = '';
}
/* 欢乐豆从输家飞到赢家 */
function flyBeans(fromEl, toEl, amount) {
  if (!fromEl || !toEl) return;
  const a = rectOf(fromEl), b = rectOf(toEl), layer = $('#flyLayer');
  const n = Math.max(4, Math.min(12, Math.round(Math.log10(Math.max(10, Math.abs(amount))) * 3)));
  const ax = a.left + a.width / 2 - 7, ay = a.top + a.height / 2 - 7;
  const dx = (b.left + b.width / 2 - 7) - ax, dy = (b.top + b.height / 2 - 7) - ay;
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'fly-bean';
    d.style.left = ax + 'px'; d.style.top = ay + 'px';
    d.style.opacity = '0';
    layer.appendChild(d);
    const jx = (Math.random() - .5) * 46, jy = (Math.random() - .5) * 34;
    requestAnimationFrame(() => {
      d.style.transition = 'transform .85s cubic-bezier(.3,.75,.35,1), opacity .85s';
      d.style.transitionDelay = (i * 60) + 'ms';
      d.style.opacity = '1';
      d.style.transform = 'translate(' + (dx + jx * .18) + 'px,' + (dy + jy * .18) + 'px) scale(.65)';
    });
    setTimeout(() => { d.style.opacity = '0'; }, 740 + i * 60);
    setTimeout(() => d.remove(), 1080 + i * 60);
  }
  toEl.classList.add('win-glow');
  setTimeout(() => toEl.classList.remove('win-glow'), 1300);
}
/* 按每家的净输赢，成对播放飞豆（输家 → 赢家） */
function beanFlow(anchors, deltas) {
  const win = [], lose = [];
  deltas.forEach((d, i) => { if (d > 0) win.push([i, d]); else if (d < 0) lose.push([i, -d]); });
  if (!win.length || !lose.length) return;
  win.sort((a, b) => b[1] - a[1]);
  lose.forEach(([li, la]) => {
    let best = win[0];
    for (const w of win) if (w[1] >= la) { best = w; break; }
    flyBeans(anchors[li], anchors[best[0]], la);
  });
}

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
  ms = ms || 1000; const t0 = performance.now();
  (function tick(now) {
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(tick);
  })(t0);
}
function floatBean(anchor, delta) {
  if (!anchor || !delta) return;
  const host = anchor.style.position ? anchor : anchor;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const d = document.createElement('div');
  d.className = 'float-bean ' + (delta > 0 ? 'up' : 'dn');
  d.innerHTML = '<span class="bean"><i></i></span>' + (delta > 0 ? '+' : '') + fmt(delta);
  d.style.top = '0px';
  host.appendChild(d);
  setTimeout(() => d.remove(), 2300);
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
function fitLayout() {
  document.body.classList.toggle('land', window.innerWidth >= window.innerHeight);
  [...document.querySelectorAll('.hand')].forEach(h => { });
}
function bootstrap() {
  S = loadSave();
  fitLayout();
  window.addEventListener('resize', fitLayout);
  window.addEventListener('orientationchange', () => setTimeout(fitLayout, 200));
  $$('.gcard').forEach(el => el.onclick = () => gotoMatch(el.dataset.game));
  $('#btnShop').onclick = openShop;
  $('#btnMe').onclick = openMe;
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
}
function showRules(k) {
  openModal(GAMES[k].rules + '<div class="foot"><button class="btn sm" data-ok>知道了</button></div>');
  $('#modal [data-ok]').onclick = closeModal;
}
