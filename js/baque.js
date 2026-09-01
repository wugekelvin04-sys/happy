/* =====================================================================
   百变八雀牌（按官方「一鸣惊人」版本实现）
   牌堆 84 张：两副去大小王与 2/3/4/5（6~A ×4花 ×2副 = 72）
                + 4 张 8 + 4 张癞子 + 4 张机会牌
   4 人，每人 7 张，摸打成 8 张即可胡；胡牌不离场，摸完牌堆结束
   合法组：三张（≥3 张同点） / 同花三顺（≥3 张同花色顺子）
   结构：3+3+2(将)、5+3、4+4、6+2(将)、8
   ===================================================================== */
'use strict';
const BQ_LO = 6, BQ_HI = 14;
const BQ_SHAPES = [
  { key: '8', parts: [8], pair: -1 },
  { key: '62', parts: [6, 2], pair: 1 },
  { key: '53', parts: [5, 3], pair: -1 },
  { key: '44', parts: [4, 4], pair: -1 },
  { key: '332', parts: [3, 3, 2], pair: 2 }
];
const BQ_RANKNAME = { 14: '独一无二', 10: '十全十美' };

/* 单组分析：返回可作为「同点组」/「同花顺组」的描述 */
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
const adjacent = (a, b) => a === null || b === null || Math.abs(a - b) === 1;

function bqFan(key, g) {  // g: 各组已选定的描述数组
  switch (key) {
    case '8':
      if (g[0].kind === 'run') return ['八方来贺', 100];
      return [BQ_RANKNAME[g[0].rank] || '一鸣惊人', BQ_RANKNAME[g[0].rank] ? 100 : 88];
    case '62': {
      const big = g[0], p = g[1];
      if (big.kind === 'run') return ['六朝金粉', 36];
      if (adjacent(big.rank, p.rank)) return ['比翼为邻', 30];
      return ['六亲同气', 20];
    }
    case '53':
      return g[0].kind === 'run' ? ['五星连珠', 15] : ['五福临门', 12];
    case '44': {
      const a = g[0], b = g[1];
      if (a.kind === 'run' && b.kind === 'run') return ['双龙出海', 24];
      if (a.kind === 'set' && b.kind === 'set') return adjacent(a.rank, b.rank) ? ['二龙腾飞', 20] : ['四海升平', 14];
      return ['四季如春', 10];
    }
    case '332': {
      const a = g[0], b = g[1];
      if (a.kind === 'run' && b.kind === 'run')
        return (a.suit === null || b.suit === null || a.suit === b.suit) ? ['一气贯通', 6] : ['双龙戏珠', 3];
      if (a.kind === 'set' && b.kind === 'set') return adjacent(a.rank, b.rank) ? ['三阳开泰', 6] : ['双喜临门', 3];
      return ['平胡', 1];
    }
  }
  return null;
}

