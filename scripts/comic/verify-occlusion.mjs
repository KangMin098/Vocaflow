// scripts/comic/verify-occlusion.mjs
// PROCESS FIX: renders each panel's ACTUAL composited layout (caption band on top +
// art below + floating dialogue balloons over the art) to a JPEG, so occlusion can be
// visually verified — the step that was missing. White boxes mark text footprints.
//   node scripts/comic/verify-occlusion.mjs <script.json> <imgDir> <outDir> [panels csv]
import { Jimp } from "jimp";
import fs from "fs";
const [,, scriptPath, imgDir, outDir, csv] = process.argv;
const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const tier = script.adaptation.default_tier;
const only = csv ? new Set(csv.split(",").map(Number)) : null;
fs.mkdirSync(outDir, { recursive: true });
const PAPER = 0xefe8d5ff, INK = 0x141210ff, WHITE = 0xffffffff;
const box = (img, x, y, w, h, fill) => {
  x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
  w = Math.min(Math.round(w), img.width - x); h = Math.min(Math.round(h), img.height - y);
  img.scan(Math.max(0,x-2), Math.max(0,y-2), w+4, h+4, function(px,py,i){ this.bitmap.data.writeUInt32BE(INK, i); });
  img.scan(x, y, w, h, function(px,py,i){ this.bitmap.data.writeUInt32BE(fill, i); });
};
let occ = 0;
for (const p of script.panels) {
  if (only && !only.has(p.n)) continue;
  const t = p.text[tier] || {};
  const art = await Jimp.read(`${imgDir}/${String(p.n).padStart(2,"0")}.jpg`);
  const W = art.width, AH = art.height;
  const bandItems = (t.narration?1:0) + (t.quote?1:0) + (t.bubbles||[]).length;
  const floatItems = [];
  const bandH = bandItems ? 22 + Math.ceil(bandItems/2)*16 : 0;
  const canvas = new Jimp({ width: W, height: AH + bandH, color: PAPER });
  // band boxes (top, on paper — never over art)
  for (let i=0;i<bandItems;i++){ const col=i%2, row=Math.floor(i/2); box(canvas, 6+col*(W/2), 6+row*16, W/2-12, 13, WHITE); }
  // art below the band
  canvas.composite(art, 0, bandH);
  // floating dialogue balloons over the art (the only occlusion risk)
  const XY={tl:[6,6],tr:[W*0.56,6],bl:[6,AH-30],br:[W*0.56,AH-30],tc:[W*0.25,6]};
  for (const b of floatItems){ const [x,y]=XY[b.pos]||XY.tr; box(canvas, x, bandH+y, W*0.42, 24, WHITE); }
  await canvas.write(`${outDir}/panel-${p.n}.jpg`);
  if (floatItems.length) occ++;
}
console.error(`rendered composites → ${outDir}. panels with floating balloons over art: ${occ}`);
