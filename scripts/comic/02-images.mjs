// scripts/comic/02-images.mjs
// Phase C + GATE-2. Read a validated script and generate one lightweight
// panel image per panel (free Pollinations/Flux backend), using the cast
// model-sheets + fixed seeds + composition for character consistency.
//
// Usage:
//   node scripts/comic/02-images.mjs --script out/script.json --out out/img [--only 7] [--force]

import fs from "fs";
import path from "path";
import { buildImagePrompt, genImage, gate2, styleFor } from "./lib.mjs";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

async function main() {
  const scriptPath = arg("script");
  const outDir = arg("out");
  if (!scriptPath || !outDir) { console.error("--script and --out required"); process.exit(2); }
  const only = arg("only") ? Number(arg("only")) : null;
  const force = !!arg("force");
  // lightweight dims, shaped per panel: portrait 3:4 for normal, landscape 3:2 for wide.
  // caption box sits over the reserved top band, so tall frames suit normal panels.
  const dims = (wide) => wide
    ? { width: Number(arg("ww", 480)), height: Number(arg("wh", 320)) }
    : { width: Number(arg("w", 312)), height: Number(arg("h", 416)) };

  const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
  const cast = script.cast;
  const baseSeed = (script.adaptation && script.adaptation.seed) || cast[0]?.seed_role || 909;
  // pick the art style from the book's difficulty (V-level) or an explicit override
  const STYLE = styleFor(script.adaptation.target_v_level, script.adaptation.art_maturity);
  console.error(`→ style: ${script.adaptation.art_maturity || "V" + script.adaptation.target_v_level} tier`);

  // Pollinations token (Seed+ tier): env var first, then a gitignored local file.
  // NEVER commit the token; scripts/comic/.pollinations-token is gitignored.
  const tokenFile = path.join(import.meta.dirname, ".pollinations-token");
  const token = (process.env.POLLINATIONS_TOKEN
    || (fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, "utf8") : "")).trim();
  console.error(token ? "→ authenticated (Seed+ tier)" : "→ anonymous tier (no token found)");

  let ok = 0, skip = 0, fail = 0;
  for (const p of [...script.panels].sort((a, b) => a.n - b.n)) {
    if (only && p.n !== only) continue;
    const outPath = path.join(outDir, `${String(p.n).padStart(2, "0")}.jpg`);
    if (!force && gate2(outPath).ok) { console.error(`· panel ${p.n} exists, skip`); skip++; continue; }

    const prompt = buildImagePrompt(p, cast, STYLE);
    // fixed per-book seed keeps the cast/style stable across panels
    const seed = baseSeed;
    const { width, height } = dims(p.wide);
    const r = await genImage(prompt, { seed, width, height, outPath, token });
    const g = r.ok ? gate2(outPath) : { ok: false };
    if (g.ok) { console.error(`✓ panel ${p.n}  ${g.bytes}B`); ok++; }
    else { console.error(`✗ panel ${p.n}  FAILED (GATE-2)`); fail++; }
  }
  console.error(`\ndone — ${ok} generated, ${skip} skipped, ${fail} failed`);
  if (fail) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
