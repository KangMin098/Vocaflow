// apps/web/src/components/csat/session/SessionHome.tsx
//
// 기출 홈 — 참조(Tines) 산업·솔루션 템플릿을 구간 단위로 옮겼다(DD-68 · tines-mapping 「기출 홈」).
//   ① 가운데 히어로: 모노 눈썹 · 세리프 제목 · 알약 둘 · 양옆에 흩어진 물건
//   ② 제품 카드: 면 + 가장자리로 흘러나가는 안쪽 액자(세 단계 노드) + 구석 아이콘 타일
//   ③ 선언: 위아래 가는 줄 사이 2열
//   ④ 색 탭 + 패널: 출제 패턴마다 고유 면 색 → 패널 면 안 크림 액자에 두 문항 비교 도식
//   ⑤ 「Dive into the details」 타일 카드 4 · ⑥ 패턴 색 카드(기기 기록) · ⑦ 「What's new」 목록 카드
// 같은 패턴은 ④⑥⑦ 어디서나 같은 색 · 같은 소품이다(`patternTone` · `patternArt`).
'use client'

import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BTN } from '@/components/ui/tines-kit'
import { track } from '@/lib/analytics/client'
import { composeDissection, emptyDissectionRecord, type DissectionCatalog, type DissectionItem, type DissectionRecord } from '@/lib/csat/dissect'
import { patternGroups, recommendationReason } from '@/lib/csat/learning-home'
import { patternArt } from '@/lib/csat/pattern-art'
import { REFLOW_VERSION } from '@/lib/csat/reflow/reflow'
import { cachedExamIds, loadDissectionRecord, saveDissectionRecord } from '@/lib/csat/session/store'
import { toItemSlug } from '@/lib/csat/item-slug'
import { TINT_CLASS, TINT_ROTATION, type Tint } from '@/lib/design/tone'
import { CsatLibrary } from '@/components/csat/browse/CsatLibrary'
import type { BrowseCatalog } from '@/lib/csat/browse-model'
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
/** 면 클래스 없이 그 패턴 색을 바탕 · 테두리 · 글자로 쓸 때(안쪽 액자가 기본 글자색을 지켜야 하는 곳) */
const toneVars = (tone: Tint) => ({ '--tone': `var(--tint-${tone})`, '--tone-ink': `var(--tint-${tone}-ink)` }) as React.CSSProperties
const STEP_ROLE = ['먼저 예측하기', '설계 대조하기', '다른 문항에서 전이']
const TILE = (name: string) => `/illustrations/tines/${name}.webp`
/** 히어로 양옆에 흩어진 물건 — 참조는 크기 · 기울기가 다른 물건 2~3개씩(동전 · 깔때기 · 구름) */
const FLOATS: { src: string; style: React.CSSProperties }[] = [
  { src: 'spot-quiz', style: { left: '1%', top: '10%', width: 132, rotate: '-10deg' } },
  { src: 'spot-memory', style: { left: '9%', top: '60%', width: 88, rotate: '8deg' } },
  { src: 'spot-search', style: { right: '2%', top: '4%', width: 112, rotate: '12deg' } },
  { src: 'spot-review-done', style: { right: '10%', top: '56%', width: 96, rotate: '-6deg' } },
]

