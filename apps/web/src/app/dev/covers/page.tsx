// apps/web/src/app/dev/covers/page.tsx
//
// 표지 비교판 — 기사 표지(`ArticleCover`, 가로 4:3) vs 도서 표지(`GradientBookCover`, 세로 3:4).
//
// 왜 이 화면이 필요한가: 표지는 **실제 슬롯 안에서 나란히 놓고 봐야** 판단이 선다.
//   학습자 화면에서 확인하려면 그 계정에 해당 자료가 담겨 있어야 하는데, 검증 계정에
//   스크립트가 없으면 스펙이 "책 표지 마커 0개" 로 **헛통과**한다(실제로 그렇게 통과했다).
//   여기서는 데이터 없이도 모든 출처·길이 조합을 한 번에 본다.
//
// 비율 근거(2026-08-17 레퍼런스 실측): Economist 카드 16:9 / New Yorker 4:3 /
//   Monocle 4:3(CSS 토큰 강제) / 롱블랙·뉴닉·폴인 4:3. 세로는 **잡지 호(號) 커버 전용**이다.

'use client'

import { ArticleCover } from '@/components/library/shared/ArticleCover'
import { GradientBookCover } from '@/components/library/shared/GradientBookCover'
import { SOURCE_META } from '@/lib/articles/source-meta'

/** 실제 발행 기사에서 뽑은 제목 — 길이 분포를 그대로 재현한다(짧은 것·긴 것·아주 긴 것). */
const SAMPLES: Array<{ title: string; source: string; level: string }> = [
  { title: 'Webb Finds Planet-Forming Disks Lived Longer in Early Universe', source: 'nasa', level: 'C1' },
  { title: 'Why do cats purr?', source: 'the_conversation', level: 'B2' },
  { title: 'Words and Their Stories: Bite the Bullet', source: 'voa', level: 'B1' },
  { title: 'Photosynthesis', source: 'simple_wikipedia', level: 'B1' },
  { title: 'How rising sea temperatures are reshaping coral reef ecosystems across the Pacific', source: 'noaa', level: 'C1' },
  { title: 'Earthquakes', source: 'usgs', level: 'B2' },
]

/** 캐러셀 실제 크기(344×258)와 같은 가로 슬롯 */
function Wide({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative aspect-[4/3] w-[344px] overflow-hidden rounded-[3px] shadow-[0_2px_4px_rgba(12,14,20,0.14),0_18px_38px_-12px_rgba(12,14,20,0.34)]">
        {children}
      </div>
      <p className="font-mono text-[10px] text-[var(--t3)]">{label}</p>
    </div>
  )
}

export default function CoversDevPage() {
  return (
    <main className="min-h-screen bg-[var(--bg2)] px-6 py-10">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-10">
        <header className="flex flex-col gap-2">
          <h1 className="font-editorial text-[32px] font-[600] text-[var(--t1)]">표지 비교판</h1>
          <p className="font-body text-[14px] text-[var(--t2)]">
            기사는 <strong>가로 4:3 · 신문 네임플레이트</strong>, 도서는{' '}
            <strong>세로 3:4 · 클로스바운드</strong>. 편집 관습에서 세로는 &ldquo;이번 호&rdquo;를,
            가로는 &ldquo;기사&rdquo;를 뜻한다.
          </p>
        </header>

        {/* ── 기사 표지 — 출처별 ───────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-[13px] font-[700] uppercase tracking-[0.1em] text-[var(--t2)]">
            ArticleCover — 출처별 (캐러셀 실제 크기 344×258)
          </h2>
          <div className="flex flex-wrap gap-5">
            {SAMPLES.map((s) => (
              <Wide key={s.source} label={`${s.source} · ${s.level}`}>
                <ArticleCover title={s.title} source={s.source} level={s.level} />
              </Wide>
            ))}
          </div>
        </section>

        {/* ── 같은 글을 두 표지로 — 메타포 대비 ─────────────────── */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-[13px] font-[700] uppercase tracking-[0.1em] text-[var(--t2)]">
            기사 vs 책 — 나란히 두었을 때 구분되는가
          </h2>
          <div className="flex flex-wrap items-end gap-6">
            {SAMPLES.slice(0, 3).map((s) => (
              <div key={s.source} className="flex items-end gap-4">
                <Wide label="기사 — 가로 4:3 평면">
                  <ArticleCover title={s.title} source={s.source} level={s.level} />
                </Wide>
                <div className="flex flex-col gap-1.5">
                  <div className="book-cover-premium relative aspect-[3/4] w-[194px] overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#A78BFA] to-[#6D28D9]" />
                    <GradientBookCover title={s.title} author="Unknown" />
                    <div aria-hidden className="book-spine3d" />
                    <div aria-hidden className="book-foreedge" />
                  </div>
                  <p className="font-mono text-[10px] text-[var(--t3)]">책 — 세로 3:4 입체</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── compact — 그리드 타일 ─────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-[13px] font-[700] uppercase tracking-[0.1em] text-[var(--t2)]">
            compact (그리드 타일 · 4:3)
          </h2>
          <div className="flex flex-wrap gap-3">
            {SAMPLES.map((s) => (
              <div
                key={s.source}
                className="relative aspect-[4/3] w-[186px] overflow-hidden rounded-[2px] shadow-[0_1px_2px_rgba(12,14,20,0.10),0_8px_18px_-8px_rgba(12,14,20,0.22)]"
              >
                <ArticleCover title={s.title} source={s.source} level={s.level} compact />
              </div>
            ))}
          </div>
        </section>

        {/* ── 등록된 모든 출처 ─────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-[13px] font-[700] uppercase tracking-[0.1em] text-[var(--t2)]">
            전 출처 ({Object.keys(SOURCE_META).length}종) — 색으로 출처를 익힐 수 있는가
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {Object.keys(SOURCE_META).map((k) => (
              <div
                key={k}
                className="relative aspect-[4/3] w-[164px] overflow-hidden rounded-[2px]"
              >
                <ArticleCover
                  title="Sample headline for this source"
                  source={k}
                  level="B2"
                  compact
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
