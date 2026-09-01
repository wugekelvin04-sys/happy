/* =====================================================================
   百变八雀牌（完全按游戏内《玩法规则》实现）
   牌堆 84 张：两副去大小王与 2/3/4/5（6~A ×4花 ×2副 = 72）
               + 新增 4 张 8（全场 12 张 8）+ 4 张癞子 + 4 张机会牌
   4 人，每人 7 张，摸打成 8 张即可胡；第一次胡牌后系统自动接管，
   直到牌堆全部摸完游戏结束（胡牌不离场）
   基础牌组：同花三/四/五/六/八顺　三/四/五/六/八张（没有七）
   结构：8　｜　6+2　｜　5+3　｜　4+4　｜　3+3+2（2 必须是一对）
   ===================================================================== */
'use strict';
const BQ_LO = 6, BQ_HI = 14;

/* 牌面分数：截图可见 A=30、10/9/7=10。
   J/Q/K 与癞子/机会牌的分值官方图未拍到，按常规 30/20/10 档位假定，
   若有确切数值改这里即可。 */
const BQ_CARD_SCORE = { 6: 10, 7: 10, 8: 10, 9: 10, 10: 10, 11: 20, 12: 20, 13: 20, 14: 30 };
const BQ_WILD_SCORE = 20, BQ_CHANCE_SCORE = 10;
function bqCardScore(c) { return c.k === 1 ? BQ_WILD_SCORE : c.k === 2 ? BQ_CHANCE_SCORE : (BQ_CARD_SCORE[c.r] || 10); }

/* 结构：parts 里 pair 索引处必须是一对 */
const BQ_SHAPES = [
  { key: '8', parts: [8], pair: -1 },
  { key: '62', parts: [6, 2], pair: 1 },
  { key: '53', parts: [5, 3], pair: -1 },
  { key: '44', parts: [4, 4], pair: -1 },
  { key: '332', parts: [3, 3, 2], pair: 2 }
];
/* 8 张同点的专属番型 */
const BQ_EIGHT = { 14: '独一无二', 13: '君临天下', 10: '十全十美', 8: '八方来财' };
/* 6+2 的专属番型（两组点数相邻且成对出现时） */
const BQ_SIX_PAIR = { '14-13': '顶峰相见', '12-11': '心心相连', '10-9': '十拿九稳', '7-6': '六事兴旺' };
const CARD_COLOR = { S: 'b', C: 'b', H: 'r', D: 'r' };

/* 单组分析：能否作为「同点组」或「同花顺组」 */
function bqGrp(cards, w, size, pairOnly) {
  const res = { set: null, run: null };
  if (cards.length + w !== size) return res;
  const ranks = cards.map(c => c.r);
  if (new Set(ranks).size <= 1) res.set = { rank: ranks.length ? ranks[0] : null };
  if (pairOnly) return res;
  if (new Set(ranks).size === cards.length) {
    const suits = new Set(cards.map(c => c.s));
    if (suits.size <= 1) {
      let best = -1;
      const mn = cards.length ? Math.min.apply(null, ranks) : BQ_LO;
      const mx = cards.length ? Math.max.apply(null, ranks) : BQ_LO;
      for (let hi = BQ_HI; hi >= BQ_LO + size - 1; hi--) {
        const lo = hi - size + 1;
        if (lo < BQ_LO) continue;
        if (cards.length && (mn < lo || mx > hi)) continue;
        best = hi; break;
      }
      if (best > 0) res.run = { high: best, suit: suits.size ? [...suits][0] : null };
    }
  }
  return res;
}
const adjacent = (a, b) => a !== null && b !== null && Math.abs(a - b) === 1;
/* 八张牌是否同颜色（癞子/机会牌不限颜色） */
function sameColor(cards) {
  const cs = new Set(cards.filter(c => c.k === 0).map(c => CARD_COLOR[c.s]));
  return cs.size <= 1;
}
function bqFan(key, g, all) {
  switch (key) {
    case '8':
      if (g[0].kind === 'set' && BQ_EIGHT[g[0].rank]) return [BQ_EIGHT[g[0].rank], 100];
      return ['八方来贺', 50];                       // 八张同花顺，或其他点数的 8 炸
    case '62': {
      const big = g[0], p = g[1];
      if (big.kind === 'set' && adjacent(big.rank, p.rank)) {
        const hi = Math.max(big.rank, p.rank), lo = Math.min(big.rank, p.rank);
        const nm = BQ_SIX_PAIR[hi + '-' + lo];
        if (nm) return [nm, 32];
        return ['比翼为邻', 16];
      }
      if (sameColor(all)) return ['六朝金粉', 16];
      return ['六六大顺', 8];
    }
    case '53': {
      const a = g[0], b = g[1];
      if (a.kind === 'set' && b.kind === 'set' && adjacent(a.rank, b.rank)) return ['永恒相随', 8];
      if (sameColor(all)) return ['五谷丰登', 8];
      return ['五福临门', 4];
    }
    case '44': {
      const a = g[0], b = g[1];
      if (a.kind === 'set' && b.kind === 'set' && adjacent(a.rank, b.rank)) return ['二龙腾飞', 4];
      if (sameColor(all)) return ['四季发财', 4];
      return ['四季如春', 2];
    }
    case '332': return ['平胡', 1];
  }
  return null;
}

