// apps/web/src/components/library/story/StoryCatalog.tsx
//
// LCP Story 서가(`/library/stories`) — 작품(workKey)별로 묶고, 작품마다 진입 장면(HOOK)을 시작 행동보다 먼저 보인다.
// 그 아래 판본을 편집 목표(판본 종류 + 목표 CEFR · 실측 진단 아님)별로 나눈다. 계약: docs/LCP_STORY.md §2 · §12 · §17.
// - 수는 받은 행 그대로(작품 = 서로 다른 workKey · 판본 = 발행본). 빈 서가 · 조회 실패를 구분한다.
// - 로그인 전: 메타 + HOOK 만, 시작은 로그인으로. 로그인 후: 발행본마다 내 위치 · 완료 표시(완료는 모든 단위 명시 표시 뒤에만).
// - 열 수 없는 판본의 기록은 기록으로만 보인다(링크 · 본문 없음).
// - 판본마다 시작 전 선택 안내(편집 판단 부담 · 접힌 주의 — U1)를 로그인과 무관하게 보인다. 불러오지 못하면 그렇다고 말한다.
// - 서가를 실제로 받은 뒤 `story_catalog_viewed` 를 한 번만 보낸다(실패 때는 보내지 않는다).
// - 브라우저 인증이 서버가 그린 사람(viewerId)과 달라지면 개인 진도를 지우고 다시 불러오기를 권한다.

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { ShelfEmptyState } from '@/components/library/shared/ShelfEmptyState'
import { track } from '@/lib/analytics/client'
import type { PublicEvent } from '@/lib/analytics/events'
import type { StoryCatalogPageState, StoryGuidanceState, StoryProgressRow } from '@/lib/library/story/learner-types'

import { StoryGuidance } from './StoryGuidance'
import styles from './story.module.css'
import {
  COVERAGE_LABEL,
  KIND_LABEL,
  catalogViewedEvent,
  completionWording,
  countWorksAndEditions,
  editorialTargetLabel,
  groupCatalogByWork,
  guidanceViewFor,
  positionWording,
  readerHref,
  rowCounts,
  type CatalogEditionEntry,
  type CatalogWorkGroup,
} from './story-view'
import { useStoryAuthGuard, type StoryAuthSource } from './use-story-auth-guard'

export interface StoryCatalogProps {
  state: StoryCatalogPageState
  loginHref: string
  /** 계측 주입(기본 track). */
  onEvent?: (e: PublicEvent) => void
  /** 다시 시도(기본 router.refresh). */
  onRetry?: () => void
  /** 인증 구독 원천 주입(기본 브라우저 Supabase 세션). */
  authSource?: StoryAuthSource
  /** 인증이 바뀐 뒤 「다시 불러오기」 버튼(기본 전체 새로 고침). */
  onReload?: () => void
  /** 인증이 바뀌면 서버 상태 다시 받기(기본 router.refresh). */
  onRefresh?: () => void
}

