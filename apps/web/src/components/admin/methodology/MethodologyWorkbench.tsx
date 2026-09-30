// apps/web/src/components/admin/methodology/MethodologyWorkbench.tsx
'use client'
import { useMemo, useState } from 'react'
import { isClaimExpanded } from '@/lib/methodology/expand'
import { compareMethods, evidenceUrl, researchCoverage } from '@/lib/methodology/core'
import { claimKinds, type ClaimKind, type KnowledgeBundle } from '@/lib/methodology/types'
import styles from './methodology.module.css'

const kinds: Record<ClaimKind, string> = { principle: '원칙', condition: '언제', procedure: '어떻게', rationale: '왜', example: '예시', failure: '잘못 쓰면', exception: '예외', transfer: '다른 상황으로' }
const relationLabels = { equivalent_candidate: '유사 후보 · 동등 여부 검토', contradicts: '상충 관계', context_differs: '적용 조건이 다름', complements: '상보 관계' }
const accessLabels = { metadata_only: '메타데이터만 확인', document_read: '문서 본문 확인', transcript_read: '자막 확인', unavailable: '접근 불가' }
const reviewLabels = { extracted: '검토 필요', reviewed: '검토 완료', rejected: '보류·기각' }
const time = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

export function MethodologyWorkbench({ bundle, snapshotId }: { bundle: KnowledgeBundle; snapshotId: string }) {
  const [selectedId, setSelectedId] = useState(bundle.methods[0]?.id ?? '')
  const [openClaim, setOpenClaim] = useState(bundle.claims.find(c => c.methodId === selectedId && c.kind === 'principle')?.id ?? '')
  const [skill, setSkill] = useState(''), [age, setAge] = useState(''), [exam, setExam] = useState(''), [question, setQuestion] = useState(''), [expert, setExpert] = useState('')
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [sourceQuery, setSourceQuery] = useState('')
  const [sourceId, setSourceId] = useState('')
  const coverage = useMemo(() => researchCoverage(bundle), [bundle])
  const comparisons = useMemo(() => compareMethods(bundle, bundle.methods.map(m => m.id)), [bundle])
  const taxon = (id: string) => bundle.taxonomy.find(t => t.id === id)?.label ?? id
  const names = (ids: string[]) => ids.map(id => bundle.experts.find(e => e.id === id)?.name ?? id).join(' · ')
  const belongs = (ids: string[], filter: string) => !filter || ids.some(id => id === filter || bundle.taxonomy.find(t => t.id === id)?.parentId === filter)
  const matches = (ids: string[]) => belongs(ids, skill) && belongs(ids, age) && belongs(ids, exam) && belongs(ids, question)
  const filtered = comparisons.filter(row => matches(row.method.taxonomyIds) && (!expert || row.evidence.some(e => e.expertIds.includes(expert))))
  const active = filtered.find(row => row.method.id === selectedId) ?? filtered[0]
  const selectMethod = (id: string) => { setSelectedId(id); setOpenClaim(bundle.claims.find(c => c.methodId === id && c.kind === 'principle')?.id ?? '') }
  const clear = () => { setSkill(''); setAge(''); setExam(''); setQuestion(''); setExpert('') }
  const pickedSource = bundle.sources.find(s => s.id === sourceId)
  const sourceEvidence = bundle.evidence.filter(e => e.sourceId === sourceId)
  const sourceMethods = [...new Set(sourceEvidence.map(e => bundle.claims.find(c => c.id === e.claimId)!.methodId))]
  const sourceList = bundle.sources.filter(s => (!expert || s.expertIds.includes(expert)) && (!sourceQuery || `${s.title} ${names(s.expertIds)}`.toLowerCase().includes(sourceQuery.toLowerCase())))
  const dimensionSelect = (dimension: 'skill' | 'age' | 'exam' | 'question', label: string, value: string, set: (value: string) => void) => <label>{label}<select value={value} onChange={e => set(e.target.value)}><option value="">전체</option>{bundle.taxonomy.filter(t => t.dimension === dimension).map(t => <option key={t.id} value={t.id}>{t.parentId ? '↳ ' : ''}{t.label}</option>)}</select></label>
  return <div className={styles.workbench} data-testid="methodology-workbench">
    <p className={styles.notice}>실제 공개자료를 재서술한 초기 연구입니다. 원문을 확인한 주장과 아직 읽지 못한 영상 목록을 구분합니다. <strong>출처가 있다는 사실은 교육 효과의 입증을 뜻하지 않습니다.</strong></p>
    <div className={styles.filters} aria-label="연구 범위">
      {dimensionSelect('skill', '영어 영역', skill, setSkill)}{dimensionSelect('age', '학습 단계', age, setAge)}{dimensionSelect('exam', '시험', exam, setExam)}{dimensionSelect('question', '문제 유형', question, setQuestion)}
      <label>전문가<select value={expert} onChange={e => setExpert(e.target.value)}><option value="">전체</option>{bundle.experts.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
      <button onClick={clear}>범위 초기화</button>
    </div>
    <p className={styles.scope} aria-live="polite">{[skill, age, exam, question].filter(Boolean).map(taxon).join(' · ') || '전체 영어교육'}{expert ? ` · ${names([expert])}` : ''} — 방법 {filtered.length}개. {filtered.filter(r => r.method.review === 'reviewed').length}개 검토 완료.</p>
    <div className={styles.sheet}>
      <nav className={styles.index} aria-label="방법론 색인"><h2>발견한 방법</h2>{filtered.map((row, index) => <div key={row.method.id} className={styles.indexEntry}>
        <button className={styles.methodButton} aria-pressed={active?.method.id === row.method.id} onClick={() => selectMethod(row.method.id)}><span className={styles.number}>{String(index + 1).padStart(2, '0')}</span><span>{row.method.statement}<small>{names(row.consensus.expertIds)} · {reviewLabels[row.method.review]}</small></span></button>
        <label className={styles.compareCheck}><input type="checkbox" checked={compareIds.includes(row.method.id)} disabled={!compareIds.includes(row.method.id) && compareIds.length >= 3} onChange={e => setCompareIds(prev => e.target.checked ? [...prev, row.method.id] : prev.filter(id => id !== row.method.id))} />비교에 담기</label>
      </div>)}{!filtered.length && <p>이 범위의 방법론 근거가 없습니다. 아래 조사 공백에서 다음 자료를 확인하세요.</p>}</nav>
      <article className={styles.paper} aria-label="주장과 근거">
        {active ? <>
          <p className={styles.eyebrow}>주장 ↔ 원문 근거 <span>{reviewLabels[active.method.review]}</span></p>
          <h2 className={styles.statement}>{active.method.statement}</h2>
          <p className={styles.tags}>{active.method.taxonomyIds.map(taxon).join(' · ')}</p>
          <p className={styles.meta}>명시적 원칙: 전문가 {active.consensus.expertIds.length}명 · 출처 계보 {active.consensus.originGroups.length}개. {active.consensus.independentlyRepeated ? '여러 독립 계보에서 반복됨' : '독립적인 다수 합의 미확인'} · 효과 검증 미평가</p>
          <div className={styles.claims}>{claimKinds.flatMap(kind => active.claims.filter(c => c.kind === kind).map(claim => {
            const evidence = active.evidence.filter(e => e.claimId === claim.id)
            const expanded = isClaimExpanded(openClaim, claim.id, kind, active.claims.map(c => c.id))
            return <section className={styles.claimRow} key={claim.id} data-expanded={expanded}>
              <button className={styles.claim} aria-expanded={expanded} aria-controls={`evidence-${claim.id}`} onClick={() => setOpenClaim(expanded ? '' : claim.id)}><span className={styles.kind}>{kinds[kind]}{kind === 'procedure' ? ` ${claim.ordinal + 1}` : ''}</span><span>{claim.text}<small>{claim.attribution === 'analyst_inference' ? '분석자의 추론 · ' : ''}근거 {evidence.length}개 {expanded ? '접기 −' : '보기 +'}</small></span></button>
              <aside id={`evidence-${claim.id}`} className={styles.margin} hidden={!expanded}>{evidence.map(e => {
                const source = bundle.sources.find(s => s.id === e.sourceId)!
                return <div key={e.id} className={styles.citation}><span className={styles.connector} aria-hidden="true">{e.stance === 'opposes' ? '┄┤' : e.stance === 'qualifies' ? '↳' : '→'}</span><p className={styles.kind}>{e.stance === 'supports' ? '지지 근거' : e.stance === 'qualifies' ? '조건 보완' : '반대 근거'} · {names(e.expertIds)}</p><a href={evidenceUrl(source, e.locator.kind === 'time' ? e.locator.start : undefined)} target="_blank" rel="noreferrer">{source.title} ↗</a><p>{e.locator.kind === 'section' ? e.locator.section : `${time(e.locator.start)}–${time(e.locator.end)}`}</p><small>{accessLabels[source.access]} · 확인 {source.verifiedAt}</small><p className={styles.note}>{e.note}</p></div>
              })}</aside>
            </section>
          }))}</div>
          <p className={styles.missing}>아직 출처에서 확인하지 못한 항목: {claimKinds.filter(kind => !active.claims.some(c => c.kind === kind)).map(kind => kinds[kind]).join(' · ') || '없음'}</p>
          <details><summary>같은 의견·다른 의견과 제품 적용</summary>{active.relations.length ? active.relations.map(r => <p key={r.id}>{relationLabels[r.kind]} · {reviewLabels[r.review]} — {r.reason} <button onClick={() => { clear(); selectMethod(r.fromId === active.method.id ? r.toId : r.fromId) }}>연결된 방법 보기</button><span>근거 {r.evidenceIds.length}개</span></p>) : <p>검증할 관계가 아직 등록되지 않았습니다. 의견이 같거나 충돌한다고 결론 내리지 않습니다.</p>}<p>Vocaflow 적용: {active.method.productApplications.join(' · ') || '검토 전. 추천·학습 모듈에 자동 적용하지 않음.'}</p></details>
        </> : <><h2>다음 조사로 이어가기</h2><p>선택한 조건에 맞는 확인된 방법이 없습니다. 범위를 넓히거나 조사 공백에서 읽을 자료를 정하세요.</p><button onClick={clear}>전체 범위 보기</button></>}
      </article>
    </div>
    <details className={styles.expansion} open={compareIds.length >= 2}><summary>방법 비교 {compareIds.length ? `· ${compareIds.length}개 선택` : '· 색인에서 2–3개 선택'}</summary>
      <p>표현 유사성·상보성·상충은 별개의 관계입니다. 같은 주제만으로 합의나 충돌을 추정하지 않습니다.</p>
      <div className={styles.comparison}>{compareMethods(bundle, compareIds).map(row => <section key={row.method.id}><h3>{row.method.statement}</h3><p>{names(row.consensus.expertIds)} · {reviewLabels[row.method.review]}</p><dl>{(['condition','procedure','rationale','failure','exception'] as ClaimKind[]).map(kind => <div key={kind}><dt>{kinds[kind]}</dt><dd>{row.claims.filter(c => c.kind === kind).map(c => c.text).join(' ') || '근거 미확인'}</dd></div>)}</dl><p>출처 계보 {row.consensus.originGroups.length}개 · 효과 미평가</p><button onClick={() => { clear(); selectMethod(row.method.id) }}>주장별 근거로 돌아가기</button></section>)}</div>
    </details>
    <details className={styles.expansion}><summary>조사 공백 · 다음에 무엇을 읽을까</summary>
      <p>각 칸은 ‘본문을 읽은 출처 / 추출한 방법 / 검토한 방법’입니다. 수량만으로 자료가 충분하다고 판정하지 않습니다. 칸을 누르면 연구 범위가 바뀝니다.</p>
      <div className={styles.tableScroll}><table><caption>영어 영역 × 학습 단계</caption><thead><tr><th scope="col">영역</th>{bundle.taxonomy.filter(t => t.dimension === 'age').map(t => <th key={t.id} scope="col">{t.label}</th>)}</tr></thead><tbody>{bundle.taxonomy.filter(t => t.dimension === 'skill' && !t.parentId).map(s => <tr key={s.id}><th scope="row">{s.label}</th>{coverage.filter(c => c.skillId === s.id).map(c => <td key={c.ageId}><button aria-label={`${s.label} ${taxon(c.ageId)}: 본문 ${c.read}, 방법 ${c.extracted}, 검토 ${c.reviewed}`} onClick={() => { clear(); setSkill(s.id); setAge(c.ageId) }}>{c.read} / {c.extracted} / {c.reviewed}<small>{c.extracted === 0 ? '방법 근거 필요' : c.reviewed === 0 ? '사람 검토 필요' : '범위 확장 검토'}</small></button></td>)}</tr>)}</tbody></table></div>
      <h3>선택한 범위의 다음 작업</h3><ul>{bundle.gaps.filter(g => belongs(g.taxonomyIds, skill) && belongs(g.taxonomyIds, age)).map(g => <li key={g.id}><strong>{g.question}</strong><p>{g.nextAction}</p></li>)}</ul>
      <p>현재 필터에 해당하는 시험·문제유형별 방법: {filtered.length}개. 학령과 숙련도는 다른 축이며, 학령만으로 난이도를 추정하지 않습니다.</p>
    </details>
    <details className={styles.expansion}><summary>전문가와 출처 · 영상에서 방법론으로</summary>
      <div className={styles.experts}>{bundle.experts.map(e => <button key={e.id} onClick={() => { clear(); setExpert(e.id); setSourceId(e.profileSourceIds[0]); setSourceQuery('') }}><strong>{e.name}</strong><small>{e.organization} · {e.researchStatus === 'profile_verified' ? '공식 소개 확인' : '추가 조사 후보'}</small></button>)}</div>
      <label>출처 제목·전문가 검색<input type="search" value={sourceQuery} onChange={e => setSourceQuery(e.target.value)} /></label>
      <div className={styles.sources}><div className={styles.sourceList} aria-label="출처 목록">{sourceList.map(s => <button key={s.id} onClick={() => setSourceId(s.id)} aria-pressed={sourceId === s.id}>{s.title}<small>{accessLabels[s.access]}</small></button>)}{!sourceList.length && <p>검색 결과가 없습니다. 검색어나 전문가 필터를 바꾸세요.</p>}</div>
      <section aria-live="polite">{pickedSource ? <><h3>{pickedSource.title}</h3><p>{names(pickedSource.expertIds)} · {accessLabels[pickedSource.access]}</p>{pickedSource.channelId && <p>채널: <a href={bundle.channels.find(c => c.id === pickedSource.channelId)!.url} target="_blank" rel="noreferrer">{bundle.channels.find(c => c.id === pickedSource.channelId)!.name} ↗</a></p>}<a href={evidenceUrl(pickedSource)} target="_blank" rel="noreferrer">원본 {pickedSource.kind === 'video' ? '영상' : '문서'} 열기 ↗</a><p>{pickedSource.rightsBasis}</p><h4>이 출처에서 추출한 주장·방법</h4>{sourceMethods.length ? sourceMethods.map(id => <button key={id} onClick={() => { clear(); selectMethod(id) }}>{bundle.methods.find(m => m.id === id)!.statement}</button>) : <p>추출된 주장 없음. 영상 제목을 학습법 근거로 사용하지 않았습니다.</p>}<p>연결된 근거 {sourceEvidence.length}개 · 출처 확인 {pickedSource.verifiedAt}</p></> : <p>출처를 선택하면 전문가·원본·추출된 방법을 여기에서 확인할 수 있습니다.</p>}</section></div>
    </details>
    <footer className={styles.footer}>자료 확인 {bundle.verifiedAt} · DB 스냅샷 {snapshotId.slice(0, 12)} · 검토 상태 변경은 검증된 번들 적재 절차를 따릅니다.</footer>
  </div>
}
