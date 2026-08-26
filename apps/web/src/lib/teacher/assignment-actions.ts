// apps/web/src/lib/teacher/assignment-actions.ts
//
// 학급 과제(단어 목록) server actions — F8 해소의 배선.
//
// 왜 있는가 (2026-08-17 실측):
//   학급이 껍데기였다. `classes` 는 `id·teacher_id·name·invite_code` 가 전부였고
//   `class_members` 는 코드에서 **테스트 파일에만** 등장했다 — 학급을 만들고 30명을 초대해도
//   학생에게 전달되는 것이 없었다. 진단의 10만 경로가 교사 채널(CAC 0)인데 그 기구가 비어 있었다.
//   → 마이그레이션 `class_assignments` + `class_assignment_progress` (2026-08-17 승인·적용).
//
// 🔴 **지문은 넘기지 않는다.** 교사가 넣는 것은 대체로 검정교과서·모의고사다.
//    여기서 다루는 것은 **낱말 목록**뿐이고, DB 의 CHECK(`is_valid_assignment_words`)가
//    구조적으로 강제한다(공백 포함 표면형·200자 초과 뜻·200개 초과를 거부).
//    이 파일은 그 계약을 **먼저** 지킨다 — 서버까지 가서 거부당하느니 여기서 거른다.
//
// 권한은 RLS 가 판정한다. 이 파일은 auth 게이트만 확인하고 필터를 손으로 걸지 않는다 —
//   손으로 건 필터와 정책이 어긋나면 조용히 새는 쪽은 늘 손으로 건 쪽이다.

'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import {
  assignmentWordsToVocabRows,
  countUnplayable,
  usableAssignmentWords,
  type DictLookup,
} from './assignment-vocab'

/** 과제에 실리는 낱말 한 개. DB 저장 형태와 같다(`{w,m,v}`) — 변환 지점을 만들지 않는다. */
export interface AssignmentWord {
  /** 표면형 */
  w: string
  /** 한국어 뜻 (없을 수 있다) */
  m?: string | null
  /** V-Level */
  v?: number | null
}

export interface ClassAssignment {
  id: string
  classId: string
  className: string
  title: string
  words: AssignmentWord[]
  createdAt: string
}

export interface AssignmentProgress {
  /** 학급 인원 (교사 제외) */
  memberCount: number
  /** 열어 본 사람 수 */
  openedCount: number
  /** 단어장에 담은 사람 수 */
  collectedCount: number
}

function loose(c: unknown): SupabaseClient {
  return c as SupabaseClient
}

/** 과제 제목·단어 상한 — DB CHECK 와 같은 값. 어긋나면 서버까지 가서야 거부당한다. */
const MAX_TITLE = 120
const MAX_WORDS = 200
const MAX_SURFACE = 64
const MAX_MEANING = 200

/**
 * 낱말 목록을 DB 가 받는 형태로 정제한다.
 *
 * 버리는 것: 공백 포함 표면형(구·문장 조각) · 빈 표면형 · 길이 초과.
 * 자르는 것: 뜻의 길이, 목록 개수.
 * **던지지 않는다** — 화면이 한 항목 때문에 전체를 잃지 않게, 걸러내고 남은 것으로 진행한다.
 */
function sanitizeWords(words: AssignmentWord[]): AssignmentWord[] {
  const out: AssignmentWord[] = []
  const seen = new Set<string>()

  for (const raw of words) {
    if (out.length >= MAX_WORDS) break
    const w = (raw?.w ?? '').trim()
    if (w.length === 0 || w.length > MAX_SURFACE || /\s/.test(w)) continue
    if (seen.has(w.toLowerCase())) continue
    seen.add(w.toLowerCase())

    const m = (raw?.m ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_MEANING)
    const v = typeof raw?.v === 'number' && raw.v >= 1 && raw.v <= 11 ? Math.round(raw.v) : null

    out.push({ w, m: m.length > 0 ? m : null, v })
  }
  return out
}

/**
 * 학급에 단어 목록을 보낸다 (교사).
 *
 * 학급 소유 검증은 하지 않는다 — RLS `ca_teacher_all` 의 WITH CHECK 가
 * `is_class_teacher(class_id, auth.uid())` 를 요구하므로, 남의 학급에 보내면 INSERT 가 실패한다.
 */
