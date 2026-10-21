// apps/web/src/components/csat/diagnosis/map/EvidenceClaims.tsx
//
// 증거 범위(evidenceView) 표시 — 팝업 · 상세 서랍 · Workspace 창이 같은 값을 같은 문구로 보여 준다.
// 판정하지 않는다: 네 값(지금 확인 · 교수 경로 · 다른 글 적용 · 지연 확인)을 따로 두고 하나의 숙달률로 합치지 않는다.
// 근거가 없거나 보류인 것은 실패로 말하지 않는다.

import type { AttemptEvidence, EvidenceView } from '@/lib/csat/map/v62/evidence-claims'
import { CURRENT_CHECK_LABEL } from '@/lib/csat/map/v62/evidence-claims'

import u from './unified.module.css'

const TRANSFER_LABEL: Record<EvidenceView['newPassageTransfer']['status'], string> = {
  none: '아직 없어요',
  experienced: '해 봤어요',
  no_content: '적용할 글을 준비 중이에요',
  unknown: '기록을 읽지 못했어요',
}
const REPAIR_LABEL: Record<EvidenceView['instructionPath']['repair'], string> = { unknown: '기록을 읽지 못했어요', none: '아직 없어요', tried: '해 봤어요', succeeded: '맞혀 봤어요' }
const CLAIM_LABEL: Record<AttemptEvidence['claim'], string> = {
  independent_check: '혼자 푼 첫 확인',
  condition_success: '이 과제를 맞힘(혼자 확인은 아님)',
  performed_only: '수행 기록',
  held: '보류(근거 확인 필요)',
  not_counted: '세지 않음',
}

function transferText(e: EvidenceView) {
  const t = e.newPassageTransfer
  if (t.status === 'experienced' || t.status === 'none') {
    const m = e.instructionPath.transferPlanned
    return `${TRANSFER_LABEL[t.status]} · ${t.passages}${m !== null ? ` / ${m}` : ''}편(현재 원문 기준)`
  }
  return TRANSFER_LABEL[t.status]
}

/** 한 줄 칩 — 팝업 · Workspace 창 */
export function EvidenceChips({ e, testId }: { e: EvidenceView; testId: string }) {
  return (
    <ul className={u.evChips} data-testid={testId} data-check={e.currentCheck.status} data-transfer={e.newPassageTransfer.status} data-delay={e.delayedRetention.status} data-ledger={e.ledger}>
      <li>지금 확인 · {CURRENT_CHECK_LABEL[e.currentCheck.status]}</li>
      <li>다른 글 적용 · {transferText(e)}</li>
      <li>시간 지나 다시 확인 · 아직 근거 없음</li>
    </ul>
  )
}

/** 상세 서랍 — 네 값 · 도구 범위 · 시도별 사유 */
export function EvidenceBlock({ e }: { e: EvidenceView }) {
  const notes = e.attempts.filter((a) => a.reasons.length > 0)
  const counts = e.attempts.reduce<Record<string, number>>((m, a) => ({ ...m, [a.claim]: (m[a.claim] ?? 0) + 1 }), {})
  const counted = new Set(e.attempts.filter((a) => a.claim === 'independent_check').map((a) => a.itemRef))
  const sharedCounted = new Set(e.sharedPassageGroups.flat().filter((item) => counted.has(item))).size
  const observed = [...new Map(e.attempts.filter((a) => a.fields.performed === 'CONFIRMED' && a.fields.independence === 'CONFIRMED').map((a) => [a.itemRef, a])).values()]
  return (
    <div className={u.evBlock} data-testid="ins-evidence-claims" data-check={e.currentCheck.status} data-ledger={e.ledger}>
      <dl className={u.popKv}>
        <dt>지금 확인</dt>
        <dd data-testid="ev-check" data-current-items={e.currentCheck.independentItems} data-ledger-items={e.ledger === 'unknown' ? undefined : counted.size}>
          {CURRENT_CHECK_LABEL[e.currentCheck.status]} · 이번 판정의 독립 확인 {e.currentCheck.independentItems}문항
          {/* T-0076 — 상세 기록 집계는 다른 범위(연결된 과제 키 · 전체 기간 · 현재 주석 확인된 것만) — 이번 판정 수를 대신하지 않는다 */}
          <span className={u.fine}> (상세 기록: {e.ledger === 'unknown' ? '다 읽지 못해 확인 보류' : `현재 주석까지 확인된 독립 확인 ${counted.size}개 · 전체 기간`})</span>
        </dd>
        <dt>바로잡기</dt>
        <dd data-testid="ev-repair">{REPAIR_LABEL[e.instructionPath.repair]} — 해 본 것이지 익혔다는 뜻은 아니에요</dd>
        <dt>다른 글 적용</dt>
        <dd data-testid="ev-transfer">{transferText(e)} — 혼자 적용할 수 있다는 판정은 아니에요</dd>
        <dt>시간 지나 다시 확인</dt>
        <dd data-testid="ev-delay">아직 근거 없음 — 간격 기준이 정해지지 않았어요(기간 만료와 다른 것)</dd>
      </dl>
      {e.ledger === 'unknown' && <p className={u.fine} data-testid="ev-ledger-unknown">수행 기록을 다 읽지 못해 근거가 완전하지 않을 수 있어요.</p>}
      {e.attempts.length > 0 && (
        <p className={u.fine} data-testid="ev-claims">
          {(Object.keys(CLAIM_LABEL) as AttemptEvidence['claim'][]).filter((k) => counts[k]).map((k) => `${CLAIM_LABEL[k]} ${counts[k]}${k === 'independent_check' ? '(현행 도구 기준)' : ''}`).join(' · ')}
          {e.ledger === 'complete' ? ` · 기록에서 확인된 독립 첫 관찰 ${observed.length}개: 첫 독립 관찰 중 맞힘 ${observed.filter((a) => a.outcome === 'correct').length} · 틀림 ${observed.filter((a) => a.outcome === 'incorrect').length}` : ''}
        </p>
      )}
      {notes.length > 0 && (
        <ul className={u.evNotes} data-testid="ev-notes">
          {[...new Set(notes.flatMap((a) => a.reasons))].map((r) => (
            <li key={r}>{r} {notes.filter((a) => a.reasons.includes(r)).length}건</li>
          ))}
        </ul>
      )}
      {e.sharedPassageGroups.length > 0 && <p className={u.fine} data-testid="ev-shared">같은 글의 다른 문항 {e.sharedPassageGroups.length}묶음이 있어요({e.ledger === 'unknown' ? '현행 도구 독립 확인 집계 보류' : `현행 도구 독립 확인 집계에 ${sharedCounted}문항 포함`}). 별개 글의 독립 관찰로 해석하지 않아요(집계 정책 미확정).</p>}
      {e.scope && (
        <details className={u.evScope} data-testid="ev-scope">
          <summary>이 과제가 보는 것 · 보지 않는 것</summary>
          <p className={u.fine}>보는 것: {e.scope.observes.join(' · ')}</p>
          <p className={u.fine}>보지 않는 것: {e.scope.notObserved.join(' · ')}</p>
          <p className={u.fine}>채점: {e.scope.review}</p>
        </details>
      )}
    </div>
  )
}
