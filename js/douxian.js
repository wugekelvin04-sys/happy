/* =====================================================================
   斗仙牌（按官方规则实现）
   1 副去大小王（52 张），4 人独立对决，凡/灵/仙三个区域，共 4 回合
   凡界 2 张、灵界 3 张、仙界 5 张；按牌型和点数得【灵力值】，
   每区域灵力高者赢低者，差距越大赢越多
   第 1 回合只开凡界+灵界；第 2 回合起仙界开放，回合结束【飞升】：
   凡→灵、灵→仙、仙→牌堆，然后弃牌并补满 8 张手牌
   ===================================================================== */
'use strict';

const DX_ZONES = [{ k: 'fan', n: '凡', size: 2 }, { k: 'ling', n: '灵', size: 3 }, { k: 'xian', n: '仙', size: 5 }];

/* ---- 灵力值（完全按游戏内《牌型大小和倍率》）----
   灵力值 =（主体牌型的点数大小 × 牌型倍率 + 牌型值）× 回合倍率
   点数 A>K>Q>…>2；K=13 Q=12 J=11；A 常规 14，组成 A2 / A23 / A2345 时 A 记为 1
   回合倍率（灵气复苏）：第 1 回合 1，第 2、3 回合 2，第 4 回合 3 */
const DX_ROUND_MUL = [0, 1, 2, 2, 3];
/* [牌型倍率, 牌型值] */
const DX_TABLE = [
  { '清龙': [1, 70], '两仪': [1, 50], '飞剑': [1, 30], '同花': [1, 15], '散手': [1, 0] },
  { '至尊龙': [2, 100], '三清诀': [2, 70], '连环剑': [1, 45], '忘忧花': [1, 30], '两仪': [1, 15], '散手': [1, 0] },
  {
    '五爪金龙': [6, 360], '四象神功': [5, 280], '三清两仪': [5, 200], '剑贯长空': [2, 100],
    '天花乱坠': [2, 70], '三清诀': [1, 45], '乾坤对': [1, 30], '两仪': [1, 15], '散手': [1, 0]
  }
];
/* 各区域牌型从大到小（游戏内顺序：仙界是顺子 > 同花） */
const DX_ORDER = [
  ['清龙', '两仪', '飞剑', '同花', '散手'],
  ['至尊龙', '三清诀', '连环剑', '忘忧花', '两仪', '散手'],
  ['五爪金龙', '四象神功', '三清两仪', '剑贯长空', '天花乱坠', '三清诀', '乾坤对', '两仪', '散手']
];
function dxScore(zone, name, key, round) {
  const t = DX_TABLE[zone][name];
  return (key * t[0] + t[1]) * (DX_ROUND_MUL[round] || 1);
}
function dxPower(cards, zone, round) {
  round = round || 1;
  if (!cards || !cards.length) return { p: -1, n: '空' };
  const rs = cards.map(c => c.r).sort((a, b) => b - a);
  const cnt = {}; rs.forEach(r => cnt[r] = (cnt[r] || 0) + 1);
  const gr = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || b - a);
  const flush = new Set(cards.map(c => c.s)).size === 1;
  const uniq = [...new Set(rs)];
  let straight = false, sHi = rs[0];
  if (uniq.length === rs.length) {
    if (uniq[0] - uniq[uniq.length - 1] === rs.length - 1) straight = true;
    else if (uniq[0] === 14) {                       // A 记为 1：A2 / A23 / A2345
      const alt = uniq.slice(1).concat([1]).sort((a, b) => b - a);
      if (alt[0] - alt[alt.length - 1] === rs.length - 1) { straight = true; sHi = alt[0]; }
    }
  }
  const mk = (n, k) => ({ p: dxScore(zone, n, k, round), n: n, key: k });
  if (zone === 0) {                                  // 凡界 2 张
    if (straight && flush) return mk('清龙', sHi);
    if (cnt[gr[0]] === 2) return mk('两仪', gr[0]);
    if (straight) return mk('飞剑', sHi);
    if (flush) return mk('同花', rs[0]);
    return mk('散手', rs[0]);
  }
  if (zone === 1) {                                  // 灵界 3 张
    if (straight && flush) return mk('至尊龙', sHi);
    if (cnt[gr[0]] === 3) return mk('三清诀', gr[0]);
    if (straight) return mk('连环剑', sHi);
    if (flush) return mk('忘忧花', rs[0]);
    if (cnt[gr[0]] === 2) return mk('两仪', gr[0]);
    return mk('散手', rs[0]);
  }
  /* 仙界 5 张：剑贯长空（顺子）大于天花乱坠（同花） */
  if (straight && flush) return mk('五爪金龙', sHi);
  if (cnt[gr[0]] === 4) return mk('四象神功', gr[0]);
  if (cnt[gr[0]] === 3 && cnt[gr[1]] === 2) return mk('三清两仪', gr[0]);
  if (straight) return mk('剑贯长空', sHi);
  if (flush) return mk('天花乱坠', rs[0]);
  if (cnt[gr[0]] === 3) return mk('三清诀', gr[0]);
  if (cnt[gr[0]] === 2 && cnt[gr[1]] === 2) return mk('乾坤对', gr[0]);
  if (cnt[gr[0]] === 2) return mk('两仪', gr[0]);
  return mk('散手', rs[0]);
}

