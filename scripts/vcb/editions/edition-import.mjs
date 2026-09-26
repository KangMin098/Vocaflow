#!/usr/bin/env node
// scripts/vcb/editions/edition-import.mjs
//
// **VCB 에디션 표지 — 4단계 import.** 생성된 표지 파일을 `shared_word_sets.cover_image_meta.edition` 에 적는다.
//
//   node --tls-max-v1.2 --env-file=apps/web/.env.local scripts/vcb/editions/edition-import.mjs            # 드라이런
//   node --tls-max-v1.2 --env-file=apps/web/.env.local scripts/vcb/editions/edition-import.mjs --commit
//
// 재실행 안전 — jsonb 를 **통째로 덮지 않는다.** 기존 cover_image_meta 를 읽어 `edition` 키 하나만 더한다
// (덮으면 family·lockup 이 날아간다). 파일이 없는 세트는 건너뛰고 그 수를 출력한다(빈 값을 넣지 않는다).
// 되돌리기: 같은 키를 지우면 화면은 종전 표지(VocabCoverArt)로 돌아간다 — 파일은 남는다.

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_STYLE, TITLE_INK } from './edition-styles.mjs'
import { chromium } from '../../design/lib/ref-page.mjs'

const HERE = import.meta.dirname
const ROOT = path.resolve(HERE, '../../..')
const PUB = '/covers/vocab/editions'
const DIR = path.join(ROOT, 'apps/web/public', PUB)
const COMMIT = process.argv.includes('--commit')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 부재 — --env-file=apps/web/.env.local')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

const prompts = JSON.parse(fs.readFileSync(path.join(HERE, 'work', 'prompts.out.json'), 'utf8'))
const logPath = path.join(HERE, 'work', 'gen-log.json')
const genLog = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : {}

// 면 색 — tines 표지는 진한 단색 면 위 사물이다. 화면이 제목 띠를 **그림과 같은 색**으로 칠하도록
//   네 모서리(24px 칸)의 중앙값을 적는다. 모델이 실제로 칠한 색이라 TILE_BG 의 이름표 색과 다를 수 있다(자홍이 라일락으로 나온다).
const browser = await chromium.launch()
const page = await browser.newPage()
async function panelOf(file) {
  return page.evaluate(async (src) => {
    const im = new Image(); im.src = src; await im.decode()
    const W = im.naturalWidth, H = im.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H
    const g = c.getContext('2d'); g.drawImage(im, 0, 0)
    const px = []
    for (const [x0, y0] of [[4, 4], [W - 28, 4], [4, H - 28], [W - 28, H - 28]]) {
      const d = g.getImageData(x0, y0, 24, 24).data
      for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]])
    }
    const med = [0, 1, 2].map((k) => px.map((p) => p[k]).sort((a, b) => a - b)[px.length >> 1])
    return '#' + med.map((v) => v.toString(16).padStart(2, '0')).join('')
  }, 'data:image/webp;base64,' + fs.readFileSync(file).toString('base64'))
}

let wrote = 0, skippedNoFile = 0, unchanged = 0
for (const [slug, raw] of Object.entries(prompts)) {
  const p = { ...raw, style: raw.style ?? DEFAULT_STYLE }
  const file = path.join(DIR, `${slug}.webp`)
  if (!fs.existsSync(file) || fs.statSync(file).size < 10_000) { skippedNoFile++; continue }
  const { data: row, error } = await sb.from('shared_word_sets').select('id, cover_image_meta').eq('slug', slug).maybeSingle()
  if (error || !row) { console.warn(`  ? ${slug} — 세트를 못 찾음 ${error?.message ?? ''}`); skippedNoFile++; continue }
  const edition = {
    src: `${PUB}/${slug}.webp`,
    style: p.style,
    title_ink: TITLE_INK[p.style] ?? 'light',
    model: genLog[slug]?.model ?? 'qwen-image-q3-lightning (kaggle)',
    generated_at: genLog[slug]?.generated_at ?? fs.statSync(file).mtime.toISOString(),
    v: Math.round(fs.statSync(file).mtimeMs / 1000), // 캐시 무효화용 — 다시 그리면 바뀐다
    ...(p.style === 'tines' ? { panel: await panelOf(file) } : {}),
  }
  const prev = row.cover_image_meta?.edition
  if (prev && prev.src === edition.src && prev.v === edition.v && prev.style === edition.style && prev.panel === edition.panel) { unchanged++; continue }
  if (COMMIT) {
    const next = { ...(row.cover_image_meta ?? {}), edition }
    const { error: e2 } = await sb.from('shared_word_sets').update({ cover_image_meta: next }).eq('id', row.id)
    if (e2) { console.warn(`  ✗ ${slug} ${e2.message}`); continue }
  }
  wrote++
  console.log(`  ${COMMIT ? '✓' : '·'} ${slug} (${p.style})`)
}
await browser.close()
console.log(`${COMMIT ? '적재' : '드라이런'} ${wrote} · 변경 없음 ${unchanged} · 파일 없어 건너뜀 ${skippedNoFile}`)
