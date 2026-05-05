// scripts/seed-dictionary.mjs
//
// 외부 시드 데이터 (SQLite) → Supabase 3 테이블 import.
//
// 흐름 [4 단계]:
//   [1/4] env 검증 (.env.local + service_role 키 형식)
//   [2/4] SQLite 직접 읽기 (압축 해제 불필요)
//   [3/4] notes + 모델 파싱 → 단어/카테고리 빌드
//   [4/4] 통계 출력 + 사용자 확인 → Supabase batch upsert
//
// 멱등성:
//   3 테이블 모두 ignoreDuplicates=true → 재실행 안전.
//   기존 row 의 meaning_ko 등 채워진 값은 절대 덮어쓰지 않음.
//
// 의존성 (devDependencies):
//   pnpm add -D -w better-sqlite3 @supabase/supabase-js dotenv
//
// 실행:
//   pnpm db:seed-dictionary           — 실행 + 확인 프롬프트
//   pnpm db:seed-dictionary:dry       — INSERT 없이 통계만
//   pnpm db:seed-dictionary -- --yes  — 확인 프롬프트 스킵 (CI 용)

import { existsSync } from 'node:fs'
import { argv, exit, stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'

import Database from 'better-sqlite3'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

import { config } from './seed-dictionary.config.mjs'

// dotenv fallback — --env-file 없이도 .env.local 자동 로드
dotenv.config({ path: config.envFile })

// ════════════════════════════════════════════════════════════
// 인자
// ════════════════════════════════════════════════════════════
const dryRun = argv.includes('--dry-run') || config.dryRun
const skipConfirm = argv.includes('--yes') || argv.includes('-y')

// ════════════════════════════════════════════════════════════
// [1/4] env 검증
// ════════════════════════════════════════════════════════════
console.log('[1/4] env 검증')

const SUPABASE_URL = process.env[config.envKeys.url]
const SERVICE_ROLE = process.env[config.envKeys.serviceRole]

if (!dryRun) {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error(`  ✗ env 누락: ${config.envKeys.url} / ${config.envKeys.serviceRole}`)
    console.error(`  ✗ ${config.envFile} 에 추가 후 재실행`)
    exit(1)
  }
  if (!SERVICE_ROLE.startsWith('eyJ')) {
    console.error(`  ✗ ${config.envKeys.serviceRole} 형식 이상 — JWT 는 'eyJ' 로 시작`)
    console.error('    Supabase Dashboard → Project Settings → API → service_role(secret) 복사')
    exit(1)
  }
  console.log(`  ✓ url          : ${SUPABASE_URL}`)
  console.log(`  ✓ service_role : ${SERVICE_ROLE.slice(0, 12)}…${SERVICE_ROLE.slice(-6)}`)
} else {
  console.log('  · DRY-RUN — env 우회')
}

if (!existsSync(config.dbPath)) {
  console.error(`  ✗ 시드 DB 없음: ${config.dbPath}`)
  exit(1)
}
console.log(`  ✓ db           : ${config.dbPath}`)
console.log()

// ════════════════════════════════════════════════════════════
// [2/4] SQLite 직접 읽기
// ════════════════════════════════════════════════════════════
console.log('[2/4] SQLite open')
const db = new Database(config.dbPath, { readonly: true })
console.log(`  ✓ open         : readonly`)
console.log()

// ════════════════════════════════════════════════════════════
// [3/4] notes + 모델 필드 파싱
// ════════════════════════════════════════════════════════════
console.log('[3/4] notes + 모델 필드 파싱')

const colRow = db.prepare('SELECT models FROM col LIMIT 1').get()
if (!colRow) {
  console.error('  ✗ col 테이블 비어 있음')
  db.close()
  exit(1)
}
const models = JSON.parse(colRow.models)

/** 모델별 fieldName(lowercase) → ord */
function buildFieldIndex(model) {
  const idx = {}
  for (const f of model.flds) idx[f.name.toLowerCase().trim()] = f.ord
  return idx
}

/** fieldMap 후보 중 첫 일치 ord */
function resolveOrd(fieldIndex, candidates) {
  for (const c of candidates) {
    const ord = fieldIndex[c.toLowerCase()]
    if (ord !== undefined) return ord
  }
  return -1
}

const FLD_SEP = '\x1f'
const notes = db.prepare('SELECT mid, flds FROM notes').all()
console.log(`  ✓ raw notes : ${notes.length.toLocaleString()}`)

/** 누적 빌드 컨테이너 */
const dictMap = new Map() // word → row
const catMap = new Map() // category id → row
const wcMap = new Map() // `${word}\x01${catId}` → row

let skippedBadPos = 0
let skippedEmptyPos = 0
let skippedBadCefr = 0

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]+/g, '')
    .trim()
    .split(/\s+/)
    .join(config.slugSeparator)

/** H1 > H2 > H3 트리 등록 후 leaf id 반환 */
function ensureCategoryPath(h1, h2, h3) {
  const labels = [h1, h2, h3].map((s) => (s ?? '').trim()).filter(Boolean)
  if (labels.length === 0) return null

  let parentId = null
  let lastId = null
  for (let level = 1; level <= labels.length; level++) {
    const slug = slugify(labels[level - 1])
    if (!slug) return null
    const id = parentId ? `${parentId}-${slug}` : slug
    if (!catMap.has(id)) {
      catMap.set(id, {
        id,
        name_en: labels[level - 1],
        level,
        parent_id: parentId,
        sort_order: 0,
        is_active: true,
      })
    }
    parentId = id
    lastId = id
  }
  return lastId
}