const _bqCache = new Map();
/* 8 张判胡；官方：手中有癞子时不能胡 3+3+2 平胡 */
function bqHu(cards8) {
  if (!cards8 || cards8.length !== 8) return null;
  const sig = cards8.map(c => c.k ? 'W' + c.k : c.r + c.s).sort().join('|');
  if (_bqCache.has(sig)) return _bqCache.get(sig);
  const cs = cards8.filter(c => !isWild(c));
  const usedWild = cs.length < 8;
  let best = null;
  for (const sh of BQ_SHAPES) {
    const parts = sh.parts, buckets = parts.map(() => []);
    const rec = i => {
      if (i === cs.length) {
        const opts = [];
        for (let p = 0; p < parts.length; p++) {
          const info = bqGrp(buckets[p], parts[p] - buckets[p].length, parts[p], sh.pair === p);
          const list = [];
          if (info.set) list.push({ kind: 'set', rank: info.set.rank });
          if (info.run) list.push({ kind: 'run', rank: info.run.high, suit: info.run.suit });
          if (!list.length) return;
          opts.push(list);
        }
        const walk = (k, acc) => {
          if (k === opts.length) {
            const f = bqFan(sh.key, acc, cards8);
            if (f && (!best || f[1] > best.mult)) best = { name: f[0], mult: f[1], shape: sh.key };
            return;
          }
          for (const o of opts[k]) walk(k + 1, acc.concat([o]));
        };
        walk(0, []);
        return;
      }
      for (let p = 0; p < parts.length; p++) {
        if (buckets[p].length >= parts[p]) continue;
        if (p > 0 && parts[p] === parts[p - 1] && sh.pair !== p - 1 && buckets[p - 1].length === 0) continue;
        buckets[p].push(cs[i]); rec(i + 1); buckets[p].pop();
      }
    };
    rec(0);
  }
  if (best) {
    best.hard = !usedWild;                          // 硬气：手中没有癞子
    if (usedWild && best.shape === '332') best = null;   // 大胡：有癞子不能平胡
  }
  _bqCache.set(sig, best || null);
  return best || null;
}
/* 7 张听牌分析 */
function bqWaits(hand7, seen) {
  const out = []; let bestMult = 0;
  for (let r = BQ_LO; r <= BQ_HI; r++) for (const s of SUITS) {
    const total = r === 8 ? 3 : 2;
    const left = total - (seen ? (seen[r + s] || 0) : 0);
    if (left <= 0) continue;
    const h = bqHu(hand7.concat([{ id: -1, r: r, s: s, k: 0 }]));
    if (h) { out.push({ r: r, s: s, mult: h.mult, left: left }); if (h.mult > bestMult) bestMult = h.mult; }
  }
  return { waits: out, bestMult: bestMult };
}
/* 一手牌里「不属于任何特定牌型」的牌的分数（输家分数用）
   最大化能成组的分数，剩下的算负分 */
function bqDeadScore(cards) {
  const n = cards.length;
  const groups = [];
  for (let mask = 1; mask < (1 << n); mask++) {
    let k = 0; for (let i = 0; i < n; i++) if (mask & (1 << i)) k++;
    if (k < 3 || k === 7 || k > 8) continue;
    const g = []; for (let i = 0; i < n; i++) if (mask & (1 << i)) g.push(cards[i]);
    const w = g.filter(isWild).length, cs = g.filter(c => !isWild(c));
    const f = bqGrp(cs, w, k, false);
    if (!f.set && !f.run) continue;
    groups.push({ mask: mask, score: g.reduce((s, c) => s + bqCardScore(c), 0) });
  }
  const best = new Array(1 << n).fill(0);           // best[used] = 已成组的最大分数
  for (let used = 0; used < (1 << n); used++) {
    if (best[used] < 0) continue;
    for (const g of groups) {
      if (used & g.mask) continue;
      const nx = used | g.mask;
      if (best[nx] < best[used] + g.score) best[nx] = best[used] + g.score;
    }
  }
  const total = cards.reduce((s, c) => s + bqCardScore(c), 0);
  return total - Math.max.apply(null, best);        // 剩下没成组的分数
}
function bqSort(a, b) {
  if (a.k !== b.k) return b.k - a.k;
  if (a.r !== b.r) return a.r - b.r;
  return SUITS.indexOf(a.s) - SUITS.indexOf(b.s);
}

