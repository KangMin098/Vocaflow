// apps/web/src/components/library/browse/ArticleCard.tsx
//
// 스크립트(아티클) 카드 — /library/books 스크립트 탭.
// 아티클은 표지가 없는 짧은 단일 텍스트라, 도서 코버 대신 소스 액센트 + 메타 중심 카드.
// "학습하기" → startArticleLearning(서버 액션) → /text/[id] 워크스페이스.

'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  Library,
  Loader2,
  Newspaper,
  Scale,
  Target,
  Volume2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { startArticleLearning } from '@/lib/articles/start-learning'
import type { PublishedArticle } from '@/lib/articles/types'
import { judgeArticleIPlusOne } from '@/lib/library/i-plus-one'

const SOURCE_META: Record<string, { label: string; color: string }> = {
  voa: { label: 'VOA Learning', color: '#2563EB' },
  nasa: { label: 'NASA', color: '#7C3AED' },
  nih: { label: 'NIH', color: '#0E7490' },
  // v06.66 신규 + v06.69 arxiv 제거
  simple_wikipedia: { label: 'Simple Wikipedia', color: '#0F766E' },
  wikinews: { label: 'Wikinews', color: '#B45309' },
  the_conversation: { label: 'The Conversation', color: '#15803D' },
  // v06.180 신규 소스 — 미등록 시 회색 폴백이라 라벨·색 지정
  owid: { label: 'Our World in Data', color: '#0891B2' },
  factbook: { label: 'World Factbook', color: '#57534E' },
  elife: { label: 'eLife', color: '#BE185D' },
  // v06.198~199 신규 소스 (topic·reference 트랙)
  wikipedia: { label: 'Wikipedia', color: '#3730A3' },
  plos: { label: 'PLOS', color: '#0369A1' },
  wikivoyage: { label: 'Wikivoyage', color: '#0D9488' },
  usgs: { label: 'USGS', color: '#92400E' },
  noaa: { label: 'NOAA Climate', color: '#155E75' },
  rss: { label: 'RSS', color: '#D97706' },
}

// 배지는 흰 글씨(text-white) → 모든 배경이 대비 ≥4.5:1 필요.
// A1 이 파스텔 #86EFAC(≈1.4:1)라 저시력/색맹 판독 불가였음 → 대비 통과 녹색으로 교정(v06.210).
const CEFR_COLOR: Record<string, string> = {
  A1: '#15803D',
  A2: 'var(--ios-green)',
  B1: 'var(--p)',
  B2: '#1D4ED8',
  C1: '#7C3AED',
  C2: '#581C87',
}

// P4 — VOA 등급(Level 1-3) ↔ CEFR 1:1 매핑 (voa.ts VOA_LEVEL_TO_CEFR 역). VOA 소스만 병기.
const CEFR_TO_VOA_LEVEL: Record<string, number> = { A2: 1, B1: 2, B2: 3 }

// P4 — 글 유형(register) 배지: 아이콘+텍스트 (색만으로 정보 전달 금지 §10).
const REGISTER_META: Record<string, { label: string; Icon: LucideIcon }> = {
  narrative: { label: '서사', Icon: BookOpen },
  expository: { label: '설명', Icon: GraduationCap },
  argumentative: { label: '논증', Icon: Scale },
  news: { label: '뉴스', Icon: Newspaper },
  reference: { label: '참고', Icon: Library },
}

