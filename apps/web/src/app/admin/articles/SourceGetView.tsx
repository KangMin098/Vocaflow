// apps/web/src/app/admin/articles/SourceGetView.tsx
// ACP §18 — 소스 전용 GET 화면 (소스별 탭의 패널).
//
// 각 소스를 "전용 화면" 으로 보여준다: 정보·특성·학습자에게 제공하는 것 → 정책 →
// 프로필(무엇을·어떤 글·문체·feeds) → 후보 테이블 → 라이브 RSS.
// 단일 컴포넌트 source-param — 하드코딩 6화면이 아니라 SourcePolicy + source-guide 로 구동.

'use client'

import { BarChart3, BookOpen, FlaskConical, Globe, Library, Megaphone, Microscope, Newspaper, Rocket, Volume2, VolumeX } from 'lucide-react'

import type { SourceFeedHealth } from '@/lib/articles/types'
import type { SourceKey, LearnerLevel } from '@vocaflow/library-pipeline/curation-spec'
import {
  useSourcePolicy,
  SUPPLY_LABEL,
  MEDIA_LABEL,
  DERIVATION_LABEL,
  ATTRIBUTION_LABEL,
} from '@/lib/articles/use-source-policy'
import { getSourceGuide, REGISTER_LABEL, SOURCE_LABEL } from '@/lib/articles/source-guide'
import { CandidateTable } from './CandidateTable'
import { SourceProfile } from './SourceProfile'
import { VoaFeedTab } from './VoaFeedTab'
import { RssFeedTab } from './RssFeedTab'

const NASA_FEEDS = [
  { id: 'news', label: 'News Releases' },
  { id: 'apod', label: 'Astronomy Picture of the Day' },
  { id: 'iotd', label: 'Image of the Day' },
]
const NIH_FEEDS = [
  { id: 'medlineplus', label: "MedlinePlus What's New (안정)" },
  { id: 'directors-blog', label: "Director's Blog" },
  { id: 'news', label: 'NIH News Releases (현재 차단 · URL 직접 입력)' },
]

export function SourceGetView({
  source,
  level,
  feedHealth,
  onEnqueued,
}: {
  source: SourceKey
  level: LearnerLevel
  feedHealth: SourceFeedHealth[]
  onEnqueued: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <SourceHeader source={source} />
      <SourceProfile source={source} level={level} feedHealth={feedHealth} />
      <CandidateTable source={source} onImported={onEnqueued} />
      <details className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]">
        <summary className="cursor-pointer px-3 py-2 font-display text-[12px] font-[600] text-[var(--t2)] marker:text-[var(--t4)]">
          라이브 RSS 직접 수집 (후보 풀에 추가)
        </summary>
        <div className="border-t border-[var(--bd)] p-3">
          <SourceGetBody source={source} onEnqueued={onEnqueued} />
        </div>
      </details>
    </div>
  )
}

// ── 소스 헤더 — 정체성 + 학습자에게 제공하는 것 + 정책 ──

function SourceHeader({ source }: { source: SourceKey }) {
  const policy = useSourcePolicy(source)
  const g = getSourceGuide(source)

  // "학습자에게 제공" 한 줄 — register · CEFR · 음성 · 단어세트 합성.
  const offering =
    `${g.registers.map((r) => REGISTER_LABEL[r] ?? r).join('·')} 글 · CEFR ${g.cefr.min}–${g.cefr.max}` +
    (policy.media === 'audio' ? ' · 원어민 음성 듣기' : ' · 읽기 중심') +
    (policy.derivation === 'display_only' ? ' · 본문 읽기 전용(ND)' : ' · 단어세트 학습 가능')

  return (
    <header className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
      <h2 className="font-display text-[18px] font-[700] text-[var(--t1)]">{SOURCE_LABEL[source] ?? source}</h2>
      <p className="font-body text-[12px] text-[var(--t2)]">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">학습자에게 </span>
        {offering}
      </p>
      <PolicyRow source={source} />
    </header>
  )
}

