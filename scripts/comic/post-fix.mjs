// scripts/comic/post-fix.mjs
// R22 구조적 후처리 = 힌트-저항 결함을 "프롬프트 재롤" 대신 "좌표 기반 결정적 편집"으로 해결.
// 재생성으로 안 잡히던 3대 난제를 GPU 없이(jimp) 확정 처리한다:
//   void        후드/그림자 내부를 순수 void 로 → faceless 유령이 얼굴 얻는 것 차단(identity_collapse)
//   blank       묘비/간판 면의 baked garbled 글자를 평탄화(주변 톤 샘플) → HTML 레터링이 대신 얹힘
//   translucent 유령 영역을 종이톤으로 블렌딩 → 흑백책의 반투명 유령감(불투명 실체 결함 교정)
// 좌표(정규화 bbox [x,y,w,h] 0..1, 아트 기준)는 두 경로로 공급:
//   --sdk(+ANTHROPIC_API_KEY): Claude vision 이 결함 영역을 로케이트(pod 불필요 — API 임).
//   --spec: 에이전트/사람이 작성한 post-fix-spec.json 을 그대로 적용.
// 원본은 qc/prefix-backup/NN.jpg 로 백업(가역). 결정적이라 회귀에도 안전.
//
// Usage:
//   node post-fix.mjs --images OUT --spec OUT/qc/post-fix-spec.json
//   node post-fix.mjs --images OUT --script S.json --panels 6,16 --sdk        (vision 로케이트 후 적용)
//   node post-fix.mjs --selftest                                              (합성 이미지로 3연산 검증)
import { Jimp } from "jimp";
import fs from "fs";
import path from "path";
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; };
const has = (n) => process.argv.includes(`--${n}`);
const INK = { r: 0x14, g: 0x12, b: 0x10 }, PAPER = { r: 0xef, g: 0xe8, b: 0xd5 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 정규화 bbox → 픽셀 정수 rect(경계 클램프)
const rect = (img, [x, y, w, h]) => {
  const X = clamp(Math.round(x * img.width), 0, img.width - 1);
  const Y = clamp(Math.round(y * img.height), 0, img.height - 1);
  return { X, Y, W: clamp(Math.round(w * img.width), 1, img.width - X), H: clamp(Math.round(h * img.height), 1, img.height - Y) };
};

// bbox 바깥 3px 링의 평균색(평탄화용 주변 톤)
function ringAvg(img, X, Y, W, H, pad = 3) {
  let r = 0, g = 0, b = 0, n = 0;
  const add = (px, py) => { if (px < 0 || py < 0 || px >= img.width || py >= img.height) return; const i = (py * img.width + px) * 4; const d = img.bitmap.data; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; };
  for (let px = X - pad; px < X + W + pad; px++) { for (let k = 1; k <= pad; k++) { add(px, Y - k); add(px, Y + H - 1 + k); } }
  for (let py = Y - pad; py < Y + H + pad; py++) { for (let k = 1; k <= pad; k++) { add(X - k, py); add(X + W - 1 + k, py); } }
  return n ? { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) } : PAPER;
}

// 세 연산 — 모두 in-place, 결정적
function applyOp(img, op, bbox, opts = {}) {
  const { X, Y, W, H } = rect(img, bbox);
  const d = img.bitmap.data;
  const feather = clamp(opts.feather ?? 4, 0, Math.floor(Math.min(W, H) / 2)); // 경계 부드럽게
  const fill = op === "blank" ? ringAvg(img, X, Y, W, H) : op === "void" ? INK : null;
  const alpha = op === "translucent" ? clamp(opts.alpha ?? 0.4, 0.05, 0.95) : 1; // 유령 잔존 비율
  for (let py = Y; py < Y + H; py++) {
    for (let px = X; px < X + W; px++) {
      const i = (py * img.width + px) * 4;
      // 경계 페더 가중치(0 바깥→1 안쪽)
      const e = Math.min(px - X, X + W - 1 - px, py - Y, Y + H - 1 - py);
      const wgt = feather ? clamp(e / feather, 0, 1) : 1;
      if (op === "translucent") { // 원본을 종이톤으로 블렌딩 → 반투명
        const a = 1 - (1 - alpha) * wgt; // 페더 안쪽일수록 더 투명(=종이 쪽)
        d[i] = Math.round(d[i] * a + PAPER.r * (1 - a));
        d[i + 1] = Math.round(d[i + 1] * a + PAPER.g * (1 - a));
        d[i + 2] = Math.round(d[i + 2] * a + PAPER.b * (1 - a));
      } else { // void/blank: 목표색으로 페더 블렌딩
        d[i] = Math.round(d[i] * (1 - wgt) + fill.r * wgt);
        d[i + 1] = Math.round(d[i + 1] * (1 - wgt) + fill.g * wgt);
        d[i + 2] = Math.round(d[i + 2] * (1 - wgt) + fill.b * wgt);
      }
    }
  }
  return { X, Y, W, H, op };
}

