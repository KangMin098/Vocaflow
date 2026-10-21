// apps/web/scripts/prune-dist-dirs.mjs
//
// 격리 distDir(`.next-*`) 사본을 보존 한도(dist-dir-retention.mjs)대로 정리한다.
// `next build` 는 자기 apps/web 만 정리하므로, 여러 워크트리에 이미 쌓인 사본은 이것으로 한 번에 비운다.
//
//   node apps/web/scripts/prune-dist-dirs.mjs                       # 이 워크트리 apps/web · 미리보기
//   node apps/web/scripts/prune-dist-dirs.mjs --root D:/workspace   # 형제 워크트리 전부 · 미리보기
//   node apps/web/scripts/prune-dist-dirs.mjs --root D:/workspace --apply
//
// 옵션: --keep N (워크트리마다 남길 최신 격리 사본 수, 기본 2) · --min-age-hours H (기본 2)
// 살아 있는 서버의 사본과 `.next` · `.next-dev` 는 지우지 않는다. 재실행 안전.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_MAX_KEEP, DEFAULT_MIN_AGE_MS, planDistDirPrune, pruneDistDirs } from './dist-dir-retention.mjs'

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const value = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const apply = flag('--apply')
const root = value('--root')
const maxKeep = value('--keep') !== undefined ? Number(value('--keep')) : DEFAULT_MAX_KEEP
const minAgeMs =
  value('--min-age-hours') !== undefined ? Number(value('--min-age-hours')) * 60 * 60_000 : DEFAULT_MIN_AGE_MS
if (!Number.isInteger(maxKeep) || maxKeep < 0 || !Number.isFinite(minAgeMs) || minAgeMs < 0) {
  console.error('--keep 은 0 이상의 정수, --min-age-hours 는 0 이상의 수여야 한다.')
  process.exit(2)
}

const selfWebDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const webDirs = root
  ? fs
      .readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(root, e.name, 'apps', 'web'))
      .filter((d) => fs.existsSync(d))
  : [selfWebDir]

const now = Date.now()
let total = 0
for (const webDir of webDirs) {
  const opts = { webDir, now, maxKeep, minAgeMs }
  const { remove } = planDistDirPrune(opts)
  if (!remove.length) continue
  total += remove.length
  if (apply) {
    const { removed, failed } = pruneDistDirs(opts)
    console.log(`${webDir}: 삭제 ${removed.length}${failed.length ? ` · 실패 ${failed.join(', ')}` : ''}`)
  } else {
    console.log(`${webDir}: ${remove.map((r) => r.name).join(', ')}`)
  }
}
console.log(
  total === 0
    ? '정리할 격리 사본이 없다.'
    : apply
      ? `완료 — ${total}개 대상.`
      : `미리보기 — ${total}개. 지우려면 --apply 를 붙인다.`,
)
