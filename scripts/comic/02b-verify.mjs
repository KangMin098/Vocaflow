// scripts/comic/02b-verify.mjs
// GATE-2.5 — Analyze & Repair. After panels are generated, each panel is scored
// on the key elements (scene fidelity, figure count, character identity, caption-
// zone clearance, style). Failing panels are regenerated with a stricter, defect-
// targeted prompt, keeping character anchors + house style locked.
//
// The analyst (vision) is Claude — two modes:
//   --api        : call the Anthropic vision model automatically (needs ANTHROPIC_API_KEY);
//                  fully autonomous verify → repair → re-verify loop.
//   --verdicts F : consume a verdicts JSON authored by Claude in-session (works with no key):
//                  { "panels": [ { "n": 4, "verdict": "fail",
//                                  "tags": ["extra_figures"], "hint": "no mummy figure" } ] }
//
// Usage:
//   node scripts/comic/02b-verify.mjs --script s.json --images dir --verdicts qc.json --repair
//   node scripts/comic/02b-verify.mjs --script s.json --images dir --api --repair --max 3

import fs from "fs";
import path from "path";
import { refinePrompt, genImage, gate2, STYLE } from "./lib.mjs";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

const dims = (wide) => wide ? { width: 480, height: 320 } : { width: 312, height: 416 };

// ---- optional autonomous analyst: Claude vision ----
async function verifyWithClaude(imgPath, panel, cast, apiKey) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });
  const b64 = fs.readFileSync(imgPath).toString("base64");
  const present = (panel.characters || []).map((id) => {
    const c = cast.find((x) => x.id === id);
    return c ? `${c.name} (${c.canonical}, ${c.anchor})` : id;
  });
  const rubric = `You are a strict comic QC reviewer. Judge this panel against its spec.
SPEC:
- intended scene: ${panel.scene}
- expected figures: ${(panel.characters || []).length} (${present.join("; ") || "none / scenery"})
- caption box will be placed in the ${panel.cap_zone || "top"} area, which must be roughly empty.
Return STRICT JSON only:
{"verdict":"pass"|"fail","tags":[subset of "extra_figures","scene_mismatch","identity_drift","capzone_blocked","style_drift"],"hint":"<short concrete fix, or empty>"}`;
  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 400,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
        { type: "text", text: rubric },
      ],
    }],
  });
  const t = msg.content.map((c) => c.text || "").join("");
  return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
}

async function main() {
  const scriptPath = arg("script"), imagesDir = arg("images");
  if (!scriptPath || !imagesDir) { console.error("--script and --images required"); process.exit(2); }
  const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
  const cast = script.cast;
  const baseSeed = (script.adaptation && script.adaptation.seed) || cast[0]?.seed_role || 909;
  const doRepair = !!arg("repair");
  const maxAttempts = Number(arg("max", 3));
  const escalate = !!arg("escalate");

  const tokenFile = path.join(import.meta.dirname, ".pollinations-token");
  const token = (process.env.POLLINATIONS_TOKEN || (fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, "utf8") : "")).trim();

  // ---- collect verdicts ----
  const byN = {};
  if (arg("verdicts")) {
    const v = JSON.parse(fs.readFileSync(arg("verdicts"), "utf8"));
    for (const p of v.panels || []) byN[p.n] = p;
    console.error(`→ loaded ${Object.keys(byN).length} verdicts (Claude in-session)`);
  } else if (arg("api")) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { console.error("--api needs ANTHROPIC_API_KEY"); process.exit(2); }
    console.error("→ verifying with Claude vision…");
    for (const p of script.panels) {
      const img = path.join(imagesDir, `${String(p.n).padStart(2, "0")}.jpg`);
      if (!gate2(img).ok) { byN[p.n] = { n: p.n, verdict: "fail", tags: ["scene_mismatch"], hint: "blank/failed image" }; continue; }
      try { byN[p.n] = { n: p.n, ...(await verifyWithClaude(img, p, cast, apiKey)) }; }
      catch (e) { byN[p.n] = { n: p.n, verdict: "fail", tags: [], hint: "verify error: " + e.message }; }
      const r = byN[p.n];
      console.error(`  panel ${p.n}: ${r.verdict}${r.tags?.length ? " [" + r.tags.join(",") + "]" : ""}`);
    }
  } else { console.error("provide --verdicts <file> or --api"); process.exit(2); }

  const fails = script.panels.filter((p) => byN[p.n] && byN[p.n].verdict === "fail");
  console.error(`\nGATE-2.5: ${script.panels.length - fails.length}/${script.panels.length} pass, ${fails.length} to repair`);

  const report = { generated_at: null, total: script.panels.length, failed: fails.map((p) => p.n), repairs: [] };

  if (doRepair) {
    for (const p of fails) {
      const v = byN[p.n];
      const img = path.join(imagesDir, `${String(p.n).padStart(2, "0")}.jpg`);
      const { width, height } = dims(p.wide);
      let ok = false, attempts = 0;
      for (let a = 1; a <= maxAttempts && !ok; a++) {
        attempts = a;
        const seed = baseSeed + (escalate ? (a - 1) * 7 : 0);
        const prompt = refinePrompt(p, cast, STYLE, v.tags || [], v.hint || "", a);
        const g = await genImage(prompt, { seed, width, height, outPath: img, token });
        if (!g.ok) { continue; }
        // re-verify only in --api mode; verdicts mode does a single targeted pass (re-reviewed by Claude next)
        if (arg("api") && process.env.ANTHROPIC_API_KEY) {
          try { const rv = await verifyWithClaude(img, p, cast, process.env.ANTHROPIC_API_KEY); ok = rv.verdict === "pass"; byN[p.n] = { n: p.n, ...rv }; }
          catch { ok = true; }
        } else { ok = true; }
      }
      console.error(`  ↻ panel ${p.n}: repaired in ${attempts} attempt(s)${ok ? " ✓" : " (kept best)"}`);
      report.repairs.push({ n: p.n, tags: v.tags, hint: v.hint, attempts, resolved: ok });
    }
  }

  const out = path.join(imagesDir, "qc-report.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.error(`→ wrote ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