class BaqueGame {
  constructor(c) {
    this.c = c; this.P = c.players; this.n = 4;
    this.delta = [0, 0, 0, 0]; this.hands = [[], [], [], []];
    this.hus = [0, 0, 0, 0]; this.turns = [0, 0, 0, 0];
    this.roundNo = 1;
    this.wall = []; this.discard = []; this.pool = []; this.dead = 0;
    this.seen = {}; this.sel = new Set();
    this.turn = 0; this.drawn = null;
  }
  buildDeck() {
    const d = [];
    for (let k = 0; k < 2; k++) for (let r = BQ_LO; r <= BQ_HI; r++) for (const s of SUITS) d.push(mkCard(r, s, 0));
    for (const s of SUITS) d.push(mkCard(8, s, 0));          // 新增 4 张 8 → 全场 12 张 8
    for (let i = 0; i < 4; i++) d.push(mkCard(0, 'W', 1));   // 癞子
    for (let i = 0; i < 4; i++) d.push(mkCard(0, 'W', 2));   // 机会牌
    return shuffle(d);
  }
  run() { this.layout(); this.newDeal(); }
  /* 发一轮新牌 */
  newDeal() {
    _bqCache.clear();
    this.wall = this.buildDeck();
    this.hands = [[], [], [], []];
    for (let i = 0; i < 4; i++) this.hands[i] = this.wall.splice(0, 7).sort(bqSort);
    this.pool = []; this.discard = []; this.dead = 0; this.seen = {};
    this.turns = [0, 0, 0, 0]; this.sel = new Set(); this.drawn = null;
    this.phase = ''; this.turn = 0;
    this.c.act.innerHTML = '';
    $('#tInfo').textContent = '底分 ' + fmt(this.c.base) + ' · 第 ' + this.roundNo + ' 轮';
    this.render();
    setTimeout(() => this.step(), 600);
  }
  layout() {
    const b = this.c.body;
    [...b.querySelectorAll('.seat-chip,.play-slot,.center-zone')].forEach(e => e.remove());
    this.seats = []; this.slots = [];
    const R = RING[4];
    for (let i = 1; i < 4; i++) {
      const el = mkSeat(this.P[i], R[i], '<span class="hs">7 张</span>');
      const bk = backEl(7); bk.style.cssText += ';position:absolute;' + (R[i].rev ? 'left:-24px;' : 'right:-24px;') + 'top:2px';
      el.style.position = 'absolute'; el.appendChild(bk);
      b.appendChild(el); this.seats[i] = el;
      const sl = mkPlaySlot(R[i]); b.appendChild(sl); this.slots[i] = sl;
    }
    this.slots[0] = mkPlaySlot(R[0]); b.appendChild(this.slots[0]);
    this.center = document.createElement('div'); this.center.className = 'center-zone';
    b.appendChild(this.center);
    this.anchors = [$('.me-bar'), this.seats[1], this.seats[2], this.seats[3]];
  }
  render() {
    for (let i = 1; i < 4; i++) {
      const e = this.seats[i];
      e.querySelector('.hs').innerHTML = this.hands[i].length + '张'
        + (this.hus[i] ? ' <b class="gold-txt">胡' + this.hus[i] + '</b>' : '');
      e.querySelector('.cardback-count').textContent = this.hands[i].length;
      e.querySelector('.bn').textContent = fmt(Math.max(0, this.P[i].beans + this.delta[i]));
      e.classList.toggle('turn', this.turn === i && !this.c.over);
    }
    $('#tMyBeans').textContent = fmt(Math.max(0, this.P[0].beans + this.delta[0]));
    this.center.innerHTML = '';
    const pickable = this.phase === 'draw' && this.turn === 0 && !this.c.over;
    const area = document.createElement('div'); area.className = 'deck-area';
    /* 牌堆（点它 = 摸牌） */
    const pile = document.createElement('div'); pile.className = 'deck-pile' + (pickable ? ' hot' : '');
    const bk = backEl(''); pile.appendChild(bk);
    const num = document.createElement('div'); num.className = 'num'; num.textContent = this.wall.length;
    pile.appendChild(num);
    if (pickable) pile.onclick = () => { this.c.act.innerHTML = ''; this.drawCard(0); };
    const pileWrap = document.createElement('div');
    pileWrap.appendChild(pile);
    const cap = document.createElement('div'); cap.className = 'deck-cap';
    cap.textContent = pickable ? '点这里摸牌' : '牌堆';
    pileWrap.appendChild(cap);
    area.appendChild(pileWrap);
    /* 待选底池（最近 4 张） */
    const poolWrap = document.createElement('div');
    const pa = document.createElement('div'); pa.className = 'pool-area';
    if (!this.pool.length) { const em = document.createElement('span'); em.className = 'pool-empty'; em.textContent = '底池暂无牌'; pa.appendChild(em); }
    this.pool.forEach(d => {
      const e = cardEl(d.c, '');
      if (pickable) { e.classList.add('hot'); e.onclick = () => this.takeFromPool(d); }
      else e.style.filter = 'brightness(.85)';
      pa.appendChild(e);
    });
    poolWrap.appendChild(pa);
    const cap2 = document.createElement('div'); cap2.className = 'deck-cap';
    cap2.textContent = (pickable ? '点一张直接拿走' : '底池（最近 4 张）') + (this.dead ? '　已废 ' + this.dead : '');
    poolWrap.appendChild(cap2);
    area.appendChild(poolWrap);
    this.center.appendChild(area);
    this.deckEl = pile; this.poolEl = pa;
    for (let i = 0; i < 4; i++) {
      this.slots[i].innerHTML = '';
      const last = this.discard[this.discard.length - 1];
      if (last && last.by === i && !last.dead) this.slots[i].appendChild(cardEl(last.c, 'tiny'));
    }
    const hd = this.c.hand; hd.innerHTML = '';
    fitHand(hd, this.hands[0].length, 42);
    this.hands[0].forEach(c => {
      const e = cardEl(c); e.style.setProperty('--cw', '42px');
      if (this.sel.has(c.id)) e.classList.add('sel');
      if (this.drawn === c.id) e.style.marginLeft = '10px';
      e.onclick = () => {
        if (this.c.over || this.phase !== 'play' || this.hands[0].length !== 8) return;
        this.sel = new Set([c.id]); this.render();
      };
      hd.appendChild(e);
    });
    let ex = '第 ' + this.roundNo + ' 轮' + (this.hus[0] ? ' · 已胡 ' + this.hus[0] + ' 次' : '');
    if (!ex && this.hands[0].length === 7) {
      const w = bqWaits(this.hands[0], this.seen);
      if (w.waits.length) ex = '听' + w.waits.length + '种·最高' + w.bestMult + '番';
    }
    $('#tMyExtra').textContent = ex;
  }
  markSeen(c) { if (!isWild(c)) this.seen[c.r + c.s] = (this.seen[c.r + c.s] || 0) + 1; }

