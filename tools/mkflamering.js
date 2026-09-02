/* 生成「整圈火焰」序列图：5 个档位（对应名次 1~5 的火势）× FR 帧，
   拼成一张 sprite sheet。每一帧都是一整条连续的火焰轮廓 —— 火舌在
   标量场里先合并再上色，所以只有一圈描边，不会像拼贴那样出现
   互相穿插的描边。赛璐璐硬边分色，纯程序生成。 */
const zlib = require('zlib'), fs = require('fs');
function png(w, h, buf) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    buf.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
  const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const chunk = (t, d) => { const L = Buffer.alloc(4); L.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]); const C = Buffer.alloc(4); C.writeUInt32BE(crc(td));
    return Buffer.concat([L, td, C]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* ---- 版面：中间是名次牌（参考尺寸 176×44），四周留给火焰 ---- */
const BW = 176, BH = 44, RAD = 10;
const ML = 40, MR = 40, MT = 52, MB = 34;          // 上下左右留白（= CSS 里的负 inset）
const FW = BW + ML + MR, FH = BH + MT + MB;        // 单帧 256×130
const FR = 14, LV = 5, SS = 2, TAU = Math.PI * 2;
const RX = BW / 2, RY = BH / 2, CX = ML + RX, CY = MT + RY;
const ex = RX - RAD, ey = RY - RAD;
const EX = 2 * ey, ARC = Math.PI / 2 * RAD, TOP = 2 * ex;
const PERIM = 2 * EX + 4 * ARC + 2 * TOP;

/* 圆角矩形：返回到轮廓的距离 d（外正内负）与沿周长的位置 s */
function rrect(px, py) {
  const ax = Math.abs(px), ay = Math.abs(py);
  const qx = ax - ex, qy = ay - ey;
  if (qx > 0 && qy > 0) {
    const h = Math.hypot(qx, qy), phi = Math.atan2(qy, qx);
    let s;
    if (px > 0 && py > 0) s = EX + phi * RAD;
    else if (px < 0 && py > 0) s = EX + ARC + TOP + (Math.PI / 2 - phi) * RAD;
    else if (px < 0) s = EX + ARC + TOP + ARC + EX + phi * RAD;
    else s = EX + ARC + TOP + ARC + EX + ARC + TOP + (Math.PI / 2 - phi) * RAD;
    return { d: h - RAD, s };
  }
  if (qx > qy) {                                    // 左右两条边
    return { d: qx - RAD, s: px > 0 ? py + ey : EX + ARC + TOP + ARC + (ey - py) };
  }
  return { d: qy - RAD, s: py > 0 ? EX + ARC + (ex - px)   // 上下两条边
    : EX + ARC + TOP + ARC + EX + ARC + (px + ex) };
}
/* 周长位置 s 处外法线的 y 分量：上边 +1、下边 −1、两侧 0。
   火往上窜，所以上边的火舌高、下边的矮。 */
function nyAt(s) {
  let a = s % PERIM;
  if (a < EX) return 0; a -= EX;
  if (a < ARC) return Math.sin(a / RAD); a -= ARC;
  if (a < TOP) return 1; a -= TOP;
  if (a < ARC) return Math.cos(a / RAD); a -= ARC;
  if (a < EX) return 0; a -= EX;
  if (a < ARC) return -Math.sin(a / RAD); a -= ARC;
  if (a < TOP) return -1; a -= TOP;
  return -Math.cos(a / RAD);
}

/* 赛璐璐色阶 + 固定像素宽的深红描边 */
const OUTLINE = [186, 32, 0], OUT_PX = 2.2;
const BANDS = [[0, .26, [255, 82, 6]], [.26, .52, [255, 148, 24]],
               [.52, .76, [255, 204, 58]], [.76, 1.01, [255, 246, 210]]];
const shade = m => { for (const [a, b, c] of BANDS) if (m >= a && m < b) return c; return BANDS[3][2]; };

/* 火舌宽度剖面：根部圆头（贴着牌不会露平切边），往上收成尖 */
function profile(u) {
  const uc = .16;
  return u < uc ? Math.sqrt(Math.max(0, 1 - ((uc - u) / uc) ** 2))
                : Math.pow(1 - (u - uc) / (1 - uc), .8);
}
let seed = 20260901;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

/* 每个档位一套火舌，位置沿周长均布，参数固定（种子随档位重置，可复现） */
function makeLevel(f) {
  seed = 20260901 + Math.round(f * 100);
  const n = Math.round(6 + 19 * f), T = [];
  for (let k = 0; k < n; k++) {
    const s0 = PERIM * (k + .5 + (rnd() - .5) * .55) / n;
    T.push({
      s0, ny: nyAt(s0),
      h: (6 + 34 * Math.pow(f, 1.35)) * (.72 + .56 * rnd()),   // 火舌长度
      w: (5 + 9 * f) * (.75 + .5 * rnd()),        // 根部半宽（沿周长）
      amp: (2 + 5 * f) * (.6 + .8 * rnd()),       // 尖端摆幅
      fq: 1.1 + rnd() * 1.3, ph: rnd(), sp: .8 + rnd() * .7,
    });
  }
  return { T, col: 1.2 + 3.4 * f };               // col = 贴着牌那圈火"领子"的厚度
}

const LEVELS = [];
for (let l = 0; l < LV; l++) LEVELS.push(makeLevel((l + 1) / LV));

const SW = FW * FR, SH = FH * LV;
const sheet = Buffer.alloc(SW * SH * 4);
for (let l = 0; l < LV; l++) {
  const { T, col } = LEVELS[l];
  for (let fr = 0; fr < FR; fr++) {
    const t = fr / FR;
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      let r = 0, g = 0, b = 0, cnt = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const px = x + (sx + .5) / SS - CX, py = CY - (y + (sy + .5) / SS);
        const { d, s } = rrect(px, py);
        if (d <= 0) continue;                     // 牌面里边不画
        let m = -1, edge = 0;
        if (d < col) { m = .5 + .36 * (1 - d / col); edge = Math.max(edge, col - d); }
        for (const g2 of T) {
          const hh = g2.h * (.42 + .58 * (.5 + .5 * g2.ny))
                   * (.88 + .12 * Math.sin(TAU * (t * g2.sp + g2.ph)));
          const u = d / hh;
          if (u > 1) continue;
          let db = s - g2.s0; db -= PERIM * Math.round(db / PERIM);   // 沿周长的环形差
          const drift = g2.amp * Math.pow(u, 1.3) * Math.sin(TAU * (u * g2.fq - t + g2.ph));
          const hw = g2.w * profile(u) * (1 + .18 * Math.sin(TAU * (u * 2.3 - t * 1.4 + g2.ph)));
          const dist = hw - Math.abs(db - drift);
          if (dist <= 0) continue;
          edge = Math.max(edge, Math.min(dist, (1 - u) * hh));
          m = Math.max(m, (dist / hw) * (1 - .55 * u));
        }
        if (m < 0) continue;
        const c = edge < OUT_PX ? OUTLINE : shade(m);
        r += c[0]; g += c[1]; b += c[2]; cnt++;
      }
      if (!cnt) continue;
      const o = ((l * FH + y) * SW + fr * FW + x) * 4;
      sheet[o] = Math.round(r / cnt); sheet[o + 1] = Math.round(g / cnt);
      sheet[o + 2] = Math.round(b / cnt); sheet[o + 3] = Math.round(cnt / (SS * SS) * 255);
    }
  }
}
const out = process.argv[2];
fs.writeFileSync(out, png(SW, SH, sheet));
console.log(out, SW + 'x' + SH, (fs.statSync(out).size / 1024).toFixed(1) + 'KB',
  LV + ' levels x ' + FR + ' frames of ' + FW + 'x' + FH,
  '| CSS inset: -' + MT + 'px -' + MR + 'px -' + MB + 'px -' + ML + 'px');
