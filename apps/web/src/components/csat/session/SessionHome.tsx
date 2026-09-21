// apps/web/src/components/csat/session/SessionHome.tsx
//
// 기출 홈 — 참조(Tines) 솔루션 템플릿 골격을 화면 용도에 맞춰 옮겼다(DD-68 · tines-mapping §20).
//   ① 2열 히어로: 제목 + 시작 알약 / 오른쪽 「오늘의 해부」 제품 카드(안쪽 액자 = 세 단계 노드)
//   ② 색 탭 + 패널: 출제 패턴마다 고유 면 색 → 두 문항 비교 도식
//   ③ 「Dive into the details」 타일 카드 4: 한 문항에서 남는 네 단계
//   ④ 패턴 색 카드: 어디까지 읽었나(기기 기록)
//   ⑤ 디렉터리: 왼쪽 필터 · 오른쪽 목록
// 같은 패턴은 ②④⑤ 어디서나 같은 색이다(`patternTone`).
'use client'

import { ArrowDown, ArrowRight, Headphones } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BTN } from '@/components/ui/tines-kit'
import { track } from '@/lib/analytics/client'
import { composeDissection, emptyDissectionRecord, type DissectionCatalog, type DissectionItem, type DissectionRecord } from '@/lib/csat/dissect'
import { patternGroups, recommendationReason } from '@/lib/csat/learning-home'
import { REFLOW_VERSION } from '@/lib/csat/reflow/reflow'
import { cachedExamIds, loadDissectionRecord, saveDissectionRecord } from '@/lib/csat/session/store'
import { toItemSlug } from '@/lib/csat/item-slug'
import { TINT_CLASS, TINT_ROTATION, type Tint } from '@/lib/design/tone'
import { PaperDrop } from './PaperDrop'
import { PatternComparison } from './PatternComparison'
import { PatternMap } from './PatternMap'
import styles from './session.module.css'
import home from './learning-home.module.css'

export const PRIMARY = styles.primary
export function dissectionHref(items: DissectionItem[]) {
  return `/csat/dissect?set=${encodeURIComponent(items.map(i => toItemSlug(i.id)).join(','))}`
}
const itemHref = (item: DissectionItem, section?: string) => `/csat/dissect?item=${toItemSlug(item.id)}${section ? `#analysis-${section}` : ''}`
/** 패턴 순서대로 면 색을 돌린다 — 홈의 오늘 카드(분홍 = 기출 범주 색)와 겹치지 않게 분홍 앞의 셋부터 쓴다. */
export const patternTone = (index: number): Tint => TINT_ROTATION[index % TINT_ROTATION.length]
/** 면 밖에서 그 패턴 색을 테두리 · 점으로 쓸 때 */
const toneVars = (tone: Tint) => ({ '--tone': `var(--tint-${tone})`, '--tone-ink': `var(--tint-${tone}-ink)` }) as React.CSSProperties
const STEP_ROLE = ['먼저 예측하기', '설계 대조하기', '다른 문항에서 전이']
const TILE = (name: string) => `/illustrations/tines/${name}.webp`

