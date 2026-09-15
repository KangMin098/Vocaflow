// apps/web/src/components/comic/PdModernReader.tsx
//
// PDCP 모던 리더 — 구성 보존 현대화 결과를 학습자에게 제시. 원작 페이지(page-modern=색채·디자인 현대화)
// 를 배경으로, 모던 말풍선(letter.spec 좌표)을 HTML 오버레이로 얹는다. 원작 작화·구성 100% 보존.
//   학습 레이어: ①말풍선 TTS(실음 speechSynthesis) ②단어 탭 → 뜻(lookup_word_meaning, i+1).
// Calm UI: 자극 최소·모달은 차분한 하단 시트·색+아이콘 이중 신호·44px 타겟·다크 대응.
//
// dev/admin preview 로 먼저 검증(발행 게이트 통과 전). 이미지는 /api/pdcp/artifact 로 서빙.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Volume2, X, Loader2, BookOpen } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type Balloon = { type: 'balloon' | 'caption'; x: number; y: number; w: number; h: number; text: string }
// imageRel = admin preview(dev artifact 라우트) · imageUrl = 발행(공개 버킷 URL)
type Page = { index: number; page: string; imageRel?: string; imageUrl?: string; balloons: Balloon[] }
type VocabInfo = { resolved_word?: string; meaning_ko?: string; pos?: string; cefr_level?: string; example_en?: string }