// ── 정책 행 (supply/media/derivation/attribution) ──

type ChipTone = 'neutral' | 'info' | 'known' | 'review'
const CHIP_COLORS: Record<ChipTone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--bg)', fg: 'var(--t2)' },
  info: { bg: 'var(--learn-fresh-light)', fg: 'var(--learn-fresh)' },
  known: { bg: 'var(--learn-known-light)', fg: 'var(--learn-known)' },
  review: { bg: 'var(--learn-review-light)', fg: 'var(--learn-review)' },
}

function PolicyRow({ source }: { source: string }) {
  const policy = useSourcePolicy(source)
  const MediaIcon = policy.media === 'audio' ? Volume2 : VolumeX
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--r-sm)] bg-[var(--bg2)] px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">정책</span>
      <PolicyChip
        label={`score · ${SUPPLY_LABEL[policy.supply]}`}
        tone={policy.supply === 'static' ? 'info' : 'neutral'}
      />
      <PolicyChip
        label={`진입 · ${MEDIA_LABEL[policy.media]}`}
        tone={policy.media === 'audio' ? 'known' : 'neutral'}
        Icon={MediaIcon}
      />
      <PolicyChip
        label={`단어세트 · ${DERIVATION_LABEL[policy.derivation]}`}
        tone={policy.derivation === 'display_only' ? 'review' : 'known'}
      />
      <PolicyChip
        label={`출처 · ${ATTRIBUTION_LABEL[policy.attribution]}`}
        tone={policy.attribution === 'required' ? 'review' : 'neutral'}
      />
      <span className="ml-auto font-mono text-[10px] text-[var(--t5)]">{policy.license}</span>
    </div>
  )
}

function PolicyChip({ label, tone, Icon }: { label: string; tone: ChipTone; Icon?: typeof Volume2 }) {
  const c = CHIP_COLORS[tone]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[var(--r-full)] border border-[var(--bd)] px-2.5 py-1 font-mono text-[10px] font-[600]"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {Icon && <Icon size={11} aria-hidden />}
      {label}
    </span>
  )
}

// ── 라이브 RSS 직접 수집 (소스별 feed) ──

