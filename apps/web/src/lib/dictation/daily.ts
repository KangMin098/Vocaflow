// apps/web/src/lib/dictation/daily.ts
//
// 오늘의 받아쓰기 — "매일 열 이유"를 시스템이 만든다.
//
// 왜 필요한가:
//   기존 허브는 "리소스를 고르세요"였다. 고르는 일 자체가 마찰이고, 매일 무엇을 골라야
//   느는지는 학습자가 알 수 없다. 매일 오는 습관은 **결정 비용이 0일 때**만 생긴다.
//
// 조립 규칙 (5문장 · 약 4분):
//   ① due   3문장 — 복습 임박 단어가 사는 문장. 받아쓰기가 곧 그 단어의 복습이 된다.
//   ② retry 1문장 — 최근 85% 미만으로 놓친 문장 재도전 (Spacing + 실패 후 재인출).
//   ③ fresh 1문장 — 최근 읽던 자료의 새 문장 (Variable Reward · 신선함).
//
//   ②③이 비면 ①로 채운다. 전부 비면 null — 호출부가 "자료를 먼저 고르세요"로 안내.
//
// 오늘 이미 받아쓴 문장은 제외한다 — 같은 날 같은 문장을 다시 주면 "시스템이 나를
// 보고 있지 않다"는 신호가 되고, 그 순간 매일 오는 이유가 사라진다.

import type { SupabaseClient } from '@supabase/supabase-js'

import { loadInflectedForms } from '@/lib/workspace/scoped-words'

import { attachTargets, isUsableSentence, type DictationSentence, type DictationSource, type TargetLemma } from './source'
import { splitSentences } from './text-splitter'

const DAILY_TARGET = 5
const DUE_SLOTS = 3
const RETRY_SLOTS = 1
const FRESH_SLOTS = 1

/** KST 오늘 00:00 의 ISO — 서버가 UTC 라 날짜 경계를 명시적으로 만든다. */
function kstTodayStartIso(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  kst.setUTCHours(0, 0, 0, 0)
  return new Date(kst.getTime() - 9 * 60 * 60 * 1000).toISOString()
}

/** 오늘 이미 받아쓴 문장 집합 (중복 배달 방지). */
async function fetchTodayDone(client: SupabaseClient, userId: string): Promise<Set<string>> {
  const { data } = await client
    .from('dictation_attempts')
    .select('expected')
    .eq('user_id', userId)
    .gte('created_at', kstTodayStartIso())
    .limit(200)
  return new Set(((data ?? []) as Array<{ expected: string }>).map((r) => r.expected.trim()))
}

// ── ① 복습 임박 단어가 사는 문장 ──────────────────────────────────

interface DueVocabRow {
  word: string
  lemma: string | null
  example_sentence: string | null
  next_review_at: string | null
  text_id: string | null
}

async function fetchDueSentences(
  client: SupabaseClient,
  userId: string,
  done: Set<string>,
  limit: number,
): Promise<DictationSentence[]> {
  // next_review_at 이 이른 순 — 지금 가장 흔들리는 단어부터.
  // 아직 복습일이 안 온 단어까지 포함해 풀을 넓게 잡고(예문 없는 행이 많다) 앞에서 자른다.
  const { data } = await client
    .from('vocabularies')
    .select('word, lemma, example_sentence, next_review_at, text_id')
    .eq('user_id', userId)
    .not('example_sentence', 'is', null)
    .order('next_review_at', { ascending: true, nullsFirst: false })
    .limit(120)

  const rows = (data ?? []) as DueVocabRow[]
  if (rows.length === 0) return []

  const formsMap = await loadInflectedForms(
    client,
    rows.map((r) => (r.lemma ?? r.word).toLowerCase()),
  )

  const out: DictationSentence[] = []
  const usedText = new Set<string>()
  for (const r of rows) {
    if (out.length >= limit) break
    const sentence = (r.example_sentence ?? '').trim()
    if (!sentence || !isUsableSentence(sentence)) continue
    if (done.has(sentence) || usedText.has(sentence)) continue
    usedText.add(sentence)
    const lemma = (r.lemma ?? r.word).toLowerCase()
    const lemmas: TargetLemma[] = [{ word: lemma, forms: formsMap.get(lemma) ?? [] }]
    const targets = attachTargets(sentence, lemmas)
    // 예문 안에 그 단어가 안 보이면(불규칙 미수록 등) 타깃 없이도 받아쓸 가치는 있으나,
    // due 슬롯의 목적이 그 단어 복습이므로 건너뛴다.
    if (targets.targetWords.length === 0) continue
    out.push({
      text: sentence,
      ...targets,
      contextLabel: '복습 임박 단어',
      reason: 'due',
    })
  }
  return out
}

// ── ② 최근 놓친 문장 재도전 ───────────────────────────────────────

interface MissRow {
  expected: string
  accuracy: number
  target_words: string[]
  session_title: string | null
}

