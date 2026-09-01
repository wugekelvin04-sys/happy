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
const SG_TYPES = [
  ['单张', 1], ['对子', 2], ['两对', 5], ['三张', 20], ['顺子', 50],
  ['同花', 70], ['三带二', 100], ['四炸', 200], ['同花顺', 500]
];
/* 名次系数：第 1 名赢所有人，2~5 名「名次越靠前扣豆越多」 */
const SG_RANKMUL = [0, 4, 3, 2, 1];
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
  return { t: t, key: key, name: SG_TYPES[t][0], mult: SG_TYPES[t][1], cs: cards };
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
  }
  deal() {
    const d = [];
    for (const s of SUITS) for (let r = 2; r <= 14; r++) d.push(mkCard(r, s, 0));
    shuffle(d);
    this.hands = [];
    for (let i = 0; i < 5; i++) this.hands.push(d.splice(0, 8).sort((a, b) => b.r - a.r));
    this.pubs = SG_CAMPS.map(c => d.splice(0, c.pub));
  }
  run() { this.layout(); this.round = 1; this.startRound(); }
  layout() {
    const b = this.c.body;
    [...b.querySelectorAll('.seat-chip,.play-slot,.center-zone')].forEach(e => e.remove());
    this.seats = []; this.slots = [];
    const R = RING[5];
    for (let i = 1; i < 5; i++) {
      const el = mkSeat(this.P[i], R[i], '<span class="hs">8 张</span>');
      b.appendChild(el); this.seats[i] = el;
      const sl = mkPlaySlot(R[i]); sl.style.flexDirection = 'column'; sl.style.gap = '1px';
      b.appendChild(sl); this.slots[i] = sl;
    }
    this.slots[0] = mkPlaySlot(R[0]); this.slots[0].style.flexDirection = 'column'; this.slots[0].style.gap = '1px';
    b.appendChild(this.slots[0]);
    this.mid = document.createElement('div'); this.mid.className = 'center-zone';
    b.appendChild(this.mid);
    this.anchors = [$('.me-bar'), this.seats[1], this.seats[2], this.seats[3], this.seats[4]];
  }
  renderCamps() {
    this.mid.innerHTML = '';
    /* 先算出每个阵营能做到的最强牌型，作为推荐 */
    this.reco = sgBestPerCamp(this.hands[0], this.pubs);
    let bestCi = -1;
    this.reco.forEach((r, i) => { if (r && (bestCi < 0 || sgCmp(r.ev, this.reco[bestCi].ev) > 0)) bestCi = i; });
    this.recoBest = bestCi;

    const tip = document.createElement('div');
    tip.style.cssText = 'text-align:center;font-size:12px;margin-bottom:4px';
    tip.className = 'gold-txt';
    tip.textContent = '第 ' + this.round + '/4 轮 · 选一个阵营出战';
    this.mid.appendChild(tip);

    const wrap = document.createElement('div'); wrap.className = 'camps';
    SG_CAMPS.forEach((cp, ci) => {
      const d = document.createElement('div');
      d.className = 'camp ' + cp.cls + (this.camp === ci ? ' act' : '') + (ci === bestCi ? ' reco' : '');
      const cc = document.createElement('div'); cc.className = 'cc';
      if (cp.pub === 0) { const s = document.createElement('div'); s.style.cssText = 'font-size:19px'; s.textContent = '🐉'; cc.appendChild(s); }
      else this.pubs[ci].forEach(c => cc.appendChild(cardEl(c, 'tiny')));
      d.innerHTML = '<div class="cn">' + cp.n + (ci === bestCi ? ' <span class="reco-tag">推荐</span>' : '') + '</div>';
      d.appendChild(cc);
      const q = document.createElement('div'); q.className = 'cq';
      q.textContent = '公共 ' + cp.pub + ' · 出 ' + (5 - cp.pub) + ' 张';
      d.appendChild(q);
      const bx = document.createElement('div'); bx.className = 'cbest';
      const r = this.reco[ci];
      bx.innerHTML = r ? ('最大 <b>' + r.ev.name + '</b> <b class="m">×' + r.ev.mult + '</b>') : '—';
      d.appendChild(bx);
      d.onclick = () => { if (!this.busy) this.fillReco(ci); };   // 选国即默认填入该国最大组合
      wrap.appendChild(d);
    });
    this.mid.appendChild(wrap);

    const pv = document.createElement('div');
    pv.style.cssText = 'text-align:center;font-size:12px;margin-top:6px;min-height:36px;line-height:1.55';
    if (this.camp >= 0) {
      const need = 5 - SG_CAMPS[this.camp].pub;
      const own = this.hands[0].filter(c => this.sel.has(c.id));
      const r = this.reco[this.camp];
      if (own.length === need) {
        const e = sgEval5(own.concat(this.pubs[this.camp]));
        const isBest = r && sgCmp(e, r.ev) >= 0;
        pv.innerHTML = '<div><span style="font-size:11px;opacity:.85">' + SG_CAMPS[this.camp].n + '国 · 当前牌型</span> '
          + '<b class="gold-txt" style="font-size:15px">' + e.name + ' ×' + e.mult + '</b>'
          + (isBest ? ' <span style="color:#8dffb8;font-size:11px">已是最大</span>' : '') + '</div>'
          + (isBest ? '<div style="font-size:11px;opacity:.8">点手牌可自行替换</div>'
            : '<div style="font-size:11px;color:#ffd7a8">最大可做 <b class="gold-txt">' + r.ev.name + ' ×' + r.ev.mult
              + '</b>　<span class="tap-reco">还原最大</span></div>');
      } else {
        pv.innerHTML = '<div>已选 <b class="gold-txt">' + own.length + '/' + need + '</b> 张，再选 '
          + (need - own.length) + ' 张即可显示牌型</div>'
          + (r ? '<div style="font-size:11px;color:#ffd7a8">最大可做 <b class="gold-txt">' + r.ev.name + ' ×' + r.ev.mult
            + '</b>　<span class="tap-reco">还原最大</span></div>' : '');
      }
      const tapEl = pv.querySelector('.tap-reco');
      if (tapEl) tapEl.onclick = e => { e.stopPropagation(); this.fillReco(this.camp); };
    } else {
      const r = bestCi >= 0 ? this.reco[bestCi] : null;
      pv.innerHTML = '<div>点上方阵营即自动选中该国最大组合</div>'
        + (r ? '<div style="font-size:11px;color:#ffd7a8">本轮最优：<b class="gold-txt">'
          + SG_CAMPS[bestCi].n + '国 ' + r.ev.name + ' ×' + r.ev.mult + '</b></div>' : '');
    }
    this.mid.appendChild(pv);
  }
  /* 按该阵营的最大牌型自动选牌 */
  fillReco(ci) {
    const r = (this.reco || sgBestPerCamp(this.hands[0], this.pubs))[ci];
    if (!r) return;
    this.camp = ci; this.sel = new Set(r.own.map(c => c.id));
    this.render();
    toast(SG_CAMPS[ci].n + '国最大：' + r.ev.name + ' ×' + r.ev.mult, 1300);
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
    this.deal();
    this.render();
    const a = this.c.act; a.innerHTML = '';
    actBtn('自动最大', 'grey', () => {
      const per = sgBestPerCamp(this.hands[0], this.pubs);
      let bi = -1; per.forEach((r, i) => { if (r && (bi < 0 || sgCmp(r.ev, per[bi].ev) > 0)) bi = i; });
      if (bi >= 0) this.fillReco(bi);
    });
    actBtn('出战', '', () => {
      if (this.camp < 0) return toast('请选择阵营');
      if (this.sel.size !== 5 - SG_CAMPS[this.camp].pub) return toast('出牌张数不对');
      a.innerHTML = ''; this.resolve();
    });
    /* 进入本轮时默认帮玩家选好全场最大的组合 */
    const per0 = sgBestPerCamp(this.hands[0], this.pubs);
    let bi0 = -1; per0.forEach((r, i) => { if (r && (bi0 < 0 || sgCmp(r.ev, per0[bi0].ev) > 0)) bi0 = i; });
    if (bi0 >= 0) { this.reco = per0; this.camp = bi0; this.sel = new Set(per0[bi0].own.map(c => c.id)); }
    this.render();
  }
  async resolve() {
    this.busy = true;
    const plays = [];
    const mine = this.hands[0].filter(c => this.sel.has(c.id));
    plays[0] = { camp: this.camp, own: mine, ev: sgEval5(mine.concat(this.pubs[this.camp])) };
    for (let i = 1; i < 5; i++) plays[i] = sgBestPlay(this.hands[i], this.pubs);
    const order = [0, 1, 2, 3, 4].slice().sort((a, b) => sgCmp(plays[b].ev, plays[a].ev));
    const rank = []; order.forEach((p, k) => rank[p] = k + 1);
    const win = order[0];
    const sameCamp = order.filter(i => i !== win && plays[i].camp === plays[win].camp).length;
    const sameType = order.filter(i => i !== win && plays[i].ev.t === plays[win].ev.t).length;
    const critM = Math.min(8, Math.pow(2, sameCamp));
    const killM = Math.min(8, Math.pow(2, sameType));
    const winMult = plays[win].ev.mult;
    const rd = [0, 0, 0, 0, 0];
    for (const i of order) {
      if (i === win) continue;
      let pay = this.c.base * winMult * SG_RANKMUL[rank[i] - 1];
      if (plays[i].camp === plays[win].camp) pay *= critM;
      if (plays[i].ev.t === plays[win].ev.t) pay *= killM;
      rd[i] -= pay; rd[win] += pay;
    }
    this.lastInfo = { winMult: winMult, critM: critM, killM: killM, sameCamp: sameCamp, sameType: sameType };
    /* 出牌动画：各家的牌飞到自己的出牌区 */
    const froms = [rectOf(this.c.hand), ...[1, 2, 3, 4].map(i => rectOf(this.seats[i]))];
    await Promise.all([0, 1, 2, 3, 4].map(i =>
      flyCards(plays[i].ev.cs.slice().sort((a, b) => b.r - a.r), froms[i], rectOf(this.slots[i]), { cls: 'xs', step: 11 })));
    if (this.c.over) return;
    for (let i = 0; i < 5; i++) {
      const sl = this.slots[i]; sl.innerHTML = '';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:0';
      plays[i].ev.cs.slice().sort((a, b) => b.r - a.r).forEach((c, k) => {
        const e = cardEl(c, 'xs'); if (k) e.style.marginLeft = '-8px'; row.appendChild(e);
      });
      sl.appendChild(row);
      const tag = document.createElement('div');
      tag.style.cssText = 'font-size:9.5px;white-space:nowrap;background:rgba(0,0,0,.55);border-radius:6px;padding:0 5px;'
        + (i === win ? 'box-shadow:0 0 0 1px #ffd76a;' : '');
      tag.innerHTML = '<b class="rank-badge rk' + Math.min(4, rank[i]) + '" style="width:13px;height:13px;font-size:9px">' + rank[i] + '</b> '
        + '<span style="opacity:.85">' + SG_CAMPS[plays[i].camp].n + '</span> <b class="gold-txt">' + plays[i].ev.name + '</b>'
        + (rd[i] ? ' <b style="color:' + (rd[i] > 0 ? '#7dffb0' : '#ff9a8f') + '">' + (rd[i] > 0 ? '+' : '') + fmt(rd[i]) + '</b>' : '');
      sl.appendChild(tag);
    }
    /* 中央：冠军牌型与暴击/杀牌 */
    this.mid.innerHTML = '';
    const t = document.createElement('div');
    t.style.cssText = 'font-size:12px;background:rgba(0,0,0,.5);border-radius:10px;padding:3px 12px;border:1px solid rgba(255,215,106,.5)';
    t.innerHTML = '<span class="gold-txt">第 ' + this.round + ' 轮 · 冠军 ' + plays[win].ev.name + ' ×' + winMult + '</span>'
      + '<div style="font-size:10px;margin-top:1px;color:#ffb3a7">'
      + (sameCamp ? '同阵营 ' + sameCamp + ' 人 → 暴击×' + critM + '　' : '')
      + (sameType ? '同牌型 ' + sameType + ' 人 → 杀×' + killM : '')
      + (!sameCamp && !sameType ? '名次系数 4/3/2/1' : '') + '</div>';
    this.mid.appendChild(t);
    await sleep(700);
    if (this.c.over) return;
    beanFlow(this.anchors, rd);
    await sleep(500);
    for (let i = 0; i < 5; i++) this.delta[i] += rd[i];
    for (let i = 1; i < 5; i++) this.seats[i].querySelector('.bn').textContent = fmt(Math.max(0, this.P[i].beans + this.delta[i]));
    $('#tMyBeans').textContent = fmt(Math.max(0, this.P[0].beans + this.delta[0]));
    await sleep(2100);
    if (this.c.over) return;
    this.round++;
    this.startRound();
  }
  finish() {
    if (this.c.over) return;
    settle(this.P.map((p, i) => ({ p: p, delta: this.delta[i], tag: '' })), '四轮结束 · 三国牌');
  }
}