  /* ---------- 主循环 ---------- */
  async step() {
    if (this.c.over) return;
    if (!this.wall.length) return this.finish();
    const i = this.turn;
    if (i === 0) { this.phase = 'draw'; this.render(); return this.myDraw(); }
    await sleep(420 + rnd(240));
    if (this.c.over) return;
    const pick = this.aiPick(i);
    if (pick) await this.takeCard(i, pick, false);
    else await this.drawCard(i);
  }
  /* 玩家自己选：摸牌 或 从最近 4 张里捡一张 */
  myDraw() {
    const a = this.c.act; a.innerHTML = '';
    const tip = document.createElement('span'); tip.className = 'pill'; tip.style.fontSize = '11px';
    tip.textContent = this.pool.length ? '点牌堆摸牌，或从底池点一张拿走' : '点中间的牌堆摸牌';
    a.appendChild(tip);
    this.tingBtn();
  }
  takeFromPool(d) {
    if (this.phase !== 'draw' || this.turn !== 0 || this.c.over) return;
    this.c.act.innerHTML = '';
    this.takeCard(0, d, false);
  }
  /* 从牌堆摸一张 */
  async drawCard(i) {
    const lastCard = this.wall.length === 1;
    const c = this.wall.shift();
    const fromDeck = this.deckEl ? rectOf(this.deckEl) : null;
    this.hands[i].push(c); this.hands[i].sort(bqSort);
    this.turns[i]++;
    if (i === 0) { this.drawn = c.id; this.sel = new Set(); }
    this.phase = 'play'; this.render();
    if (fromDeck) {
      if (i === 0) await flyIntoHand(c, fromDeck, this.c.hand, 42);
      else flyCards([c], fromDeck, rectOf(this.seats[i]), { cls: 'tiny', step: 0, back: true });
    }
    await this.afterGet(i, { zimo: true, dihu: this.turns[i] === 1, haidi: lastCard });
  }
  /* 从可捡区拿一张（不算自摸） */
  async takeCard(i, d, silent) {
    const from = this.poolEl ? rectOf(this.poolEl) : rectOf(this.center);
    this.pool = this.pool.filter(x => x !== d);
    this.hands[i].push(d.c); this.hands[i].sort(bqSort);
    this.turns[i]++;
    if (i === 0) { this.drawn = d.c.id; this.sel = new Set(); }
    this.phase = 'play'; this.render();
    if (i === 0) await flyIntoHand(d.c, from, this.c.hand, 42);
    else flyCards([d.c], from, rectOf(this.seats[i]), { cls: 'tiny', step: 0 });
    if (!silent && i !== 0) say(this.seats[i], '捡牌！');
    await this.afterGet(i, { zimo: false, dihu: false, haidi: false });
  }
  /* 拿到牌之后：能胡就胡，否则打一张 */
  async afterGet(i, ev) {
    this.curEv = ev;
    const hu = bqHu(this.hands[i]);
    if (i === 0) return this.myTurn(hu, ev);
    await sleep(420 + rnd(240));
    if (this.c.over) return;
    if (hu) { await this.doHu(i, hu, ev, null); return this.next(); }
    await this.playOut(i, this.bestDiscard(i).card);
  }
  /* 人机决定要不要捡牌：能直接胡就捡，能明显改善听牌也捡 */
  aiPick(i) {
    if (!this.pool.length) return null;
    const base = bqWaits(this.hands[i], this.seen);
    const baseCnt = base.waits.reduce((s, x) => s + x.left, 0);
    let best = null;
    for (const d of this.pool) {
      const h8 = this.hands[i].concat([d.c]);
      if (bqHu(h8)) return d;                          // 捡了直接胡
      let bestAfter = -1;
      for (const c of h8) {
        const w = bqWaits(h8.filter(x => x.id !== c.id), this.seen);
        const cnt = w.waits.reduce((s, x) => s + x.left, 0) * 100 + w.bestMult * 6;
        if (cnt > bestAfter) bestAfter = cnt;
      }
      if (!best || bestAfter > best.v) best = { d: d, v: bestAfter };
    }
    return best && best.v > baseCnt * 100 + base.bestMult * 6 + 60 ? best.d : null;
  }
  myTurn(hu, ev) {
    const a = this.c.act; a.innerHTML = '';
    if (hu) {
      const mult = hu.mult * (ev.dihu ? 16 : ev.haidi ? 4 : 1) * (ev.zimo ? 3 : 1);
      actBtn('胡 ' + hu.name + ' ' + hu.mult + '番', 'red', async () => {
        a.innerHTML = ''; await this.doHu(0, hu, ev, null); this.next();
      });
      toast('可胡 ' + hu.name + '　总倍数 ×' + mult + (hu.hard ? '（硬气结算两次）' : ''), 1800);
    }
    actBtn('提示', 'grey', () => { this.sel = new Set([this.bestDiscard(0).card.id]); this.render(); });
    this.tingBtn();
    actBtn('打出', '', async () => {
      if (!this.sel.size) return toast('请先选一张要打出的牌');
      const card = this.hands[0].find(x => this.sel.has(x.id));
      a.innerHTML = ''; await this.playOut(0, card);
    });
  }
  /* 听牌提示：点开看能胡哪些牌、各几番 */
  tingBtn() {
    const hand = this.hands[0].length === 8 && this.sel.size
      ? this.hands[0].filter(c => !this.sel.has(c.id)) : this.hands[0].slice(0, 7);
    const w = bqWaits(hand, this.seen);
    const b = actBtn(w.waits.length ? '听 ' + w.waits.length + ' 种' : '未听牌', 'blue', () => this.showTing());
    if (!w.waits.length) b.classList.add('grey');
    return b;
  }
  showTing() {
    const full = this.hands[0].length === 8;
    const hand = full && this.sel.size ? this.hands[0].filter(c => !this.sel.has(c.id)) : this.hands[0].slice(0, 7);
    const w = bqWaits(hand, this.seen);
    let h = '<h2>听牌提示</h2>';
    h += '<p style="text-align:center;font-size:12px">'
      + (full ? (this.sel.size ? '打出选中的牌后' : '（先选一张要打出的牌，可看打出后的听口）') : '当前手牌')
      + '　共 <b class="gold-txt">' + w.waits.length + '</b> 种胡牌</p>';
    if (!w.waits.length) h += '<p style="text-align:center">目前没有听牌。</p>';
    else {
      const byMult = {};
      w.waits.forEach(x => { (byMult[x.mult] = byMult[x.mult] || []).push(x); });
      h += '<table class="rt"><tr><th>番数</th><th>可胡的牌</th><th>剩余</th></tr>';
      Object.keys(byMult).map(Number).sort((a, b) => b - a).forEach(m => {
        const list = byMult[m].sort((a, b) => b.r - a.r || SUITS.indexOf(a.s) - SUITS.indexOf(b.s));
        h += '<tr><td>×' + m + '</td><td style="text-align:left;color:#e2f2e8;font-weight:400">'
          + list.map(x => '<span style="color:' + (SUIT_COLOR[x.s] === 'r' ? '#ff8272' : '#dfe7ff') + '">'
            + RANK_CH[x.r] + SUIT_CH[x.s] + '</span>').join(' ')
          + '</td><td>' + list.reduce((s, x) => s + x.left, 0) + ' 张</td></tr>';
      });
      h += '</table>';
    }
    h += '<div class="foot"><button class="btn sm" data-close>知道了</button></div>';
    openModal(h);
    $('#modal [data-close]').onclick = closeModal;
  }
  bestDiscard(i) {
    const hand = this.hands[i]; let best = null;
    for (const c of hand) {
      const rest = hand.filter(x => x.id !== c.id);
      const w = bqWaits(rest, this.seen);
      const cnt = w.waits.reduce((s, x) => s + x.left, 0);
      const score = cnt * 100 + w.bestMult * 6 - bqDeadScore(rest) + (c.k === 1 ? -100000 : c.k === 2 ? 40 : 0) + rnd(5);
      if (!best || score > best.score) best = { card: c, score: score };
    }
    return best;
  }
  /* 打出一张牌 */
  async playOut(i, card) {
    const from = rectOf(i === 0 ? this.c.hand : this.seats[i]);
    this.hands[i] = this.hands[i].filter(x => x.id !== card.id);
    this.markSeen(card);
    if (i === 0) { this.sel = new Set(); this.drawn = null; }
    if (card.k === 2) {
      /* 机会牌：直接进废牌堆，别人不能要；打出后从牌堆最近 4 张选 1 张，
         不影响本次摸牌，选完手牌回到 8 张，还要再打一张 */
      this.discard.push({ c: card, by: i, dead: true });
      this.dead++;
      this.phase = 'play'; this.render();
      flyCards([card], from, rectOf(this.center), { cls: 'tiny', step: 0, fade: true });
      if (i === 0) toast('打出机会牌', 900); else say(this.seats[i], '机会牌！');
      await sleep(500);
      if (this.c.over) return;
      if (this.wall.length) await this.chancePick(i);
      if (this.c.over) return;
      return this.afterGet(i, this.curEv);           // 继续这一巡，再打一张
    }
    const rec = { c: card, by: i };
    this.discard.push(rec);
    this.pool.push(rec);
    while (this.pool.length > 4) { this.pool.shift(); this.dead++; }   // 只保留最近 4 张可捡
    this.phase = 'play'; this.render();
    flyCards([card], from, rectOf(this.slots[i]), { cls: 'tiny', step: 0 });
    await this.afterDiscard(i);
  }
  /* 打出后：机会牌四选一 → 其他家接炮 */
  async afterDiscard(i) {
    const card = this.discard[this.discard.length - 1].c;
    if (this.c.over) return;
    for (let k = 1; k < 4; k++) {
      const j = (i + k) % 4;
      const hu = bqHu(this.hands[j].concat([card]));
      if (!hu) continue;
      if (j === 0) { if (!(await this.askHu(hu))) continue; }
      this.hands[j] = this.hands[j].concat([card]);
      const rec = this.discard.pop();
      this.pool = this.pool.filter(x => x !== rec);
      await this.doHu(j, hu, { zimo: false, dihu: false, haidi: false }, i);
      this.turn = j; return this.next();
    }
    this.next();
  }
  /* 机会牌：打出后从牌堆最近 4 张里选 1 张放入手牌 */
  async chancePick(i) {
    const opts = this.wall.slice(0, Math.min(4, this.wall.length));
    let choice;
    if (i === 0 && !this.headless) {
      choice = await new Promise(res => {
        const a = this.c.act; a.innerHTML = '';
        const tip = document.createElement('span'); tip.className = 'pill'; tip.textContent = '机会牌：4 选 1';
        a.appendChild(tip);
        opts.forEach(c => {
          const e = cardEl(c, 'mini'); e.style.cursor = 'pointer';
          e.onclick = () => { a.innerHTML = ''; res(c); };
          a.appendChild(e);
        });
      });
    } else {
      let best = null;
      for (const c of opts) {
        const w = bqWaits(this.hands[i].concat([c]).slice(0, 8), this.seen);
        const sc = w.waits.length * 10 + w.bestMult + (isWild(c) ? 50 : 0);
        if (!best || sc > best.sc) best = { c: c, sc: sc };
      }
      choice = best.c;
      say(this.seats[i], '机会牌！');
    }
    const from = this.deckEl ? rectOf(this.deckEl) : rectOf(this.center);
    this.wall = this.wall.filter(x => x !== choice);
    this.hands[i].push(choice); this.hands[i].sort(bqSort);
    this.render();
    if (i === 0) { await flyIntoHand(choice, from, this.c.hand, 42); toast('机会牌换到 ' + (choice.k ? (choice.k === 1 ? '癞子' : '机会牌') : RANK_CH[choice.r] + SUIT_CH[choice.s]), 1100); }
    else flyCards([choice], from, rectOf(this.seats[i]), { cls: 'tiny', step: 0, back: true });
  }
  askHu(hu) {
    return new Promise(res => {
      const a = this.c.act; a.innerHTML = ''; let done = false;
      const fin = v => { if (done) return; done = true; clearInterval(t); a.innerHTML = ''; res(v); };
      const b1 = document.createElement('button'); b1.className = 'btn sm red';
      b1.textContent = '胡！' + hu.name + ' ' + hu.mult + '番'; b1.onclick = () => fin(true);
      const b2 = document.createElement('button'); b2.className = 'btn sm grey'; b2.textContent = '过 (5)';
      b2.onclick = () => fin(false);
      a.appendChild(b1); a.appendChild(b2);
      let s = 5; const t = setInterval(() => { s--; b2.textContent = '过 (' + s + ')'; if (s <= 0) fin(false); }, 1000);
    });
  }
  /* ---------- 结算 ----------
     欢乐豆 = 底分 ×（胜利玩家分数 − 失败玩家分数）× 最终倍数
     胜利玩家分数 = 8 张牌的分数之和（全部在牌型里，算正分）
     失败玩家分数 = 不属于特定牌型的其他牌的分数（算负分）
     最终倍数 = 海底/地胡倍数 × 牌型倍数 × 自摸倍数
     硬气（手中没有癞子）→ 一次胡牌结算两次 */
  async doHu(i, hu, ev, from) {
    const winScore = this.hands[i].reduce((s, c) => s + bqCardScore(c), 0);
    const eventMul = ev.dihu ? 16 : ev.haidi ? 4 : 1;
    const zimoMul = ev.zimo ? 3 : 1;
    const mult = eventMul * hu.mult * zimoMul;
    const times = hu.hard ? 2 : 1;
    const tags = [hu.name + ' ' + hu.mult + '番'];
    if (ev.dihu) tags.push('地胡×16'); else if (ev.haidi) tags.push('海底捞月×4');
    tags.push(ev.zimo ? '自摸×3' : '接炮');
    if (hu.hard) tags.push('硬气·结算两次');

    const rd = [0, 0, 0, 0];
    for (let j = 0; j < 4; j++) {
      if (j === i) continue;
      if (from !== null && j !== from) continue;                 // 点炮只由放炮者结算
      const dead = bqDeadScore(this.hands[j]);
      let pay = this.c.base * (winScore + dead) * mult * times;
      pay = capPay(pay, this.P[j].beans + this.delta[j], this.c.game.cap);
      rd[j] -= pay; rd[i] += pay;
    }
    for (let j = 0; j < 4; j++) this.delta[j] += rd[j];
    this.hus[i]++;
    if (i === 0) bigWin('胡！' + hu.name); else say(this.seats[i], '胡！' + hu.name);
    beanFlow(this.anchors, rd);
    for (let j = 0; j < 4; j++) floatBean(this.anchors[j], rd[j]);
    this.render();
    await sleep(1400);
    if (this.c.over) return;
    this.roundEnd(i, hu, tags.join(' · '), mult * times, rd);
  }
  /* 本轮结束：亮出所有人的手牌，点「下一轮」继续 */
  roundEnd(winner, hu, tagText, mult, rd) {
    this.phase = 'over';
    this.c.act.innerHTML = '';
    this.render();
    /* 亮牌：每家的手牌摊在自己的出牌区 */
    for (let i = 0; i < 4; i++) {
      const sl = this.slots[i]; sl.innerHTML = '';
      sl.style.flexDirection = 'column'; sl.style.gap = '2px';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:1px;justify-content:center';
      this.hands[i].forEach(c => row.appendChild(cardEl(c, 'tiny')));
      sl.appendChild(row);
      const tg = document.createElement('div');
      tg.className = 'reveal-tag' + (i === winner ? ' first' : '');
      tg.innerHTML = (i === winner ? '<b class="gold-txt">胡</b>' : '<span style="opacity:.8">未胡</span>')
        + (rd[i] ? '<b class="amt" style="color:' + (rd[i] > 0 ? '#7dffae' : '#ff8272') + '">'
          + (rd[i] > 0 ? '+' : '') + fmt(rd[i]) + '</b>' : '');
      sl.appendChild(tg);
    }
    this.center.innerHTML = '';
    const box = document.createElement('div');
    box.style.cssText = 'font-size:12px;background:rgba(0,0,0,.6);border-radius:10px;padding:5px 14px;'
      + 'border:1px solid rgba(255,215,106,.6);text-align:center;white-space:nowrap';
    box.innerHTML = winner < 0
      ? '<span class="gold-txt" style="font-size:14px">流局</span><div style="font-size:11px;margin-top:2px">牌堆摸完，无人胡牌</div>'
      : '<span class="gold-txt" style="font-size:14px">' + (winner === 0 ? '我' : this.P[winner].name) + ' 胡牌</span>'
      + '<div style="font-size:11px;margin-top:2px">' + tagText + '　总倍数 <b class="gold-txt">×' + mult + '</b></div>';
    this.center.appendChild(box);
    actBtn('下一轮', '', () => { this.roundNo++; this.resetSlots(); this.newDeal(); });
    actBtn('结束牌局', 'grey', () => this.finish());
  }
  resetSlots() {
    for (let i = 0; i < 4; i++) { this.slots[i].innerHTML = ''; this.slots[i].style.flexDirection = ''; }
  }
  next() {
    if (this.c.over) return;
    if (this.phase === 'over') return;
    this.phase = '';
    if (!this.wall.length) return this.roundEnd(-1, null, '', 1, [0, 0, 0, 0]);
    this.turn = (this.turn + 1) % 4;
    setTimeout(() => this.step(), 340);
  }
  finish() {
    if (this.c.over) return;
    settle(this.P.map((p, i) => ({ p: p, delta: this.delta[i], tag: this.hus[i] ? '胡' + this.hus[i] + '次' : '未胡' })),
      '牌局结束 · 百变八雀牌', '共 ' + this.roundNo + ' 轮');
  }
}

