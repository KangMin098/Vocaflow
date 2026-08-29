// apps/web/src/lib/flashcard/hub-words.ts
//
// /flashcard hub 일반 진입 (set/text 스코프 없음) → 사용자 SRS 큐의 due 단어를
// FlashcardWord[] 로 변환 (mock 대체). 워크스페이스 스코프 진입(scoped-words)과 짝.
//
// 쿼리는 lib/wordvault/study-queries.fetchStudyVocabularies(due 우선 + cap) 단일 출처 재사용,
// FSRS 상태는 rowToCard 로 실제 vocabularies row 에서 hydrate (세션 인터벌 미리보기 정합).
// 영속화는 FlashcardSession 이 pushPendingResult → flushPendingSession 으로 처리(서버 권위 재계산).

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import { createInitialSRS } from '@/lib/srs/sm2'
import { rowToCard, type VocabularyRow } from '@/lib/srs/supabase-adapter'
import { blankSurface } from '@/lib/text/surface-match'
import { fetchStudyVocabularies } from '@/lib/wordvault/study-queries'
import { fetchDictExtras, exampleKey } from '@/lib/flashcard/dict-extras'
import type { FlashcardWord } from '@/types/flashcard'

/**
 * hub 진입 학습 단어 — 사용자 vocabularies 의 due 우선(next_review_at 임박순) 세션.
 * 빈 배열이면 호출부에서 빈 상태 안내(mock 으로 폴백 금지).
 */
export async function fetchDueFlashcardWords(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<FlashcardWord[]> {
  const rows = await fetchStudyVocabularies(client, userId)

  // 사전 부가정보(연어+다의어+어원)는 vocabularies 가 아닌 shared_dictionary/word_root_links 소유
  // → 단어 배치로 보강(scoped-words 공용 헬퍼). 정답면 절제 노출(Progressive Disclosure). 실패해도 카드 렌더 그대로.
  const extras = await fetchDictExtras(
    client,
    rows.map((r) => r.word),
  )

  return rows.map((r) => {
    const example = r.example_sentence ?? ''
    const ex = extras.get(r.word.toLowerCase())
    return {
      id: r.id,
      text: r.word,
      meaning: r.meaning ?? '',
      pronunciation: r.pronunciation ?? '',
      pos: r.pos ?? '',
      exampleSentence: example,
      // hub 단어는 사전 inflected_forms 미보유 → 규칙 기반 빈칸 fallback
      exampleSentenceWithBlank: example ? blankSurface(example, r.word) : '',
      collocations: ex?.collocations,
      senses: ex?.senses,
      exampleTranslation: ex?.exampleTranslations?.[exampleKey(example ?? '')],
      roots: ex?.roots,
      mnemonic: ex?.mnemonic,
      textId: r.text_id ?? r.id,
      textTitle: '내 단어장',
      textChapter: '',
      srs: createInitialSRS(),
      // 실제 FSRS 상태 hydrate — VocabRow 는 rowToCard 가 쓰는 FSRS 컬럼을 모두 포함
      srsV2: rowToCard(r as unknown as VocabularyRow),
    } satisfies FlashcardWord
  })
}