GAMES.sanguo = {
  key: 'sanguo', name: '三国牌', seats: 5, base: 10, entry: 50000,
  start(c) { new SanguoGame(c).run(); },
  rules: '<h2>三国牌</h2>'
    + '<h4>基础规则</h4><ul>'
    + '<li>一副扑克去掉大小王共 <b>52 张</b>，每局 <b>5 人</b>参与各自为战，进行 <b>4 轮</b>出牌比拼。</li>'
    + '<li>每轮开始，玩家每人拥有 <b>8 张手牌</b>；公共区域分为 <b>魏、蜀、吴</b> 三个阵营。</li>'
    + '<li>每轮向三个阵营刷新固定张数的公共牌：<b>魏国 3 张、蜀国 0 张、吴国 2 张</b>。</li></ul>'
    + '<h4>组合出牌</h4><ul>'
    + '<li>从手牌选对应数量的牌，与任一阵营的公共牌组成 <b>5 张牌型</b>进行比拼：<br>'
    + '　选魏国出 <b>2 张</b>　｜　选蜀国出 <b>5 张</b>　｜　选吴国出 <b>3 张</b></li></ul>'
    + '<h4>牌型规则</h4>'
    + '<table class="rt"><tr><th>牌型</th><th>说明</th><th>倍率</th></tr>'
    + '<tr><td>同花顺</td><td>同花色且点数连续</td><td>×500</td></tr>'
    + '<tr><td>四炸</td><td>四张同点</td><td>×200</td></tr>'
    + '<tr><td>三带二</td><td>三张同点 + 一对</td><td>×100</td></tr>'
    + '<tr><td>同花</td><td>五张同花色</td><td>×70</td></tr>'
    + '<tr><td>顺子</td><td>点数连续</td><td>×50</td></tr>'
    + '<tr><td>三张</td><td>三张同点</td><td>×20</td></tr>'
    + '<tr><td>两对</td><td>两组对子</td><td>×5</td></tr>'
    + '<tr><td>对子</td><td>一组对子</td><td>×2</td></tr>'
    + '<tr><td>单张</td><td>以上都不是</td><td>×1</td></tr>'
    + '</table><p style="margin-top:5px;font-size:12px">牌型越大，结算时倍率越高；同牌型比点数，决出 1~5 名。</p>'
    + '<h4>结算规则</h4><ul>'
    + '<li>四轮比拼每轮单独结算，豆子实时到账。</li>'
    + '<li><b>第 1 名赢所有人</b>，拿下全部豆豆；第 2~5 名按名次倍数输豆，<b>名次越靠前，扣豆越多</b>。</li>'
    + '<li>输家支付 = <b>底分 × 第 1 名牌型倍率 × 名次系数 × 暴击 × 杀牌</b>；名次系数：第 2 名 ×4、第 3 名 ×3、第 4 名 ×2、第 5 名 ×1。</li></ul>'
    + '<h4>暴击与杀牌</h4><ul>'
    + '<li><b>暴击</b>：与第 1 名 <b>同阵营</b> 会被暴击，同阵营人数越多倍率越高（最高 ×8）。</li>'
    + '<li><b>杀牌</b>：与第 1 名 <b>同牌型</b> 会被杀牌，同牌型人数越多扣得越狠（最高 ×8）。</li></ul>'
};
