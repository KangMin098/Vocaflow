// 정답 공개 UX 격리 프로토타입 — 실제 LectureStage + 실제 강의 데이터 + sidecar 어댑터. 제품 라우트 · 로그인 · DB 없음.
// 주소 ?item=2026-22 (2026#22) · 2026-27 · 2016-27
import { createRoot } from 'react-dom/client'
import { useEffect, useRef, useState } from 'react'

import { LectureStage, useLecture } from '@/components/csat/lecture/LectureStage'
import d2026 from '@/lib/csat/lecture-data/2026.json'
import d2016 from '@/lib/csat/lecture-data/2016.json'

import s2026 from '../cue-audit/sidecar-final/2026.disclosure.json'
import s2016 from '../cue-audit/sidecar-final/2016.disclosure.json'
import { preStopNotice, resolveAnswerBoundary, truncateLecture } from './adapter.mjs'

type Cue = { id: string; target: { kind: string; id: string }; segments: { text: string }[] }
type Lec = { version?: number; cues: Cue[] }
const DATA: Record<string, { lec: Lec; side: unknown }> = {}
for (const [d, s] of [[d2026, s2026], [d2016, s2016]] as const) {
  for (const [id, l] of Object.entries((d as unknown as { lectures: Record<string, Lec> }).lectures)) {
    DATA[id] = { lec: l, side: (s as unknown as { lectures: { lecture_id: string }[] }).lectures.find((x) => x.lecture_id === id) }
  }
}
const q = new URLSearchParams(location.search)
const itemId = (q.get('item') ?? '2026-22').replace('-', '#')
const { side } = DATA[itemId]
// 검사용 — &break=1 이면 대본 한 cue 를 바꿔 sidecar 결속을 일부러 깬다(미검증 경로 확인)
const lec: Lec = q.get('break') === '1' ? { ...DATA[itemId].lec, cues: DATA[itemId].lec.cues.map((c, i) => (i === 1 ? { ...c, segments: [{ ...c.segments[0], text: c.segments[0].text + ' ' }, ...c.segments.slice(1)] } : c)) } : DATA[itemId].lec

const sha256 = async (s: string) => 'sha256:' + Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, '0')).join('')

// 강의 API 가로채기 — 정답 직전까지 모드면 경계 뒤 cue 를 응답에서 뺀다(대본 · 강조 · 소거 · 음성이 같은 정책)
let served: Lec = lec
const realFetch = window.fetch.bind(window)
window.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
  String(input).includes('/api/csat/lecture') ? Promise.resolve(new Response(JSON.stringify({ ok: true, lecture: served }), { headers: { 'content-type': 'application/json' } })) : realFetch(input, init)

type Path = 'choose' | 'self' | 'full' | 'until' | 'until-ended' | 'stopped'

function Player({ path, startAt, onEnded, announce }: { path: Path; startAt: number; onEnded: () => void; announce: (s: string) => void }) {
  const ctx = useLecture()
  const started = useRef(false)
  // 검사용 — 무음 강의는 cue 마다 추정 초를 기다리므로 검사는 next() 로 넘긴다
  useEffect(() => { (window as unknown as { __CTX__: unknown }).__CTX__ = ctx })
  useEffect(() => {
    if (!ctx || started.current) return
    started.current = true
    ctx.start(startAt, 'start')
  }, [ctx, startAt])
  useEffect(() => {
    if (ctx?.status === 'ended' && path === 'until') onEnded()
    if (ctx?.status === 'playing') announce(path === 'until' ? '정답 직접 공개 직전까지 강의를 들려줘요' : '전체 해설 강의를 들려줘요 — 정답이 나와요')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.status])
  return (
    <section aria-label="읽기 강의 대본" data-testid="script">
      <p data-testid="state">{ctx?.status} · cue {ctx?.index} / 받은 cue {ctx?.cues.length}</p>
      <ol>{ctx?.cues.map((c, i) => <li key={c.id} data-cue={c.id} aria-current={i === ctx.index ? 'step' : undefined}>{c.text}</li>)}</ol>
    </section>
  )
}

