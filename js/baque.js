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
    this.hus = [0, 0, 0, 0]; this.auto = [false, false, false, false];
    this.turns = [0, 0, 0, 0];
    this.wall = []; this.discard = []; this.seen = {}; this.sel = new Set();
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
  run() {
    _bqCache.clear();
    this.wall = this.buildDeck();
    for (let i = 0; i < 4; i++) this.hands[i] = this.wall.splice(0, 7).sort(bqSort);
    this.layout(); this.render();
    this.turn = 0;
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
    const info = document.createElement('div');
    info.style.cssText = 'font-size:11px;color:#dbeaff;display:flex;align-items:center;gap:6px';
    info.innerHTML = '<span style="display:inline-block;width:18px;height:25px;border-radius:3px;'
      + 'background:repeating-linear-gradient(45deg,#1d4ed8 0 3px,#1e3a8a 3px 6px);border:1px solid #fff"></span>'
      + '牌堆剩余 <b class="gold-txt">' + this.wall.length + '</b> 张';
    this.center.appendChild(info);
    this.deckEl = info;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:2px;max-width:340px';
    this.discard.slice(-14).forEach(d => row.appendChild(cardEl(d.c, 'xs')));
    this.center.appendChild(row);
    for (let i = 0; i < 4; i++) {
      this.slots[i].innerHTML = '';
      const last = this.discard[this.discard.length - 1];
      if (last && last.by === i) this.slots[i].appendChild(cardEl(last.c, 'tiny'));
    }
    const hd = this.c.hand; hd.innerHTML = '';
    fitHand(hd, this.hands[0].length, 42);
    this.hands[0].forEach(c => {
      const e = cardEl(c); e.style.setProperty('--cw', '42px');
      if (this.sel.has(c.id)) e.classList.add('sel');
      if (this.drawn === c.id) e.style.marginLeft = '10px';
      e.onclick = () => {
        if (this.c.over || this.auto[0] || this.hands[0].length !== 8) return;
        this.sel = new Set([c.id]); this.render();
      };
      hd.appendChild(e);
    });
    let ex = this.hus[0] ? '已胡 ' + this.hus[0] + ' 次' : '';
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
    const lastCard = this.wall.length === 1;
    const c = this.wall.shift();
    const fromDeck = this.deckEl ? rectOf(this.deckEl) : null;
    this.hands[i].push(c); this.hands[i].sort(bqSort);
    this.turns[i]++;
    if (i === 0) { this.drawn = c.id; this.sel = new Set(); }
    this.render();
    if (fromDeck) flyCards([c], fromDeck, rectOf(i === 0 ? this.c.hand : this.seats[i]),
      { cls: 'tiny', step: 0, back: i !== 0 });
    const hu = bqHu(this.hands[i]);
    const ev = { zimo: true, dihu: this.turns[i] === 1, haidi: lastCard };
    if (i === 0 && !this.auto[0]) return this.myTurn(hu, ev);
    await sleep(300 + rnd(220));
    if (this.c.over) return;
    if (hu) { await this.doHu(i, hu, ev, null); return this.next(); }
    this.discardCard(i, this.bestDiscard(i).card);
    await this.afterDiscard(i);
  }
  myTurn(hu, ev) {
    const a = this.c.act; a.innerHTML = '';
    if (hu) {
      const mult = hu.mult * (ev.dihu ? 16 : ev.haidi ? 4 : 1) * 3;
      actBtn('胡 ' + hu.name + ' ' + hu.mult + '番', 'red', async () => {
        a.innerHTML = ''; await this.doHu(0, hu, ev, null); this.next();
      });
      toast('可胡 ' + hu.name + '　总倍数 ×' + mult + (hu.hard ? '（硬气结算两次）' : ''), 1600);
    }
    actBtn('提示', 'grey', () => { this.sel = new Set([this.bestDiscard(0).card.id]); this.render(); });
    actBtn('打出', '', async () => {
      if (!this.sel.size) return toast('请先选一张要打出的牌');
      const card = this.hands[0].find(x => this.sel.has(x.id));
      a.innerHTML = ''; this.discardCard(0, card); await this.afterDiscard(0);
    });
  }
  bestDiscard(i) {
    const hand = this.hands[i]; let best = null;
    for (const c of hand) {
      const rest = hand.filter(x => x.id !== c.id);
      const w = bqWaits(rest, this.seen);
      const cnt = w.waits.reduce((s, x) => s + x.left, 0);
      const score = cnt * 100 + w.bestMult * 6 - bqDeadScore(rest) + (isWild(c) ? -100000 : 0) + rnd(5);
      if (!best || score > best.score) best = { card: c, score: score };
    }
    return best;
  }
  discardCard(i, card) {
    const from = rectOf(i === 0 ? this.c.hand : this.seats[i]);
    this.hands[i] = this.hands[i].filter(x => x.id !== card.id);
    this.markSeen(card);
    this.discard.push({ c: card, by: i });
    if (i === 0) { this.sel = new Set(); this.drawn = null; }
    this.render();
    flyCards([card], from, rectOf(this.slots[i]), { cls: 'tiny', step: 0 });
  }
  /* 打出后：机会牌四选一 → 其他家接炮 */
  async afterDiscard(i) {
    const card = this.discard[this.discard.length - 1].c;
    if (card.k === 2 && this.wall.length) await this.chancePick(i);
    if (this.c.over) return;
    for (let k = 1; k < 4; k++) {
      const j = (i + k) % 4;
      const hu = bqHu(this.hands[j].concat([card]));
      if (!hu) continue;
      if (j === 0 && !this.auto[0]) { if (!(await this.askHu(hu))) continue; }
      this.hands[j] = this.hands[j].concat([card]);
      this.discard.pop();
      await this.doHu(j, hu, { zimo: false, dihu: false, haidi: false }, i);
      this.turn = j; return this.next();
    }
    this.next();
  }
  /* 机会牌：打出后从牌堆最近 4 张里选 1 张放入手牌 */
  async chancePick(i) {
    const opts = this.wall.slice(0, Math.min(4, this.wall.length));
    let choice;
    if (i === 0 && !this.auto[0]) {
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
    this.wall = this.wall.filter(x => x !== choice);
    this.hands[i].push(choice); this.hands[i].sort(bqSort);
    if (i === 0) toast('机会牌换到 ' + (choice.k ? (choice.k === 1 ? '癞子' : '机会牌') : RANK_CH[choice.r] + SUIT_CH[choice.s]), 1100);
    this.render();
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
    if (ev.zimo) tags.push('自摸×3');
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
    toast(this.P[i].name + '　' + tags.join(' · '), 1700);
    beanFlow(this.anchors, rd);
    this.auto[i] = true;                            // 第一次胡牌后系统自动接管
    this.hands[i].forEach(c => this.markSeen(c));
    this.hands[i] = [];
    this.render();
    await sleep(1200);
    if (this.c.over) return;
    if (this.wall.length >= 7) this.hands[i] = this.wall.splice(0, 7).sort(bqSort);
    this.render();
  }
  next() {
    if (this.c.over) return;
    if (!this.wall.length) return this.finish();
    this.turn = (this.turn + 1) % 4;
    if (!this.hands[this.turn].length && this.wall.length < 7) return this.finish();
    setTimeout(() => this.step(), 220);
  }
  finish() {
    if (this.c.over) return;
    settle(this.P.map((p, i) => ({ p: p, delta: this.delta[i], tag: this.hus[i] ? '胡' + this.hus[i] + '次' : '未胡' })),
      '牌局结束 · 百变八雀牌');
  }
}

GAMES.baque = {
  key: 'baque', name: '百变八雀牌', seats: 4, base: 20, entry: 60000, cap: 20000,
  start(c) { new BaqueGame(c).run(); },
  rules: '<h2>百变八雀牌</h2>'
    + '<h4>玩法说明</h4><ul>'
    + '<li>使用 <b>84 张</b>扑克：两副去掉大小王和 2/3/4/5（6~A），新增 <b>4 张 8</b>（全场 12 张 8）、'
    + '<b>4 张癞子</b>、<b>4 张机会牌</b>。</li>'
    + '<li>4 人同桌，开局每人 7 张，通过摸打把手中 <b>8 张牌</b>组成特定牌型即可胡牌。</li>'
    + '<li><b>第一次胡牌后不能再进行手牌操作</b>，系统会自动进行胡牌操作，直至牌堆全部摸完，游戏结束。</li>'
    + '<li><b>机会牌</b>：打出后可以从牌堆最近 4 张牌里选 1 张放入手牌。</li>'
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
