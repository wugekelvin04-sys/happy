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

/* ---- 灵力值 ----
   数值按官方对局视频标定：
   凡界 清龙 4♥3♥=148、A♥2♥=144、K-Q=166  → 140 + 2×高牌
   灵界 忘忧花 K高=43 → 30+高牌；连环剑 A23=48、J10 9=56 → 45+高牌
   仙界 散手 A高=28 → 2×高牌；两仪 一对6=42 → 30+2×高牌
   结算：每区域两两比较，输赢 = 灵力差 × 底分（视频中 +6000/−3900/−2100 已逐一验算） */
const DX_TABLE = [
  /* 凡界：系数 2，档距 35 */ { c: 2, base: { '散手': 0, '同花': 35, '飞剑': 70, '两仪': 105, '清龙': 140 } },
  /* 灵界：系数 1，档距 15 */ { c: 1, base: { '散手': 0, '两仪': 15, '忘忧花': 30, '连环剑': 45, '三清决': 60, '至尊龙': 75 } },
  /* 仙界：系数 2，档距 30 */ { c: 2, base: { '散手': 0, '两仪': 30, '乾坤对': 60, '三清决': 90, '剑贯长空': 120, '天花乱坠': 150, '三清两仪': 180, '四象神功': 210, '五爪金龙': 240 } }
];
const DX_ORDER = [
  ['清龙', '两仪', '飞剑', '同花', '散手'],
  ['至尊龙', '三清决', '连环剑', '忘忧花', '两仪', '散手'],
  ['五爪金龙', '四象神功', '三清两仪', '天花乱坠', '剑贯长空', '三清决', '乾坤对', '两仪', '散手']
];
function dxScore(zone, name, key) {
  const t = DX_TABLE[zone];
  return t.base[name] + t.c * key;
}
function dxPower(cards, zone) {
  if (!cards || !cards.length) return { p: -1, n: '空' };
  const rs = cards.map(c => c.r).sort((a, b) => b - a);
  const cnt = {}; rs.forEach(r => cnt[r] = (cnt[r] || 0) + 1);
  const gr = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || b - a);
  const flush = new Set(cards.map(c => c.s)).size === 1;
  const uniq = [...new Set(rs)];
  let straight = false, sHi = rs[0];
  if (uniq.length === rs.length) {
    if (uniq[0] - uniq[uniq.length - 1] === rs.length - 1) straight = true;
    else if (uniq[0] === 14) {                       // A 当 1 的小顺（A2、A23、A2345）
      const alt = uniq.slice(1).concat([1]).sort((a, b) => b - a);
      if (alt[0] - alt[alt.length - 1] === rs.length - 1) { straight = true; sHi = alt[0]; }
    }
  }
  const mk = (n, k) => ({ p: dxScore(zone, n, k), n: n });
  if (zone === 0) {                                  // 凡界 2 张
    if (straight && flush) return mk('清龙', sHi);
    if (cnt[gr[0]] === 2) return mk('两仪', gr[0]);
    if (straight) return mk('飞剑', sHi);
    if (flush) return mk('同花', rs[0]);
    return mk('散手', rs[0]);
  }
  if (zone === 1) {                                  // 灵界 3 张
    if (straight && flush) return mk('至尊龙', sHi);
    if (cnt[gr[0]] === 3) return mk('三清决', gr[0]);
    if (straight) return mk('连环剑', sHi);
    if (flush) return mk('忘忧花', rs[0]);
    if (cnt[gr[0]] === 2) return mk('两仪', gr[0]);
    return mk('散手', rs[0]);
  }
  /* 仙界 5 张 */
  if (straight && flush) return mk('五爪金龙', sHi);
  if (cnt[gr[0]] === 4) return mk('四象神功', gr[0]);
  if (cnt[gr[0]] === 3 && cnt[gr[1]] === 2) return mk('三清两仪', gr[0]);
  if (flush) return mk('天花乱坠', rs[0]);
  if (straight) return mk('剑贯长空', sHi);
  if (cnt[gr[0]] === 3) return mk('三清决', gr[0]);
  if (cnt[gr[0]] === 2 && cnt[gr[1]] === 2) return mk('乾坤对', gr[0]);
  if (cnt[gr[0]] === 2) return mk('两仪', gr[0]);
  return mk('散手', rs[0]);
}

