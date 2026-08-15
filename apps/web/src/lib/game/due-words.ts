// apps/web/src/lib/game/due-words.ts
//
// 아케이드 기본 스코프 — "내 복습 큐(due)" 단어를 게임 wordPool 로.
//
// 왜 필요한가:
//   /arcade 카드는 `?set=`·`?text=` 없이 게임을 열었고, 스캐폴드는 스코프가 없으면
//   wordPool 을 주지 않았다 → 게임이 하드코딩 DEFAULT_POOL 로 돌고,
//   recordGameResult 는 그 단어를 vocabularies 에서 못 찾아 silent skip →
//   허브가 내건 "모든 게임은 학습 기록(FSRS)과 연동됩니다" 가 기본 진입에서 거짓이었다.
//   기본 스코프를 사용자 due 큐로 두어 아무 것도 고르지 않아도 진짜 학습이 되게 한다.
//
// 정렬은 flashcard/pairflip 과 동일 정책 — next_review_at ASC(nullsFirst) → created_at ASC.
// 브라우저 supabase client 사용 (GamePlayScaffold = client component).

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Word } from '@/components/game/_shared/gamekit'
import { loadInflectedForms } from '@/lib/workspace/scoped-words'

/** 한 게임 세션에 실을 단어 상한 — Cognitive Load(작업기억) + 쿼리 비용 절충. */
export const ARCADE_POOL_CAP = 40

export interface DueWordsResult {
  words: Word[]
  /**
   * **이 풀의 크기**(= `words.length`, `ARCADE_POOL_CAP` 로 잘린 뒤). 학습자의 보유 단어 총수가
   * 아니다 — 이전 주석이 "전체 보유 단어 수(상한 이전)" 라고 적혀 있었고, 그 말을 믿은 화면이
   * 252단어 학습자에게 "내 단어 40개" 라고 말했다(2026-08-15 실측). 총수가 필요하면
   * `vocabularies` head count 를 따로 센다.
   */
  total: number
}

/**
 * 사용자 vocabularies 의 복습 임박 단어 → 게임 Word[].
 * meaning 이 빈 단어는 어떤 게임에서도 문제로 못 쓰므로 제외.
 * 실패(비로그인·네트워크)는 빈 배열 — 호출부가 맛보기 풀로 degrade.
 */
export async function fetchDueGameWords(
  client: SupabaseClient,
  userId: string,
  limit: number = ARCADE_POOL_CAP,
): Promise<DueWordsResult> {
  const { data, error } = await client
    .from('vocabularies')
    .select('word, lemma, meaning, example_sentence, pronunciation, pos')
    .eq('user_id', userId)
    .not('meaning', 'is', null)
    .neq('meaning', '')
    .order('next_review_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) return { words: [], total: 0 }

  const rows = (data ?? []) as Array<{
    word: string
    lemma: string | null
    meaning: string | null
    example_sentence: string | null
    pronunciation: string | null
    pos: string | null
  }>

  // 굴절형 — 예문 빈칸/타이핑 판정이 불규칙형을 인식하도록 (scoped-words 와 동일 소스)
  let formsMap = new Map<string, string[]>()
  try {
    formsMap = await loadInflectedForms(client, rows.map((r) => r.lemma ?? r.word))
  } catch {
    /* 사전 보강 실패는 비치명 — 단어 자체로 플레이 */
  }

  const words: Word[] = rows.map((r) => {
    const inflected = formsMap.get(r.lemma ?? r.word)
    return {
      en: r.word,
      ko: r.meaning ?? '',
      ...(r.pronunciation ? { pron: r.pronunciation } : {}),
      ...(r.example_sentence ? { example: r.example_sentence } : {}),
      ...(r.pos ? { pos: r.pos } : {}),
      ...(inflected && inflected.length > 0 ? { inflected } : {}),
    }
  })

  return { words, total: words.length }
}