function SourceGetBody({ source, onEnqueued }: { source: SourceKey; onEnqueued: () => void }) {
  switch (source) {
    case 'voa':
      return <VoaFeedTab onEnqueued={onEnqueued} />
    case 'nasa':
      return (
        <RssFeedTab
          source="nasa"
          heading="🚀 NASA"
          subtitle="U.S. federal government · Public Domain"
          feeds={NASA_FEEDS}
          emptyIcon={Rocket}
          urlPattern={/^https:\/\/(?:(?:www|apod)\.)?nasa\.gov\//}
          urlHostHint="nasa.gov / apod.nasa.gov 도메인"
          urlPlaceholder="https://www.nasa.gov/news-release/...  또는  https://apod.nasa.gov/apod/ap240519.html"
          onEnqueued={onEnqueued}
        />
      )
    case 'nih':
      return (
        <RssFeedTab
          source="nih"
          heading="🩺 NIH"
          subtitle="National Institutes of Health · Public Domain"
          feeds={NIH_FEEDS}
          emptyIcon={FlaskConical}
          urlPattern={/^https:\/\/(?:(?:www|directorsblog)\.)?nih\.gov\/|^https:\/\/medlineplus\.gov\//}
          urlHostHint="nih.gov / medlineplus.gov 도메인"
          urlPlaceholder="https://www.nih.gov/news-events/news-releases/..."
          onEnqueued={onEnqueued}
        />
      )
    case 'simple_wikipedia':
      return (
        <RssFeedTab
          source="simple_wikipedia"
          heading="📘 Simple English Wikipedia"
          subtitle="CC-BY-SA · A2~B1 설명문 (전 주제) · URL 직접 입력"
          feeds={[]}
          emptyIcon={BookOpen}
          urlPattern={/^https?:\/\/simple\.wikipedia\.org\/wiki\//}
          urlHostHint="simple.wikipedia.org/wiki/ 도메인"
          urlPlaceholder="https://simple.wikipedia.org/wiki/Photosynthesis"
          onEnqueued={onEnqueued}
        />
      )
    case 'the_conversation':
      return (
        <RssFeedTab
          source="the_conversation"
          heading="📣 The Conversation"
          subtitle="CC-BY-ND · B2~C1 논증문 (CSAT 유형) · 본문 불변(display_only)"
          feeds={[]}
          emptyIcon={Megaphone}
          urlPattern={/^https?:\/\/theconversation\.com\//}
          urlHostHint="theconversation.com 도메인"
          urlPlaceholder="https://theconversation.com/..."
          onEnqueued={onEnqueued}
        />
      )
    case 'wikinews':
      return (
        <RssFeedTab
          source="wikinews"
          heading="🗞 Wikinews"
          subtitle="CC-BY 2.5 · A2~B2 시사 · URL 직접 입력"
          feeds={[]}
          emptyIcon={Newspaper}
          urlPattern={/^https?:\/\/en\.wikinews\.org\/wiki\//}
          urlHostHint="en.wikinews.org/wiki/ 도메인"
          urlPlaceholder="https://en.wikinews.org/wiki/..."
          onEnqueued={onEnqueued}
        />
      )
    case 'owid':
      return (
        <RssFeedTab
          source="owid"
          heading="📊 Our World in Data"
          subtitle="CC-BY 4.0 · B2~C1 데이터 논증문 (CSAT 유형) · 발행 허용"
          feeds={[]}
          emptyIcon={BarChart3}
          urlPattern={/^https?:\/\/ourworldindata\.org\//}
          urlHostHint="ourworldindata.org 도메인"
          urlPlaceholder="https://ourworldindata.org/..."
          onEnqueued={onEnqueued}
        />
      )
    case 'factbook':
      return (
        <RssFeedTab
          source="factbook"
          heading="🌍 CIA World Factbook"
          subtitle="Public Domain · B1~B2 국가 개요 참고문 (reference) · 발행 허용"
          feeds={[]}
          emptyIcon={Globe}
          urlPattern={/^https:\/\/raw\.githubusercontent\.com\/factbook\/factbook\.json\//}
          urlHostHint="raw.githubusercontent.com/factbook/factbook.json 국가 JSON"
          urlPlaceholder="https://raw.githubusercontent.com/factbook/factbook.json/master/east-n-southeast-asia/ks.json"
          onEnqueued={onEnqueued}
        />
      )
    case 'elife':
      return (
        <RssFeedTab
          source="elife"
          heading="🔬 eLife"
          subtitle="CC-BY 4.0 · B2~C1 과학 digest (편집자 저작 요약) · 발행 허용"
          feeds={[]}
          emptyIcon={Microscope}
          urlPattern={/^https?:\/\/(?:www\.)?elifesciences\.org\/articles\/\d+/}
          urlHostHint="elifesciences.org/articles/<번호> (digest 보유 기사)"
          urlPlaceholder="https://elifesciences.org/articles/91060"
          onEnqueued={onEnqueued}
        />
      )
    case 'wikipedia':
      return (
        <RssFeedTab
          source="wikipedia"
          heading="📚 English Wikipedia (정규)"
          subtitle="CC-BY-SA · B2~C1 정규 백과 (FA/GA 검수분) · 발행 허용"
          feeds={[]}
          emptyIcon={Library}
          urlPattern={/^https?:\/\/en\.wikipedia\.org\/wiki\//}
          urlHostHint="en.wikipedia.org/wiki/ 도메인"
          urlPlaceholder="https://en.wikipedia.org/wiki/Photosynthesis"
          onEnqueued={onEnqueued}
        />
      )
  }
}
