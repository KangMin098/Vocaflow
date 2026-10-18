// apps/web/src/components/csat/theater/StructurePredict.tsx
'use client'
//
// FINAL §6 ⑤ — 「글 전체 구조」 먼저 예측하기. 공개 문제지를 곁에 두고 문장 번호마다 역할(주제문 · 근거 · 예시 …)과
// 글 전체 구조 패턴을 고른 뒤 맞춰 보면, 서버가 검수된 설계 주석과 대조하고 그다음에 구조 도식(StructureDiagram)을 연다.
// 지문 원문은 보이지 않는다(평가원 저작물 — 문장 번호만). 예측 없이 바로 보기도 되지만 그 경우 「먼저 봄」으로 남는다.
// 판정은 「설계 가설과 같게 읽었나」 — 능력 점수가 아니다(화면 문구로 밝힌다).

import { useRef, useState } from 'react'

import { PATTERN_LABEL, ROLE_LABEL, type PassageDesign, type Pattern, type Role } from '@/lib/csat/design'

import { StructureDiagram } from './SceneDiagrams'
import styles from './theater.module.css'

const ROLES = Object.keys(ROLE_LABEL) as Role[]
const PATTERNS = Object.keys(PATTERN_LABEL) as Pattern[]
const uuid = () => crypto.randomUUID()

interface Grade { roleOk: boolean[]; rolesRight: number; patternOk: boolean; topicOk: boolean; isCorrect: boolean }

export function StructurePredict({ slug, design, sentenceCount }: { slug: string; design: PassageDesign; sentenceCount: number | null }) {
  const n = design.roles.length
  const [roles, setRoles] = useState<(Role | '')[]>(() => Array(n).fill(''))
  const [pattern, setPattern] = useState<Pattern | null>(null)
  const [grade, setGrade] = useState<Grade | null>(null)
  const [skipped, setSkipped] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const session = useRef(uuid())
  // 같은 답의 재시도는 제출 id · 판단 시각을 그대로(FI-008)
  const mutation = useRef<{ key: string; id: string; at: string } | null>(null)
  const ready = roles.every(Boolean) && pattern !== null
  // 지도 문장 수와 역할 수가 다르면 번호를 지어내지 않는다(StructureDiagram 과 같은 원칙) — 예측도 순서로만 묻는다
  const label = (i: number) => (sentenceCount === n ? `문장 ${i + 1}` : `${i + 1}번째 덩어리`)

  async function submit() {
    if (!ready || busy) return
    setBusy(true); setError(null)
    const response = { roles, pattern }
    const key = JSON.stringify(response)
    if (!mutation.current || mutation.current.key !== key) mutation.current = { key, id: uuid(), at: new Date().toISOString() }
    try {
      const r = await fetch(`/api/csat/item/${slug}/structure`, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ response, clientSessionId: session.current, clientMutationId: mutation.current.id, answeredAt: mutation.current.at, helpLevel: 'independent' }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(typeof j.error === 'string' ? j.error : '맞춰 보지 못했어요 — 잠시 뒤 다시 눌러 주세요'); return }
      setGrade(j.grade as Grade)
    } catch { setError('연결이 끊겼어요 — 같은 답으로 다시 누르면 한 번만 저장돼요') } finally { setBusy(false) }
  }

  if (grade || skipped) {
    return (
      <div data-testid="structure-predict-done">
        {grade && (
          <section className={styles.diagram} aria-live="polite" data-testid="structure-predict-result">
            <p className={styles.diagramHead}><b>내 예측과 설계 주석 대조</b><span className={styles.epistemic}>능력 점수 아님 · 설계 가설과의 대조</span></p>
            <ul className="break-keep">
              <li>주제문 자리: {grade.topicOk ? '같게 읽었어요' : '다르게 읽었어요 — 아래 도식에서 주제문을 확인해 보세요'}</li>
              <li>문장 역할: {n}개 중 {grade.rolesRight}개 같음{grade.roleOk.some((x) => !x) ? ` (다른 곳: ${grade.roleOk.map((x, i) => (x ? null : label(i))).filter(Boolean).join(' · ')})` : ''}</li>
              <li>구조 패턴: {grade.patternOk ? '같게 읽었어요' : `다르게 읽었어요 — 설계는 「${PATTERN_LABEL[design.pattern]}」`}</li>
            </ul>
          </section>
        )}
        <StructureDiagram design={design} sentenceCount={sentenceCount} />
      </div>
    )
  }

  return (
    <section className={styles.diagram} aria-labelledby="structure-predict-h" data-testid="structure-predict">
      <p className={styles.diagramHead}>
        <b id="structure-predict-h">먼저 구조를 읽어 보세요</b>
        <span className={styles.epistemic}>문제지를 곁에 두고 번호로</span>
      </p>
      <p className="break-keep">문장마다 하는 일(주제문 · 근거 · 예시 · 전환 …)을 고르고, 글 전체가 어떤 구조인지 고른 뒤 맞춰 보면 설계 주석과 대조해 드려요.</p>
      <ol style={{ display: 'grid', gap: 8 }}>
        {roles.map((v, i) => (
          <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span>{label(i)}</span>
              <select value={v} disabled={busy} onChange={(e) => setRoles((s) => s.map((x, j) => (j === i ? (e.target.value as Role | '') : x)))} style={{ minHeight: 44 }}>
                <option value="">역할 고르기</option>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </label>
          </li>
        ))}
      </ol>
      <fieldset style={{ border: 0, padding: 0, margin: '12px 0 0' }} disabled={busy}>
        <legend>글 전체 구조</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PATTERNS.map((p) => (
            <button key={p} type="button" aria-pressed={pattern === p} onClick={() => setPattern(p)} style={{ minHeight: 44, padding: '0 12px' }}>{PATTERN_LABEL[p]}</button>
          ))}
        </div>
      </fieldset>
      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={submit} disabled={!ready || busy} data-testid="structure-predict-submit" style={{ minHeight: 44, padding: '0 16px' }}>{busy ? '맞춰 보는 중…' : '맞춰 보기'}</button>
        <button type="button" onClick={() => setSkipped(true)} style={{ minHeight: 44, padding: '0 12px' }}>예측 없이 도식 보기</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