export async function createAssignment(
  classId: string,
  title: string,
  words: AssignmentWord[],
): Promise<{ ok: boolean; error?: string }> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const cleanTitle = (title ?? '').trim().slice(0, MAX_TITLE)
  if (cleanTitle.length === 0) return { ok: false, error: '과제 이름을 입력해 주세요.' }

  const cleanWords = sanitizeWords(words ?? [])
  if (cleanWords.length === 0) return { ok: false, error: '보낼 단어가 없어요.' }

  const { error } = await loose(client)
    .from('class_assignments')
    .insert({ class_id: classId, created_by: user.id, title: cleanTitle, words: cleanWords })

  if (error) {
    // RLS 거부와 형태 거부를 구분해 준다 — "왜 안 되는지" 를 화면이 말할 수 있어야 한다.
    const denied = /row-level security|permission/i.test(error.message)
    return {
      ok: false,
      error: denied ? '이 학급에 보낼 권한이 없어요.' : '보내지 못했어요. 잠시 뒤 다시 시도해 주세요.',
    }
  }
  // 과제 발송은 `class_assignments.created_at` 에 남는다 — 파생되므로 따로 기록하지 않는다.
  return { ok: true }
}

/**
 * 내가 받은 과제 (학생) — 소속 학급의 것만.
 *
 * RLS `ca_member_read` 가 소속 여부를 판정하므로 여기서 class_id 를 손으로 걸지 않는다.
 */
export async function fetchMyAssignments(): Promise<{
  assignments: ClassAssignment[]
  failed: boolean
}> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { assignments: [], failed: false }

  const { data, error } = await loose(client)
    .from('class_assignments')
    .select('id, class_id, title, words, created_at, classes(name)')
    .order('created_at', { ascending: false })
    .limit(50)

  // ⚠️ 조회 실패를 빈 목록으로 돌려주면 "받은 과제가 없어요" 로 보인다 —
  //    없는 것과 못 읽은 것은 다르다(같은 실수가 `/teacher` 클래스 목록에서 이미 한 번 났다).
  if (error) return { assignments: [], failed: true }

  type Row = {
    id: string
    class_id: string
    title: string
    words: AssignmentWord[] | null
    created_at: string
    classes: { name: string } | { name: string }[] | null
  }

  const assignments = ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    classId: r.class_id,
    className: Array.isArray(r.classes) ? (r.classes[0]?.name ?? '') : (r.classes?.name ?? ''),
    title: r.title,
    words: Array.isArray(r.words) ? r.words : [],
    createdAt: r.created_at,
  }))

  return { assignments, failed: false }
}

/**
 * 과제를 열어 봤다고 기록한다 (학생).
 *
 * 이미 있으면 `opened_at` 을 덮지 않는다 — **처음 열어 본 시각**이 의미 있는 값이다.
 */
export async function markAssignmentOpened(assignmentId: string): Promise<void> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return

  await loose(client)
    .from('class_assignment_progress')
    .upsert(
      { assignment_id: assignmentId, user_id: user.id },
      { onConflict: 'assignment_id,user_id', ignoreDuplicates: true },
    )
}

/**
 * **과제 낱말을 학습자의 단어장에 실제로 넣는다** — 그리고 담았다고 기록한다.
 *
 * ── 2026-08-26 이전에는 기록만 했다 ─────────────────────────────────
 * 버튼은 `단어장에 담기` 이고 누르면 `담았어요` 로 바뀌는데, 하는 일은
 * `class_assignment_progress.collected_at` 을 찍는 것뿐이었다. **단어장은 그대로였다.**
 * 교사 대시보드도 그 숫자를 세어 "N명이 담았어요" 라고 말했다 —
 * 교사가 지문을 고르고 낱말을 뽑아 보낸 이유가 학생의 학습 자료가 되는 것인데,
 * 그 **종착점이 빈 약속**이었다.
 *
 * ── 왜 origin='assignment' 인가 ─────────────────────────────────────
 * `origin` 에는 삭제 의미가 붙어 있다 — `unenroll_library_book` 은 도서를 해지할 때
 * 그 학습자의 `origin='shared_set'` 낱말을 지운다. 과제 낱말에 그 값을 쓰면
 * **무관한 도서를 해지했을 뿐인데 선생님이 보낸 단어가 함께 사라진다.**
 * (`20260826123000_vocab_origin_assignment`)
 *
 * ── 이미 있는 낱말은 건드리지 않는다 ────────────────────────────────
 * `ignoreDuplicates` — 학습자가 이미 갖고 있던 낱말의 FSRS 상태(difficulty·stability·
 * next_review_at)를 과제가 초기화하면 **그동안의 학습이 지워진다.** 추출 화면의 저장도
 * 같은 이유로 같은 옵션을 쓴다.
 *
 * 낱말 저장이 실패하면 **기록도 남기지 않는다.** 순서를 뒤집으면 "담았어요" 라고 표시된 채
 * 단어장은 비어 있는, 지금 고치고 있는 바로 그 상태가 된다.
 */