const _bqCache = new Map();
/* 8 张判胡；useWild=true 时禁止「平胡」（官方：有癞子不能平胡，要胡大胡） */
function bqHu(cards8) {
  if (!cards8 || cards8.length !== 8) return null;
  const sig = cards8.map(c => isWild(c) ? 'W' : c.r + c.s).sort().join('|');
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
            const f = bqFan(sh.key, acc);
            if (f && (!best || f[1] > best.mult)) best = { name: f[0], mult: f[1] };
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
    best.hard = !usedWild;                       // 硬气：没有癞子的番型
    if (usedWild && best.mult === 1) best = null; // 大胡：用了癞子不能平胡
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
function bqSort(a, b) {
  if (isWild(a) !== isWild(b)) return isWild(a) ? -1 : 1;
  if (a.k !== b.k) return a.k - b.k;
  if (a.r !== b.r) return a.r - b.r;
  return SUITS.indexOf(a.s) - SUITS.indexOf(b.s);
}

class BaqueGame {
  constructor(c) {
    this.c = c; this.P = c.players; this.n = 4;
    this.delta = [0, 0, 0, 0]; this.hands = [[], [], [], []];
    this.ren = [0, 0, 0, 0]; this.hus = [0, 0, 0, 0]; this.auto = [false, false, false, false];
    this.wall = []; this.discard = []; this.seen = {}; this.sel = new Set();
    this.turn = 0; this.drawn = null; this.phase = 'swap';
  }
  buildDeck() {
    const d = [];
    for (let k = 0; k < 2; k++) for (let r = BQ_LO; r <= BQ_HI; r++) for (const s of SUITS) d.push(mkCard(r, s, 0));
    for (const s of SUITS) d.push(mkCard(8, s, 0));          // 新增 4 张 8
    for (let i = 0; i < 4; i++) d.push(mkCard(0, 'W', 1));   // 癞子
    for (let i = 0; i < 4; i++) d.push(mkCard(0, 'W', 2));   // 机会牌
    return shuffle(d);
  }
  run() {
    _bqCache.clear();
    this.wall = this.buildDeck();
    for (let i = 0; i < 4; i++) this.hands[i] = this.wall.splice(0, 7).sort(bqSort);
    this.layout(); this.render();
    this.swapPhase();
  }
  layout() {
    const b = this.c.body; b.innerHTML = ''; this.seats = [];
    const pos = [null, 'p-right', 'p-top', 'p-left'];
    for (let i = 1; i < 4; i++) {
      const el = seatBox(this.P[i], '<span class="hs">7 张</span>', pos[i]);
      el.querySelector('.ex').appendChild(backEl(7));
      b.appendChild(el); this.seats[i] = el;
    }
    this.pz = document.createElement('div');
    this.pz.style.cssText = 'position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:5px;align-items:center;pointer-events:none';
    b.appendChild(this.pz);
  }
  render() {
    for (let i = 1; i < 4; i++) {
      const e = this.seats[i];
      e.querySelector('.hs').innerHTML = this.hands[i].length + ' 张'
        + (this.ren[i] ? ' <b style="color:#8fd6ff">忍' + this.ren[i] + '</b>' : '')
        + (this.hus[i] ? ' <b class="gold-txt">胡' + this.hus[i] + '</b>' : '');
      e.querySelector('.cardback-count').textContent = this.hands[i].length;
      e.querySelector('.bn').textContent = fmt(this.P[i].beans + this.delta[i]);
    }
    $('#tMyBeans').textContent = fmt(this.P[0].beans + this.delta[0]);
    this.pz.innerHTML = '';
    const info = document.createElement('div');
    info.style.cssText = 'font-size:12px;color:#dbeaff';
    info.innerHTML = '牌堆剩余 <b class="gold-txt">' + this.wall.length + '</b> 张';
    this.pz.appendChild(info);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:2px;max-width:96%';
    this.discard.slice(-10).forEach(d => {
      const e = cardEl(d.c, 'tiny');
      if (d.ren) { const r = document.createElement('div'); r.className = 'ren'; r.textContent = '忍'; e.appendChild(r); }
      row.appendChild(e);
    });
    this.pz.appendChild(row);

    const hd = this.c.hand; hd.innerHTML = '';
    fitHand(hd, this.hands[0].length);
    this.hands[0].forEach(c => {
      const e = cardEl(c);
      if (this.sel.has(c.id)) e.classList.add('sel');
      if (this.drawn === c.id) e.style.marginLeft = '10px';
      e.onclick = () => this.tapCard(c);
      hd.appendChild(e);
    });
    let ex = '';
    if (this.ren[0]) ex += '忍 ×' + this.ren[0] + '　';
    if (this.hus[0]) ex += '已胡 ' + this.hus[0] + ' 次';
    if (!ex && this.hands[0].length === 7) {
      const w = bqWaits(this.hands[0], this.seen);
      if (w.waits.length) ex = '听 ' + w.waits.length + ' 种 · 最高' + w.bestMult + '番';
    }
    $('#tMyExtra').textContent = ex;
  }
  tapCard(c) {
    if (this.c.over) return;
    if (this.phase === 'swap') {
      if (this.sel.has(c.id)) this.sel.delete(c.id);
      else { if (this.sel.size >= 2) return toast('只能选 2 张'); this.sel.add(c.id); }
      return this.render();
    }
    if (this.phase !== 'my' || this.hands[0].length !== 8) return;
    this.sel = new Set([c.id]); this.render();
  }
  /* ---------- 换两张 ---------- */
  swapPhase() {
    this.phase = 'swap'; this.sel = new Set();
    toast('开局换两张：选 2 张与其他玩家随机交换', 1800);
    const a = this.c.act; a.innerHTML = '';
    actBtn('随机选', 'grey', () => {
      this.sel = new Set(shuffle(this.hands[0].slice()).slice(0, 2).map(c => c.id)); this.render();
    });
    actBtn('确认换牌', '', () => {
      if (this.sel.size !== 2) return toast('请选择 2 张牌');
      a.innerHTML = ''; this.doSwap();
    });
    this.render();
  }
  doSwap() {
    const give = [];
    for (let i = 0; i < 4; i++) {
      let picks;
      if (i === 0) picks = this.hands[0].filter(c => this.sel.has(c.id));
      else picks = shuffle(this.hands[i].slice()).slice(0, 2);
      picks.forEach(c => give.push({ from: i, c: c }));
      this.hands[i] = this.hands[i].filter(c => picks.indexOf(c) < 0);
    }
    shuffle(give);
    // 尽量不把牌换回原主
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 2; k++) {
        let idx = give.findIndex(g => g.from !== i);
        if (idx < 0) idx = 0;
        this.hands[i].push(give.splice(idx, 1)[0].c);
      }
      this.hands[i].sort(bqSort);
    }
    this.sel = new Set(); this.render();
    bigWin('换牌完成');
    this.turn = 0;
    setTimeout(() => this.step(), 900);
  }
  /* ---------- 主循环 ---------- */
  async step() {
    if (this.c.over) return;
    if (this.wall.length === 0) return this.finish();
    const i = this.turn;
    const c = this.wall.shift();
    this.hands[i].push(c); this.hands[i].sort(bqSort);
    if (i === 0) { this.drawn = c.id; this.sel = new Set(); }
    this.render();
    const hu = bqHu(this.hands[i]);
    if (i === 0 && !this.auto[0]) { this.phase = 'my'; return this.myTurn(hu); }
    await sleep(300 + rnd(240));
    if (this.c.over) return;
    if (hu) {
      const bao = Math.random() < .35;
      await this.doHu(i, hu, bao);
      return this.next();
    }
    this.discardCard(i, this.bestDiscard(i).card, false);
    this.next();
  }
  myTurn(hu) {
    const a = this.c.act; a.innerHTML = '';
    if (hu) {
      const times = Math.min(8, this.ren[0] + 1) * (hu.hard ? 2 : 1);
      actBtn('胡 ' + hu.name + ' ' + hu.mult + '番', 'red', async () => {
        a.innerHTML = ''; await this.doHu(0, hu, false); this.next();
      });
      actBtn('爆胡', '', async () => {
        a.innerHTML = ''; await this.doHu(0, hu, true); this.next();
      });
      actBtn('忍住不胡', 'grey', () => {
        a.innerHTML = ''; this.phase = 'my2';
        toast('打出一张牌即可获得【忍】', 1200);
        this.myDiscardUI(true);
      });
      toast('可胡 ' + hu.name + '（结算 ' + times + ' 次）', 1500);
      return;
    }
    this.myDiscardUI(false);
  }
  myDiscardUI(gainRen) {
    const a = this.c.act; a.innerHTML = '';
    actBtn('提示', 'grey', () => { this.sel = new Set([this.bestDiscard(0).card.id]); this.render(); });
    actBtn('打出', '', () => {
      if (!this.sel.size) return toast('请先选一张要打出的牌');
      const card = this.hands[0].find(x => this.sel.has(x.id));
      a.innerHTML = ''; this.discardCard(0, card, gainRen); this.next();
    });
  }
  bestDiscard(i) {
    const hand = this.hands[i]; let best = null;
    for (const c of hand) {
      const rest = hand.filter(x => x.id !== c.id);
      const w = bqWaits(rest, this.seen);
      const cnt = w.waits.reduce((s, x) => s + x.left, 0);
      const score = cnt * 100 + w.bestMult * 4 + (isWild(c) ? -100000 : 0) + rnd(5);
      if (!best || score > best.score) best = { card: c, score: score, n: w.waits.length };
    }
    return best;
  }
  discardCard(i, card, gainRen) {
    this.hands[i] = this.hands[i].filter(x => x.id !== card.id);
    if (!isWild(card)) this.seen[card.r + card.s] = (this.seen[card.r + card.s] || 0) + 1;
    if (gainRen) { this.ren[i] = Math.min(9, this.ren[i] + 1); if (i === 0) bigWin('忍 ×' + this.ren[0]); else say(this.seats[i], '忍！'); }
    this.discard.push({ c: card, by: i, ren: !!gainRen });
    if (i === 0) { this.sel = new Set(); this.drawn = null; }
    this.render();
  }
  async doHu(i, hu, bao) {
    let times = Math.min(8, this.ren[i] + 1);
    const hard = hu.hard;
    if (hard) times *= 2;
    const amt = this.c.base * hu.mult;
    for (let k = 0; k < times; k++)
      for (let j = 0; j < 4; j++) if (j !== i) { this.delta[j] -= amt; this.delta[i] += amt; }
    this.hus[i] += times;
    const label = hu.name + ' ' + hu.mult + '番 · 结算' + times + '次' + (hard ? ' · 硬气' : '');
    if (i === 0) bigWin('胡！' + hu.name); else say(this.seats[i], '胡！' + hu.name);
    toast(this.P[i].name + '　' + label, 1500);
    this.ren[i] = 0;
    this.auto[i] = true;                       // 官方：第一次胡牌后系统自动接管
    this.hands[i].forEach(c => { if (!isWild(c)) this.seen[c.r + c.s] = (this.seen[c.r + c.s] || 0) + 1; });
    this.hands[i] = [];
    this.render();
    await sleep(900);
    if (this.c.over) return;
    if (bao) {                                  // 爆胡：多摸一张，其他玩家各得一个忍
      for (let j = 0; j < 4; j++) if (j !== i) this.ren[j] = Math.min(9, this.ren[j] + 1);
      if (this.wall.length) {
        const extra = this.wall.splice(0, 8);
        const hu2 = extra.length === 8 ? bqHu(extra) : null;
        toast('爆胡！其他玩家各获得 1 个忍', 1300);
        if (hu2) {
          const amt2 = this.c.base * hu2.mult;
          for (let k = 0; k < times; k++)
            for (let j = 0; j < 4; j++) if (j !== i) { this.delta[j] -= amt2; this.delta[i] += amt2; }
          this.hus[i] += times;
          bigWin('爆胡 · ' + hu2.name);
        }
        extra.forEach(c => { if (!isWild(c)) this.seen[c.r + c.s] = (this.seen[c.r + c.s] || 0) + 1; });
        await sleep(700);
      }
    }
    if (this.wall.length >= 7) this.hands[i] = this.wall.splice(0, 7).sort(bqSort);
    this.render();
  }
  next() {
    if (this.c.over) return;
    if (this.wall.length === 0) return this.finish();
    this.turn = (this.turn + 1) % 4;
    if (this.hands[this.turn].length === 0 && this.wall.length < 7) return this.finish();
    setTimeout(() => this.step(), 220);
  }
  finish() {
    if (this.c.over) return;
    const rows = this.P.map((p, i) => ({ p: p, delta: this.delta[i], tag: this.hus[i] ? '胡' + this.hus[i] + '次' : '未胡' }));
    settle(rows, '牌局结束 · 百变八雀牌');
  }
}