/* 在已有 fixed 牌的基础上，从 hand 里挑 need 张，使该区域灵力最大 */
function dxBestFill(hand, fixed, zone, need, round) {
  if (need <= 0) return [];
  if (hand.length < need) return hand.slice(0, need);
  let best = null, bestP = -1;
  const cur = [];
  const rec = (start) => {
    if (cur.length === need) {
      const p = dxPower(fixed.concat(cur), zone, round).p;
      if (p > bestP) { bestP = p; best = cur.slice(); }
      return;
    }
    for (let i = start; i < hand.length; i++) { cur.push(hand[i]); rec(i + 1); cur.pop(); }
  };
  rec(0);
  return best || hand.slice(0, need);
}

class DouxianGame {
  constructor(c) {
    this.c = c; this.P = c.players; this.n = 4;
    this.delta = [0, 0, 0, 0];
    this.hands = [[], [], [], []];
    this.field = [0, 1, 2, 3].map(() => [[], [], []]);   // [player][zone] = cards
    this.deck = []; this.used = [];
    this.round = 0; this.reset = [false, false, false, false];
    this.sel = new Set(); this.activeZone = 0; this.phase = '';
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
  run() {
    this.deck = [];
    for (const s of SUITS) for (let r = 2; r <= 14; r++) this.deck.push(mkCard(r, s, 0));
    shuffle(this.deck);
    for (let i = 0; i < 4; i++) this.hands[i] = this.draw(8).sort((a, b) => b.r - a.r);
    this.layout();
    this.round = 1;
    this.startRound();
  }
  layout() {
    const b = this.c.body;
    [...b.querySelectorAll('.seat-chip,.play-slot,.center-zone')].forEach(e => e.remove());
    b.style.cssText = '';
    this.seats = []; this.slots = [];
    const CH = [null, { chip: { right: '2px', top: '26%' }, rev: true }, { chip: { left: '50%', top: '2px', tx: -50 } }, { chip: { left: '2px', top: '26%' } }];
    const ZP = [{ left: '50%', bottom: '1%', tx: -50 }, { right: '2px', top: '46%' }, { left: '50%', top: '23%', tx: -50 }, { left: '2px', top: '46%' }];
    for (let i = 1; i < 4; i++) {
      const el = mkSeat(this.P[i], CH[i], '<span class="hs"></span>');
      b.appendChild(el); this.seats[i] = el;
    }
    for (let i = 0; i < 4; i++) {
      const sl = document.createElement('div');
      sl.className = 'play-slot'; sl.style.zIndex = 4;
      applyPos(sl, ZP[i]); b.appendChild(sl); this.slots[i] = sl;
    }
    this.tip = document.createElement('div'); this.tip.className = 'center-zone';
    b.appendChild(this.tip);
    this.anchors = [$('.me-bar'), this.seats[1], this.seats[2], this.seats[3]];
  }
  realmEl(pi, zi, mini, reveal) {
    const cards = this.field[pi][zi], size = DX_ZONES[zi].size;
    const d = document.createElement('div');
    d.className = 'realm' + (!mini && zi === this.activeZone && this.phase === 'place' ? ' act' : '');
    const nm = document.createElement('div'); nm.className = 'rn'; nm.textContent = DX_ZONES[zi].n;
    d.appendChild(nm);
    const rs = document.createElement('div'); rs.className = 'rs';
    for (let i = 0; i < size; i++) {
      if (cards[i]) {
        if (reveal === false) { const bk = backEl(''); bk.style.width = mini ? '17px' : '21px'; bk.style.height = mini ? '24px' : '30px'; rs.appendChild(bk); }
        else {
          const e = cardEl(cards[i], mini ? 'xs' : 'tiny');
          if (!mini && this.phase === 'place') {
            e.style.cursor = 'pointer';
            e.onclick = ev => { ev.stopPropagation(); this.pullBack(zi, cards[i]); };
          }
          rs.appendChild(e);
        }
      } else rs.appendChild(slotEl(true));
    }
    d.appendChild(rs);
    if (!mini) {
      const pw = document.createElement('div'); pw.className = 'pw'; d.appendChild(pw);
      d.onclick = () => { if (this.phase === 'place') this.pickZone(zi); };
    }
    return d;
  }
  /* 点区域：自动放入该区域当前能做到的最大组合 */
  pickZone(z) {
    this.activeZone = z;
    const need = DX_ZONES[z].size - this.field[0][z].length;
    if (need > 0 && this.hands[0].length >= need) {
      const pick = dxBestFill(this.hands[0], this.field[0][z], z, need, this.round);
      pick.forEach(c => { this.field[0][z].push(c); this.hands[0] = this.hands[0].filter(x => x.id !== c.id); });
      const p = dxPower(this.field[0][z], z, this.round);
      toast(DX_ZONES[z].n + '界最大：' + p.n + ' ' + p.p, 1100);
    }
    this.render(); this.tipPlace();
  }
  /* 把区域里的牌收回手牌（换牌） */
  pullBack(z, card) {
    if (this.field[0][z].length <= this.keep0[z]) return toast('这张是上回合飞升上来的，不能收回');
    this.field[0][z] = this.field[0][z].filter(x => x.id !== card.id);
    this.hands[0].push(card); this.hands[0].sort((a, b) => b.r - a.r);
    this.activeZone = z;
    this.render(); this.tipPlace();
  }
  render(revealAll) {
    for (let i = 1; i < 4; i++) {
      const box = this.slots[i]; box.innerHTML = '';
      const mr = document.createElement('div'); mr.className = 'mini-realms';
      for (let z = 0; z < 3; z++) {
        if (this.round === 1 && z === 2) continue;
        mr.appendChild(this.realmEl(i, z, true, revealAll ? true : false));
      }
      box.appendChild(mr);
      this.seats[i].querySelector('.bn').textContent = fmt(Math.max(0, this.P[i].beans + this.delta[i]));
      this.seats[i].querySelector('.hs').textContent = '手牌 ' + this.hands[i].length;
    }
    const box0 = this.slots[0]; box0.innerHTML = '';
    const wrap = document.createElement('div'); wrap.className = 'realms';
    for (let z = 0; z < 3; z++) {
      if (this.round === 1 && z === 2) continue;
      const el = this.realmEl(0, z, false, true);
      const need = DX_ZONES[z].size - this.field[0][z].length;
      const pw = el.querySelector('.pw');
      if (this.phase === 'place' && need > 0) pw.innerHTML = '<span style="color:#ffd7a8">缺 ' + need + '</span>';
      else if (this.field[0][z].length === DX_ZONES[z].size) {
        const p = dxPower(this.field[0][z], z, this.round); pw.textContent = p.n + ' ' + p.p;
      }
      wrap.appendChild(el);
    }
    box0.appendChild(wrap);
    this.myBanner = this.myBanner || null;
    const hd = this.c.hand; hd.innerHTML = '';
    fitHand(hd, this.hands[0].length, 38);
    this.hands[0].forEach(c => {
      const e = cardEl(c); e.style.setProperty('--cw', '38px');
      if (this.sel.has(c.id)) e.classList.add('sel');
      e.onclick = () => this.tapCard(c);
      hd.appendChild(e);
    });
    $('#tMyBeans').textContent = fmt(Math.max(0, this.P[0].beans + this.delta[0]));
    $('#tMyExtra').textContent = '第 ' + Math.min(4, this.round) + '/4 回合';
  }
  tapCard(c) {
    if (this.c.over) return;
    if (this.phase === 'place') {
      const z = this.activeZone, need = DX_ZONES[z].size - this.field[0][z].length;
      if (need <= 0) return toast('该区域已满，先点其他区域');
      this.hands[0] = this.hands[0].filter(x => x.id !== c.id);
      this.field[0][z].push(c);
      if (DX_ZONES[z].size - this.field[0][z].length === 0) {
        for (let k = 0; k < 3; k++) { const t = (z + k + 1) % 3; if (this.round === 1 && t === 2) continue; if (this.field[0][t].length < DX_ZONES[t].size) { this.activeZone = t; break; } }
      }
      this.render(); return this.tipPlace();
    }
    if (this.phase === 'discard') {
      this.sel.has(c.id) ? this.sel.delete(c.id) : this.sel.add(c.id);
      return this.render();
    }
  }
  needCounts(i) { return [0, 1, 2].map(z => (this.round === 1 && z === 2) ? 0 : DX_ZONES[z].size - this.field[i][z].length); }

  startRound() {
    if (this.c.over) return;
    if (this.round > 4) return this.finish();
    this.phase = 'place'; this.sel = new Set();
    this.keep0 = [0, 1, 2].map(z => this.field[0][z].length);
    this.placeTotal = this.needCounts(0).reduce((a, b) => a + b, 0);
    this.activeZone = this.needCounts(0).findIndex(x => x > 0);
    for (let i = 1; i < 4; i++) this.aiPlace(i);
    this.autoPlace(true);                       // 进来就按各区最大自动布好，玩家可再替换
    const a = this.c.act; a.innerHTML = '';
    actBtn('自动布阵', 'grey', () => this.autoPlace());
    actBtn('全部收回', 'grey', () => {
      for (let z = 0; z < 3; z++) { while (this.field[0][z].length > this.keep0[z]) this.hands[0].push(this.field[0][z].pop()); }
      this.hands[0].sort((x, y) => y.r - x.r); this.render(); this.tipPlace();
    });
    actBtn('确认布阵', '', () => {
      if (this.needCounts(0).some(x => x > 0)) return toast('还有区域没放满');
      a.innerHTML = ''; this.resolve();
    });
  }
  tipPlace() {
    const need = this.needCounts(0).reduce((a, b) => a + b, 0);
    const totalNeed = this.placeTotal || need;
    const zs = (this.round === 1 ? [0, 1] : [0, 1, 2]).map(z => {
      if (this.field[0][z].length < DX_ZONES[z].size) return DX_ZONES[z].n + ' <span style="color:#ffd7a8">缺</span>';
      const p = dxPower(this.field[0][z], z, this.round);
      return DX_ZONES[z].n + ' <b class="gold-txt">' + p.n + ' ' + p.p + '</b>';
    }).join('　');
    this.tip.innerHTML = '<div class="gold-txt" style="font-size:13px;letter-spacing:2px">第 ' + this.round + ' 回合 · 布阵'
      + '<span style="font-size:11px;letter-spacing:0"> （已放入 ' + (totalNeed - need) + '/' + totalNeed + '）</span></div>'
      + '<div style="font-size:11px;margin-top:1px">' + zs + '</div>'
      + '<div class="zone-line">点区域自动放该区最大牌 · 点区域里的牌可收回替换</div>';
  }
  autoPlace(silent) {
    for (let z = 0; z < 3; z++) while (this.field[0][z].length > this.keep0[z]) this.hands[0].push(this.field[0][z].pop());
    this.hands[0].sort((x, y) => y.r - x.r);
    const order = this.round === 1 ? [1, 0] : [2, 1, 0];   // 仙界最值钱，先满足
    order.forEach(z => {
      const need = DX_ZONES[z].size - this.field[0][z].length;
      if (need <= 0) return;
      const pick = dxBestFill(this.hands[0], this.field[0][z], z, need, this.round);
      pick.forEach(c => { this.field[0][z].push(c); this.hands[0] = this.hands[0].filter(x => x.id !== c.id); });
    });
    this.render(); this.tipPlace();
    if (!silent) toast('已按各区最大自动布阵');
  }
  aiPlace(i) {
    // 与玩家的「自动布阵」同一套算法：按 仙 → 灵 → 凡 逐区取最大
    // 少量人机会先照顾灵界，制造一点风格差异
    const order = this.round === 1 ? [1, 0]
      : (Math.random() < .22 ? [1, 2, 0] : [2, 1, 0]);
    order.forEach(z => {
      const need = DX_ZONES[z].size - this.field[i][z].length;
      if (need <= 0) return;
      const pick = dxBestFill(this.hands[i], this.field[i][z], z, need, this.round);
      pick.forEach(c => { this.field[i][z].push(c); this.hands[i] = this.hands[i].filter(x => x.id !== c.id); });
    });
  }
  /* ---------- 结算 ---------- */
  banner(i, txt, val, rankIdx) {
    let host = this.slots[i].querySelector('.pwr-wrap');
    if (!host) { host = document.createElement('div'); host.className = 'pwr-wrap'; this.slots[i].insertBefore(host, this.slots[i].firstChild); }
    if (!host) return;
    host.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'pwr-banner' + (rankIdx === 0 ? ' win' : '');
    d.innerHTML = '<span>' + txt + '</span><span>🔥</span><span class="v">' + val + '</span>'
      + '<span class="rank-badge rk' + (rankIdx + 1) + '">' + (rankIdx + 1) + '</span>';
    host.appendChild(d);
  }
  clearBanners() {
    for (let i = 0; i < 4; i++) { const h = this.slots[i].querySelector('.pwr-wrap'); if (h) h.innerHTML = ''; }
  }
  beanAnchor(i) { return this.anchors[i]; }
  async resolve() {
    this.phase = 'show';
    this.render(true);
    const zones = this.round === 1 ? [0, 1] : [0, 1, 2];
    const pw = [0, 1, 2, 3].map(i => zones.map(z => dxPower(this.field[i][z], z, this.round)));
    const total = [0, 0, 0, 0];
    for (let zi = 0; zi < zones.length; zi++) {
      const z = zones[zi];
      this.tip.innerHTML = '<div class="gold-txt" style="font-size:14px;letter-spacing:2px">' + DX_ZONES[z].n + '界斗法</div>'
        + '<div class="zone-line">' + DX_ZONES[z].n + '界：' + DX_ORDER[z].map((n, k) => k === 0 ? '<b>' + n + '</b>' : n).join(' &gt; ') + '</div>';
      /* 名次 + 横幅 */
      const ord = [0, 1, 2, 3].slice().sort((a, b) => pw[b][zi].p - pw[a][zi].p);
      ord.forEach((pi, k) => this.banner(pi, pw[pi][zi].n, pw[pi][zi].p, k));
      await sleep(1400);
      if (this.c.over) return;
      /* 两两结算 */
      const rd = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
        const d = pw[i][zi].p - pw[j][zi].p;
        if (d === 0) continue;
        const w = d > 0 ? i : j, l = d > 0 ? j : i;
        const amt = capPay(Math.abs(d) * this.c.base,
          this.P[l].beans + this.delta[l] + total[l] + rd[l], this.c.game.cap);
        rd[w] += amt; rd[l] -= amt;
      }
      const before = total.slice();
      for (let i = 0; i < 4; i++) {
        total[i] += rd[i];
        const el = i === 0 ? $('#tMyBeans') : this.seats[i].querySelector('.bn');
        animNumber(el, this.P[i].beans + this.delta[i] + before[i], this.P[i].beans + this.delta[i] + total[i], 1000);
        floatBean(this.beanAnchor(i), rd[i]);
      }
      beanFlow(this.anchors, rd);
      await sleep(2100);
      if (this.c.over) return;
      this.clearBanners();
    }
    /* 全胜 */
    const sweepWin = [], sweepLose = [], sweepPairs = [];
    const sd = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      if (i === j) continue;
      let all = true, diff = 0;
      for (let zi = 0; zi < zones.length; zi++) {
        if (pw[i][zi].p < pw[j][zi].p) { all = false; break; }
        diff += pw[i][zi].p - pw[j][zi].p;
      }
      if (all && diff > 0) {
        const amt = capPay(diff * this.c.base,
          this.P[j].beans + this.delta[j] + total[j] + sd[j], this.c.game.cap);
        sd[i] += amt; sd[j] -= amt;
        sweepPairs.push([i, j]);
        if (sweepWin.indexOf(i) < 0) sweepWin.push(i);
        if (sweepLose.indexOf(j) < 0) sweepLose.push(j);
      }
    }
    if (sweepWin.length) {
      this.tip.innerHTML = '<div class="gold-txt" style="font-size:15px;letter-spacing:3px">全　胜</div>'
        + '<div class="zone-line">' + sweepWin.map(i => i === 0 ? '我' : this.P[i].name).join('、') + ' 三界灵力全面压制，额外结算一次</div>';
      const before = total.slice();
      for (let i = 0; i < 4; i++) {
        total[i] += sd[i];
        const el = i === 0 ? $('#tMyBeans') : this.seats[i].querySelector('.bn');
        animNumber(el, this.P[i].beans + this.delta[i] + before[i], this.P[i].beans + this.delta[i] + total[i], 1000);
        floatBean(this.beanAnchor(i), sd[i]);
      }
      beanFlow(this.anchors, sd);
      await sleep(2200);
      if (this.c.over) return;
    }
    for (let i = 0; i < 4; i++) this.delta[i] += total[i];
    this.render(true);
    /* 官方：一回合内全胜 2 人及以上 →「得证大道」；全输给 2 人及以上 →「隐忍渡劫」。
       只对触发的那名玩家生效，且在下一回合补牌之后才把场上的牌全部收回手中。 */
    const winCnt = [0, 0, 0, 0], loseCnt = [0, 0, 0, 0];
    sweepPairs.forEach(([w, l]) => { winCnt[w]++; loseCnt[l]++; });
    this.reset = [0, 1, 2, 3].map(i => winCnt[i] >= 2 || loseCnt[i] >= 2);
    if (this.reset[0]) bigWin(winCnt[0] >= 2 ? '得证大道' : '隐忍渡劫');
    else if (this.reset.some(Boolean)) toast('有玩家触发了' + (winCnt.some(c => c >= 2) ? '得证大道' : '隐忍渡劫'), 1200);
    this.round++;
    if (this.round > 4) return setTimeout(() => this.finish(), 900);
    setTimeout(() => this.ascend(), this.reset.some(Boolean) ? 1400 : 600);
  }
  /* ---------- 飞升 + 弃牌 ---------- */
  ascend() {
    if (this.c.over) return;
    for (let i = 0; i < 4; i++) {                 // 飞升：凡→灵、灵→仙、仙界牌回牌堆
      this.used = this.used.concat(this.field[i][2]);
      this.field[i][2] = this.field[i][1];
      this.field[i][1] = this.field[i][0];
      this.field[i][0] = [];
      this.hands[i].sort((a, b) => b.r - a.r);
    }
    this.phase = 'discard'; this.sel = new Set();
    this.tip.innerHTML = '<div class="gold-txt" style="font-size:13px;letter-spacing:2px">飞升完成 · 弃牌阶段</div>'
      + '<div class="zone-line">凡→灵、灵→仙、仙界牌回牌堆；可弃掉任意张手牌，下回合补满 8 张</div>';
    for (let i = 1; i < 4; i++) this.aiDiscard(i);
    this.render();
    const a = this.c.act; a.innerHTML = '';
    actBtn('智能弃牌', 'grey', () => {
      this.sel = new Set(this.hands[0].filter(c => c.r < 10 && this.hands[0].filter(x => x.r === c.r).length < 2).map(c => c.id));
      this.render();
    });
    actBtn('确认', '', () => {
      a.innerHTML = '';
      this.used = this.used.concat(this.hands[0].filter(c => this.sel.has(c.id)));
      this.hands[0] = this.hands[0].filter(c => !this.sel.has(c.id));
      for (let i = 0; i < 4; i++) {              // 补齐手牌到 8 张
        const need = 8 - this.hands[i].length;
        if (need > 0) this.hands[i] = this.hands[i].concat(this.draw(need));
      }
      /* 补牌后，触发得证大道 / 隐忍渡劫的玩家把场上的牌全部收回手中，下回合重新填满三界 */
      for (let i = 0; i < 4; i++) {
        if (!this.reset[i]) continue;
        for (let z = 0; z < 3; z++) { this.hands[i] = this.hands[i].concat(this.field[i][z]); this.field[i][z] = []; }
      }
      this.reset = [false, false, false, false];
      for (let i = 0; i < 4; i++) this.hands[i].sort((x, y) => y.r - x.r);
      this.sel = new Set();
      this.startRound();
    });
  }
  aiDiscard(i) {
    const keep = [];
    this.hands[i].forEach(c => {
      const pairAble = this.hands[i].filter(x => x.r === c.r).length >= 2;
      if (c.r >= 11 || pairAble) keep.push(c); else this.used.push(c);
    });
    this.hands[i] = keep;
  }
  finish() {
    if (this.c.over) return;
    const rows = this.P.map((p, i) => ({ p: p, delta: this.delta[i], tag: '' }));
    settle(rows, '四回合结束 · 斗仙牌');
  }
}