export function SessionHome({ catalog, browse, initialType }: { catalog: DissectionCatalog; browse: BrowseCatalog; initialType?: string }) {
  const router = useRouter()
  const [state, setState] = useState<{ record: DissectionRecord; cached: string[]; plan: DissectionItem[]; now: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [pattern, setPattern] = useState(0)
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
  const steps = [
    { name: '예측', detail: '근거는 어디에 있을까', tile: 'tile-quiz', tone: 'pink' as Tint, href: ready ? dissectionHref(plan) : '#library-title' },
    { name: '설계 읽기', detail: '근거 → 함정 → 의도', tile: 'tile-read', tone: 'green' as Tint, href: selected ? itemHref(selected.items[0], 'evidence') : '#library-title' },
    { name: '전이', detail: '소재가 바뀌어도 통할까', tile: 'tile-articles', tone: 'peach' as Tint, href: ready ? dissectionHref(plan) : '#library-title' },
    { name: '패턴 축적', detail: '내 언어로 남긴 공식', tile: 'tile-textbooks', tone: 'lavender' as Tint, href: '/csat/formulas' },
  ]
  const tone = patternTone(pattern)

  return <div className={home.home} data-csat-home>
    {/* ① 히어로 */}
    <div className={home.hero}>
      {FLOATS.map(f => <Image key={f.src} className={home.float} style={f.style} src={TILE(f.src)} alt="" width={1328} height={1328} priority />)}
      {active && <Link className={home.resume} href="/csat/dissect?resume=1"><span className={home.resumeBadge}>이어서</span><span>{active.items[active.index].replace('#', ' · ')}번부터 하던 학습</span><ArrowRight size={15} aria-hidden /></Link>}
      <p className={home.mono}>CSAT · Dissect</p>
      <h1 id="home-title">다른 지문, 같은 설계.</h1>
      <p className={home.lede}>수능·모의평가 {browse.items.length}문항이 전부 열려 있어요. 유형·학년도로 골라 바로 들어가거나, 오늘 몫으로 고른 세 문항부터 시작해요.</p>
      <div className={home.ctaRow}>
        <Link className={BTN.primary} href="#library-title" data-testid="browse-all">전체 기출 탐색</Link>
        <button className={BTN.secondary} onClick={() => void start()} disabled={busy || !ready} data-testid="start">{busy ? '여는 중…' : ready ? '오늘의 해부 시작' : '준비 중'}</button>
      </div>
    </div>

    {/* ② 제품 카드 */}
    <section className={`${TINT_CLASS.pink} ${home.today}`} data-testid="today-card" aria-labelledby="today-title" aria-busy={!state}>
      <div className={home.todayCopy}>
        <h2 id="today-title">오늘의 해부 · {type}</h2>
        {ready ? <>
          <p className={home.sessionKind}>{plan[0].formulaTag === plan[1].formulaTag ? '같은 설계, 다른 소재' : '같은 유형, 다른 설계'}</p>
          <p className={home.reason} data-testid="recommendation-reason">{recommendationReason(catalog, plan, record, state!.now)}</p>
          <p className={home.sessionMeta}>{plan.length}문항 · 예측 → 대조 → 전이 · 예상 {plan.length * 4}분</p>
          {needed.length > 0
            ? <details className={home.paper}><summary>PDF {needed.length}개 필요 · 미리 준비하기</summary><PaperDrop catalog={catalog} needed={needed} onLoaded={p => setState(s => s ? { ...s, cached: [...new Set([...s.cached, p.exam_id])] } : s)} /></details>
            : <p className={home.localNote}>이 기기의 문제지로 바로 시작할 수 있어요.</p>}
        </> : <p className={home.reason}>{state ? '추천할 분석을 준비하고 있어요.' : '기기 기록을 확인하고 있어요…'}{state && <button className={BTN.text} onClick={() => router.refresh()}>다시 확인</button>}</p>}
        <Image className={home.todayIcon} src={TILE('tile-csat')} alt="" width={1328} height={1328} priority />
      </div>
      {ready && <div className={home.frame}>
        <p className={home.frameBar}><span aria-hidden /><span aria-hidden /><span aria-hidden /><small>기출 / 오늘의 해부 / {plan.length}문항</small></p>
        <ol className={home.itinerary}>{plan.map((item, index) => <li key={item.id}>
          <span className={home.step}>{String(index + 1).padStart(2, '0')}</span>
          <div><span className={home.reference}>{STEP_ROLE[index]} · {item.exam_id} {item.no}번</span><p>{item.format}</p></div>
        </li>)}</ol>
      </div>}
    </section>

    {/* ③ 선언 */}
    <section className={home.statement} aria-labelledby="why-title">
      <h2 id="why-title">정답을 알고 시작하는 기출</h2>
      <p>평가원 기출은 소재가 바뀌어도 같은 설계를 되풀이해요. 근거가 어디에 놓이고 오답이 어떻게 만들어지는지 먼저 예측하고, 두 지문을 나란히 놓고 대조한 뒤, 세 번째 지문에서 같은 설계를 스스로 찾아요. 맞힌 개수 대신 읽어 낸 설계가 남아요.</p>
    </section>

    {/* ④ 색 탭 + 패널 */}
    <section className={home.band} aria-labelledby="proof-title" data-testid="pattern-proof">
      <div className={home.bandHead}>
        <h2 id="proof-title">문장은 달라도, 연결 방식은 같다</h2>
        <Image className={home.headSpot} src={TILE('spot-search')} alt="" width={1328} height={1328} />
      </div>
      {selected ? <div className={home.tabbed}>
        <div className={home.tabs} role="group" aria-label="비교할 출제 패턴">{groups.map((group, index) => <button key={group.tag} className={TINT_CLASS[patternTone(index)]} aria-pressed={pattern === index} onClick={() => setPattern(index)}>{group.format}</button>)}</div>
        <div className={home.panel} style={toneVars(tone)}>
          <div className={home.panelHead}>
            <div><h3>{selected.format}</h3><p>같은 공식으로 묶인 {selected.items.length}문항을 나란히 놓고 근거와 오답의 자리를 비교해요.</p></div>
            <Image src={patternArt(selected.format)} alt="" width={1328} height={1328} />
          </div>
          <div className={home.panelFrame}><PatternComparison key={selected.tag} items={selected.items} /></div>
          <Link className={home.panelLink} href={itemHref(selected.items[0], 'evidence')}>실제 근거에서 확인하기 <ArrowRight size={15} aria-hidden /></Link>
        </div>
      </div> : <p className={styles.quiet}>비교할 기출 분석을 준비하고 있어요.</p>}
    </section>

    {/* ⑤ 타일 카드 */}
    <section className={home.band} aria-labelledby="path-title">
      <div className={home.centerHead}><h2 id="path-title">정답 다음에 남는 것</h2><p>한 문항에서 다음 문항으로 가져가는 네 가지.</p></div>
      <ol className={home.tiles}>{steps.map(step => <li key={step.name} style={toneVars(step.tone)}><Link href={step.href}>
        <Image src={TILE(step.tile)} alt="" width={1328} height={1328} />
        <span className={home.stripes} aria-hidden />
        <span className={`${TINT_CLASS[step.tone]} ${home.tileLabel}`}><strong>{step.name}</strong><span>{step.detail}</span></span>
      </Link></li>)}</ol>
    </section>

    {/* ⑥ 패턴 색 카드 */}
    <section className={home.band} aria-labelledby="map-title">
      <div className={home.bandHead}>
        <div><h2 id="map-title">어디까지 읽었나요?</h2><p className={home.intro}>정답률 대신, 살펴본 원리의 흔적을 남겨요. 이 기기에만 저장돼요.</p></div>
        <Image className={home.headSpot} src={TILE('spot-memory')} alt="" width={1328} height={1328} />
      </div>
      <PatternMap items={catalog.items} record={record} toneOf={toneOf} />
      <div className={home.mapFoot}><Link className={BTN.soft} href="/csat/formulas">내 공식에서 이어가기 <ArrowRight size={15} aria-hidden /></Link>{record.queue.length > 0 && <span>{record.queue.length}개 원리를 다시 확인하려고 남겼어요.</span>}</div>
    </section>

    {/* ⑦ 전체 기출 서가 — 12문항짜리 목록을 802문항으로 바꾼 자리 */}
    <section className={home.band}>
      <CsatLibrary catalog={browse} initialType={initialType} />
    </section>
  </div>
}