export function SessionHome({ catalog }: { catalog: DissectionCatalog }) {
  const router = useRouter()
  const [state, setState] = useState<{ record: DissectionRecord; cached: string[]; plan: DissectionItem[]; now: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [pattern, setPattern] = useState(0)
  const [filter, setFilter] = useState('all')
  const groups = patternGroups(catalog.items)
  const selected = groups[pattern] ?? groups[0]
  const toneOf = new Map(groups.map((g, i) => [g.tag, patternTone(i)]))
  useEffect(() => {
    let alive = true
    void Promise.all([loadDissectionRecord(), cachedExamIds(REFLOW_VERSION)]).then(([record, cached]) => {
      const now = Date.now()
      if (alive) setState({ record, cached, plan: composeDissection(catalog, record, now, cached), now })
    })
    return () => { alive = false }
  }, [catalog])
  // Real comparison survives SSR; private progress arrives after hydration.
  const record = state?.record ?? emptyDissectionRecord(0)
  const plan = state?.plan ?? []
  const ready = plan.length === 3
  const needed = [...new Set(plan.map(i => i.exam_id))].filter(e => !state?.cached.includes(e))
  const type = catalog.types.find(t => t.id === plan[0]?.type_id)?.name ?? '기출 분석'
  const active = record.active && record.active.index < record.active.items.length ? record.active : null
  const start = async () => {
    if (busy || !state || !ready) return
    setBusy(true)
    await saveDissectionRecord({ ...record, onboarded: true })
    track({ name: 'csat_session_started', props: { size: plan.length, review: record.queue.some(q => q.due <= state.now), needed: new Set(plan.map(i => i.exam_id)).size, cached: new Set(plan.map(i => i.exam_id).filter(e => state.cached.includes(e))).size } })
    router.push(dissectionHref(plan))
  }
  const filtered = catalog.items.filter(i => filter === 'all' || i.formulaTag === filter || filter === 'seen' && (record.inspected?.includes(i.id) || record.predictions.some(p => p.item === i.id)))
  const steps = [
    { name: '예측', detail: '근거는 어디에 있을까', tile: 'tile-quiz', tone: 'pink' as Tint, href: ready ? dissectionHref(plan) : '#explore-title' },
    { name: '설계 읽기', detail: '근거 → 함정 → 의도', tile: 'tile-read', tone: 'green' as Tint, href: selected ? itemHref(selected.items[0], 'evidence') : '#explore-title' },
    { name: '전이', detail: '소재가 바뀌어도 통할까', tile: 'tile-articles', tone: 'peach' as Tint, href: ready ? dissectionHref(plan) : '#explore-title' },
    { name: '패턴 축적', detail: '내 언어로 남긴 공식', tile: 'tile-textbooks', tone: 'lavender' as Tint, href: '/csat/formulas' },
  ]

  return <div className={home.home} data-csat-home>
    {/* ① 히어로 */}
    <div className={home.hero}>
      <div className={home.heroCopy}>
        {active && <Link className={home.resume} href="/csat/dissect?resume=1"><span className={home.resumeBadge}>이어서</span><span>{active.items[active.index].replace('#', ' · ')}번부터 하던 학습</span><ArrowRight size={15} aria-hidden /></Link>}
        <p className={home.chip}>CSAT · 출제자의 설계 읽기</p>
        <h1 id="home-title">다른 지문, 같은 설계.</h1>
        <p className={home.intro}>정답을 알고 시작해요. 근거와 오답을 만든 설계를 예측하고, 다른 지문에서 같은 설계를 찾아요.</p>
        <div className={home.ctaRow}>
          <button className={BTN.primary} onClick={() => void start()} disabled={busy || !ready} data-testid="start">{busy ? '여는 중…' : ready ? '오늘의 해부 시작' : '준비 중'}<ArrowRight size={16} aria-hidden /></button>
          <Link className={BTN.secondary} href="/csat/formulas">내 공식</Link>
        </div>
        <a className={BTN.text} href="#explore-title">문항 목록에서 고르기 <ArrowDown size={15} aria-hidden /></a>
      </div>

      <section className={`${TINT_CLASS.pink} ${home.today}`} data-testid="today-card" aria-labelledby="today-title" aria-busy={!state}>
        <div className={home.todayCopy}>
          <p className={home.eyebrow}>오늘의 해부</p>
          <h2 id="today-title">{type}</h2>
          {ready ? <>
            <p className={home.sessionKind}>{plan[0].formulaTag === plan[1].formulaTag ? '같은 설계, 다른 소재' : '같은 유형, 다른 설계'}</p>
            <p className={home.reason} data-testid="recommendation-reason">{recommendationReason(catalog, plan, record, state!.now)}</p>
            <p className={home.sessionMeta}><span>{plan.length}문항 · 예측 → 대조 → 전이</span><span>예상 {plan.length * 4}분</span></p>
          </> : <p className={home.reason}>{state ? '추천할 분석을 준비하고 있어요.' : '기기 기록을 확인하고 있어요…'}{state && <button className={BTN.text} onClick={() => router.refresh()}>다시 확인</button>}</p>}
          <Image className={home.todayIcon} src={TILE('tile-csat')} alt="" width={1328} height={1328} priority />
        </div>
        {ready && <div className={home.frame}>
          <p className={home.frameBar} aria-hidden><span /><span /><span /></p>
          <ol className={home.itinerary}>{plan.map((item, index) => <li key={item.id}>
            <span className={home.step}>{String(index + 1).padStart(2, '0')}</span>
            <div><span className={home.reference}>{STEP_ROLE[index]} · {item.exam_id} {item.no}번</span><p>{item.format}</p></div>
          </li>)}</ol>
          {needed.length > 0
            ? <details className={home.paper}><summary>PDF {needed.length}개 필요 · 미리 준비하기</summary><PaperDrop catalog={catalog} needed={needed} onLoaded={p => setState(s => s ? { ...s, cached: [...new Set([...s.cached, p.exam_id])] } : s)} /></details>
            : <p className={home.localNote}>이 기기의 문제지로 바로 시작할 수 있어요.</p>}
        </div>}
      </section>
    </div>

    {/* ② 색 탭 + 패널 */}
    <section className={home.band} aria-labelledby="proof-title" data-testid="pattern-proof">
      <div className={home.bandHead}>
        <div><p className={home.eyebrow}>소재 너머의 공통점</p><h2 id="proof-title">문장은 달라도, 연결 방식은 같다</h2></div>
        <Image className={home.headSpot} src={TILE('spot-search')} alt="" width={1328} height={1328} />
      </div>
      {selected ? <div className={home.tabbed}>
        <div className={home.tabs} role="group" aria-label="비교할 출제 패턴">{groups.map((group, index) => <button key={group.tag} className={TINT_CLASS[patternTone(index)]} aria-pressed={pattern === index} onClick={() => setPattern(index)}>{group.format}<small>{group.items.length}문항</small></button>)}</div>
        <div className={home.panel} style={toneVars(patternTone(pattern))}>
          <div className={`${TINT_CLASS[patternTone(pattern)]} ${home.panelHead}`}><strong>{selected.format}</strong><Link className={BTN.text} href={itemHref(selected.items[0], 'evidence')}>실제 근거에서 확인하기 <ArrowRight size={15} aria-hidden /></Link></div>
          <PatternComparison key={selected.tag} items={selected.items} />
        </div>
      </div> : <p className={styles.quiet}>비교할 기출 분석을 준비하고 있어요.</p>}
    </section>

    {/* ③ 타일 카드 */}
    <section className={home.band} aria-labelledby="path-title">
      <div className={home.centerHead}><p className={home.eyebrow}>한 문항에서 다음 문항으로</p><h2 id="path-title">정답 다음에 남는 것</h2></div>
      <ol className={home.tiles}>{steps.map((step, index) => <li key={step.name} style={toneVars(step.tone)}><Link href={step.href}>
        <Image src={TILE(step.tile)} alt="" width={1328} height={1328} />
        <span className={home.stripes} aria-hidden />
        <span className={`${TINT_CLASS[step.tone]} ${home.tileLabel}`}><small>{String(index + 1).padStart(2, '0')}</small><strong>{step.name}</strong><span>{step.detail}</span></span>
      </Link></li>)}</ol>
    </section>

    {/* ④ 패턴 색 카드 */}
    <section className={home.band} aria-labelledby="map-title">
      <div className={home.bandHead}>
        <div><p className={home.eyebrow}>나의 탐색 지도</p><h2 id="map-title">어디까지 읽었나요?</h2><p className={home.intro}>정답률 대신, 살펴본 원리의 흔적을 남겨요. 이 기기에만 저장돼요.</p></div>
        <Image className={home.headSpot} src={TILE('spot-memory')} alt="" width={1328} height={1328} />
      </div>
      <PatternMap items={catalog.items} record={record} toneOf={toneOf} />
      <div className={home.mapFoot}><Link className={BTN.soft} href="/csat/formulas">내 공식에서 이어가기 <ArrowRight size={15} aria-hidden /></Link>{record.queue.length > 0 && <span>{record.queue.length}개 원리를 다시 확인하려고 남겼어요.</span>}</div>
    </section>

    {/* ⑤ 디렉터리 */}
    <section className={`${home.band} ${home.directory}`} aria-labelledby="explore-title">
      <aside>
        <p className={home.eyebrow}>자유롭게 읽기</p>
        <h2 id="explore-title">궁금한 문항부터</h2>
        <p className={home.intro}><Headphones size={16} aria-hidden /> 분석을 읽고, 같은 설명을 들을 수 있어요.</p>
        <label className={home.filter}>살펴볼 원리 <select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">전체 문항</option><option value="seen">내가 살펴본 문항</option>{groups.map(group => <option key={group.tag} value={group.tag}>{group.format}</option>)}</select></label>
      </aside>
      <div className={home.listCard}>
        {filtered.length ? <ul className={home.index}>{filtered.map(item => <li key={item.id} style={toneVars(toneOf.get(item.formulaTag) ?? 'lavender')}><Link href={itemHref(item)}>
          <span className={`${TINT_CLASS[toneOf.get(item.formulaTag) ?? 'lavender']} ${home.rowIcon}`} aria-hidden><Image src={TILE('spot-reading')} alt="" width={1328} height={1328} /></span>
          <span className={home.rowText}><strong>{item.topic}</strong><span className={home.reference}><b>{item.format}</b> | {item.exam_id} · {item.no}번</span></span>
          <ArrowRight size={16} aria-hidden />
        </Link></li>)}</ul> : <p className={home.empty}>아직 살펴본 문항이 없어요. <button className={BTN.text} onClick={() => setFilter('all')}>전체 문항 보기</button></p>}
      </div>
    </section>
  </div>
}