// ── SELFTEST: 합성 이미지에 3연산 적용 후 픽셀 불변식 검증 ──
if (has("selftest")) {
  const img = new Jimp({ width: 200, height: 200, color: 0xffffffff });
  img.scan(60, 60, 80, 80, function (px, py, i) { this.bitmap.data.writeUInt32BE(0x808080ff, i); }); // 회색 사각
  const mid = (im) => { const i = (100 * im.width + 100) * 4; const d = im.bitmap.data; return [d[i], d[i + 1], d[i + 2]]; };
  let ok = true;
  { const t = img.clone(); applyOp(t, "void", [0.3, 0.3, 0.4, 0.4], { feather: 0 }); const [r] = mid(t); if (r > 40) { console.error("void FAIL", mid(t)); ok = false; } else console.log("void OK", mid(t)); }
  { const t = img.clone(); applyOp(t, "blank", [0.3, 0.3, 0.4, 0.4], { feather: 0 }); const [r] = mid(t); if (r < 230) { console.error("blank FAIL(주변 흰색 기대)", mid(t)); ok = false; } else console.log("blank OK", mid(t)); }
  { const t = img.clone(); applyOp(t, "translucent", [0.3, 0.3, 0.4, 0.4], { feather: 0, alpha: 0.4 }); const [r] = mid(t); const exp = Math.round(0x80 * 0.4 + PAPER.r * 0.6); if (Math.abs(r - exp) > 3) { console.error("translucent FAIL", mid(t), "exp", exp); ok = false; } else console.log("translucent OK", mid(t)); }
  console.log(ok ? "\n✅ selftest PASS" : "\n✗ selftest FAIL");
  process.exit(ok ? 0 : 1);
}

const IMAGES = arg("images");
if (!IMAGES) { console.error("--images 필수 (또는 --selftest)"); process.exit(2); }
const QC = path.join(IMAGES, "qc"); fs.mkdirSync(QC, { recursive: true });
const BK = path.join(QC, "prefix-backup"); fs.mkdirSync(BK, { recursive: true });
const nnPath = (n) => path.join(IMAGES, `${String(n).padStart(2, "0")}.jpg`);

// 스펙 확보: --spec 우선, 없고 --sdk 면 vision 로케이트
let spec = null;
if (arg("spec")) spec = JSON.parse(fs.readFileSync(arg("spec"), "utf8"));
else if (has("sdk")) {
  const SCRIPT = arg("script");
  if (!SCRIPT) { console.error("--sdk 로케이트엔 --script 필요"); process.exit(2); }
  const script = JSON.parse(fs.readFileSync(SCRIPT, "utf8"));
  const tier = script.adaptation?.default_tier || "teen";
  const byN = Object.fromEntries((script.panels || []).map((p) => [p.n, p]));
  const panels = String(arg("panels", "")).split(",").filter(Boolean).map(Number);
  if (!panels.length) { console.error("--sdk 로케이트엔 --panels 필요"); process.exit(2); }
  let client; try { const A = (await import("@anthropic-ai/sdk")).default; if (!process.env.ANTHROPIC_API_KEY) throw 0; client = new A(); } catch { console.error("--sdk 인데 sdk/key 없음"); process.exit(2); }
  spec = {};
  const GUIDE = `흑백 그래픽노블 패널의 "힌트로 안 잡히는" 결함을 좌표로 로케이트한다. 셋 중 하나만 고르라:
- void: 후드/그림자 안에 얼굴/이목구비가 보이는데 순수 어둠이어야 하는 영역(faceless 유령)
- blank: 묘비/간판/책 표지 등에 판독 가능한 garbled 글자가 baked 된 면(HTML 레터링이 대신 얹혀야 함)
- translucent: 반투명이어야 할 유령이 불투명 실체로 그려진 몸통 영역
결함이 없으면 op="none". bbox 는 정규화 [x,y,w,h] (좌상단 기준 0..1, 아트 이미지 기준).`;
  for (const n of panels) {
    const p = byN[n]; if (!p) continue;
    const b64 = fs.readFileSync(nnPath(n)).toString("base64");
    const t = p.text?.[tier] || {};
    const msg = await client.messages.create({ model: "claude-opus-4-8", max_tokens: 400, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } }, { type: "text", text: `${GUIDE}\n패널 ${n}: scene=${p.scene}; 대사=${JSON.stringify((t.bubbles || []).map((x) => x.text))}\nONLY JSON: {"op":"void|blank|translucent|none","bbox":[x,y,w,h],"note":""}` }] }] });
    let v; try { v = JSON.parse(msg.content.map((x) => x.text || "").join("").match(/\{[\s\S]*\}/)[0]); } catch { v = { op: "none" }; }
    console.log(`locate p${n}: ${v.op}${v.op !== "none" ? " " + JSON.stringify(v.bbox) + (v.note ? " — " + v.note : "") : ""}`);
    if (v.op && v.op !== "none" && Array.isArray(v.bbox) && v.bbox.length === 4) spec[n] = { op: v.op, bbox: v.bbox, note: v.note, alpha: v.alpha, feather: v.feather };
  }
  fs.writeFileSync(path.join(QC, "post-fix-spec.json"), JSON.stringify(spec, null, 2));
  console.log(`\nspec → ${path.join(QC, "post-fix-spec.json")}`);
}
if (!spec) { console.error("스펙 없음 (--spec 또는 --sdk)"); process.exit(2); }

// ── 적용 ──
let applied = 0;
for (const [n, s] of Object.entries(spec)) {
  if (!s || !s.op || s.op === "none" || !Array.isArray(s.bbox)) continue;
  const src = nnPath(n);
  if (!fs.existsSync(src)) { console.error(`p${n}: 이미지 없음 ${src}`); continue; }
  fs.copyFileSync(src, path.join(BK, `${String(n).padStart(2, "0")}.jpg`)); // 백업(가역)
  const img = await Jimp.read(src);
  const r = applyOp(img, s.op, s.bbox, { alpha: s.alpha, feather: s.feather });
  await img.write(src);
  console.log(`✓ p${n} ${r.op} @[${r.X},${r.Y} ${r.W}x${r.H}]${s.note ? " — " + s.note : ""}`);
  applied++;
}
console.log(`\n적용 ${applied} · 백업 → ${BK} (되돌리기: 백업본 복사)`);
process.exit(0);