function App() {
  const [boundary, setBoundary] = useState<{ status: string; stopBefore: number | null; preStopRisk?: string; reasons: string[] } | null>(null)
  const [path, setPath] = useState<Path>('choose')
  const [run, setRun] = useState(0)
  const [startAt, setStartAt] = useState(0)
  const [live, setLive] = useState('')
  useEffect(() => { void resolveAnswerBoundary(lec, side, sha256).then(setBoundary) }, [])
  ;(window as unknown as { __PROTO__: unknown }).__PROTO__ = { boundary, path }
  const verified = boundary?.status === 'VERIFIED' && boundary.stopBefore != null

  const begin = (p: Path, from = 0) => {
    served = p === 'until' && verified ? truncateLecture(lec, boundary!.stopBefore!) : lec
    setStartAt(from)
    setPath(p)
    setRun((n) => n + 1)
  }
  const targets = [...new Set(lec.cues.map((c) => `${c.target.kind}:${c.target.id}`))]

  return (
    <main style={{ width: 1000, margin: '0 auto', font: '16px sans-serif' }}>
      <p aria-live="polite" data-testid="live" style={{ position: 'absolute', left: -9999 }}>{live}</p>
      {path === 'choose' ? (
        <section aria-labelledby="choose-h" data-testid="choose" style={{ border: '1px solid #ccc', padding: 16 }}>
          <h2 id="choose-h">이 문항을 어떻게 볼까요?</h2>
          <p>강의는 정답과, 정답을 좁히는 단서를 말해요. 정답을 아직 보고 싶지 않다면 원문부터 보거나 정지 지점까지만 들으세요.</p>
          <button type="button" style={{ minHeight: 44 }} onClick={() => { setPath('self'); setLive('원문부터 직접 분석해요 — 강의는 재생하지 않아요') }} data-testid="path-self">원문부터 직접 분석</button>{' '}
          <button type="button" style={{ minHeight: 44 }} onClick={() => begin('full')} data-testid="path-full">전체 해설 강의 듣기(정답 포함)</button>{' '}
          {verified ? (
            <button type="button" style={{ minHeight: 44 }} onClick={() => begin('until')} data-testid="path-until" aria-describedby="until-note">직접 정답 공개 직전까지 듣기</button>
          ) : null}
          <p id="until-note" data-testid="until-note">
            {verified
              ? preStopNotice(boundary!.preStopRisk)
              : '이 강의는 정답 공개 지점이 아직 검증되지 않아 「정답 직전까지」 를 고를 수 없어요.'}
          </p>
        </section>
      ) : null}
      {path === 'until-ended' ? (
        <section data-testid="boundary-prompt" aria-labelledby="bp-h" style={{ border: '1px solid #c90', padding: 16 }}>
          <h2 id="bp-h" tabIndex={-1}>다음 부분에서 정답을 직접 말해요</h2>
          <button type="button" style={{ minHeight: 44 }} onClick={() => begin('full', boundary!.stopBefore!)} data-testid="bp-continue">계속 듣기(정답 공개)</button>{' '}
          <button type="button" style={{ minHeight: 44 }} onClick={() => { setPath('stopped'); setLive('여기서 멈췄어요') }} data-testid="bp-stop">여기서 멈춤</button>{' '}
          <button type="button" style={{ minHeight: 44 }} onClick={() => { setPath('self'); setLive('원문으로 돌아가요') }} data-testid="bp-self">원문으로</button>
        </section>
      ) : null}
      {path === 'full' || path === 'until' ? (
        <LectureStage key={run} slug={itemId.replace('#', '-')} meta={{ sec: 120, cues: served.cues.length }} keys={false}>
          <Player path={path} startAt={startAt} onEnded={() => { setPath('until-ended'); setLive('정답 직접 공개 직전에서 멈췄어요. 계속 들을지 고르세요') }} announce={setLive} />
          <div>{targets.map((k) => <article key={k} data-lecture-target={k} data-block={k} style={{ margin: '24px 0', height: 60, border: '1px solid #999' }}>{k}</article>)}</div>
        </LectureStage>
      ) : null}
      {path === 'self' ? <section data-testid="self">원문 · 선지 탐색 화면(강의 없음)</section> : null}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
