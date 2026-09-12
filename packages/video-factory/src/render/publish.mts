// packages/video-factory/src/render/publish.mts
//
// **찍은 것을 올린다** — Supabase Storage 공개 버킷 `video`.
//
//   mp4 (out/<규격>/) + 포스터·자막 (dist-media/) → 버킷 → manifest 에 baseUrl 기록
//
// **재실행 안전**: 같은 크기의 파일이 이미 올라가 있으면 건너뛴다. 250MB 를 매번 다시
// 올리면 발행이 부담스러워지고, 부담스러운 단계는 안 하게 된다.
//
// ⚠️ 버킷은 마이그레이션(`20260913000100_video_bucket.sql`)이 만든다. 적용 전에 돌리면
//   **무엇이 없는지 분명히 말하고 멈춘다** — "업로드 실패" 만 찍고 끝내지 않는다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PKG = path.resolve(HERE, '../..')
const REPO = path.resolve(PKG, '../..')
const OUT = path.join(PKG, 'out')
const DIST = path.join(PKG, 'dist-media')
const MANIFEST = path.join(REPO, 'apps/web/src/lib/video/manifest.json')
const BUCKET = 'video'

/* 접속 — 저장소 관례대로 apps/web/.env.local 직독. */
const envPath = path.join(REPO, 'apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2]!.replace(/^['"]|['"]$/g, '')
  }
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) {
  throw new Error(
    '발행에는 SUPABASE_SERVICE_ROLE_KEY 가 필요하다 (apps/web/.env.local). ' +
      'anon 키로는 버킷에 쓸 수 없다.',
  )
}
const db = createClient(URL_, KEY, { auth: { persistSession: false } })

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.vtt': 'text/vtt',
  '.txt': 'text/plain',
}

interface Upload {
  /** 버킷 안 경로 */
  key: string
  abs: string
}

function collect(): Upload[] {
  const out: Upload[] = []
  const walk = (dir: string, prefix: string) => {
    if (!fs.existsSync(dir)) return
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name)
      const key = prefix ? `${prefix}/${e.name}` : e.name
      if (e.isDirectory()) walk(abs, key)
      else if (MIME[path.extname(e.name)]) out.push({ key, abs })
    }
  }
  walk(OUT, '')
  walk(DIST, '')
  return out.sort((a, b) => a.key.localeCompare(b.key))
}

async function main(): Promise<void> {
  const { data: buckets, error: bucketErr } = await db.storage.listBuckets()
  if (bucketErr) throw new Error(`버킷 목록을 못 읽었다: ${bucketErr.message}`)
  if (!buckets.some((b) => b.name === BUCKET)) {
    throw new Error(
      `버킷 '${BUCKET}' 이 없다.\n` +
        `  마이그레이션을 먼저 적용해야 한다 — supabase/migrations/20260913000100_video_bucket.sql\n` +
        `  (CLAUDE.md: 마이그레이션 자동 적용 금지 — 사람이 승인한 뒤 apply_migration)`,
    )
  }

  const files = collect()
  if (files.length === 0) {
    throw new Error('올릴 것이 없다 — 먼저 `pnpm video render-all` 과 `pnpm video package` 를 돌린다')
  }

  // 이미 같은 크기로 올라간 것은 건너뛴다.
  const existing = new Map<string, number>()
  for (const dir of ['wide', 'vertical', 'square', '']) {
    const { data } = await db.storage.from(BUCKET).list(dir, { limit: 1000 })
    for (const o of data ?? []) {
      const size = (o.metadata as { size?: number } | null)?.size
      if (typeof size === 'number') existing.set(dir ? `${dir}/${o.name}` : o.name, size)
    }
  }

  let sent = 0
  let skipped = 0
  let failed = 0
  for (const f of files) {
    const bytes = fs.statSync(f.abs).size
    if (existing.get(f.key) === bytes) {
      skipped++
      continue
    }
    const { error } = await db.storage
      .from(BUCKET)
      .upload(f.key, fs.readFileSync(f.abs), {
        contentType: MIME[path.extname(f.abs)],
        upsert: true,
        // 영상은 한 번 올리면 잘 안 바뀐다 — 오래 캐시해 재생 시작을 빠르게 한다.
        cacheControl: '604800',
      })
    if (error) {
      failed++
      console.log(`FAIL ${f.key} — ${error.message}`)
      continue
    }
    sent++
  }

  const baseUrl = `${URL_.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}`
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as { baseUrl: string | null }
  manifest.baseUrl = baseUrl
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8')

  console.log(`올림 ${sent} · 건너뜀 ${skipped}` + (failed ? ` · 실패 ${failed}` : ''))
  console.log(`baseUrl → ${baseUrl}`)
  console.log(`manifest → ${path.relative(process.cwd(), MANIFEST)} (커밋해야 화면에 뜬다)`)
}

await main()