GAMES.baque = {
  key: 'baque', name: '百变八雀牌', seats: 4, base: 20, entry: 60000, cap: 20000,
  start(c) { new BaqueGame(c).run(); },
  rules: '<h2>百变八雀牌</h2>'
    + '<h4>玩法说明</h4><ul>'
    + '<li>使用 <b>84 张</b>扑克：两副去掉大小王和 2/3/4/5（6~A），新增 <b>4 张 8</b>（全场 12 张 8）、'
    + '<b>4 张癞子</b>、<b>4 张机会牌</b>。</li>'
    + '<li>4 人同桌，开局每人 7 张。每巡可以<b>点牌堆摸一张</b>，也可以<b>从底池（最近 4 张弃牌）里拿一张</b>；凑成 <b>8 张</b>特定牌型即可胡牌。</li>'
    + '<li>本作按<b>一轮一胡</b>结算：有人胡牌（或牌堆摸完流局）本轮即结束，亮出所有人的手牌，点「下一轮」继续；随时可「结束牌局」看总账。</li>'
    + '<li><b>机会牌</b>：打出后可以从牌堆最近 4 张牌里选 1 张放入手牌；机会牌直接进废牌堆，别人拿不走，且不影响本次摸牌，选完还要再打一张。</li>'
    + '<li><b>癞子</b>可当任意牌；但手中有癞子时<b>不能胡 3+3+2 平胡</b>。</li></ul>'
    + '<h4>基础牌组</h4><ul>'
    + '<li><b>同花三/四/五/六/八顺</b>：3 4 5 6 8 张相同花色的牌按顺序排列。</li>'
    + '<li><b>三/四/五/六/八张</b>：将 3 4 5 6 8 张相同点数的牌组成一组。</li>'
    + '<li>8 张牌的结构：<b>8</b>　｜　<b>6+2</b>　｜　<b>5+3</b>　｜　<b>4+4</b>　｜　<b>3+3+2</b>（2 要求为一对）</li></ul>'
    + '<h4>番型与倍数</h4>'
    + '<table class="rt"><tr><th>番型</th><th>构成</th><th>倍数</th></tr>'
    + '<tr><td>独一无二</td><td>八张 A</td><td>×100</td></tr>'
    + '<tr><td>君临天下</td><td>八张 K</td><td>×100</td></tr>'
    + '<tr><td>十全十美</td><td>八张 10</td><td>×100</td></tr>'
    + '<tr><td>八方来财</td><td>八张 8</td><td>×100</td></tr>'
    + '<tr><td>八方来贺</td><td>完整 8 张，同花顺或 8 炸</td><td>×50</td></tr>'
    + '<tr><td>顶峰相见</td><td>K 和 A 构成 6+2</td><td>×32</td></tr>'
    + '<tr><td>心心相连</td><td>J 和 Q 构成 6+2</td><td>×32</td></tr>'
    + '<tr><td>十拿九稳</td><td>10 和 9 构成 6+2</td><td>×32</td></tr>'
    + '<tr><td>六事兴旺</td><td>6 和 7 构成 6+2</td><td>×32</td></tr>'
    + '<tr><td>比翼为邻</td><td>6+2，两组相邻同点数</td><td>×16</td></tr>'
    + '<tr><td>六朝金粉</td><td>6+2，八张牌同颜色</td><td>×16</td></tr>'
    + '<tr><td>六六大顺</td><td>6+2，同花顺或同数组</td><td>×8</td></tr>'
    + '<tr><td>永恒相随</td><td>5+3，两组相邻同点数</td><td>×8</td></tr>'
    + '<tr><td>五谷丰登</td><td>5+3，八张牌同颜色</td><td>×8</td></tr>'
    + '<tr><td>五福临门</td><td>5+3，同花顺或同数组</td><td>×4</td></tr>'
    + '<tr><td>二龙腾飞</td><td>4+4，两组相邻同点数</td><td>×4</td></tr>'
    + '<tr><td>四季发财</td><td>4+4，八张牌同颜色</td><td>×4</td></tr>'
    + '<tr><td>四季如春</td><td>4+4，同花顺或同数组</td><td>×2</td></tr>'
    + '<tr><td>平胡</td><td>3+3+2，2 为一对</td><td>×1</td></tr>'
    + '</table>'
    + '<h4>特殊事件</h4>'
    + '<table class="rt"><tr><th>事件</th><th>说明</th><th>倍数</th></tr>'
    + '<tr><td>自摸</td><td>最后胡牌是从牌堆摸的</td><td>×3</td></tr>'
    + '<tr><td>地胡</td><td>第一次轮到自己只摸打一次就胡</td><td>×16</td></tr>'
    + '<tr><td>海底捞月</td><td>胡牌堆最后一张牌</td><td>×4</td></tr>'
    + '<tr><td>硬气</td><td>胡牌时手中没有癞子</td><td>结算两次</td></tr>'
    + '</table>'
    + '<h4>结算规则</h4><ul>'
    + '<li>每张牌面都有分数，属于特定牌型时算正分，不属于时算负分。</li>'
    + '<li><b>欢乐豆 = 底分 ×（胜利玩家分数 − 失败玩家分数）× 最终倍数</b></li>'
    + '<li>胜利玩家分数 = 所有牌对应正分相加；失败玩家分数 = 不属于特定牌型的其他牌的分数。</li>'
    + '<li><b>最终倍数 = 海底/地胡倍数 × 牌型倍数 × 自摸倍数</b>。</li>'
    + '<li>胡牌玩家和剩下的玩家一一结算，结算完胡牌玩家不离开，继续参与后续的胡牌结算。</li>'
    + '<li>每次结算不超过场次封顶，也不超过输家全部欢乐豆。</li></ul>'
};