export function ArticleCard({
  article,
  userVLevel,
}: {
  article: PublishedArticle
  userVLevel: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const src = SOURCE_META[article.source] ?? { label: article.source, color: 'var(--t3)' }
  const cefr = article.cefr_level
  const cefrColor = cefr ? (CEFR_COLOR[cefr] ?? 'var(--t3)') : null
  const tags = (article.category_tags ?? []).slice(0, 3)

  // P4 — i+1 적합도(C4) · 음성 · VOA Level · 글 유형
  const fit = judgeArticleIPlusOne(article.article_v_level, userVLevel)
  const hasAudio = !!(article.audio_url && article.audio_url.trim())
  const voaLevel = article.source === 'voa' && cefr ? (CEFR_TO_VOA_LEVEL[cefr] ?? null) : null
  const registerMeta = article.register ? (REGISTER_META[article.register] ?? null) : null

  function handleLearn() {
    startTransition(async () => {
      const res = await startArticleLearning(article.id)
      if (res.ok) router.push(`/text/${res.textId}?mode=read`)
      else window.alert(res.error)
    })
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)]">
      {/* 소스 액센트 바 */}
      <div aria-hidden className="h-1" style={{ backgroundColor: src.color }} />

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {/* 소스 + CEFR */}
        <div className="flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-0.5 font-mono text-[10px] font-[700]"
            style={{ color: src.color, backgroundColor: `color-mix(in srgb, ${src.color} 12%, transparent)` }}
          >
            <FileText size={10} aria-hidden /> {src.label}
          </span>
          <span className="inline-flex items-center gap-1">
            {voaLevel != null && (
              <span
                className="inline-flex items-center rounded-[var(--r-sm)] border border-[var(--bd)] px-1.5 py-0.5 font-mono text-[10px] font-[700] text-[var(--t2)]"
                title={`VOA Level ${voaLevel}`}
              >
                Lv{voaLevel}
              </span>
            )}
            {cefr && (
              <span
                className="inline-flex items-center rounded-[var(--r-sm)] px-1.5 py-0.5 font-mono text-[10px] font-[700] text-white"
                style={{ backgroundColor: cefrColor ?? 'var(--t3)' }}
              >
                {cefr}
              </span>
            )}
          </span>
        </div>

        {/* 제목 (Lora) */}
        <h3 className="line-clamp-2 font-english text-[16px] font-[600] leading-[1.32] text-[var(--t1)]">
          {article.title}
        </h3>

        {article.author && (
          <p className="line-clamp-1 font-body text-[11.5px] text-[var(--t3)]">{article.author}</p>
        )}

        {/* i+1 적합도 + 글 유형 */}
        {(fit || registerMeta) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {fit && (
              <span
                title={`글 V${article.article_v_level} · 내 V${fit.effectiveUserVLevel}${userVLevel ? '' : ' (기준)'}`}
                className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-0.5 font-display text-[10px] font-[700]"
                style={{
                  color: fit.color,
                  backgroundColor: `color-mix(in srgb, ${fit.color} 14%, transparent)`,
                }}
              >
                <Target size={10} aria-hidden /> {fit.label}
              </span>
            )}
            {registerMeta && (
              <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-mono text-[10px] text-[var(--t2)]">
                <registerMeta.Icon size={10} aria-hidden /> {registerMeta.label}
              </span>
            )}
          </div>
        )}

        {/* 메타 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-[var(--t3)]">
          {article.word_count != null && (
            <span className="tabular-nums">{article.word_count.toLocaleString()} 단어</span>
          )}
          {article.reading_minutes != null && (
            <span className="inline-flex items-center gap-1">
              <Clock size={10} aria-hidden /> {article.reading_minutes}분
            </span>
          )}
          {hasAudio && (
            <span className="inline-flex items-center gap-1" title="원어민 음성 포함">
              <Volume2 size={10} aria-hidden /> 음성
            </span>
          )}
        </div>

        {/* 카테고리 태그 */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-mono text-[9px] text-[var(--t2)]"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* 액션 */}
        <div className="mt-auto flex items-center gap-2 pt-1.5">
          <button
            type="button"
            onClick={handleLearn}
            disabled={pending}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[var(--r-md)] bg-[var(--p)] px-3 py-2 font-display text-[12.5px] font-[600] text-[var(--ti)] transition-colors hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 size={13} className="animate-spin" aria-hidden />
            ) : (
              <>
                학습하기
                <ArrowRight size={13} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
          {article.source_url && (
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="원문 보기"
              aria-label="원문 보기"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] border border-[var(--bd)] text-[var(--t3)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
            >
              <ExternalLink size={13} aria-hidden />
            </a>
          )}
        </div>
      </div>
    </article>
  )
}