export async function markAssignmentCollected(
  assignmentId: string,
): Promise<{ ok: boolean; error?: string; added?: number; unplayable?: number }> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  // 낱말은 과제 행에서 다시 읽는다 — 클라이언트가 보낸 목록을 믿으면 남의 낱말도 넣을 수 있다.
  // RLS 가 소속 학급의 과제만 열어 주므로, 못 읽으면 담을 자격이 없는 것이다.
  const { data: rows, error: readErr } = await loose(client)
    .from('class_assignments')
    .select('words')
    .eq('id', assignmentId)
    .limit(1)

  if (readErr) return { ok: false, error: '과제를 불러오지 못했어요.' }
  const words = usableAssignmentWords(
    (rows as { words: AssignmentWord[] | null }[] | null)?.[0]?.words,
  )
  if (words.length === 0) return { ok: false, error: '담을 낱말이 없어요.' }

  // 사전에 **한 번** 물어 두 가지를 얻는다.
  //
  //   ① 표제어가 실재하는가 — `vocabularies.lemma` 는 `shared_dictionary(word)` 를 참조한다.
  //      없는 값을 적으면 **그 한 행 때문에 일괄 upsert 전체가 거부되고** 학생은 과제를
  //      통째로 못 담는다(FK 는 NULL 을 허용하므로 없으면 비운다).
  //   ② 뜻 — 과제에 뜻이 없으면 여기서 채운다. **뜻이 비면 그 낱말은 어떤 게임에도 안 나온다**
  //      (`fetchDueGameWords` 가 `.neq('meaning','')` 로 거른다). 단어장에 들어가고도
  //      영영 안 풀리는 죽은 낱말이 되는 것을 막는다.
  const { data: dictRows } = await loose(client)
    .from('shared_dictionary')
    .select('word, meaning_ko')
    .in('word', words.map((w) => w.w))
  const dict = new Map<string, DictLookup>(
    ((dictRows ?? []) as { word: string; meaning_ko: string | null }[]).map((r) => [
      r.word,
      { meaningKo: r.meaning_ko },
    ]),
  )

  // 행을 만드는 규칙은 `assignment-vocab.ts` 가 소유한다 —
  // `'use server'` 파일은 async 함수만 내보낼 수 있어 순수 함수를 그대로 검사할 수 없다.
  const vocab = assignmentWordsToVocabRows(user.id, words, dict)

  const { error: insErr, count } = await loose(client)
    .from('vocabularies')
    .upsert(vocab, { onConflict: 'user_id,word', ignoreDuplicates: true, count: 'exact' })

  if (insErr) return { ok: false, error: '단어장에 담지 못했어요.' }

  const now = new Date().toISOString()
  const { error } = await loose(client)
    .from('class_assignment_progress')
    .upsert(
      { assignment_id: assignmentId, user_id: user.id, collected_at: now },
      { onConflict: 'assignment_id,user_id' },
    )

  // 낱말은 들어갔는데 기록만 실패한 경우 — 학습 자체는 되므로 성공으로 본다.
  // (다음에 다시 눌러도 `ignoreDuplicates` 라 중복이 생기지 않는다.)
  void error
  // 뜻이 끝내 비어 있는 낱말 수 — 그것들은 게임에 안 나온다. 화면이 사실대로 말할 수 있게 넘긴다.
  return { ok: true, added: count ?? 0, unplayable: countUnplayable(vocab) }
}
/**
 * 내가 이미 담은 과제 id (학생) — 화면이 "담았어요" 를 처음부터 보여줄 수 있게.
 *
 * 없으면 새로고침할 때마다 다 안 한 것처럼 보인다.
 */
