// scripts/comic/03-assemble.mjs
// Phase D/E. Read a validated script + its panel images and assemble the
// Gonick-style comic page (bubbles + narration + verbatim quotes overlaid as
// crisp HTML/CSS — text is never baked into the image). One tier per build;
// the shared art is reused across tiers, so only the text overlay changes.
//
// Usage:
//   node scripts/comic/03-assemble.mjs --script out/script.json --images out/img \
//        --tier teen --out out/comic.teen.html

import fs from "fs";
import path from "path";
import { assembleHTML, assembleComicHTML } from "./lib.mjs";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

function main() {
  const scriptPath = arg("script");
  const imagesDir = arg("images");
  const out = arg("out");
  if (!scriptPath || !imagesDir || !out) {
    console.error("--script, --images and --out required"); process.exit(2);
  }
  const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
  const tier = arg("tier", script.adaptation.default_tier);

  // verify every panel has its image before assembling
  const missing = script.panels
    .map((p) => path.join(imagesDir, `${String(p.n).padStart(2, "0")}.jpg`))
    .filter((f) => !fs.existsSync(f));
  if (missing.length) {
    console.error("✗ missing panel images:\n   " + missing.join("\n   "));
    process.exit(1);
  }

  // --layout webtoon (default, single vertical column) | comic (multi-panel book pages)
  const layout = arg("layout", "webtoon");
  const html = layout === "comic"
    ? assembleComicHTML(script, { tier, imagesDir })
    : assembleHTML(script, { tier, imagesDir });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.error(`✓ assembled ${script.panels.length} panels (layout=${layout}, tier=${tier}) → ${out}  (${html.length} bytes)`);
}

main();
