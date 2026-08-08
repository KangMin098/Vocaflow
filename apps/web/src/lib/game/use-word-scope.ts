// apps/web/src/lib/game/use-word-scope.ts
//
// 게임 단어 스코프 해석 — 모든 게임(스캐폴드 17종 + 독립 3D wordblitz)의 단일 진입점.
//
// ── 스코프 3단 ────────────────────────────────────────────────────
//   ① explicit : ?set= / ?text= (+?chapter=) → 그 자료의 단어
//   ② mine     : 스코프 없음 + 단어가 필요한 게임 → 사용자 due 큐 (아케이드 기본)
//   ③ demo     : ①②로 최소 단어를 못 채움 → 게임 내장 맛보기 풀(wordPool=undefined)
//
// 왜 훅으로 뽑았나:
//   play-scaffold 와 /play/wordblitz/page.tsx 가 같은 스코프 로직을 각자 복제하고 있었고,
//   v07.4 에서 ②를 스캐폴드에만 넣자 카탈로그가 `source:'mine'` 이라 광고한 wordblitz 가
//   정작 내 단어를 안 쓰는 불일치가 생겼다. 한 곳에서 해석해 두 경로가 같이 따라오게 한다.
//
// minWords === 0(내장 뱅크 게임)이면 ②를 시도하지 않는다 — 불필요한 쿼리 차단.

'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import type { Word } from '@/components/game/_shared/gamekit'
import { fetchDueGameWords } from '@/lib/game/due-words'
import { createClient } from '@/lib/supabase/client'
import { fetchScopedWords } from '@/lib/workspace/scoped-words'

export type ScopeKind = 'explicit' | 'mine' | 'bank'

export interface WordScope {
  /** 로딩 중(explicit/mine 조회 대기) — 게임 렌더 전 스피너 */
  loading: boolean
  kind: ScopeKind
  /** explicit 인데 minWords 미달 — 호출부가 안내 화면을 띄운다 */
  insufficient: boolean
  /** 맛보기 폴백(내 단어 부족) — 라벨로 반드시 표기 */
  demo: boolean
  /** 게임에 넘길 단어. undefined = 게임 내장 풀 사용 */
  words: Word[] | undefined
  /** ResourceContext 라벨 */
  title: string
  subtitle: string
  /** 원본 쿼리 — 복귀 경로·점수 적재에 필요 */
  set?: string
  text?: string
  from?: string
  chapter: number | null
}

interface Loaded {
  kind: 'explicit' | 'mine'
  words: Word[]
  title: string
  subtitle: string
}

export function useGameWordScope({
  label,
  minWords,
}: {
  /** 게임 표시명 — 폴백 라벨 */
  label: string
  /** 이 게임이 필요로 하는 최소 단어 수. 0 = 내장 뱅크 게임 */
  minWords: number
}): WordScope {
  const searchParams = useSearchParams()
  const set = searchParams.get('set') ?? undefined
  const text = searchParams.get('text') ?? undefined
  const from = searchParams.get('from') ?? undefined
  const chapterNum = Number(searchParams.get('chapter'))
  const chapter = Number.isInteger(chapterNum) && chapterNum > 0 ? chapterNum : null

  const explicit = !!(set || text)
  const needsWords = minWords > 0
  const useMine = !explicit && needsWords
  const loadsPool = explicit || useMine

  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    if (!loadsPool) return
    let mounted = true
    void (async () => {
      const client = createClient()
      const {
        data: { user },
      } = await client.auth.getUser()

      if (explicit) {
        const res = await fetchScopedWords(client, { set, text, chapter, userId: user?.id ?? null })
        if (!mounted) return
        setLoaded({
          kind: 'explicit',
          words: (res?.words ?? []).map((w) => ({
            en: w.word,
            ko: w.meaning,
            pron: w.pronunciation || undefined,
            example: w.example || undefined,
            pos: w.pos || undefined,
            inflected: w.inflectedForms && w.inflectedForms.length > 0 ? w.inflectedForms : undefined,
          })),
          title: res?.title ?? label,
          subtitle: res?.subtitle ?? '',
        })
        return
      }

      // mine — 비로그인이면 즉시 맛보기로 degrade(로그인 벽으로 놀이를 막지 않는다)
      if (!user) {
        if (mounted) setLoaded({ kind: 'mine', words: [], title: label, subtitle: '' })
        return
      }
      const due = await fetchDueGameWords(client, user.id)
      if (!mounted) return
      setLoaded({
        kind: 'mine',
        words: due.words,
        title: '내 복습 단어',
        subtitle: `${due.words.length}개 · 복습 임박순`,
      })
    })()
    return () => {
      mounted = false
    }
  }, [loadsPool, explicit, set, text, chapter, label])

  if (!loadsPool) {
    return {
      loading: false,
      kind: 'bank',
      insufficient: false,
      demo: false,
      words: undefined,
      title: label,
      subtitle: '큐레이션 세계',
      set,
      text,
      from,
      chapter,
    }
  }

  if (loaded === null) {
    return {
      loading: true,
      kind: explicit ? 'explicit' : 'mine',
      insufficient: false,
      demo: false,
      words: undefined,
      title: label,
      subtitle: '',
      set,
      text,
      from,
      chapter,
    }
  }

  const enough = loaded.words.length >= minWords
  // explicit 은 사용자가 "이 자료로"를 명시했으므로 몰래 다른 단어로 바꿔치지 않고 안내한다.
  // mine 은 막지 않고 맛보기로 degrade — 단, demo=true 로 라벨에 명시.
  const insufficient = loaded.kind === 'explicit' && !enough
  const demo = loaded.kind === 'mine' && !enough

  return {
    loading: false,
    kind: loaded.kind,
    insufficient,
    demo,
    words: enough ? loaded.words : undefined,
    title: demo ? '맛보기 단어' : loaded.title,
    subtitle: demo ? '내 단어장이 채워지면 내 단어로 바뀌어요' : loaded.subtitle,
    set,
    text,
    from,
    chapter,
  }
}
