// scripts/comic/pd/page-html.mjs
//
// 구성 보존 모던 리더(HTML) — PDCP 내용(문구) 현대화. 원작 페이지 구성 그대로(page-modern=색감 현대화 이미지)
// 를 배경으로, letter.spec.json 의 오퍼레이터 좌표에 **둥근 모던 말풍선/캡션(HTML/CSS)**을 얹는다.
// 래스터 stamp 의 한계(사각 박스·좌표 굽힘)를 HTML 로 해소 — 크리스프 폰트·둥근 말풍선·선택가능 텍스트.
// 자립형(이미지 base64 임베드) → 브라우저에서 바로 열림. 학습자 리더 통합 전 검증본.
//
//   node scripts/comic/pd/page-html.mjs --workdir work/<slug>

import fs from 'node:fs'
import path from 'node:path'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1] }
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const REPO = path.resolve(HERE, '..', '..', '..')

const WD = arg('workdir')
if (!WD || !fs.existsSync(WD)) { console.error(`--workdir <dir> 필요: ${WD}`); process.exit(2) }
const specFile = path.join(WD, 'letter.spec.json')
const spec = fs.existsSync(specFile) ? JSON.parse(fs.readFileSync(specFile, 'utf8')) : {}

const pmDir = path.join(WD, 'page-modern')
if (!fs.existsSync(pmDir)) { console.error(`page-modern 없음 — 먼저 page-modern.mjs 실행`); process.exit(2) }
const pages = fs.readdirSync(pmDir).filter((f) => /^\d+\.jpg$/i.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

const b64 = (f) => `data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}`
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const pageHtml = pages.map((f) => {
  const key = f.replace(/\.jpg$/i, '')
  const img = b64(path.join(pmDir, f))
  const balloons = (spec[key] || []).map((b) => {
    const cls = b.type === 'caption' ? 'cap' : 'bal'
    const style = `left:${(b.x * 100).toFixed(2)}%;top:${(b.y * 100).toFixed(2)}%;width:${(b.w * 100).toFixed(2)}%;height:${(b.h * 100).toFixed(2)}%`
    return `      <div class="lt ${cls}" style="${style}"><span>${escHtml(b.text)}</span></div>`
  }).join('\n')
  return `  <figure class="pg">
    <img src="${img}" alt="page ${key}" />
${balloons}
  </figure>`
}).join('\n')

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Whiz — 구성 보존 모던 리더 (검증본)</title>
<style>
  :root{ --ink:#1a1a1a; --paper:#fbfaf7; --accent:#2e7d5a; --bd:#2a2a2a; }
  *{ box-sizing:border-box; }
  body{ margin:0; background:#e9e7e2; color:var(--ink);
    font-family:"Segoe UI",system-ui,-apple-system,sans-serif; }
  header{ padding:14px 18px; background:#fff; border-bottom:1px solid #ddd; }
  header b{ font-size:15px; } header span{ color:#777; font-size:12.5px; margin-left:8px; }
  .wrap{ max-width:820px; margin:0 auto; padding:18px 12px 60px; display:flex; flex-direction:column; gap:22px; }
  .pg{ position:relative; margin:0; line-height:0; box-shadow:0 2px 14px rgba(0,0,0,.14); border-radius:8px; overflow:hidden; }
  .pg img{ width:100%; height:auto; display:block; }
  /* 모던 말풍선/캡션 오버레이(구성 좌표 위) */
  .lt{ position:absolute; display:flex; align-items:center; justify-content:center;
    padding:1.1% 1.4%; text-align:center; }
  .lt span{ display:block; width:100%; line-height:1.16;
    font-weight:600; letter-spacing:.1px;
    /* 박스 폭에 맞춰 글자 크기 자동 축소 */
    font-size:clamp(9px, 1.9vw, 17px); }
  .bal{ background:rgba(255,255,255,.97); border:2px solid var(--bd);
    border-radius:46% / 52%; box-shadow:0 1px 4px rgba(0,0,0,.18); }
  .cap{ background:var(--paper); border:1px solid #cfc8bd; border-left:5px solid var(--accent);
    border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,.12); }
  .cap span{ text-align:left; font-weight:500; }
</style></head>
<body>
<header><b>Whiz Comics — 구성 보존 모던 리더</b><span>원작 구성 그대로 · 이미지=색감(C 볼드) · 내용=모던 말풍선(HTML). 검증본.</span></header>
<div class="wrap">
${pageHtml}
</div>
</body></html>`

const outDir = path.join(WD, 'page-html')
fs.mkdirSync(outDir, { recursive: true })
const out = path.join(outDir, 'reader.html')
fs.writeFileSync(out, html, 'utf8')
const withSpec = pages.filter((f) => (spec[f.replace(/\.jpg$/i, '')] || []).length).length
console.log(`✓ 모던 리더 HTML — 페이지 ${pages.length}(대사 스펙 ${withSpec}) · ${path.relative(REPO, out)}`)
console.log(`  브라우저에서 열기: ${out}`)