export async function fetchMyCollectedIds(): Promise<string[]> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return []

  const { data } = await loose(client)
    .from('class_assignment_progress')
    .select('assignment_id')
    .eq('user_id', user.id)
    .not('collected_at', 'is', null)

  return ((data ?? []) as { assignment_id: string }[]).map((r) => r.assignment_id)
}

/**
 * 내가 보낸 과제 + 수행 현황 (교사).
 *
 * 과제 하나마다 진도를 따로 조회하면 N+1 이 된다 — 학급 인원과 진도를 각각 **한 번씩**
 * 모아서 메모리에서 합친다.
 */
export async function fetchSentAssignments(): Promise<{
  rows: { assignment: ClassAssignment; progress: AssignmentProgress }[]
  failed: boolean
}> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { rows: [], failed: false }

  // RLS `ca_teacher_all` 이 자기 학급 것만 내준다 — 여기서 teacher_id 를 손으로 걸지 않는다.
  const { data, error } = await loose(client)
    .from('class_assignments')
    .select('id, class_id, title, words, created_at, classes(name)')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return { rows: [], failed: true }

  type Row = {
    id: string
    class_id: string
    title: string
    words: AssignmentWord[] | null
    created_at: string
    classes: { name: string } | { name: string }[] | null
  }
  const assignments = (data ?? []) as Row[]
  if (assignments.length === 0) return { rows: [], failed: false }

  const classIds = [...new Set(assignments.map((a) => a.class_id))]
  const assignmentIds = assignments.map((a) => a.id)

  const [membersRes, progressRes] = await Promise.all([
    loose(client).from('class_members').select('class_id, user_id').in('class_id', classIds),
    loose(client)
      .from('class_assignment_progress')
      .select('assignment_id, collected_at')
      .in('assignment_id', assignmentIds),
  ])

  const memberCount = new Map<string, number>()
  for (const m of (membersRes.data ?? []) as { class_id: string }[]) {
    memberCount.set(m.class_id, (memberCount.get(m.class_id) ?? 0) + 1)
  }

  const opened = new Map<string, number>()
  const collected = new Map<string, number>()
  for (const p of (progressRes.data ?? []) as { assignment_id: string; collected_at: string | null }[]) {
    opened.set(p.assignment_id, (opened.get(p.assignment_id) ?? 0) + 1)
    if (p.collected_at) collected.set(p.assignment_id, (collected.get(p.assignment_id) ?? 0) + 1)
  }

  return {
    failed: false,
    rows: assignments.map((a) => ({
      assignment: {
        id: a.id,
        classId: a.class_id,
        className: Array.isArray(a.classes) ? (a.classes[0]?.name ?? '') : (a.classes?.name ?? ''),
        title: a.title,
        words: Array.isArray(a.words) ? a.words : [],
        createdAt: a.created_at,
      },
      progress: {
        memberCount: memberCount.get(a.class_id) ?? 0,
        openedCount: opened.get(a.id) ?? 0,
        collectedCount: collected.get(a.id) ?? 0,
      },
    })),
  }
}

/**
 * 과제별 수행 현황 (교사).
 *
 * "봤는데 안 했다" 를 볼 수 있게 열람과 담기를 **따로** 센다 — 합치면 교사에게 가장
 * 쓸모 있는 신호가 사라진다.
 */
export async function fetchAssignmentProgress(
  assignmentId: string,
  classId: string,
): Promise<AssignmentProgress> {
  const client = await createClient()

  const [members, progress] = await Promise.all([
    loose(client).from('class_members').select('user_id').eq('class_id', classId),
    loose(client)
      .from('class_assignment_progress')
      .select('user_id, collected_at')
      .eq('assignment_id', assignmentId),
  ])

  const rows = (progress.data ?? []) as { user_id: string; collected_at: string | null }[]

  return {
    memberCount: (members.data ?? []).length,
    openedCount: rows.length,
    collectedCount: rows.filter((r) => r.collected_at !== null).length,
  }
}
