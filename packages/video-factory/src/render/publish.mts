// packages/video-factory/src/render/publish.mts
//
// **찍은 것을 올린다** — Supabase Storage 공개 버킷 `video`.
//
//   mp4 (out/<규격>/) + 포스터·자막 (dist-media/) → 버킷 → manifest 에 baseUrl 기록
//
// **재실행 안전**: 같은 **내용(sha256)**의 파일이 이미 올라가 있으면 건너뛴다(`upload-plan.ts`).
// 250MB 를 매번 다시 올리면 발행이 부담스러워지고, 부담스러운 단계는 안 하게 된다.
// 크기로 가르면 교체 편처럼 같은 경로·같은 크기·다른 내용인 파일이 건너뛰어져 옛 편이 남는다.
//
// ⚠️ 버킷은 마이그레이션(`20260913000100_video_bucket.sql`)이 만든다. 적용 전에 돌리면
//   **무엇이 없는지 분명히 말하고 멈춘다** — "업로드 실패" 만 찍고 끝내지 않는다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

import { advance } from '../jobs/client'
import { refreshRetiredFile } from '../requests/drain.mjs'
import { HASH_INDEX_KEY, nextHashIndex, parseHashIndex, planUploads, sha256File } from './upload-plan'

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
// 좁혀진 값을 따로 잡아 둔다 — 함수 본문 안에서는 모듈 스코프의 좁힘이 유지되지 않는다.
const SUPABASE_URL: string = URL_
const db = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } })

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

  // 내린 편은 올리지 않는다 — 로컬에 남은 파일이 버킷으로 되돌아가지 않게
  const retired = new Set((await refreshRetiredFile()).map((r) => r.video_id))
  const idOf = (key: string) => path.basename(key).replace(/\.[^.]+$/, '')
  const files = collect().filter((f) => !retired.has(idOf(f.key)))
  if (files.length === 0) {
    throw new Error('올릴 것이 없다 — 먼저 `pnpm video render-all` 과 `pnpm video package` 를 돌린다')
  }

  // 이미 **같은 내용**으로 올라간 것만 건너뛴다 — 버킷에 실제로 있고, 기록된 sha256 이 같을 때.
  const remoteKeys = new Set<string>()
  for (const dir of ['wide', 'vertical', 'square', 'thumb', '']) {
    const { data, error } = await db.storage.from(BUCKET).list(dir, { limit: 1000 })
    if (error) throw new Error(`버킷 목록(${dir || '/'})을 못 읽었다: ${error.message}`)
    // 폴더 항목은 id 가 null 이다 — 파일만 센다
    for (const o of data ?? []) if (o.id) remoteKeys.add(dir ? `${dir}/${o.name}` : o.name)
  }
  let prevHashes: Record<string, string> = {}
  if (remoteKeys.has(HASH_INDEX_KEY)) {
    const { data, error } = await db.storage.from(BUCKET).download(HASH_INDEX_KEY)
    if (error) throw new Error(`해시 기록(${HASH_INDEX_KEY})을 못 읽었다: ${error.message}`)
    prevHashes = parseHashIndex(await data.text())
  }
  const hashed = files.map((f) => ({ ...f, sha256: sha256File(f.abs) }))
  const plan = planUploads(hashed, remoteKeys, prevHashes)

  let sent = 0
  const skipped = plan.skip.length
  let failed = 0
  const okFiles: { key: string; sha256: string }[] = [...plan.skip]
  const failedKeys: string[] = []
  for (const f of plan.upload) {
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
      failedKeys.push(f.key)
      console.log(`FAIL ${f.key} — ${error.message}`)
      continue
    }
    okFiles.push(f)
    sent++
  }

  // 해시 기록 갱신 — 올린(또는 같음을 확인한) 것만. 이 기록을 못 쓰면 다음 발행이 전부 다시 올릴 뿐
  // 틀리게 건너뛰지는 않으므로 실패로 치되 멈추지는 않는다.
  const index = nextHashIndex(prevHashes, okFiles, failedKeys)
  const { error: idxErr } = await db.storage
    .from(BUCKET)
    .upload(HASH_INDEX_KEY, JSON.stringify(index, null, 2) + '\n', { contentType: 'text/plain', upsert: true, cacheControl: '0' })
  if (idxErr) console.log(`FAIL ${HASH_INDEX_KEY} — ${idxErr.message} (다음 발행은 전부 다시 올린다)`)

  // 큐에 마지막 단계를 남긴다 — 파일이 아니라 **기록**이 진행을 말해야 파이프라인이다.
  //
  // 실패가 하나라도 있으면 올리지 않는다. 「발행됨」은 **전부 올라갔다**는 뜻이어야 하고,
  // 절반만 올라간 편을 published 로 적으면 화면에서 깨진 채 "정상" 으로 보인다.
  const current = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as {
    videos: { id: string; kind: string }[]
  }
  if (failed === 0) {
    for (const v of current.videos) await advance(v.id, v.kind, 'published')
  } else {
    console.log(`  (실패 ${failed}건이라 published 로 올리지 않는다 — 다시 돌리면 올라간다)`)
  }

  const baseUrl = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}`
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as { baseUrl: string | null }
  manifest.baseUrl = baseUrl
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8')

  console.log(`올림 ${sent} · 건너뜀 ${skipped}` + (failed ? ` · 실패 ${failed}` : ''))
  console.log(`baseUrl → ${baseUrl}`)
  console.log(`manifest → ${path.relative(process.cwd(), MANIFEST)} (커밋해야 화면에 뜬다)`)
}

await main()