// 단어 토큰화 — 알파벳 단어만 탭 가능(구두점 보존해 표시).
const WORD_RE = /^[A-Za-z][A-Za-z'-]*$/
function tokenize(text: string): { raw: string; word: string | null }[] {
  return text.split(/(\s+)/).map((chunk) => {
    if (/^\s+$/.test(chunk)) return { raw: chunk, word: null }
    const core = chunk.replace(/^[^A-Za-z]+|[^A-Za-z']+$/g, '')
    return { raw: chunk, word: WORD_RE.test(core) && core.length >= 2 ? core : null }
  })
}

// issueId → admin preview(dev artifact). pages → 발행 학습자 경로(공개 URL, 서버가 주입).
export default function PdModernReader({ issueId, pages: pagesProp, title: titleProp }: { issueId?: string; pages?: Page[]; title?: string }) {
  const [pages, setPages] = useState<Page[] | null>(pagesProp ?? null)
  const [title, setTitle] = useState(titleProp ?? '복원 만화')
  const [err, setErr] = useState<string | null>(null)
  const [vocab, setVocab] = useState<string | null>(null)
  const [vocabInfo, setVocabInfo] = useState<VocabInfo | null>(null)
  const [vocabBusy, setVocabBusy] = useState(false)
  const triggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (pagesProp || !issueId) return // 발행 경로는 서버가 pages 주입 — fetch 안 함
    let alive = true
    fetch(`/api/pdcp/reader?issueId=${encodeURIComponent(issueId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (!alive) return; if (j.error && !j.pages?.length) setErr(j.error); else { setPages(j.pages ?? []); if (j.title) setTitle(j.title) } })
      .catch(() => { if (alive) setErr('불러오기 실패') })
    return () => { alive = false }
  }, [issueId, pagesProp])

  // 단어 뜻 조회(lookup_word_meaning) — ComicReader 와 동일 RPC 재사용.
  useEffect(() => {
    if (!vocab) { setVocabInfo(null); return }
    setVocabBusy(true); setVocabInfo(null)
    let alive = true
    ;(createClient() as unknown as SupabaseClient)
      .rpc('lookup_word_meaning', { p_surface: vocab })
      .then(({ data }: { data: unknown }) => { if (alive) setVocabInfo((Array.isArray(data) ? data[0] : data) ?? null) })
      .then(undefined, () => { if (alive) setVocabInfo(null) })
      .then(() => { if (alive) setVocabBusy(false) })
    return () => { alive = false }
  }, [vocab])

  // 모달 Esc + 포커스 복귀(접근성)
  useEffect(() => {
    if (!vocab) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setVocab(null) } }
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('keydown', onKey, true); triggerRef.current?.focus?.() }
  }, [vocab])

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'; u.rate = 0.95
    window.speechSynthesis.speak(u)
  }, [])

  const onWord = useCallback((e: React.MouseEvent, word: string) => {
    triggerRef.current = e.currentTarget as HTMLElement
    setVocab(word.toLowerCase())
  }, [])

  if (err) return <div className="mx-auto max-w-[560px] px-4 py-16 text-center font-body text-[13px] text-[var(--t2)]">{err}</div>
  if (!pages) return <div className="flex items-center justify-center py-20 text-[var(--t3)]"><Loader2 className="animate-spin" size={20} aria-hidden /></div>
  if (!pages.length) return <div className="mx-auto max-w-[560px] px-4 py-16 text-center font-body text-[13px] text-[var(--t2)]">아직 페이지가 없습니다.</div>

  return (
    <div className="mx-auto w-full max-w-[820px] px-3 pb-24 md:px-4">
      <header className="flex items-center gap-2 py-3">
        <BookOpen size={15} className="text-[var(--p)]" aria-hidden />
        <h1 className="truncate font-display text-[15px] font-[800] text-[var(--t1)]">{title}</h1>
        <span className="ml-auto font-mono text-[10px] text-[var(--t3)]">구성 보존 현대화 · 말풍선 탭·듣기</span>
      </header>

      <ol className="flex flex-col gap-3">
        {pages.map((pg) => (
          <li key={pg.page}>
            <figure className="pd-page relative m-0 overflow-hidden rounded-[var(--r-md)] bg-[var(--bg3)] leading-[0] shadow-[0_2px_14px_rgba(0,0,0,0.14)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pg.imageUrl ?? `/api/pdcp/artifact?issueId=${encodeURIComponent(issueId ?? '')}&rel=${encodeURIComponent(pg.imageRel ?? '')}`}
                alt={pg.balloons.length ? pg.balloons.map((b) => b.text).join(' ') : `${pg.page} 페이지`}
                loading="lazy"
                className="block w-full"
              />
              {pg.balloons.map((b, bi) => (
                <div
                  key={bi}
                  className={`pd-lt ${b.type === 'caption' ? 'pd-cap' : 'pd-bal'}`}
                  style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
                >
                  <button
                    type="button"
                    onClick={() => speak(b.text)}
                    aria-label="이 대사 듣기"
                    className="pd-tts"
                  >
                    <Volume2 size={13} aria-hidden />
                  </button>
                  <span className="pd-text">
                    {tokenize(b.text).map((t, ti) =>
                      t.word ? (
                        <button key={ti} type="button" onClick={(e) => onWord(e, t.word as string)} className="pd-word">{t.raw}</button>
                      ) : (
                        <span key={ti}>{t.raw}</span>
                      ),
                    )}
                  </span>
                </div>
              ))}
            </figure>
          </li>
        ))}
      </ol>

      {/* 단어 뜻 — 차분한 하단 시트(Calm UI·모달 오버레이 학습중단 최소화: 하단 고정, 본문 계속 보임) */}
      {vocab && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-4" role="dialog" aria-modal="true" aria-label={`${vocab} 뜻`}>
          <div className="w-full max-w-[560px] rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[0_-4px_24px_rgba(0,0,0,0.18)]">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-[17px] font-[800] text-[var(--t1)]">{vocabInfo?.resolved_word ?? vocab}</span>
                  {vocabInfo?.pos && <span className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-1 font-mono text-[10px] text-[var(--t2)]">{vocabInfo.pos}</span>}
                  {vocabInfo?.cefr_level && <span className="rounded-[var(--r-full)] bg-[var(--p-light)] px-2 py-1 font-mono text-[10px] font-[700] text-[var(--p)]">{vocabInfo.cefr_level}</span>}
                  <button type="button" onClick={() => speak(vocabInfo?.resolved_word ?? vocab)} aria-label="단어 듣기" className="text-[var(--t3)] transition-colors hover:text-[var(--p)]"><Volume2 size={15} aria-hidden /></button>
                </div>
                {vocabBusy ? (
                  <p className="mt-1.5 flex items-center gap-2 font-body text-[12px] text-[var(--t3)]"><Loader2 size={12} className="animate-spin" aria-hidden /> 찾는 중…</p>
                ) : vocabInfo?.meaning_ko ? (
                  <>
                    <p className="mt-1.5 font-body text-[14px] text-[var(--t1)]">{vocabInfo.meaning_ko}</p>
                    {vocabInfo.example_en && <p className="mt-1 font-body text-[12px] italic leading-snug text-[var(--t2)]">{vocabInfo.example_en}</p>}
                  </>
                ) : (
                  <p className="mt-1.5 font-body text-[12.5px] text-[var(--t2)]">사전에 없는 단어예요. 문맥으로 뜻을 추측해 보세요.</p>
                )}
              </div>
              <button type="button" onClick={() => setVocab(null)} aria-label="닫기" className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--r-full)] text-[var(--t3)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)]"><X size={18} aria-hidden /></button>
            </div>
          </div>
        </div>
      )}

      {/* 오버레이 스타일 — 컨테이너 쿼리로 페이지 폭에 비례한 폰트(반응형). 원작 위 덮어쓰기 아님(HTML 레이어). */}
      <style jsx>{`
        .pd-page { container-type: inline-size; }
        .pd-lt { position: absolute; display: flex; align-items: center; justify-content: center; padding: 1% 1.3%; text-align: center; }
        .pd-text { display: block; width: 100%; line-height: 1.16; font-weight: 600; letter-spacing: 0.1px; color: #1a1a1a; font-size: 2.3cqw; }
        .pd-bal { background: rgba(255,255,255,0.97); border: 0.28cqw solid #2a2a2a; border-radius: 46% / 52%; box-shadow: 0 0.2cqw 0.5cqw rgba(0,0,0,0.18); }
        .pd-cap { background: #fbfaf7; border: 0.14cqw solid #cfc8bd; border-left: 0.55cqw solid #2e7d5a; border-radius: 0.7cqw; box-shadow: 0 0.14cqw 0.4cqw rgba(0,0,0,0.12); }
        .pd-cap .pd-text { text-align: left; font-weight: 500; }
        .pd-word { color: inherit; font: inherit; cursor: pointer; border-radius: 3px; padding: 0 0.5px; transition: background var(--dur-fast,120ms) var(--ease,ease); }
        .pd-word:hover, .pd-word:focus-visible { background: rgba(46,125,90,0.18); outline: none; }
        .pd-tts { position: absolute; top: -0.9cqw; right: -0.9cqw; display: grid; place-items: center; width: 3.2cqw; height: 3.2cqw; min-width: 22px; min-height: 22px; border-radius: 999px; background: #2e7d5a; color: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.25); opacity: 0.55; transition: opacity var(--dur-fast,120ms); }
        .pd-tts:hover, .pd-tts:focus-visible { opacity: 1; outline: none; }
      `}</style>
    </div>
  )
}