export function StoryCatalog({ state, loginHref, onEvent, onRetry, authSource, onReload, onRefresh }: StoryCatalogProps) {
  const router = useRouter()
  const emit = onEvent ?? track
  const retry = onRetry ?? (() => router.refresh())
  const reload = onReload ?? (() => window.location.reload())
  const refresh = onRefresh ?? (() => router.refresh())
  const { guard, status: authStatus } = useStoryAuthGuard(state.status === 'ready' ? state.viewerId : null, authSource)

  // 인증이 바뀌면(경계마다 한 번) 서버가 지금 쿠키로 다시 그리게 한다.
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  const refreshedFor = useRef<typeof guard | null>(null)
  useEffect(() => {
    if (authStatus === 'changed' && refreshedFor.current !== guard) {
      refreshedFor.current = guard
      refreshRef.current()
    }
  }, [authStatus, guard])

  const sent = useRef(false)
  const emitRef = useRef(emit)
  emitRef.current = emit
  const viewed = catalogViewedEvent(state)
  useEffect(() => {
    if (sent.current || !viewed) return
    sent.current = true
    emitRef.current(viewed)
  }, [viewed])

  if (state.status === 'error') {
    return (
      <div className={styles.page} data-story-catalog="error">
        <CatalogHead />
        <ShelfEmptyState
          tone="error"
          title="이야기 서가를 불러오지 못했어요"
          body={state.failure.message || '잠시 뒤 다시 시도해 주세요.'}
          onAction={retry}
          actionLabel="다시 시도"
        />
      </div>
    )
  }

  const authChanged = authStatus === 'changed'
  // 개인 진도 · 기록은 브라우저 사용자 = 서버 viewerId 가 긍정 확인(same)된 뒤에만 그린다(표시 보호 — 받은 바이트 회수는 아님).
  const personal = state.signedIn && authStatus === 'same'
  const checking = state.signedIn && authStatus === 'checking'
  const signedIn = state.signedIn && !authChanged
  const progress = personal ? state.progress : null
  const { works, editions } = countWorksAndEditions(state.releases)
  const grouping = groupCatalogByWork(state.releases, progress)

  return (
    <div className={styles.page} data-story-catalog="ready">
      <CatalogHead counts={state.releases.length > 0 ? { works, editions } : null} />

      {authChanged ? (
        <div className={styles.notice} role="status" data-story-auth="changed">
          <p className={styles.statusText}>로그인 상태가 바뀌었어요 — 내 진도를 지웠어요.</p>
          <button type="button" className={styles.ctaSecondary} onClick={reload}>
            다시 불러오기
          </button>
        </div>
      ) : null}

      {checking ? (
        <div className={styles.notice} role="status" aria-live="polite" data-story-identity="checking">
          <p className={styles.statusText}>로그인 상태를 확인하고 있어요 — 확인되면 내 진도가 보여요.</p>
        </div>
      ) : null}

      {personal && state.progressError ? (
        <div className={`${styles.notice} ${styles.noticeError}`} role="status" data-story-progress="error">
          <p className={styles.statusText}>
            내 진도를 불러오지 못했어요. 서가는 그대로 볼 수 있어요.
            {state.progressError.message ? <span className={styles.statusDetail}>{state.progressError.message}</span> : null}
          </p>
          <button type="button" className={styles.ctaSecondary} onClick={retry}>
            다시 시도
          </button>
        </div>
      ) : null}

      {state.releases.length === 0 ? (
        <ShelfEmptyState
          tone="empty"
          title="아직 공개된 이야기가 없어요"
          body="이야기 판본이 발행되면 이곳에 작품별로 보여요. 지금은 Books 서가에서 도서를 고를 수 있어요."
          ctaHref="/library/books"
          ctaLabel="Books 보기"
        />
      ) : (
        <ul className={styles.works} aria-label="작품">
          {grouping.works.map((work) => (
            <WorkRow
              key={work.workKey}
              work={work}
              signedIn={signedIn}
              authChanged={authChanged}
              loginHref={loginHref}
              guidance={state.guidance}
            />
          ))}
        </ul>
      )}

      {grouping.orphanHistory.length > 0 ? (
        <section className={styles.history} aria-labelledby="story-orphan-history" data-story-history="orphan">
          <h2 id="story-orphan-history" className={styles.asideTitle}>
            지금은 열 수 없는 판본의 기록
          </h2>
          <ul>
            {grouping.orphanHistory.map((row) => (
              <li key={row.releaseKey}>{historyLine(row)}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function CatalogHead({ counts }: { counts?: { works: number; editions: number } | null }) {
  return (
    <header className={styles.head}>
      <h1 className={styles.title}>Stories</h1>
      <p className={styles.lede}>작품의 첫 장면을 먼저 읽고, 편집 목표가 맞는 판본을 고르세요.</p>
      {counts ? (
        <p className={`${styles.meta} ${styles.metaStrong}`} data-story-counts>
          {`작품 ${counts.works}편 · 판본 ${counts.editions}개`}
        </p>
      ) : null}
    </header>
  )
}

function WorkRow({
  work,
  signedIn,
  authChanged,
  loginHref,
  guidance,
}: {
  work: CatalogWorkGroup
  signedIn: boolean
  authChanged: boolean
  loginHref: string
  guidance: StoryGuidanceState
}) {
  const headingId = `story-work-${work.workKey}`
  return (
    <li className={styles.work} data-story-work>
      <div>
        <h2 id={headingId} className={styles.workTitle} lang="en">
          {work.title}
        </h2>
        <blockquote className={styles.hook} lang="en" aria-label="진입 장면" data-story-hook>
          {work.hookText}
        </blockquote>
      </div>
      <div className={styles.editions}>
        {work.editions.map((group) => (
          <section key={`${group.kind}:${group.targetCefr ?? ''}`} className={styles.editionGroup} data-story-edition-group>
            <h3 className={styles.groupHead}>
              <span>{KIND_LABEL[group.kind].name}</span>
              <span className={styles.groupTarget}>{editorialTargetLabel(group.targetCefr)}</span>
            </h3>
            <ul className={styles.editionList}>
              {group.entries.map((entry) => (
                <EditionRow
                  key={entry.release.releaseKey}
                  entry={entry}
                  workTitle={work.title}
                  signedIn={signedIn}
                  authChanged={authChanged}
                  loginHref={loginHref}
                  guidance={guidance}
                />
              ))}
            </ul>
          </section>
        ))}
        {work.history.length > 0 ? (
          <div className={styles.history} data-story-history="work">
            이전에 읽던 판본 중 지금은 열 수 없는 것이 있어요(기록만 남아 있어요).
            <ul>
              {work.history.map((row) => (
                <li key={row.releaseKey}>{historyLine(row)}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </li>
  )
}

function EditionRow({
  entry,
  workTitle,
  signedIn,
  authChanged,
  loginHref,
  guidance,
}: {
  entry: CatalogEditionEntry
  workTitle: string
  signedIn: boolean
  authChanged: boolean
  loginHref: string
  guidance: StoryGuidanceState
}) {
  const { release, progress } = entry
  const kind = KIND_LABEL[release.kind]
  const wording = progress ? completionWording(rowCounts(progress), release.completionLabel, release.coverage) : null
  const href = signedIn || authChanged ? readerHref(release.releaseKey, null) : loginHref
  const label = !signedIn && !authChanged ? '로그인하고 읽기' : progress ? (wording?.done ? '다시 보기' : '이어 읽기') : '판본 열기'
  return (
    <li className={styles.edition} data-story-release>
      <div className={styles.editionInfo}>
        {release.title !== workTitle ? (
          <span className={styles.editionName} lang="en">
            {release.title}
          </span>
        ) : null}
        <span>
          {COVERAGE_LABEL[release.coverage]} · {release.unitCount}단위
        </span>
        <span>{kind.gist}</span>
        <StoryGuidance view={guidanceViewFor(guidance, release.releaseKey)} />
        {progress && wording ? (
          <span className={styles.progressLine} data-story-progress-line>
            {positionWording(progress.lastUnitIndex, progress.unitCount)} ·{' '}
            <span className={wording.done ? styles.doneMark : undefined}>{wording.text}</span>
          </span>
        ) : null}
      </div>
      <Link
        href={href}
        className={signedIn && progress ? styles.cta : styles.ctaSecondary}
        aria-label={`${release.title} ${kind.name} — ${label}`}
        data-story-open={!signedIn && !authChanged ? 'login' : 'reader'}
      >
        {label}
      </Link>
    </li>
  )
}

function historyLine(row: StoryProgressRow): string {
  const wording = completionWording(rowCounts(row), row.completionLabel, row.countsAsWorkCompletion ? 'complete_work' : 'excerpt')
  return `열 수 없는 판본 · ${wording?.text ?? `완료 표시 0/${row.unitCount}`}`
}
