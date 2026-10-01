// scripts/csat/source-origin-export.mjs
// DB의 평가원 영어 지문을 본문 해시별로 묶고, 원전 검색용 짧은 지문(fingerprint)만 JSONL로 내보낸다.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve('apps/web/.env.local') })

const DEFAULT_OUTPUT = 'scripts/csat/source-origin-work/pending.jsonl'
const PAGE_SIZE = 1000
const WINDOW_SIZE = 11
const FINGERPRINTS_PER_PASSAGE = 3
const MIN_WORDS = 7

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function normalizePassage(value) {
  return String(value ?? '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[_━─]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizedHashText(value) {
  return normalizePassage(value)
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function searchWords(value) {
  return normalizePassage(value)
    .replace(/\([^)]{0,80}\)/g, ' ')
    .replace(/[^A-Za-z0-9' -]/g, ' ')
    .replace(/\b(?:①|②|③|④|⑤)\b/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/^-+|-+$/g, ''))
    .filter((word) => /^[A-Za-z][A-Za-z'-]*$/.test(word))
}

function documentFrequencies(passages) {
  const frequencies = new Map()
  for (const passage of passages) {
    const seen = new Set(searchWords(passage).map((word) => word.toLowerCase()))
    for (const word of seen) frequencies.set(word, (frequencies.get(word) ?? 0) + 1)
  }
  return frequencies
}

function selectFingerprints(passage, frequencies, documentCount) {
  const words = searchWords(passage)
  if (words.length < MIN_WORDS) return []
  const size = Math.min(WINDOW_SIZE, words.length)
  const candidates = []

  for (let start = 0; start <= words.length - size; start += 1) {
    const window = words.slice(start, start + size)
    const lower = window.map((word) => word.toLowerCase())
    const unique = new Set(lower)
    const idfScore = [...unique].reduce(
      (sum, word) => sum + Math.log((documentCount + 1) / ((frequencies.get(word) ?? 0) + 1)),
      0,
    )
    const rareLongWords = lower.filter(
      (word) => word.length >= 7 && (frequencies.get(word) ?? documentCount) <= Math.max(2, documentCount * 0.02),
    ).length
    const score = idfScore + rareLongWords * 1.5
    candidates.push({ start, end: start + size, score, text: window.join(' ') })
  }

  candidates.sort((a, b) => b.score - a.score || a.start - b.start)
  const selected = []
  for (const candidate of candidates) {
    const overlaps = selected.some(
      (existing) => Math.max(existing.start, candidate.start) < Math.min(existing.end, candidate.end),
    )
    if (overlaps) continue
    selected.push(candidate)
    if (selected.length === FINGERPRINTS_PER_PASSAGE) break
  }

  return selected.sort((a, b) => a.start - b.start).map(({ text }) => text)
}

// keyset(id) 로 끝까지 — OFFSET 은 뒤 페이지가 앞을 다시 훑는다(scan-offset-paging 예산). 두 호출 모두 id 를 고른다.
async function selectAll(db, table, columns) {
  const rows = []
  let cursor = null
  for (;;) {
    let q = db.from(table).select(columns).order('id').limit(PAGE_SIZE)
    if (cursor !== null) q = q.gt('id', cursor)
    const { data, error } = await q
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
    cursor = data[data.length - 1].id
  }
}

const output = path.resolve(arg('--output', DEFAULT_OUTPUT))
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY를 찾지 못했다')

const db = createClient(url, key, { auth: { persistSession: false } })
const [exams, items] = await Promise.all([
  selectAll(db, 'csat_exams', 'id,label,kind,year,month'),
  selectAll(db, 'csat_items', 'id,exam_id,no,in_scope,passage'),
])
const examById = new Map(exams.map((exam) => [exam.id, exam]))
const scoped = items.filter((item) => item.in_scope && normalizedHashText(item.passage).length >= 60)
const grouped = new Map()

for (const item of scoped) {
  const hashText = normalizedHashText(item.passage)
  const passageSha256 = sha256(hashText)
  const existing = grouped.get(passageSha256)
  if (existing) {
    existing.items.push(item)
  } else {
    grouped.set(passageSha256, { passage: normalizePassage(item.passage), items: [item] })
  }
}

const groups = [...grouped.entries()].map(([passageSha256, group]) => ({ passageSha256, ...group }))
const frequencies = documentFrequencies(groups.map((group) => group.passage))
const records = groups
  .map((group) => {
    const itemIds = group.items.map((item) => item.id).sort()
    const representative = group.items
      .slice()
      .sort((a, b) => a.exam_id.localeCompare(b.exam_id) || a.no - b.no)[0]
    const exam = examById.get(representative.exam_id)
    const fingerprints = selectFingerprints(group.passage, frequencies, groups.length)
    return {
      passage_sha256: group.passageSha256,
      representative_item_id: representative.id,
      item_ids: itemIds,
      exam: exam
        ? { id: exam.id, label: exam.label, kind: exam.kind, year: exam.year, month: exam.month }
        : { id: representative.exam_id },
      word_count: searchWords(group.passage).length,
      fingerprints,
      search_queries: fingerprints.map(
        (fingerprint) => `"${fingerprint}" -수능 -모의고사 -EBS -ebsi -quizlet`,
      ),
      status: 'pending',
    }
  })
  .sort(
    (a, b) =>
      (a.exam.year ?? 0) - (b.exam.year ?? 0) ||
      (a.exam.month ?? 0) - (b.exam.month ?? 0) ||
      a.representative_item_id.localeCompare(b.representative_item_id),
  )

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`, 'utf8')

const duplicateGroups = records.filter((record) => record.item_ids.length > 1)
console.log(
  JSON.stringify(
    {
      output,
      exams: exams.length,
      in_scope_items: scoped.length,
      unique_passages: records.length,
      duplicate_groups: duplicateGroups.length,
      items_in_duplicate_groups: duplicateGroups.reduce((sum, record) => sum + record.item_ids.length, 0),
      records_without_fingerprints: records.filter((record) => record.fingerprints.length === 0).length,
    },
    null,
    2,
  ),
)
