// apps/web/src/lib/articles/start-learning.ts
//
// 스크립트(아티클) 학습 시작 — published 아티클 본문으로 학습용 texts 행 생성.
// books 의 enroll_library_book(챕터 N개) 과 달리 아티클은 단일 텍스트라 texts 1행.
//
// 재학습 시 중복 생성 방지: texts.source_url 에 'article:{id}' 마커를 저장하고
// 동일 마커가 있으면 기존 행 재사용 (마이그레이션 없이 멱등).

'use server'

import { createClient } from '@/lib/supabase/server'

type Result = { ok: true; textId: string } | { ok: false; error: string }

export async function startArticleLearning(articleId: string): Promise<Result> {
  if (!articleId) return { ok: false, error: '잘못된 요청이에요' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요' }

  const marker = `article:${articleId}`

  // 글 단어장 구독 + vocabularies 시드 (책 _enroll_book_subscribe_word_sets 미러).
  //   subscribe_article_word_set 는 auth.uid() 사용 SECURITY DEFINER · 멱등(ON CONFLICT).
  //   단어장 미발행/미생성이어도 무해(0행) — 발행 트리거가 생성하면 다음 진입에 반영.
  const subscribeWordSet = async (): Promise<void> => {
    await (
      supabase as unknown as {
        rpc: (n: string, p: Record<string, unknown>) => Promise<{ error: unknown }>
      }
    ).rpc('subscribe_article_word_set', { p_article_id: articleId })
  }

  // 1) 이미 학습 텍스트가 있으면 재사용 (멱등)
  const { data: existing } = await supabase
    .from('texts')
    .select('id')
    .eq('user_id', user.id)
    .eq('source_url', marker)
    .maybeSingle()
  if (existing && (existing as { id: string }).id) {
    await subscribeWordSet()
    return { ok: true, textId: (existing as { id: string }).id }
  }

  // 2) 아티클 본문 로드 (RLS: published + copyright_safe 만 조회 가능)
  const { data: art, error: artErr } = await supabase
    .from('library_articles')
    .select('title, author, content, cefr_level, status, copyright_safe_in_kr')
    .eq('id', articleId)
    .maybeSingle()
  if (artErr || !art) return { ok: false, error: '스크립트를 찾을 수 없어요' }
  const a = art as {
    title: string
    author: string | null
    content: string | null
    cefr_level: string | null
    status: string
    copyright_safe_in_kr: boolean
  }
  if (a.status !== 'published' || !a.copyright_safe_in_kr || !a.content) {
    return { ok: false, error: '아직 학습할 수 없는 스크립트예요' }
  }

  // 3) 학습용 texts 생성 (source='direct-script' · cyan 커버로 도서와 시각 구분)
  const { data: inserted, error: insErr } = await supabase
    .from('texts')
    .insert({
      user_id: user.id,
      title: a.title,
      content: a.content,
      author: a.author,
      source: 'direct-script',
      source_url: marker,
      cefr_level: a.cefr_level,
      progress_percent: 0,
      cover_from: '#38BDF8',
      cover_to: '#0E7490',
      last_opened: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (insErr || !inserted) {
    return { ok: false, error: '학습 시작 중 오류가 발생했어요' }
  }
  await subscribeWordSet()
  return { ok: true, textId: (inserted as { id: string }).id }
}
