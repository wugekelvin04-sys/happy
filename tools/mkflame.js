/* 动漫赛璐璐风格火焰序列帧：光滑的火舌轮廓 + 硬边分色（4~5 层色阶），
   不是粒子噪点。纯程序生成，横向 sprite sheet 输出。 */
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

const W = 72, H = 120, FR = 18, SS = 3;          // 单帧尺寸 / 帧数 / 超采样
const TAU = Math.PI * 2;

/* 赛璐璐色阶：由外到内一层比一层亮。最外圈是固定像素宽的深红描边。 */
const OUTLINE = [186, 32, 0], OUT_PX = 2.4;
const BANDS = [
  [0.00, 0.26, [255, 82, 6]],
  [0.26, 0.52, [255, 148, 24]],
  [0.52, 0.76, [255, 204, 58]],
  [0.76, 1.01, [255, 246, 210]],
];
function shade(m) {
  for (const [a, b, c] of BANDS) if (m >= a && m < b) return c;
  return BANDS[BANDS.length - 1][2];
}

/* 三条火舌：主火舌居中最高，两侧各一条矮的。相位不同，整体循环 FR 帧。 */
const TONGUES = [
  { x: .50, w: .92, h: .34, amp: .020, freq: 1.0, ph: .21, sp: .8 },   // 底座：把几条火舌连成一整团
  { x: .50, w: .52, h: 1.00, amp: .075, freq: 1.4, ph: .00, sp: 1.0 },
  { x: .28, w: .38, h: .66, amp: .070, freq: 1.9, ph: .37, sp: 1.3 },
  { x: .73, w: .35, h: .58, amp: .065, freq: 2.1, ph: .68, sp: 1.15 },
];
/* 脱离主体往上飘的小火块，动漫火焰的标志性元素 */
const EMBERS = [
  { x: .38, w: .085, y0: .52, y1: 1.02, ph: .00 },
  { x: .62, w: .070, y0: .60, y1: 1.06, ph: .45 },
  { x: .50, w: .055, y0: .70, y1: 1.10, ph: .74 },
];

/* 火舌宽度剖面：底部是个圆头（不会出现平切的硬边），上面收成尖。 */
function profile(u) {
  const uc = .13;
  if (u < uc) return Math.sqrt(Math.max(0, 1 - ((uc - u) / uc) ** 2));
  return Math.pow(1 - (u - uc) / (1 - uc), .8);
}

/* 返回 { d, m }：d = 到轮廓的距离（归一化 x），m = 亮度层级 0~1。
   m 除了看横向深浅，还随高度衰减 —— 动漫火焰亮心都聚在根部，越往上越暗。 */
function field(px, py, t) {
  let d = 0, m = 0;
  for (const g of TONGUES) {
    const flick = .88 + .12 * Math.sin(TAU * (t * g.sp + g.ph));
    const u = py / (g.h * flick);
    if (u < 0 || u > 1) continue;
    // 中轴随高度摆动，越靠尖端摆得越厉害 —— 火舌"舔"起来的感觉
    const cx = g.x + g.amp * Math.pow(u, 1.3) * Math.sin(TAU * (u * g.freq - t + g.ph));
    const hw = g.w * .5 * profile(u) * (1 + .18 * Math.sin(TAU * (u * 2.3 - t * 1.4 + g.ph)));
    if (hw <= 0) continue;
    const dist = hw - Math.abs(px - cx);
    if (dist <= 0) continue;
    d = Math.max(d, dist);
    m = Math.max(m, (dist / hw) * (1 - .62 * u) * (.72 + .28 * g.h));
  }
  for (const e of EMBERS) {                       // 飘起的小火块
    const k = (t + e.ph) % 1;
    const cy = e.y0 + (e.y1 - e.y0) * k;
    const r = e.w * (1 - k * .55);
    const fade = Math.min(1, k / .18) * Math.min(1, (1 - k) / .3);
    if (r <= 0 || fade <= 0) continue;
    const dx = (px - e.x) / r, dy = (py - cy) / (r * 1.9);
    const dd = Math.sqrt(dx * dx + dy * dy);
    if (dd < 1) { d = Math.max(d, (1 - dd) * r); m = Math.max(m, (1 - dd) * fade * .8); }
  }
  return { d, m };
}

const sheet = Buffer.alloc(W * FR * H * 4);
for (let f = 0; f < FR; f++) {
  const t = f / FR;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {   // 超采样只用来抗锯齿，色阶本身是硬边
      const px = (x + (sx + .5) / SS) / W;
      const py = 1 - (y + (sy + .5) / SS) / H;
      const { d, m } = field(px, py, t);
      if (d > 0) {
        const c = d * W < OUT_PX ? OUTLINE : shade(m);   // 最外圈固定像素宽的描边
        r += c[0]; g += c[1]; b += c[2]; a += 255;
      }
    }
    const n = SS * SS, o = ((y * (W * FR)) + f * W + x) * 4;
    if (a > 0) { sheet[o] = Math.round(r / (a / 255)); sheet[o + 1] = Math.round(g / (a / 255));
                 sheet[o + 2] = Math.round(b / (a / 255)); sheet[o + 3] = Math.round(a / n); }
  }
}
fs.writeFileSync(process.argv[2], png(W * FR, H, sheet));
console.log('flame.png', W * FR + 'x' + H, (fs.statSync(process.argv[2]).size / 1024).toFixed(1) + 'KB', FR + ' frames of ' + W + 'x' + H);