for (const n of notes) {
  const model = models[String(n.mid)]
  if (!model) continue
  const fi = buildFieldIndex(model)
  const fields = String(n.flds).split(FLD_SEP)

  const get = (key) => {
    const ord = resolveOrd(fi, config.fieldMap[key])
    return ord >= 0 ? (fields[ord] ?? '').trim() : ''
  }

  const wordRaw = get('word')
  const posRaw = get('pos')
  const cefrRaw = get('cefr').toUpperCase()
  const h1 = get('h1')
  const h2 = get('h2')
  const h3 = get('h3')
  const example = get('example')

  if (!wordRaw) continue

  const pos = posRaw.toLowerCase().trim()
  if (!pos) {
    skippedEmptyPos++
    continue
  }
  if (config.filters.skipPosContains.some((p) => pos.includes(p))) {
    skippedBadPos++
    continue
  }
  if (![...config.filters.validPos].some((v) => pos.includes(v))) {
    skippedBadPos++
    continue
  }

  const cefr = config.filters.validCefr.has(cefrRaw) ? cefrRaw : null
  if (cefrRaw && !cefr) skippedBadCefr++

  const word = wordRaw.toLowerCase().replace(/\s+/g, ' ').trim()

  // shared_dictionary — 첫 등장 row 만 (다의어는 첫 의미 채택)
  if (!dictMap.has(word)) {
    dictMap.set(word, {
      word,
      meaning_ko: null, // Phase 4-4 에서 Claude 로 채움 (NULL = 아직 번역 안 됨)
      pos: pos.replace(/\.$/, ''),
      cefr_level: cefr,
      example_en: example || null,
      source: 'imported',
      verified: false,
    })
  }

  // 카테고리 트리 + 매핑
  const catId = ensureCategoryPath(h1, h2, h3)
  if (catId) {
    const key = `${word}\x01${catId}`
    if (!wcMap.has(key)) {
      wcMap.set(key, {
        word,
        category_id: catId,
        pos_in_context: pos.replace(/\.$/, ''),
        cefr_in_context: cefr,
        rank_in_category: null,
        source: 'imported',
      })
    }
  }
}

db.close()

const cats = [...catMap.values()]
const h1Count = cats.filter((c) => c.level === 1).length
const h2Count = cats.filter((c) => c.level === 2).length
const h3Count = cats.filter((c) => c.level === 3).length

console.log(`  ✓ parse 완료`)
console.log()

// ════════════════════════════════════════════════════════════
// [4/4] 통계 + 사용자 확인 → Supabase batch upsert
// ════════════════════════════════════════════════════════════
console.log('[4/4] 통계')
console.log(`  unique words      : ${dictMap.size.toLocaleString()}`)
console.log(
  `  categories        : ${cats.length.toLocaleString()}  (H1=${h1Count} / H2=${h2Count} / H3=${h3Count})`,
)
console.log(`  word-category map : ${wcMap.size.toLocaleString()}`)
console.log(`  skipped — bad POS : ${skippedBadPos}`)
console.log(`  skipped — empty   : ${skippedEmptyPos}`)
console.log(`  skipped — bad CEFR: ${skippedBadCefr}`)
console.log()

if (dryRun) {
  console.log('🟡 DRY-RUN 종료 — DB 변경 없음.')
  exit(0)
}

if (!skipConfirm) {
  const totalRows = dictMap.size + cats.length + wcMap.size
  const rl = createInterface({ input: stdin, output: stdout })
  const ans = (
    await rl.question(
      `\n  → 총 ${totalRows.toLocaleString()} row 를 ${SUPABASE_URL} 로 INSERT 합니다.\n    계속? (y/N) `,
    )
  )
    .trim()
    .toLowerCase()
  rl.close()
  if (ans !== 'y' && ans !== 'yes') {
    console.log('  ✗ 사용자 취소.')
    exit(0)
  }
}
console.log()

console.log('  Supabase upsert (ignoreDuplicates=true)')

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/**
 * 배치 upsert — DO NOTHING 의미.
 * 기존 row 의 meaning_ko / verified 등 데이터 보존.
 */
async function upsertBatched(table, rows, conflictKey) {
  const total = rows.length
  if (total === 0) {
    console.log(`  · ${table}: 0 row — skip`)
    return
  }
  let done = 0
  for (let i = 0; i < total; i += config.batchSize) {
    const slice = rows.slice(i, i + config.batchSize)
    const { error } = await supabase
      .from(table)
      .upsert(slice, { onConflict: conflictKey, ignoreDuplicates: true })
    if (error) {
      console.error(`\n  ✗ ${table} upsert (offset ${i}, batch ${slice.length}):`)
      console.error(`    ${error.message}`)
      if (error.details) console.error(`    details: ${error.details}`)
      if (error.hint) console.error(`    hint: ${error.hint}`)
      exit(1)
    }
    done += slice.length
    stdout.write(`\r  ${table.padEnd(28)} ${done.toLocaleString()} / ${total.toLocaleString()}`)
  }
  stdout.write('\n')
}

// FK 의존성 — categories(level 오름차순) → dictionary → mapping
const catsSorted = cats.sort((a, b) => a.level - b.level)
await upsertBatched('dictionary_categories', catsSorted, 'id')
await upsertBatched('shared_dictionary', [...dictMap.values()], 'word')
await upsertBatched('dictionary_word_categories', [...wcMap.values()], 'word,category_id')

console.log()
console.log('✅ import 완료')
