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
/* 横幅朝桌子里边伸：自己居中，右家向左伸，左家和上家向右伸 —— 朝外伸会压到头像 */
const DX_BAND_SIDE = ['a-c', 'a-r', 'a-l', 'a-l'];
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
    this.sel = new Set(); this.activeZone = 0; this.phase = ''; this.curZone = -1;
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
    /* 账户在上、结算标在牌块正上方、牌块在下，三段互不重叠。
       手机横屏牌桌只有 ~390px 高，账户和牌块之间必须留出标 + 火焰的高度
       （紧凑档约 44px），否则火会烧到账户小条上。 */
    /* 位置照 pp22 官方截图按比例换算（原图 2781×1280 与本牌桌 852×393 宽高比一致）：
       每家都是「头像在外、牌块紧挨着往里」横向排一行；自己的三界在中下方一整行，
       手牌在它下面。 */
    /* 坐标全部照 pp22 官方截图量出来再换算（原图 2781×1280，与本牌桌同宽高比）：
       头像 5%/89.5%/35%，牌块 14.5%/73%/45.5%，自己的三界在 23.5%~75% × 58.6% 处。 */
    const CH = [null,
      { chip: { right: '5.2%', top: '31.4%' } },              // 右家
      { chip: { left: '35.6%', top: '5.8%' } },               // 上家
      { chip: { left: '4.9%', top: '30.1%' } }];              // 左家
    const ZP = [{ left: '50%', top: '56.7%', tx: -50 },
      { right: '14.5%', top: '29.4%' },
      { left: '46.1%', top: '5.5%' },
      { left: '14.6%', top: '29.1%' }];
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
    /* 飞豆的起终点用各家显示豆数的地方（账户） */
    this.anchors = [$('.me-bar .bean'), this.seats[1].querySelector('.bean'),
      this.seats[2].querySelector('.bean'), this.seats[3].querySelector('.bean')];
  }
  realmEl(pi, zi, mini, reveal) {
    const cards = this.field[pi][zi], size = DX_ZONES[zi].size;
    const locked = pi === 0 ? (this.keep0 ? this.keep0[zi] : 0) : 0;   // 上回合飞升上来的张数
    const show = this.phase === 'show';
    const hot = show && this.curZone === zi;
    const d = document.createElement('div');
    d.className = 'realm'
      + (!mini && zi === this.activeZone && this.phase === 'place' ? ' act' : '')
      + (hot ? ' hot' : (show && this.curZone >= 0 ? ' cold' : ''));
    // 官方：界名和牌型/灵力在同一行（区域顶部），下面直接是格子，没有底部那一行
    const nm = document.createElement('div'); nm.className = 'rn';
    nm.innerHTML = '<span class="zn">' + DX_ZONES[zi].n + '</span>';
    d.appendChild(nm);
    const rs = document.createElement('div'); rs.className = 'rs';
    /* 布阵时把已选的牌直接摆进这一界的空位（虚线高亮），看得见摆好是什么样，
       点一下就能撤回；真正放入还是要按「确认放入」。 */
    const preview = (!mini && this.phase === 'place' && zi === this.activeZone)
      ? this.hands[0].filter(c => this.sel.has(c.id)) : [];
    /* 斗法阶段把牌放大，正在比拼的那一界再大一号 */
    // 尺寸照截图：自始至终不变，正在比拼的那界只加金框不放大 ——
    // 一放大块就变宽，必然撞上旁边的区域和别家的牌
    // 官方一格：自己 144/2781 = 5.18% 的桌宽，别家 72/2781 = 2.59%。
    // 按桌宽实时换算，换设备也对得上；写死 px 只在某一个尺寸下准。
    const TW = (this.c.body && this.c.body.clientWidth) || 852;
    // 别家一格：布阵时 2.15% 桌宽（灰格挤两行），斗法时放大到 3.2% —— 官方斗法
    // 阶段别家的牌明显更大，牌面要看得清，太小等于没显示
    const cw = Math.round(TW * (mini ? (show ? .032 : .0215) : .050));
    for (let i = 0; i < size; i++) {
      if (cards[i]) {
        if (reveal === false) {
          const bk = backEl(''); bk.style.width = cw + 'px'; bk.style.height = Math.round(cw * 1.44) + 'px';
          rs.appendChild(bk);
        } else {
          const e = cardEl(cards[i], '');
          e.style.setProperty('--cw', cw + 'px');
          if (!mini && this.phase === 'place') {
            if (i < locked) {
              e.classList.add('locked');                 // 继承牌：锁定，不能动
              e.onclick = ev => { ev.stopPropagation(); toast('这张是上回合飞升上来的，不能移动', 1100); };
            } else {
              e.style.cursor = 'pointer';
              e.onclick = ev => { ev.stopPropagation(); this.pullBack(zi, i); };
            }
          }
          rs.appendChild(e);
        }
      } else if (preview[i - cards.length]) {
        const c = preview[i - cards.length];
        const e = cardEl(c, ''); e.style.setProperty('--cw', cw + 'px');
        e.classList.add('preview'); e.style.cursor = 'pointer';
        e.onclick = ev => { ev.stopPropagation(); this.tapCard(c); };
        rs.appendChild(e);
      } else {
        const sl2 = slotEl(true);            // 官方格子是 1.2 的比例，不是牌的 1.44
        sl2.style.width = cw + 'px'; sl2.style.height = Math.round(cw * 1.2) + 'px';
        rs.appendChild(sl2);
      }
    }
    d.appendChild(rs);
    if (!mini) {
      const pw = document.createElement('div'); pw.className = 'pw'; nm.appendChild(pw);
      d.onclick = () => { if (this.phase === 'place') this.pickZone(zi); };
    } else if (show) {
      // 斗法阶段别家也给一个标签位：正在比的那一界用来挂结算标，其余写牌型和灵力
      const pw = document.createElement('div'); pw.className = 'pw mini-pw';
      if (!hot && cards.length === size) {
        const p = dxPower(cards, zi, this.round);
        pw.textContent = p.n + ' ' + p.p;
      }
      nm.appendChild(pw);
    }
    return d;
  }
  /* 点区域：只做「选中建议的牌」，不直接放进去，等玩家确认 */
  pickZone(z) {
    if (this.round === 1 && z === 2) return;
    this.activeZone = z;
    this.suggestZone(z);
  }
  /* 从手牌里选出该区域当前能做到的最大组合（只是选中，不放入） */
  suggestZone(z) {
    const need = DX_ZONES[z].size - this.field[0][z].length;
    this.sel = new Set();
    if (need > 0 && this.hands[0].length >= need) {
      const pick = dxBestFill(this.hands[0], this.field[0][z], z, need, this.round);
      pick.forEach(c => this.sel.add(c.id));
    }
    this.render(); this.tipPlace();
  }
  /* 把选中的牌放进当前区域 */
  confirmPlace() {
    const z = this.activeZone;
    if (z < 0) return toast('先点一个区域');
    const need = DX_ZONES[z].size - this.field[0][z].length;
    if (need <= 0) return toast(DX_ZONES[z].n + '界已经满了');
    if (this.sel.size !== need) return toast('还需要选 ' + (need - this.sel.size) + ' 张');
    const cs = this.hands[0].filter(c => this.sel.has(c.id));
    const from = rectOf(this.c.hand), to = rectOf(this.slots[0]);
    cs.forEach(c => { this.field[0][z].push(c); this.hands[0] = this.hands[0].filter(x => x.id !== c.id); });
    this.sel = new Set();
    flyCards(cs, from, to, { cls: 'tiny', step: 10 });
    const p = dxPower(this.field[0][z], z, this.round);
    if (this.field[0][z].length === DX_ZONES[z].size) toast(DX_ZONES[z].n + '界：' + p.n + ' ' + p.p, 1100);
    /* 自动切到下一个还没填满的区域并给出建议 */
    const zs = this.round === 1 ? [0, 1] : [0, 1, 2];
    const nx = zs.find(t => this.field[0][t].length < DX_ZONES[t].size);
    if (nx !== undefined) { this.activeZone = nx; this.suggestZone(nx); }
    else { this.render(); this.tipPlace(); }
  }
  /* 把本回合放进去的牌收回手牌（继承牌不可动） */
  pullBack(z, idx) {
    if (idx < (this.keep0 ? this.keep0[z] : 0)) return toast('这张是上回合飞升上来的，不能移动', 1100);
    const card = this.field[0][z][idx];
    this.field[0][z].splice(idx, 1);
    this.hands[0].push(card); this.hands[0].sort((a, b) => b.r - a.r);
    this.activeZone = z;
    this.render(); this.tipPlace();
  }
  render(revealAll) {
    const showOthers = this.phase === 'show';           // 只有斗法阶段才亮别家的牌
    for (let i = 1; i < 4; i++) {
      const box = this.slots[i]; box.innerHTML = '';
      // 布阵阶段也把别家的区域画成灰格（照原版），只是牌都盖着
      const mr = document.createElement('div');
      mr.className = 'mini-realms' + (i === 3 ? ' lft' : '');
      // 官方别家区域整块占桌宽 12.1%，凡+灵 一行、仙 折到第二行
      mr.style.maxWidth = Math.round(((this.c.body && this.c.body.clientWidth) || 852)
        * (showOthers ? .20 : .135)) + 'px';
      for (let z = 0; z < 3; z++) {
        const el = this.realmEl(i, z, true, showOthers);
        if (this.round === 1 && z === 2) el.classList.add('sealed');   // 官方也画出来，占第二行
        mr.appendChild(el);
      }
      box.appendChild(mr);
      this.seats[i].querySelector('.bn').textContent = fmt(Math.max(0, this.P[i].beans + this.delta[i]));
      this.seats[i].querySelector('.hs').textContent =
        this.phase === 'place' ? '布阵中…' : '手牌 ' + this.hands[i].length;
    }
    const TW0 = (this.c.body && this.c.body.clientWidth) || 852;
    const box0 = this.slots[0]; box0.innerHTML = '';
    const wrap = document.createElement('div'); wrap.className = 'realms';
    for (let z = 0; z < 3; z++) {
      const el = this.realmEl(0, z, false, true);
      if (this.round === 1 && z === 2) {          // 仙界第一回合还没开放，照原版画成灰格
        el.classList.add('sealed');
        // 只改界名那一格，别整段重写 .rn —— .pw 就挂在它里面，重写会把它删掉
        el.querySelector('.zn').innerHTML = '仙 <span class="seal-txt">尚未开放</span>';
        const pw0 = el.querySelector('.pw'); if (pw0) pw0.textContent = '';
        wrap.appendChild(el); continue;
      }
      const need = DX_ZONES[z].size - this.field[0][z].length;
      const pw = el.querySelector('.pw');
      if (this.phase === 'show' && z === this.curZone) {
        pw.textContent = '';                       // 留给结算标
      } else if (need === 0) {
        const p = dxPower(this.field[0][z], z, this.round);
        pw.textContent = p.n + ' ' + p.p;
      } else if (this.phase === 'place' && z === this.activeZone) {
        /* 当前区域：选够了就把预览的牌型和灵力值直接标在这一格下面 */
        const picked = this.hands[0].filter(c => this.sel.has(c.id));
        if (picked.length === need) {
          const p = dxPower(this.field[0][z].concat(picked), z, this.round);
          pw.innerHTML = '<span class="pw-prev">' + p.n + ' ' + p.p + '</span>';
        } else pw.innerHTML = '<span style="color:#ffd7a8">还需 ' + (need - picked.length) + '</span>';
      } else pw.innerHTML = '<span style="opacity:.75">缺 ' + need + '</span>';
      wrap.appendChild(el);
    }
    box0.appendChild(wrap);
    this.myBanner = this.myBanner || null;
    const hd = this.c.hand; hd.innerHTML = '';
    // 官方手牌单张宽 7.5% 桌宽、露出 4.3%（叠 3.2%）
    const HW = Math.round(TW0 * .075);
    fitHand(hd, this.hands[0].length, HW);
    hd.style.setProperty('--ov', -Math.round(TW0 * .032) + 'px');
    this.hands[0].forEach(c => {
      const e = cardEl(c); e.style.setProperty('--cw', HW + 'px');
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
      const z = this.activeZone;
      if (z < 0) return toast('先点一个区域');
      const need = DX_ZONES[z].size - this.field[0][z].length;
      if (need <= 0) return toast(DX_ZONES[z].n + '界已经满了，先点其他区域');
      if (this.sel.has(c.id)) this.sel.delete(c.id);
      else {
        if (this.sel.size >= need) return toast(DX_ZONES[z].n + '界只需 ' + need + ' 张，先点掉一张再换');
        this.sel.add(c.id);
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
    this.keep0 = [0, 1, 2].map(z => this.field[0][z].length);   // 继承牌张数（锁定）
    this.placeTotal = this.needCounts(0).reduce((a, b) => a + b, 0);
    for (let i = 1; i < 4; i++) this.aiPlace(i);
    const zs = this.round === 1 ? [0, 1] : [0, 1, 2];
    this.activeZone = zs.find(z => this.field[0][z].length < DX_ZONES[z].size);
    if (this.activeZone === undefined) this.activeZone = zs[0];
    this.suggestZone(this.activeZone);                          // 只选中建议牌，等玩家确认
  }
  /* 布阵阶段的按钮：三界没放满就不出现「确认布阵」 */
  placeBtns() {
    const a = this.c.act; a.innerHTML = '';
    const full = !this.needCounts(0).some(x => x > 0);
    if (!full) {
      actBtn('建议', 'grey', () => this.suggestZone(this.activeZone));
      actBtn('确认放入', 'blue', () => this.confirmPlace());
    }
    const placed = [0, 1, 2].some(z => this.field[0][z].length > this.keep0[z]);
    if (placed) actBtn('全部收回', 'grey', () => {
      for (let z = 0; z < 3; z++)
        while (this.field[0][z].length > this.keep0[z]) this.hands[0].push(this.field[0][z].pop());
      this.hands[0].sort((x, y) => y.r - x.r);
      const zz = (this.round === 1 ? [0, 1] : [0, 1, 2]).find(z => this.field[0][z].length < DX_ZONES[z].size);
      this.activeZone = zz === undefined ? 0 : zz;
      this.suggestZone(this.activeZone);
    });
    if (full) actBtn('确认布阵', '', () => { a.innerHTML = ''; this.resolve(); });
  }
  tipPlace() {
    this.tip.innerHTML = '<div class="gold-txt" style="font-size:14px;letter-spacing:3px">第 '
      + this.round + ' 回合 · 布阵</div>';
    if (this.phase === 'place') this.placeBtns();
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
  /* 这一界的结算标：名次 + 牌型 + 灵力值，外面一圈火，输赢豆单独一行。
     和三国牌用的是同一套（core.js 里的 setResultTag）。 */
  banner(i, txt, val, rank, delta) {
    const sl = this.slots[i];
    // 照官方：横幅贴在「正在比拼的那一界」的上沿，朝空的那一侧伸出去，
    // 一行装下 名次 + 牌型 + 灵力 + 输赢豆。塞进区域里面会把牌盖住。
    const hot = sl.querySelector('.realm.hot') || sl.querySelector('.realm');
    if (!hot) return;
    let band = hot.querySelector(':scope > .pw-band');
    if (!band) {
      band = document.createElement('div');
      band.className = 'pw-band ' + DX_BAND_SIDE[i];
      hot.appendChild(band);
      const pw = hot.querySelector('.pw');
      if (pw) pw.textContent = '';                 // 牌型和灵力挪到横幅上了
    }
    // 输赢豆放到整块牌的下面单开一行：跟横幅挤在一行会把横幅撑得太宽，
    // 两头都会伸到头像和旁边的区域上去。
    let uh = sl.querySelector(':scope > .slot-amt');
    if (!uh) { uh = document.createElement('div'); uh.className = 'slot-amt'; sl.appendChild(uh); }
    setResultTag(band, {
      badge: rank, first: rank === 1, fire: rankFire(rank, 4), sm: true,
      html: '<b class="fx-name lg">' + txt + '</b>'
        + (val === '' ? '' : '<span class="pv">' + val + '</span>'),
      delta: delta, amtHost: uh,
    });
  }
  /* 这一界赢豆的玩家弹「胜」标（可能同时有 2 人赢） */
  async winFx(rd) {
    const wins = [0, 1, 2, 3].filter(i => rd[i] > 0);
    if (!wins.length) return;
    wins.forEach(i => {
      const host = this.slots[i];
      if (!host) return;
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      const chip = document.createElement('div');
      chip.className = 'win-chip'; chip.textContent = '胜';
      host.appendChild(chip);
      anim(chip, { scale: [0, 1.35, 1], opacity: [0, 1, 1] },
        { duration: .42, ease: MO ? Motion.backOut : 'ease-out' });
      const bn = host.querySelector('.reveal-tag');
      if (bn) anim(bn, { scale: [1, 1.14, 1] }, { duration: .45, ease: 'ease-out' });
      setTimeout(() => chip.remove(), 1600);
    });
    await sleep(520);
  }
  clearBanners() {
    for (let i = 0; i < 4; i++) this.slots[i].querySelectorAll('.pw-band,.slot-amt').forEach(e => e.remove());
  }
  beanAnchor(i) { return this.anchors[i]; }
  async resolve() {
    this.phase = 'show';
    $('#table').classList.add('reveal');
    this.render(true);
    const zones = this.round === 1 ? [0, 1] : [0, 1, 2];
    const pw = [0, 1, 2, 3].map(i => zones.map(z => dxPower(this.field[i][z], z, this.round)));
    const total = [0, 0, 0, 0];
    const zRank = [];                     // 每一界的名次，回合末判定大道 / 渡劫要用
    for (let zi = 0; zi < zones.length; zi++) {
      const z = zones[zi];
      this.curZone = z;
      this.render(true);                              // 高亮当前正在比拼的那一界
      this.tip.innerHTML = '<div class="gold-txt" style="font-size:15px;letter-spacing:3px">' + DX_ZONES[z].n + '界斗法</div>'
        + '<div class="zone-line">' + DX_ZONES[z].n + '界：' + DX_ORDER[z].map((n, k) => k === 0 ? '<b>' + n + '</b>' : n).join(' &gt; ') + '</div>';
      /* 名次 + 横幅 */
      const rk = rankList([0, 1, 2, 3], (a, b) => pw[a][zi].p - pw[b][zi].p);   // 灵力相同 → 并列
      zRank.push(rk);
      for (let pi = 0; pi < 4; pi++) this.banner(pi, pw[pi][zi].n, pw[pi][zi].p, rk[pi], 0);
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
      /* 输赢豆写到各自的标外面，账户那边就不用再重复冒一次了 */
      for (let pi = 0; pi < 4; pi++) this.banner(pi, pw[pi][zi].n, pw[pi][zi].p, rk[pi], rd[pi]);
      /* 胜利动画：这一界赢豆的每一家都弹一个「胜」（可能不止一人） */
      await this.winFx(rd);
      if (this.c.over) return;
      const before = total.slice();
      for (let i = 0; i < 4; i++) total[i] += rd[i];
      const ms = settleBeans(this.anchors, rd, () => {
        for (let i = 0; i < 4; i++) {
          const el = i === 0 ? $('#tMyBeans') : this.seats[i].querySelector('.bn');
          animNumber(el, this.P[i].beans + this.delta[i] + before[i],
            this.P[i].beans + this.delta[i] + total[i], 900);
        }
      }, { labels: false });
      await sleep(ms);
      if (this.c.over) return;
      this.clearBanners();
    }
    this.curZone = -1;
    this.render(true);
    /* 全胜：第一回合只有凡、灵两界，不构成「三界全胜」，不额外结算 */
    const sweepWin = [], sweepLose = [];
    const sd = [0, 0, 0, 0];
    if (zones.length === 3) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
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
        if (sweepWin.indexOf(i) < 0) sweepWin.push(i);
        if (sweepLose.indexOf(j) < 0) sweepLose.push(j);
      }
    }
    if (sweepWin.length) {
      this.tip.innerHTML = '<div class="gold-txt" style="font-size:15px;letter-spacing:3px">全　胜</div>'
        + '<div class="zone-line">' + sweepWin.map(i => i === 0 ? '我' : this.P[i].name).join('、') + ' 三界灵力全面压制，额外结算一次</div>';
      const before = total.slice();
      for (let i = 0; i < 4; i++) total[i] += sd[i];
      /* 全胜也把数字打在各家的标上 */
      const swRk = rankList([0, 1, 2, 3], (a, b) => sd[a] - sd[b]);
      for (let pi = 0; pi < 4; pi++) if (sd[pi]) this.banner(pi, sd[pi] > 0 ? '全胜' : '全负', '', swRk[pi], sd[pi]);
      const ms2 = settleBeans(this.anchors, sd, () => {
        for (let i = 0; i < 4; i++) {
          const el = i === 0 ? $('#tMyBeans') : this.seats[i].querySelector('.bn');
          animNumber(el, this.P[i].beans + this.delta[i] + before[i],
            this.P[i].beans + this.delta[i] + total[i], 900);
        }
      }, { labels: false });
      await sleep(ms2);
      if (this.c.over) return;
    }
    for (let i = 0; i < 4; i++) this.delta[i] += total[i];
    this.render(true);
    /* 三界都拿第一 →「得证大道」；三界都垫底 →「隐忍渡劫」。
       只对触发的那名玩家生效，且在下一回合补牌之后才把场上的牌全部收回手中。
       第一回合只开凡、灵两界，凑不满三界，一律不触发。 */
    const dao = [false, false, false, false], jie = [false, false, false, false];
    if (zRank.length === 3) for (let i = 0; i < 4; i++) {
      dao[i] = zRank.every(rk => rk[i] === 1);      // 三界都第一
      jie[i] = zRank.every(rk => rk[i] === 4);      // 三界都最后（并列垫底不算）
    }
    this.reset = [0, 1, 2, 3].map(i => dao[i] || jie[i]);
    if (this.reset[0]) bigWin(dao[0] ? '得证大道' : '隐忍渡劫');
    else if (this.reset.some(Boolean)) toast('有玩家触发了' + (dao.some(Boolean) ? '得证大道' : '隐忍渡劫'), 1200);
    this.round++;
    $('#table').classList.remove('reveal');
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
    actBtn('确认弃牌', '', () => {
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
    $('#table').classList.remove('reveal');
    const rows = this.P.map((p, i) => ({ p: p, delta: this.delta[i], tag: '' }));
    settle(rows, '四回合结束 · 斗仙牌');
  }
}

GAMES.douxian = {
  key: 'douxian', name: '斗仙牌', seats: 4, base: 150, entry: 80000, cap: 20000,
  // 实例挂到 window.__g，方便在控制台直接调结算之类的方法排查
  start(c) { (window.__g = new DouxianGame(c)).run(); },
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
