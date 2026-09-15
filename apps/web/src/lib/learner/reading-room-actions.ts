// apps/web/src/lib/learner/reading-room-actions.ts
//
// "살아있는 서재" 데이터 — 오늘 되찾을 단어와 그 맥락.
//
// 왜 이 조회가 따로 있나: 기존 허브들은 단어를 **개수**로만 다뤘다("242개 복습").
// 그런데 이 제품은 어휘 학습 플랫폼이고, 진입면에 단어가 한 개도 없다.
// 개수는 할 일을 말하지만 단어는 그 자체가 학습 재료다(Context-Dependent · Dual Coding).
//
// 밀린 순서로 고른다 — 가장 오래 못 만난 단어가 가장 값나가는 단어다.

'use server'

import { createClient } from '@/lib/supabase/server'

export interface ReadingRoomWord {
  id: string
  word: string
  meaning: string
  /** 이 단어를 만난 문장. 없을 수 있다(전체의 약 12%). */
  example: string | null
  pos: string | null
  cefr: string | null
  /** 며칠 밀렸나 — 0 이면 오늘이 기한 */
  overdueDays: number
}

export interface ReadingRoom {
  /** 지면의 주인공 — 가장 오래 밀린 단어 */
  lead: ReadingRoomWord
  /** 뒤따르는 단어들 (주인공 제외) */
  rest: ReadingRoomWord[]
  /** 오늘 기한이 지난 단어 총수 */
  overdueTotal: number
}

const PAGE = 8

/**
 * 오늘의 서재.
 *
 * 밀린 단어가 없으면 `null` — 빈 지면을 만들지 않는다. 화면은 그때 다른 것을 말한다.
 */
export async function fetchReadingRoom(): Promise<ReadingRoom | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const nowIso = new Date().toISOString()

  const { count } = await supabase
    .from('vocabularies')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .not('next_review_at', 'is', null)
    .lt('next_review_at', nowIso)

  const { data, error } = await supabase
    .from('vocabularies')
    .select('id, word, meaning, example_sentence, pos, cefr_level, next_review_at')
    .eq('user_id', user.id)
    .not('next_review_at', 'is', null)
    .lt('next_review_at', nowIso)
    // 가장 오래 밀린 것부터. meaning 이 빈 단어는 지면에 올릴 수 없다.
    .not('meaning', 'is', null)
    .order('next_review_at', { ascending: true })
    .limit(PAGE)

  if (error || !data || data.length === 0) return null

  const rows = data as Array<{
    id: string
    word: string
    meaning: string | null
    example_sentence: string | null
    pos: string | null
    cefr_level: string | null
    next_review_at: string
  }>

  const nowMs = Date.now()
  const mapped: ReadingRoomWord[] = rows
    .filter((r) => (r.meaning ?? '').trim().length > 0)
    .map((r) => ({
      id: r.id,
      word: r.word,
      meaning: (r.meaning ?? '').trim(),
      example: (r.example_sentence ?? '').trim() || null,
      pos: r.pos,
      cefr: r.cefr_level,
      overdueDays: Math.max(
        0,
        Math.floor((nowMs - new Date(r.next_review_at).getTime()) / 86_400_000),
      ),
    }))

  if (mapped.length === 0) return null

  const [lead, ...rest] = mapped
  return { lead, rest, overdueTotal: count ?? mapped.length }
}
