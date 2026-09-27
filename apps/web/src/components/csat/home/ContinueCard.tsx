// apps/web/src/components/csat/home/ContinueCard.tsx
'use client'

//
// **홈 띠 위 카드 — 방문 상태마다 다른 한 장.** (ia-design §2-1 ~ §2-3)
//
//   첫 방문   「처음이라면」 — 방법 세 줄 + 3문항 시작 한 버튼(S1 · S3 · S5)
//   재방문    「이어서」 — 멈춘 세트와 남은 분, 오늘 복습(S10: 시작 비용을 낮춘다)
//   공백 복귀 「다시 오셨네요」 — 밀린 복습은 오늘 3개만(S9: 계획이 무너져도 통째로 포기하지 않게)
//
// 모든 버튼은 **클릭 한 번**으로 학습이 시작되는 곳을 연다(시나리오 C1–C4 목표 = 1).
// 죄책감 문구 · 연속 끊김 표시는 쓰지 않는다(Empathetic Feedback).

import Link from 'next/link'
import { ArrowRight, History, Play, Sparkles } from 'lucide-react'

import { track } from '@/lib/analytics/client'
import { REVIEW_CAP, activeSet, dueNow, lastActivity, visitState } from '@/lib/csat/continuity'

import type { CsatRecordState } from './useCsatRecord'
import styles from './home.module.css'

const dateLabel = (t: number) => new Date(t).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })

export function ContinueCard({ state, from = 'home' }: { state: CsatRecordState | null; from?: 'home' | 'record' }) {
  if (!state) {
    return (
      <div className={styles.card} aria-busy="true" data-testid="continue-card" data-state="loading">
        <p className={styles.cardBack}>
          <History size={13} aria-hidden="true" /> 기록을 확인하고 있어요…
        </p>
        <div className={styles.cardFront} />
      </div>
    )
  }
  const { record, now, dueBefore } = state
  const kind = visitState(record, now)
  const set = activeSet(record)
  const due = dueNow(record, now).length
  const click = (k: 'set' | 'review' | 'comeback' | 'start') => () => track({ name: 'csat_resume_clicked', props: { kind: k, from } })

  if (kind === 'first') {
    return (
      <div className={styles.card} data-testid="continue-card" data-state="first">
        <p className={styles.cardBack}>
          <Sparkles size={13} aria-hidden="true" /> 처음이라면
        </p>
        <div className={styles.cardFront}>
          <p className={styles.cardLead}>
            기출분석은 <b>정답</b>이 아니라 <b>설계</b>를 읽는 일이에요.
          </p>
          <ol className={styles.method}>
            <li>근거가 어디 있을지 먼저 예측</li>
            <li>해설과 대조</li>
            <li>다른 문항에서 같은 설계 찾기</li>
          </ol>
          <div className={styles.cardActions}>
            <Link className={styles.primary} href="/csat/dissect" onClick={click('start')} data-testid="continue-start">
              <Play size={14} aria-hidden="true" /> 3문항으로 시작 · 약 12분
            </Link>
            <Link className={styles.quietLink} href="/wordvault">
              기초 단어가 먼저라면 <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (kind === 'comeback') {
    const last = lastActivity(record)
    return (
      <div className={styles.card} data-testid="continue-card" data-state="comeback">
        <p className={styles.cardBack}>
          <History size={13} aria-hidden="true" /> 다시 오셨네요
        </p>
        <div className={styles.cardFront}>
          <p className={styles.cardLead}>
            지난번 학습은 <b>{dateLabel(last)}</b>
            {set ? (
              <>
                {' '}
                · 세트 {set.index}/{set.total}에서 멈췄어요
              </>
            ) : null}
            .
          </p>
          <p className={styles.cardSub} data-testid="comeback-due">
            {dueBefore > REVIEW_CAP
              ? `밀린 복습 ${dueBefore}개 중 오늘은 ${due}개만 골랐어요. 나머지는 하루 ${REVIEW_CAP}개씩 뒤로 옮겼어요.`
              : due > 0
                ? `오늘 복습 ${due}개가 기다려요.`
                : '오늘은 새 3문항으로 가볍게 다시 시작해요.'}
          </p>
          <div className={styles.cardActions}>
            <Link className={styles.primary} href="/csat/dissect" onClick={click('comeback')} data-testid="continue-comeback">
              <Play size={14} aria-hidden="true" /> {due > 0 ? `복습 포함 3문항 · 약 12분` : '3문항만 하기 · 약 12분'}
            </Link>
            {set ? (
              <Link className={styles.secondary} href="/csat/dissect?resume=1" onClick={click('set')}>
                멈춘 세트 이어서
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.card} data-testid="continue-card" data-state="return">
      <p className={styles.cardBack}>
        <History size={13} aria-hidden="true" /> 이어서
      </p>
      <div className={styles.cardFront}>
        {set ? (
          <p className={styles.cardLead}>
            <b>
              세트 {set.index + 1}/{set.total}
            </b>{' '}
            · 약 {set.minutes}분 남았어요
          </p>
        ) : (
          <p className={styles.cardLead}>오늘의 해부 3문항이 준비돼 있어요.</p>
        )}
        <p className={styles.cardSub}>{due > 0 ? `오늘 복습 ${due}개 — 같은 설계를 가진 다른 문항으로 물어요.` : '오늘 복습은 없어요.'}</p>
        <div className={styles.cardActions}>
          {set ? (
            <Link className={styles.primary} href="/csat/dissect?resume=1" onClick={click('set')} data-testid="continue-resume">
              <Play size={14} aria-hidden="true" /> 이어서 하기
            </Link>
          ) : (
            <Link className={styles.primary} href="/csat/dissect" onClick={click(due > 0 ? 'review' : 'start')} data-testid="continue-next">
              <Play size={14} aria-hidden="true" /> {due > 0 ? `복습 포함 3문항` : '3문항 시작'} · 약 12분
            </Link>
          )}
          {set && due > 0 ? (
            <Link className={styles.secondary} href="/csat/dissect" onClick={click('review')} data-testid="continue-review">
              복습 {due}개
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