async function fetchRetrySentences(
  client: SupabaseClient,
  done: Set<string>,
  limit: number,
): Promise<DictationSentence[]> {
  const { data, error } = await client.rpc('dictation_recent_misses', { p_limit: 8 })
  if (error) return []
  const rows = (data ?? []) as MissRow[]
  const out: DictationSentence[] = []
  for (const r of rows) {
    if (out.length >= limit) break
    const text = r.expected.trim()
    if (done.has(text)) continue
    const targetForms: Record<string, string[]> = {}
    for (const w of r.target_words ?? []) targetForms[w] = []
    out.push({
      text,
      targetWords: r.target_words ?? [],
      targetForms,
      contextLabel: `지난번 ${Math.round(r.accuracy)}%`,
      reason: 'retry',
    })
  }
  return out
}

// ── ③ 최근 읽던 자료의 새 문장 ────────────────────────────────────

async function fetchFreshSentences(
  client: SupabaseClient,
  userId: string,
  done: Set<string>,
  limit: number,
): Promise<DictationSentence[]> {
  // content 로 거르지 않는다 — 도서 챕터는 texts.content 가 NULL 이고 본문이
  // content_chunks 에 있다(source.loadTextContent). 걸러내면 도서가 통째로 빠진다.
  const { data } = await client
    .from('texts')
    .select('id, title, content, chapter_title, chapter_idx, library_book_id, last_opened')
    .eq('user_id', userId)
    .order('last_opened', { ascending: false, nullsFirst: false })
    .limit(3)

  const rows = (data ?? []) as Array<{
    id: string
    title: string | null
    content: string | null
    chapter_title: string | null
    chapter_idx: number | null
    library_book_id: string | null
  }>

  const out: DictationSentence[] = []
  for (const t of rows) {
    if (out.length >= limit) break
    let body = t.content ?? ''
    if (body.trim().length === 0) {
      const { data: rpcData } = await client.rpc('get_chapter_content', { p_text_id: t.id })
      body = typeof rpcData === 'string' ? rpcData : ''
    }
    const pool = splitSentences(body).filter(
      (s) => isUsableSentence(s) && !done.has(s.trim()),
    )
    if (pool.length === 0) continue
    // 앞머리(장 제목 잔재)를 피해 중간에서 고른다 — 매일 같은 첫 문장이 나오지 않게.
    const pick = pool[Math.floor(pool.length * 0.15) + Math.floor(Math.random() * Math.max(1, Math.floor(pool.length * 0.7)))]
    if (!pick) continue
    out.push({
      text: pick.trim(),
      targetWords: [],
      targetForms: {},
      contextLabel: t.chapter_title || t.title || '읽던 자료',
      reason: 'fresh',
    })
  }
  return out
}

// ── 조립 ──────────────────────────────────────────────────────────

export interface DailyPlanMeta {
  due: number
  retry: number
  fresh: number
}

export interface DailyDictation extends DictationSource {
  kind: 'daily'
  meta: DailyPlanMeta
}

/**
 * 오늘의 받아쓰기 5문장 조립. 재료가 하나도 없으면 null.
 * 세 갈래를 병렬로 긁고 부족분은 due 로 메운다.
 */
export async function buildDailyDictation(
  client: SupabaseClient,
  userId: string | null,
): Promise<DailyDictation | null> {
  if (!userId) return null

  const done = await fetchTodayDone(client, userId)
  const [due, retry, fresh] = await Promise.all([
    fetchDueSentences(client, userId, done, DUE_SLOTS + 2),
    fetchRetrySentences(client, done, RETRY_SLOTS),
    fetchFreshSentences(client, userId, done, FRESH_SLOTS),
  ])

  const picked: DictationSentence[] = [
    ...due.slice(0, DUE_SLOTS),
    ...retry.slice(0, RETRY_SLOTS),
    ...fresh.slice(0, FRESH_SLOTS),
  ]
  // 부족분은 남은 due 로 (복습이 가장 손해 없는 채움)
  for (const s of due.slice(DUE_SLOTS)) {
    if (picked.length >= DAILY_TARGET) break
    picked.push(s)
  }
  if (picked.length === 0) return null

  // due → retry → fresh 순으로 정렬하지 않는다. 복습만 3개 연속이면 지루하고,
  // 재도전이 첫 문항이면 시작부터 실패 기억을 밟는다. 새 문장 → 복습 → 재도전 순으로
  // "쉬움 → 익숙 → 도전"의 정서 곡선을 만든다(§철학3 Empathetic Feedback).
  const order: Record<string, number> = { fresh: 0, due: 1, retry: 2 }
  picked.sort((a, b) => (order[a.reason ?? 'due'] ?? 1) - (order[b.reason ?? 'due'] ?? 1))

  const meta: DailyPlanMeta = {
    due: picked.filter((s) => s.reason === 'due').length,
    retry: picked.filter((s) => s.reason === 'retry').length,
    fresh: picked.filter((s) => s.reason === 'fresh').length,
  }

  const parts: string[] = []
  if (meta.due > 0) parts.push(`복습 임박 ${meta.due}`)
  if (meta.retry > 0) parts.push(`재도전 ${meta.retry}`)
  if (meta.fresh > 0) parts.push(`새 문장 ${meta.fresh}`)

  return {
    kind: 'daily',
    title: '오늘의 받아쓰기',
    subtitle: parts.join(' · '),
    sentences: picked,
    meta,
  }
}