class DouxianGame {
  constructor(c) {
    this.c = c; this.P = c.players; this.n = 4;
    this.delta = [0, 0, 0, 0];
    this.hands = [[], [], [], []];
    this.field = [0, 1, 2, 3].map(() => [[], [], []]);   // [player][zone] = cards
    this.deck = []; this.used = [];
    this.round = 0; this.reset = false;
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
    const b = this.c.body; b.innerHTML = ''; b.style.cssText = 'flex:1;position:relative;overflow:hidden;display:flex;flex-direction:column'; this.rows = [];
    for (let i = 1; i < 4; i++) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:3px 6px;margin:2px 4px;'
        + 'background:rgba(0,0,0,.32);border:1px solid rgba(255,255,255,.14);border-radius:10px';
      row.innerHTML = '<div class="avatar" style="width:26px;height:26px;font-size:13px">' + this.P[i].avatar + '</div>'
        + '<div style="min-width:60px;max-width:74px;font-size:10.5px;line-height:1.3;position:relative">'
        + '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700">' + this.P[i].name + '</div>'
        + '<div class="bean gold-txt"><i></i><span class="bn">' + fmt(this.P[i].beans) + '</span></div></div>'
        + '<div style="flex:1;display:flex;flex-direction:column;align-items:flex-end;gap:1px">'
        + '<div class="pwr-wrap"></div><div class="mini-realms"></div></div>';
      b.appendChild(row); this.rows[i] = row;
    }
    this.tip = document.createElement('div');
    this.tip.style.cssText = 'flex:1;display:flex;flex-direction:column;justify-content:center;text-align:center;font-size:12px;padding:4px 8px';
    b.appendChild(this.tip);
  }
  realmEl(cards, size, zi, mini, reveal) {
    const d = document.createElement('div');
    d.className = 'realm' + (!mini && zi === this.activeZone && this.phase === 'place' ? ' act' : '');
    const rs = document.createElement('div'); rs.className = 'rs';
    for (let i = 0; i < size; i++) {
      if (cards[i]) {
        if (reveal === false) { const b = backEl(''); b.style.width = mini ? '20px' : '26px'; b.style.height = mini ? '29px' : '37px'; rs.appendChild(b); }
        else rs.appendChild(cardEl(cards[i], mini ? 'tiny' : 'mini'));
      } else rs.appendChild(slotEl(mini));
    }
    const nm = document.createElement('div'); nm.className = 'rn'; nm.textContent = DX_ZONES[zi].n;
    d.appendChild(nm); d.appendChild(rs);
    if (!mini) { const pw = document.createElement('div'); pw.className = 'pw'; d.appendChild(pw); }
    if (!mini) d.onclick = () => { if (this.phase === 'place') { this.activeZone = zi; this.render(); } };
    return d;
  }
  render(revealAll) {
    for (let i = 1; i < 4; i++) {
      const box = this.rows[i].querySelector('.mini-realms');
      box.innerHTML = '';
      for (let z = 0; z < 3; z++) {
        if (this.round === 1 && z === 2) continue;
        box.appendChild(this.realmEl(this.field[i][z], DX_ZONES[z].size, z, true, revealAll ? true : false));
      }
      this.rows[i].querySelector('.bn').textContent = fmt(this.P[i].beans + this.delta[i]);
    }
    const zw = this.c.zone; zw.innerHTML = '';
    zw.style.position = 'relative';
    this.myBanner = document.createElement('div'); this.myBanner.className = 'pwr-wrap';
    zw.appendChild(this.myBanner);
    const wrap = document.createElement('div'); wrap.className = 'realms';
    for (let z = 0; z < 3; z++) {
      if (this.round === 1 && z === 2) continue;
      const el = this.realmEl(this.field[0][z], DX_ZONES[z].size, z, false, true);
      const need = DX_ZONES[z].size - this.field[0][z].length;
      const pw = el.querySelector('.pw');
      if (this.phase === 'place' && need > 0) pw.textContent = '缺' + need;
      else if (this.field[0][z].length === DX_ZONES[z].size) {
        const p = dxPower(this.field[0][z], z); pw.textContent = p.n + ' ' + p.p;
      }
      wrap.appendChild(el);
    }
    zw.appendChild(wrap);
    const hd = this.c.hand; hd.innerHTML = '';
    fitHand(hd, this.hands[0].length, 40);
    this.hands[0].forEach(c => {
      const e = cardEl(c); e.style.setProperty('--cw', '40px');
      if (this.sel.has(c.id)) e.classList.add('sel');
      e.onclick = () => this.tapCard(c);
      hd.appendChild(e);
    });
    $('#tMyBeans').textContent = fmt(this.P[0].beans + this.delta[0]);
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
    const need = this.needCounts(0);
    this.activeZone = need.findIndex(x => x > 0);
    this.tipPlace();
    for (let i = 1; i < 4; i++) this.aiPlace(i);
    this.render();
    const a = this.c.act; a.innerHTML = '';
    actBtn('自动布阵', 'grey', () => { this.autoPlace(); });
    actBtn('收回', 'grey', () => {
      for (let z = 0; z < 3; z++) { while (this.field[0][z].length > this.keep0[z]) this.hands[0].push(this.field[0][z].pop()); }
      this.hands[0].sort((x, y) => y.r - x.r); this.render(); this.tipPlace();
    });
    actBtn('确认布阵', '', () => {
      if (this.needCounts(0).some(x => x > 0)) return toast('还有区域没放满');
      a.innerHTML = ''; this.resolve();
    });
    this.keep0 = [0, 1, 2].map(z => this.field[0][z].length);
    this.placeTotal = this.needCounts(0).reduce((a, b) => a + b, 0);
    this.tipPlace();
  }
  tipPlace() {
    const need = this.needCounts(0).reduce((a, b) => a + b, 0);
    const totalNeed = this.placeTotal || need;
    this.tip.innerHTML = '<div class="gold-txt" style="font-size:14px;letter-spacing:2px">第 ' + this.round + ' 回合 · 布阵</div>'
      + '<div style="font-size:12px;margin-top:2px">已放入 <b class="gold-txt">' + (totalNeed - need) + '/' + totalNeed + '</b></div>'
      + '<div class="zone-line">点区域再点手牌放入；凡 2 张 · 灵 3 张' + (this.round > 1 ? ' · 仙 5 张' : '（仙界第 2 回合开放）') + '</div>';
  }
  autoPlace() {
    for (let z = 0; z < 3; z++) while (this.field[0][z].length > this.keep0[z]) this.hands[0].push(this.field[0][z].pop());
    this.hands[0].sort((x, y) => y.r - x.r);
    const plan = this.planBest(this.hands[0], this.field[0], this.needCounts(0));
    for (let z = 0; z < 3; z++) plan[z].forEach(c => { this.field[0][z].push(c); this.hands[0] = this.hands[0].filter(x => x.id !== c.id); });
    this.render(); this.tipPlace(); toast('已自动布阵');
  }
  planBest(hand, field, need) {
    const total = need.reduce((a, b) => a + b, 0);
    let best = null, bestScore = -1;
    if (hand.length < total) return [[], [], []];
    for (let it = 0; it < 700; it++) {
      const pool = shuffle(hand.slice()).slice(0, total);
      const plan = [[], [], []]; let k = 0;
      for (let z = 0; z < 3; z++) for (let j = 0; j < need[z]; j++) plan[z].push(pool[k++]);
      let sc = 0;
      for (let z = 0; z < 3; z++) if (field[z].length + plan[z].length === DX_ZONES[z].size)
        sc += dxPower(field[z].concat(plan[z]), z).p * (z === 2 ? 1.2 : z === 1 ? 1 : .9);
      if (sc > bestScore) { bestScore = sc; best = plan; }
    }
    return best;
  }
  aiPlace(i) {
    const need = this.needCounts(i);
    const plan = this.planBest(this.hands[i], this.field[i], need);
    for (let z = 0; z < 3; z++) plan[z].forEach(c => { this.field[i][z].push(c); this.hands[i] = this.hands[i].filter(x => x.id !== c.id); });
  }
  /* ---------- 结算 ---------- */
  banner(i, txt, val, rankIdx) {
    const host = i === 0 ? this.myBanner : this.rows[i].querySelector('.pwr-wrap');
    if (!host) return;
    host.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'pwr-banner' + (rankIdx === 0 ? ' win' : '');
    d.innerHTML = '<span>' + txt + '</span><span>🔥</span><span class="v">' + val + '</span>'
      + '<span class="rank-badge rk' + (rankIdx + 1) + '">' + (rankIdx + 1) + '</span>';
    host.appendChild(d);
  }
  clearBanners() {
    if (this.myBanner) this.myBanner.innerHTML = '';
    for (let i = 1; i < 4; i++) { const h = this.rows[i].querySelector('.pwr-wrap'); if (h) h.innerHTML = ''; }
  }
  beanAnchor(i) {
    return i === 0 ? $('#tMyBeans').parentNode : this.rows[i].querySelector('.bn').parentNode.parentNode;
  }
  async resolve() {
    this.phase = 'show';
    this.render(true);
    const zones = this.round === 1 ? [0, 1] : [0, 1, 2];
    const pw = [0, 1, 2, 3].map(i => zones.map(z => dxPower(this.field[i][z], z)));
    const total = [0, 0, 0, 0];
    for (let zi = 0; zi < zones.length; zi++) {
      const z = zones[zi];
      this.tip.innerHTML = '<div class="gold-txt" style="font-size:14px;letter-spacing:2px">' + DX_ZONES[z].n + '界斗法</div>'
        + '<div class="zone-line">' + DX_ZONES[z].n + '界：' + DX_ORDER[z].map((n, k) => k === 0 ? '<b>' + n + '</b>' : n).join(' &gt; ') + '</div>';
      /* 名次 + 横幅 */
      const ord = [0, 1, 2, 3].slice().sort((a, b) => pw[b][zi].p - pw[a][zi].p);
      ord.forEach((pi, k) => this.banner(pi, pw[pi][zi].n, pw[pi][zi].p, k));
      await sleep(1000);
      if (this.c.over) return;
      /* 两两结算 */
      const rd = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
        const d = pw[i][zi].p - pw[j][zi].p;
        if (d === 0) continue;
        const amt = Math.abs(d) * this.c.base;
        if (d > 0) { rd[i] += amt; rd[j] -= amt; } else { rd[j] += amt; rd[i] -= amt; }
      }
      const before = total.slice();
      for (let i = 0; i < 4; i++) {
        total[i] += rd[i];
        const el = i === 0 ? $('#tMyBeans') : this.rows[i].querySelector('.bn');
        animNumber(el, this.P[i].beans + this.delta[i] + before[i], this.P[i].beans + this.delta[i] + total[i], 700);
        floatBean(this.beanAnchor(i), rd[i]);
      }
      await sleep(1500);
      if (this.c.over) return;
      this.clearBanners();
    }
    /* 全胜 */
    const sweepWin = [], sweepLose = [];
    const sd = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      if (i === j) continue;
      let all = true, diff = 0;
      for (let zi = 0; zi < zones.length; zi++) {
        if (pw[i][zi].p < pw[j][zi].p) { all = false; break; }
        diff += pw[i][zi].p - pw[j][zi].p;
      }
      if (all && diff > 0) {
        const amt = diff * this.c.base;
        sd[i] += amt; sd[j] -= amt;
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
        const el = i === 0 ? $('#tMyBeans') : this.rows[i].querySelector('.bn');
        animNumber(el, this.P[i].beans + this.delta[i] + before[i], this.P[i].beans + this.delta[i] + total[i], 700);
        floatBean(this.beanAnchor(i), sd[i]);
      }
      await sleep(1600);
      if (this.c.over) return;
    }
    for (let i = 0; i < 4; i++) this.delta[i] += total[i];
    this.render(true);
    this.reset = sweepWin.length >= 2 || sweepLose.length >= 2;
    if (this.reset) bigWin(sweepWin.length >= 2 ? '得证大道' : '隐忍渡劫');
    this.round++;
    if (this.round > 4) return setTimeout(() => this.finish(), 900);
    setTimeout(() => this.ascend(), this.reset ? 1400 : 600);
  }
  /* ---------- 飞升 + 弃牌 ---------- */
  ascend() {
    if (this.c.over) return;
    for (let i = 0; i < 4; i++) {
      if (this.reset) {
        for (let z = 0; z < 3; z++) { this.hands[i] = this.hands[i].concat(this.field[i][z]); this.field[i][z] = []; }
      } else {
        this.used = this.used.concat(this.field[i][2]);
        this.field[i][2] = this.field[i][1];
        this.field[i][1] = this.field[i][0];
        this.field[i][0] = [];
      }
      this.hands[i].sort((a, b) => b.r - a.r);
    }
    this.reset = false;
    this.phase = 'discard'; this.sel = new Set();
    this.tip.innerHTML = '<span class="gold-txt">飞升完成 · 弃牌阶段</span><br>'
      + '<span style="font-size:11px;opacity:.9">可弃掉任意张手牌，下一回合补满 8 张</span>';
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
      for (let i = 0; i < 4; i++) {
        // 补牌至少补到 8 张；若下一回合要重新填满三界（10 张），则补到 10 张
        const want = Math.max(8, this.needCounts(i).reduce((a, b) => a + b, 0));
        const need = want - this.hands[i].length;
        if (need > 0) this.hands[i] = this.hands[i].concat(this.draw(need));
        this.hands[i].sort((x, y) => y.r - x.r);
      }
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
  key: 'douxian', name: '斗仙牌', seats: 4, base: 150, entry: 80000,
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