GAMES.douxian = {
  key: 'douxian', name: '斗仙牌', seats: 4, base: 150, entry: 80000, cap: 20000,
  start(c) { new DouxianGame(c).run(); },
  rules: '<h2>斗仙牌</h2>'
    + '<h4>基础设定 · 三界修仙场</h4><ul>'
    + '<li>1 副去掉大小王的扑克（<b>52 张</b>），<b>4 名玩家</b>独立对决，分 <b>3 个区域</b>出牌，共进行 <b>4 回合</b>。</li>'
    + '<li>每位玩家拥有 <b>凡界（2 张）／灵界（3 张）／仙界（5 张）</b>，不同区域可放的张数与牌型大小都不同。</li>'
    + '<li>每个区域按顺序单独比拼，根据牌型与点数得到 <b>【灵力值】</b>，<b>灵力值差距越大赢豆越多</b>。</li></ul>'
    + '<h4>对局流程 · 暗牌布阵</h4><ul>'
    + '<li>每人 <b>8 张手牌</b>。<b>第 1 回合</b>只开凡界 + 灵界，用手牌填满后依次比拼结算。</li>'
    + '<li><b>第 2 回合起仙界开放</b>，每回合结束进入【飞升】：<b>凡界的牌移到灵界，灵界的牌升到仙界，仙界牌回到牌堆</b>。</li>'
    + '<li>随后是弃牌阶段，可扔掉任意张手牌，下一回合补满 8 张，再用手牌填满空出来的区域。</li></ul>'
    + '<h4>牌型大小（各区域不同）</h4>'
    + '<table class="rt"><tr><th>区域</th><th>牌型（大 → 小）</th></tr>'
    + '<tr><td>凡（2 张）</td><td style="text-align:left;color:#e2f2e8;font-weight:400">清龙 &gt; 两仪 &gt; 飞剑 &gt; 同花 &gt; 散手</td></tr>'
    + '<tr><td>灵（3 张）</td><td style="text-align:left;color:#e2f2e8;font-weight:400">至尊龙 &gt; 三清决 &gt; 连环剑 &gt; 忘忧花 &gt; 两仪 &gt; 散手</td></tr>'
    + '<tr><td>仙（5 张）</td><td style="text-align:left;color:#e2f2e8;font-weight:400">五爪金龙 &gt; 四象神功 &gt; 三清两仪 &gt; 天花乱坠 &gt; 剑贯长空 &gt; 三清决 &gt; 乾坤对 &gt; 两仪 &gt; 散手</td></tr>'
    + '</table>'
    + '<p style="margin-top:6px;font-size:12px">灵力值示例：仙界「五爪金龙」A 高 = <b class="gold-txt">188</b>，「四象神功」AAAA = <b class="gold-txt">100</b>，差 88 点即赢 88 倍。</p>'
    + '<h4>结算规则 · 全胜机制</h4><ul>'
    + '<li>每回合按 <b>凡界 → 灵界 → 仙界</b> 顺序单独比拼，依次结算；每个区域灵力高者赢低者，<b>输赢 = 灵力差 × 底分</b>。</li>'
    + '<li><b>全胜</b>：单回合三个区域灵力均 ≥ 某一对手，该对手额外再按灵力差结算一次。</li>'
    + '<li>全胜 2 人及以上触发 <b>「得证大道」</b>、全输 2 人及以上触发 <b>「隐忍渡劫」</b>：下回合收回所有场牌重新规划。</li></ul>'
};