GAMES.baque = {
  key: 'baque', name: '百变八雀牌', seats: 4, base: 1000, entry: 60000,
  start(c) { new BaqueGame(c).run(); },
  rules: '<h2>百变八雀牌 · 一鸣惊人</h2>'
    + '<h4>基础玩法</h4><ul>'
    + '<li>牌堆 <b>84 张</b>：两副扑克去掉大小王与 2/3/4/5（保留 6~A），再加 <b>4 张 8</b>、<b>4 张癞子</b>、<b>4 张机会牌</b>。</li>'
    + '<li>4 人同桌，每人起手 <b>7 张</b>，通过摸打把手牌组成 <b>8 张</b>特定牌型即可胡牌。</li>'
    + '<li><b>胡牌不离场</b>（血流成河）：胡完重新发 7 张继续，摸完整个牌堆才结束，多次胡牌赢得更多。</li>'
    + '<li>第一次胡牌后不再手动操作，系统自动接管到牌堆摸完。</li></ul>'
    + '<h4>什么是特定牌型</h4><ul>'
    + '<li><b>三张</b>：3 张及以上点数相同的牌。</li>'
    + '<li><b>同花三顺</b>：3 张及以上花色相同的顺子。</li>'
    + '<li>8 张牌的合法结构：<b>3+3+1对</b>　｜　<b>5+3</b>　｜　<b>4+4</b>　｜　<b>6+1对</b>　｜　<b>8</b></li>'
    + '<li><b>癞子 / 机会牌</b>可当任意牌使用。</li></ul>'
    + '<h4>番型与倍数</h4>'
    + '<table class="rt"><tr><th>番型</th><th>构成</th><th>番</th></tr>'
    + '<tr><td>平胡</td><td>3+3+1对</td><td>×1</td></tr>'
    + '<tr><td>双喜临门</td><td>两组皆三张同点</td><td>×3</td></tr>'
    + '<tr><td>双龙戏珠</td><td>两组皆同花三顺</td><td>×3</td></tr>'
    + '<tr><td>三阳开泰</td><td>两组同点且点数相邻</td><td>×6</td></tr>'
    + '<tr><td>一气贯通</td><td>两组同花三顺且同花色</td><td>×6</td></tr>'
    + '<tr><td>四季如春</td><td>4+4</td><td>×10</td></tr>'
    + '<tr><td>五福临门</td><td>5 张同点 + 3 张组</td><td>×12</td></tr>'
    + '<tr><td>四海升平</td><td>4+4 皆同点</td><td>×14</td></tr>'
    + '<tr><td>五星连珠</td><td>5 张同花顺 + 3 张组</td><td>×15</td></tr>'
    + '<tr><td>六亲同气</td><td>6 张同点 + 1 对</td><td>×20</td></tr>'
    + '<tr><td>二龙腾飞</td><td>4+4 同点且点数相邻</td><td>×20</td></tr>'
    + '<tr><td>双龙出海</td><td>4+4 皆同花顺</td><td>×24</td></tr>'
    + '<tr><td>比翼为邻</td><td>6 张同点，与对子点数相邻</td><td>×30</td></tr>'
    + '<tr><td>六朝金粉</td><td>6 张同花顺 + 1 对</td><td>×36</td></tr>'
    + '<tr><td>一鸣惊人</td><td>8 张同点</td><td>×88</td></tr>'
    + '<tr><td>十全十美</td><td>8 张 10</td><td>×100</td></tr>'
    + '<tr><td>独一无二</td><td>8 张 A</td><td>×100</td></tr>'
    + '<tr><td>八方来贺</td><td>8 张同花顺</td><td>×100</td></tr>'
    + '</table>'
    + '<h4>三大机制</h4><ul>'
    + '<li><b>换两张</b>：开局可挑选手中任意 2 张，随机与其他玩家交换。</li>'
    + '<li><b>当忍则忍</b>：能胡时忍住不胡、把可胡的牌打出去，可获得一个【忍】。胡牌时 <b>胡牌次数 = 忍数 + 1</b>（忍 ≥7 时固定 8 次）；忍过打出的牌不可再摸回，每次胡牌后【忍】清零。</li>'
    + '<li><b>爆胡</b>：胡牌结算后再多摸一张，若能再胡就多胡一次（沿用本回合的忍）；但其他玩家都会各获得一个【忍】。</li></ul>'
    + '<h4>硬气 / 大胡</h4><ul>'
    + '<li><b>硬气</b>：番型完全没用到癞子，<b>胡 1 次结算 2 次</b>。</li>'
    + '<li><b>大胡</b>：用了癞子就不能胡「平胡」，必须胡更大的番型。</li></ul>'
    + '<h4>结算</h4><p>每次结算，其余三家各付 <b>底分 × 番数</b>。</p>'
};
