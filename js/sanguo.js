/* =====================================================================
   三国牌（按官方规则实现）
   1 副去大小王（52 张），5 人各自为战，共 4 轮
   每轮每人 8 张手牌；公共区分魏/蜀/吴三个阵营，
   每轮刷新公共牌：魏 3 张、蜀 0 张、吴 2 张
   玩家从手牌选对应张数，与任一阵营公共牌组成 5 张牌型比拼
   牌型：同花顺 > 四炸 > 三带二 > 同花 > 顺子 > 三张 > 两对 > 对子 > 单张
   第 1 名赢所有人；2~5 名名次越靠前扣豆越多
   暴击：与第 1 名同阵营　杀牌：与第 1 名同牌型
   ===================================================================== */
'use strict';

const SG_CAMPS = [
  { k: 'wei', n: '魏', pub: 3, cls: 'wei' },
  { k: 'shu', n: '蜀', pub: 0, cls: 'shu' },
  { k: 'wu', n: '吴', pub: 2, cls: 'wu' }
];
/* 官方牌型（正式名 / 通称 / 倍率），大小顺序：
   同心连环 > 四象强弩 > 三军两将 > 同袍营 > 连环计 > 三英阵 > 双翼斩 > 双雄 > 单骑 */
const SG_TYPES = [
  ['单骑', '单张', 10], ['双雄', '对子', 20], ['双翼斩', '两对', 30], ['三英阵', '三张', 40],
  ['连环计', '顺子', 60], ['同袍营', '同花', 80], ['三军两将', '三带二', 100],
  ['四象强弩', '四炸', 400], ['同心连环', '同花顺', 1000]
];
/* 名次倍率（官方表）：第 1 名赢所有人 */
const SG_RANKMUL = [0, 32, 24, 12, 4];
function sgEval5(cards) {
  const rs = cards.map(c => c.r).sort((a, b) => b - a);
  const cnt = {}; rs.forEach(r => cnt[r] = (cnt[r] || 0) + 1);
  const gr = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || b - a);
  const flush = new Set(cards.map(c => c.s)).size === 1;
  const uniq = [...new Set(rs)];
  let straight = false, hi = rs[0];
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straight = true;
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) { straight = true; hi = 5; }
  }
  let t;
  if (straight && flush) t = 8;
  else if (cnt[gr[0]] === 4) t = 7;
  else if (cnt[gr[0]] === 3 && cnt[gr[1]] === 2) t = 6;
  else if (flush) t = 5;
  else if (straight) t = 4;
  else if (cnt[gr[0]] === 3) t = 3;
  else if (cnt[gr[0]] === 2 && cnt[gr[1]] === 2) t = 2;
  else if (cnt[gr[0]] === 2) t = 1;
  else t = 0;
  let key;
  if (t === 8 || t === 4) key = [hi];
  else if (t === 5 || t === 0) key = rs;
  else key = gr.concat(rs);
  return { t: t, key: key, name: SG_TYPES[t][0], alias: SG_TYPES[t][1], mult: SG_TYPES[t][2], cs: cards };
}
function sgCmp(a, b) {
  if (a.t !== b.t) return a.t - b.t;
  for (let i = 0; i < Math.max(a.key.length, b.key.length); i++) {
    const x = a.key[i] || 0, y = b.key[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}
function combos(arr, k) {
  const out = [], cur = [];
  (function rec(i) {
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (let j = i; j < arr.length; j++) { cur.push(arr[j]); rec(j + 1); cur.pop(); }
  })(0);
  return out;
}
/* 枚举三个阵营的所有可出组合 */
function sgAllPlays(hand, pubs) {
  const out = [];
  for (let ci = 0; ci < 3; ci++) {
    const need = 5 - SG_CAMPS[ci].pub;
    if (need > hand.length) continue;
    for (const own of combos(hand, need)) out.push({ camp: ci, own: own, ev: sgEval5(own.concat(pubs[ci])) });
  }
  return out;
}
/* 官方结算：第 1 名赢所有人，输家按名次倍数付；所以目标就是把牌做到最大。
   同强度时随机换阵营，避免所有人挤在同一国被暴击。 */
function sgBestPlay(hand, pubs) {
  const all = sgAllPlays(hand, pubs);
  let best = null, bestSc = -1e9;
  const campNoise = [Math.random(), Math.random(), Math.random()];
  for (const o of all) {
    const sc = o.ev.t * 1e6 + o.ev.key.reduce((a, v, i) => a + v / Math.pow(20, i), 0) * 100 + campNoise[o.camp];
    if (sc > bestSc) { bestSc = sc; best = o; }
  }
  return best;
}
const sgStrongest = sgBestPlay;
/* 每个阵营各自能做出的最强 5 张牌型（玩家侧推荐用） */
function sgBestPerCamp(hand, pubs) {
  const out = [];
  for (let ci = 0; ci < 3; ci++) {
    const need = 5 - SG_CAMPS[ci].pub;
    if (need > hand.length) { out.push(null); continue; }
    let best = null;
    for (const own of combos(hand, need)) {
      const ev = sgEval5(own.concat(pubs[ci]));
      if (!best || sgCmp(ev, best.ev) > 0) best = { camp: ci, own: own, ev: ev };
    }
    out.push(best);
  }
  return out;
}

class SanguoGame {
  constructor(c) {
    this.c = c; this.P = c.players; this.n = 5;
    this.delta = [0, 0, 0, 0, 0];
    this.hands = []; this.pubs = [[], [], []];
    this.round = 0; this.sel = new Set(); this.camp = -1; this.busy = false;
    this.deck = null; this.used = [];
  }
  newDeck() {
    const d = [];
    for (const s of SUITS) for (let r = 2; r <= 14; r++) d.push(mkCard(r, s, 0));
    return shuffle(d);
  }
  draw(n) {
    const out = [];
    while (out.length < n) {
      if (!this.deck.length) { this.deck = shuffle(this.used); this.used = []; }
      if (!this.deck.length) break;
      out.push(this.deck.shift());
    }
    return out;
  }
  /* 官方：下个回合开始时，把所有打出的牌和公共区域的牌与牌堆洗混，再补齐手牌到 8 张 */
  deal() {
    if (!this.deck) { this.deck = this.newDeck(); this.used = []; this.hands = [[], [], [], [], []]; }
    else { this.deck = shuffle(this.deck.concat(this.used)); this.used = []; }
    for (let i = 0; i < 5; i++) {
      const need = 8 - this.hands[i].length;
      if (need > 0) this.hands[i] = this.hands[i].concat(this.draw(need));
      this.hands[i].sort((a, b) => b.r - a.r);
    }
    this.pubs = SG_CAMPS.map(c => this.draw(c.pub));
  }
  run() { this.layout(); this.round = 1; this.startRound(); }
  layout() {
    const b = this.c.body;
    [...b.querySelectorAll('.seat-chip,.play-slot,.center-zone')].forEach(e => e.remove());
    this.seats = []; this.slots = [];
    /* 0=我(下方)  1=右下  2=右上  3=左上  4=左下 */
    const CH = [null,
      { chip: { right: '2px', top: '47%' }, rev: true },
      { chip: { right: '2px', top: '1%' }, rev: true },
      { chip: { left: '2px', top: '1%' } },
      { chip: { left: '2px', top: '47%' } }];
    const SP = [{ left: '50%', bottom: '2%', tx: -50 },
      { right: '2px', top: '68%' }, { right: '2px', top: '22%' },
      { left: '2px', top: '22%' }, { left: '2px', top: '68%' }];
    for (let i = 1; i < 5; i++) {
      const el = mkSeat(this.P[i], CH[i], '<span class="hs">8 张</span>');
      b.appendChild(el); this.seats[i] = el;
    }
    for (let i = 0; i < 5; i++) {
      const sl = document.createElement('div');
      sl.className = 'play-slot'; sl.style.flexDirection = 'column'; sl.style.gap = '2px'; sl.style.zIndex = 4;
      applyPos(sl, SP[i]); b.appendChild(sl); this.slots[i] = sl;
    }
    this.mid = document.createElement('div'); this.mid.className = 'center-zone';
    b.appendChild(this.mid);
    this.anchors = [$('.me-bar'), this.seats[1], this.seats[2], this.seats[3], this.seats[4]];
  }
  renderCamps() {
    this.mid.innerHTML = '';
    const tip = document.createElement('div');
    tip.style.cssText = 'text-align:center;font-size:12px;margin-bottom:4px';
    tip.className = 'gold-txt';
    tip.textContent = '第 ' + this.round + '/4 轮 · 选一个阵营出战';
    this.mid.appendChild(tip);

    const wrap = document.createElement('div'); wrap.className = 'camps';
    SG_CAMPS.forEach((cp, ci) => {
      const act = this.camp === ci;
      const d = document.createElement('div');
      d.className = 'camp ' + cp.cls + (act ? ' act' : '');
      const cc = document.createElement('div'); cc.className = 'cc';
      if (cp.pub === 0) { const s2 = document.createElement('div'); s2.style.cssText = 'font-size:19px'; s2.textContent = '🐉'; cc.appendChild(s2); }
      else this.pubs[ci].forEach(c => { const e = cardEl(c, 'tiny'); e.classList.add('pub'); cc.appendChild(e); });
      d.innerHTML = '<div class="cn">' + cp.n + '</div>';
      d.appendChild(cc);
      const q = document.createElement('div'); q.className = 'cq';
      q.textContent = '公共 ' + cp.pub + ' · 出 ' + (5 - cp.pub) + ' 张';
      d.appendChild(q);
      /* 只有选中的阵营才显示当前倍率 */
      const bx = document.createElement('div'); bx.className = 'cbest';
      if (act) {
        const need = 5 - cp.pub;
        const own = this.hands[0].filter(c => this.sel.has(c.id));
        if (own.length === need) {
          const e = sgEval5(own.concat(this.pubs[ci]));
          bx.innerHTML = '<b>' + e.name + '</b> <b class="m">×' + e.mult + '</b>';
        } else bx.innerHTML = '<span style="color:#ffd7a8">还需 ' + (need - own.length) + ' 张</span>';
      } else bx.innerHTML = '&nbsp;';
      d.appendChild(bx);
      d.onclick = () => { if (!this.busy) this.fillReco(ci); };   // 选国即自动配好该国最优牌
      wrap.appendChild(d);
    });
    this.mid.appendChild(wrap);

    const pv = document.createElement('div');
    pv.style.cssText = 'text-align:center;font-size:11px;margin-top:5px;min-height:16px;color:#ffd7a8';
    pv.textContent = this.camp < 0 ? '点上方阵营，会自动帮你配好该国最优的牌' : '点手牌可自行替换，选满才能出战';
    this.mid.appendChild(pv);
    if (this.btnGo) this.btnGo.disabled = !this.canGo();
  }
  canGo() {
    if (this.camp < 0) return false;
    return this.sel.size === 5 - SG_CAMPS[this.camp].pub;
  }
  /* 按该阵营的最优牌型自动选牌 */
  fillReco(ci) {
    const per = sgBestPerCamp(this.hands[0], this.pubs)[ci];
    this.camp = ci;
    this.sel = per ? new Set(per.own.map(c => c.id)) : new Set();
    this.render();
    if (per) toast(SG_CAMPS[ci].n + '国最优：' + per.ev.name + ' ×' + per.ev.mult, 1200);
  }
  render() {
    for (let i = 1; i < 5; i++) {
      this.seats[i].querySelector('.hs').textContent = this.hands[i].length + ' 张';
      this.seats[i].querySelector('.bn').textContent = fmt(Math.max(0, this.P[i].beans + this.delta[i]));
    }
    if (!this.busy) { this.renderCamps(); for (let i = 0; i < 5; i++) this.slots[i].innerHTML = ''; }
    const hd = this.c.hand; hd.innerHTML = '';
    fitHand(hd, this.hands[0].length, 42);
    this.hands[0].forEach(c => {
      const e = cardEl(c); e.style.setProperty('--cw', '42px');
      if (this.sel.has(c.id)) e.classList.add('sel');
      e.onclick = () => {
        if (this.busy) return;
        if (this.camp < 0) return toast('请先选择阵营');
        const need = 5 - SG_CAMPS[this.camp].pub;
        if (this.sel.has(c.id)) this.sel.delete(c.id);
        else {
          if (this.sel.size >= need) return toast('已选满 ' + need + ' 张，先点掉一张再换');
          this.sel.add(c.id);
        }
        this.render();
      };
      hd.appendChild(e);
    });
    $('#tMyBeans').textContent = fmt(Math.max(0, this.P[0].beans + this.delta[0]));
    $('#tMyExtra').textContent = '第 ' + Math.min(4, this.round) + '/4 轮';
  }
  startRound() {
    if (this.c.over) return;
    if (this.round > 4) return this.finish();
    this.busy = false; this.sel = new Set(); this.camp = -1;
    $('#table').classList.remove('reveal');
    for (let i = 0; i < 5; i++) if (this.slots[i]) this.slots[i].innerHTML = '';
    this.deal();
    const a = this.c.act; a.innerHTML = '';
    actBtn('智能推荐', 'grey', () => {
      const per = sgBestPerCamp(this.hands[0], this.pubs);
      let bi = -1; per.forEach((r, i) => { if (r && (bi < 0 || sgCmp(r.ev, per[bi].ev) > 0)) bi = i; });
      if (bi >= 0) this.fillReco(bi);
    });
    this.btnGo = actBtn('出战', '', () => {
      if (!this.canGo()) return toast(this.camp < 0 ? '请先选择阵营' : '还没选满，选满才能出战');
      a.innerHTML = ''; this.btnGo = null; this.resolve();
    });
    this.render();
  }
  /* 一张牌的正面（底池的牌换底色） */
  faceEl(c, pubSet, big) {
    const e = cardEl(c, '');
    e.style.setProperty('--cw', big ? '38px' : '31px');
    if (pubSet.has(c.id)) e.classList.add('pub');
    return e;
  }
  /* 先摆 5 张盖着的牌 */
  layDown(i, big) {
    const sl = this.slots[i]; sl.innerHTML = '';
    const row = document.createElement('div'); row.className = 'reveal-row';
    for (let k = 0; k < 5; k++) {
      const f = document.createElement('div'); f.className = 'flipper';
      const bk = backEl('');
      bk.style.width = (big ? 38 : 31) + 'px';
      bk.style.height = Math.round((big ? 38 : 31) * 1.44) + 'px';
      f.appendChild(bk); row.appendChild(f);
    }
    sl.appendChild(row);
    const tag = document.createElement('div');
    tag.className = 'reveal-tag'; tag.style.visibility = 'hidden'; tag.textContent = '—';
    sl.appendChild(tag);
    return row;
  }
  /* 逐张翻开某家的牌 */
  async flipOpen(i, play, big) {
    const pubSet = new Set(this.pubs[play.camp].map(c => c.id));
    const cs = play.ev.cs.slice().sort((x, y) => y.r - x.r);
    const row = this.slots[i].querySelector('.reveal-row');
    const cells = [...row.children];
    for (let k = 0; k < cells.length; k++) {
      if (this.c.over) return;
      const el = cells[k];
      await done(anim(el, { rotateY: [0, 90] }, { duration: .15, ease: 'linear' }));
      if (this.c.over) return;
      el.innerHTML = ''; el.appendChild(this.faceEl(cs[k], pubSet, big));
      await done(anim(el, { rotateY: [-90, 0] }, { duration: .17, ease: 'linear' }));
      await sleep(60);
    }
  }
  /* 名次徽章 + 牌型（+ 输赢豆） */
  setTag(i, play, rank, delta) {
    const tag = this.slots[i].querySelector('.reveal-tag');
    if (!tag) return;
    tag.style.visibility = 'visible';
    tag.className = 'reveal-tag' + (rank === 1 ? ' first' : '');
    tag.innerHTML = '<span class="rank-badge rank-big rk' + Math.min(4, rank) + '">' + rank + '</span>'
      + '<span style="opacity:.85">' + SG_CAMPS[play.camp].n + '</span>'
      + '<b class="gold-txt">' + play.ev.name + '</b>'
      + (delta ? '<b class="amt" style="color:' + (delta > 0 ? '#7dffae' : '#ff8272') + '">'
        + (delta > 0 ? '+' : '') + fmt(delta) + '</b>' : '');
  }
  /* 已开牌的玩家之间重新排名（并列同名次） */
  rankOf(revealed, plays) {
    const ord = revealed.slice().sort((a, b) => sgCmp(plays[b].ev, plays[a].ev));
    const rk = {}; let cur = 1;
    ord.forEach((p, k) => {
      if (k > 0 && sgCmp(plays[p].ev, plays[ord[k - 1]].ev) !== 0) cur = k + 1;
      rk[p] = cur;
    });
    return rk;
  }
  async resolve() {
    this.busy = true;
    const plays = [];
    const mine = this.hands[0].filter(c => this.sel.has(c.id));
    plays[0] = { camp: this.camp, own: mine, ev: sgEval5(mine.concat(this.pubs[this.camp])) };
    for (let i = 1; i < 5; i++) plays[i] = sgBestPlay(this.hands[i], this.pubs);

    /* 出牌后隐藏手牌区，舞台留给中间的开牌与结算 */
    $('#table').classList.add('reveal');
    this.mid.innerHTML = '';
    const head = document.createElement('div');
    head.style.cssText = 'font-size:12px;background:rgba(0,0,0,.55);border-radius:10px;padding:4px 14px;'
      + 'border:1px solid rgba(255,215,106,.5);white-space:nowrap';
    head.innerHTML = '<span class="gold-txt">第 ' + this.round + ' 轮 · 亮牌</span>';
    this.mid.appendChild(head);
    /* 每家先扣 5 张 */
    for (let i = 0; i < 5; i++) this.layDown(i, i === 0);
    await sleep(600);
    if (this.c.over) return;

    /* 从我开始，按座位顺序逐家翻开，每翻完一家就重排名次 */
    const revealed = [];
    for (let i = 0; i < 5; i++) {
      if (this.c.over) return;
      await this.flipOpen(i, plays[i], i === 0);
      if (this.c.over) return;
      revealed.push(i);
      const rk = this.rankOf(revealed, plays);
      revealed.forEach(j => this.setTag(j, plays[j], rk[j], 0));
      const lead = revealed.filter(j => rk[j] === 1)[0];
      head.innerHTML = '<span class="gold-txt">第 ' + this.round + ' 轮 · 亮牌 ' + revealed.length + '/5</span>'
        + '　<span style="font-size:11px">暂列第一：' + (lead === 0 ? '我' : this.P[lead].name)
        + ' <b class="gold-txt">' + plays[lead].ev.name + ' ×' + plays[lead].ev.mult + '</b></span>';
      await sleep(i === 4 ? 400 : 650);
    }
    if (this.c.over) return;

    /* 全部亮完 → 结算 */
    const rank = this.rankOf([0, 1, 2, 3, 4], plays);
    const order = [0, 1, 2, 3, 4].slice().sort((a, b) => rank[a] - rank[b]);
    const win = order[0];
    const sameCamp = order.filter(i => rank[i] !== 1 && plays[i].camp === plays[win].camp).length;
    const sameType = order.filter(i => rank[i] !== 1 && plays[i].ev.t === plays[win].ev.t).length;
    const critM = Math.min(8, Math.pow(2, sameCamp));
    const killM = Math.min(8, Math.pow(2, sameType));
    const winMult = plays[win].ev.mult;
    const rd = [0, 0, 0, 0, 0];
    const winners = order.filter(i => rank[i] === 1);
    for (const i of order) {
      if (rank[i] === 1) continue;
      let pay = this.c.base * winMult * (SG_RANKMUL[rank[i] - 1] || 4);
      if (plays[i].camp === plays[win].camp) pay *= critM;
      if (plays[i].ev.t === plays[win].ev.t) pay *= killM;
      pay = capPay(pay, this.P[i].beans + this.delta[i], this.c.game.cap);
      rd[i] -= pay;
      const share = Math.floor(pay / winners.length);
      winners.forEach((w, k) => rd[w] += (k === 0 ? pay - share * (winners.length - 1) : share));
    }
    head.innerHTML = '<span class="gold-txt" style="font-size:14px">冠军 ' + plays[win].ev.name + ' ×' + winMult + '</span>'
      + '<div style="font-size:10.5px;margin-top:2px;color:#ffb3a7">'
      + (sameCamp ? '同阵营 ' + sameCamp + ' 人 → 暴击×' + critM + '　' : '')
      + (sameType ? '同牌型 ' + sameType + ' 人 → 杀×' + killM : '')
      + (!sameCamp && !sameType ? '名次倍率 32/24/12/4' : '') + '</div>';
    for (let i = 0; i < 5; i++) this.setTag(i, plays[i], rank[i], rd[i]);
    await sleep(800);
    if (this.c.over) return;
    beanFlow(this.anchors, rd);
    for (let i = 0; i < 5; i++) floatBean(this.anchors[i], rd[i]);
    await sleep(1000);
    if (this.c.over) return;

    /* 打出的牌与公共牌进入弃牌堆，下回合与牌堆洗混 */
    for (let i = 0; i < 5; i++) {
      const own = plays[i].own;
      this.hands[i] = this.hands[i].filter(c => own.indexOf(c) < 0);
      this.used = this.used.concat(own);
    }
    this.used = this.used.concat(this.pubs[0], this.pubs[1], this.pubs[2]);
    for (let i = 0; i < 5; i++) this.delta[i] += rd[i];
    for (let i = 1; i < 5; i++) this.seats[i].querySelector('.bn').textContent = fmt(Math.max(0, this.P[i].beans + this.delta[i]));
    $('#tMyBeans').textContent = fmt(Math.max(0, this.P[0].beans + this.delta[0]));
    await sleep(1500);
    if (this.c.over) return;
    $('#table').classList.remove('reveal');
    this.round++;
    this.startRound();
  }
  finish() {
    if (this.c.over) return;
    $('#table').classList.remove('reveal');
    settle(this.P.map((p, i) => ({ p: p, delta: this.delta[i], tag: '' })), '四轮结束 · 三国牌');
  }
}

GAMES.sanguo = {
  key: 'sanguo', name: '三国牌', seats: 5, base: 10, entry: 50000, cap: 20000,
  start(c) { new SanguoGame(c).run(); },
  rules: '<h2>三国牌</h2>'
    + '<h4>基础规则</h4><ul>'
    + '<li>一副扑克去掉大小王共 <b>52 张</b>，每局 <b>5 人</b>参与各自为战，进行 <b>4 轮</b>出牌比拼。</li>'
    + '<li>每轮开始，玩家每人拥有 <b>8 张手牌</b>；公共区域分为 <b>魏、蜀、吴</b> 三个阵营。</li>'
    + '<li>每轮向三个阵营刷新固定张数的公共牌：<b>魏国 3 张、蜀国 0 张、吴国 2 张</b>。</li></ul>'
    + '<h4>组合出牌</h4><ul>'
    + '<li>从手牌选对应数量的牌，与任一阵营的公共牌组成 <b>5 张牌型</b>进行比拼：<br>'
    + '　选魏国出 <b>2 张</b>（3+2）　｜　选蜀国出 <b>5 张</b>（5+0）　｜　选吴国出 <b>3 张</b>（2+3）</li>'
    + '<li>下个回合开始时，把所有打出的牌和公共区域的牌与牌堆洗混，再把全部玩家的手牌<b>补至 8 张</b>。</li></ul>'
    + '<h4>牌型规则（大 → 小）</h4>'
    + '<table class="rt"><tr><th>牌型</th><th>说明</th><th>倍率</th></tr>'
    + '<tr><td>同心连环</td><td>同花顺</td><td>×1000</td></tr>'
    + '<tr><td>四象强弩</td><td>四炸</td><td>×400</td></tr>'
    + '<tr><td>三军两将</td><td>三带二</td><td>×100</td></tr>'
    + '<tr><td>同袍营</td><td>同花</td><td>×80</td></tr>'
    + '<tr><td>连环计</td><td>顺子</td><td>×60</td></tr>'
    + '<tr><td>三英阵</td><td>三张</td><td>×40</td></tr>'
    + '<tr><td>双翼斩</td><td>两对</td><td>×30</td></tr>'
    + '<tr><td>双雄</td><td>对子</td><td>×20</td></tr>'
    + '<tr><td>单骑</td><td>单张</td><td>×10</td></tr>'
    + '</table><p style="margin-top:5px;font-size:12px">同牌型先比主体区域的点数，一致时再比踢脚牌；点数 A&gt;K&gt;Q&gt;…&gt;2，花色没有大小之分。</p>'
    + '<h4>结算规则</h4>'
    + '<table class="rt"><tr><th>名次</th><th>倍率</th></tr>'
    + '<tr><td>第 1 名</td><td>赢所有人</td></tr>'
    + '<tr><td>第 2 名</td><td>32</td></tr>'
    + '<tr><td>第 3 名</td><td>24</td></tr>'
    + '<tr><td>第 4 名</td><td>12</td></tr>'
    + '<tr><td>第 5 名</td><td>4</td></tr></table>'
    + '<ul><li>四轮每轮单独结算，豆子实时到账；<b>计算牌型倍率时只算第 1 名玩家的牌型</b>。</li>'
    + '<li>输家支付 = <b>底分 × 第 1 名牌型倍率 × 名次倍率 × 暴击 × 杀牌</b>。</li>'
    + '<li>出现多个第 1 名时，其余玩家名次顺延（例如有两个第 1 名，剩下的分别是 2、3、4 名）。</li>'
    + '<li>每次结算不超过场次封顶，也不超过输家全部欢乐豆。</li></ul>'
    + '<h4>暴击与杀牌</h4><ul>'
    + '<li><b>暴击</b>：与第 1 名 <b>同阵营</b> 会被暴击，同阵营人数越多倍率越高（最高 ×8）。</li>'
    + '<li><b>杀牌</b>：与第 1 名 <b>同牌型</b> 会被杀牌，同牌型人数越多扣得越狠（最高 ×8）。</li></ul>'
};
