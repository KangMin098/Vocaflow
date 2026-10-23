// 격리 하네스 — LectureStage 만 실제 브라우저에 띄운다(로그인 · 제품 라우트 · DB 없음).
// 강의 데이터는 커밋된 2026.json 의 2026#34(아래 fetch 가로채기로 공급).
import { createRoot } from 'react-dom/client'
import { useEffect } from 'react'

import { LectureStage, useLecture } from '@/components/csat/lecture/LectureStage'
import data from '@/lib/csat/lecture-data/2026.json'
import disclosure from '@/lib/csat/lecture/disclosure-data.json'

const lecture = (data as unknown as { lectures: Record<string, { cues: { target: { kind: string; id: string } }[] }> }).lectures['2026#34']
// 제품 API 와 같은 계약을 흉내 낸다 — scope=until 이면 제품 경계 데이터의 stopBefore 앞 cue 만 준다
const stop = (disclosure as unknown as { lectures: Record<string, { stopBefore: number }> }).lectures['2026#34'].stopBefore
;(window as unknown as { __STOP__: number }).__STOP__ = stop
const requested: string[] = []
;(window as unknown as { __REQ__: string[] }).__REQ__ = requested

const realFetch = window.fetch.bind(window)
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.includes('/api/csat/lecture')) {
    requested.push(url)
    const until = url.includes('scope=until')
    const body = until ? { ok: true, lecture: { ...lecture, cues: lecture.cues.slice(0, stop) }, disclosure: { scope: 'until', verified: true, stopBefore: stop } } : { ok: true, lecture, disclosure: { scope: 'full' } }
    return Promise.resolve(new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }))
  }
  return realFetch(input, init)
}

const keyOf = (t: { kind: string; id: string }) => `${t.kind}:${t.id}`
const keys = [...new Set(lecture.cues.map((c) => keyOf(c.target)))]

function Probe() {
  const lec = useLecture()
  useEffect(() => {
    ;(window as unknown as { __CTX__: unknown }).__CTX__ = lec
  })
  return (
    <div style={{ position: 'fixed', top: 0, right: 24, zIndex: 9, background: '#fff', padding: 8, border: '1px solid #ccc', font: '12px sans-serif' }}>
      <button id="play" type="button" style={{ minHeight: 44 }} onClick={() => lec?.start(0, 'start')}>재생</button>{' '}
      <span id="state">{lec?.status} · cue {lec?.index} · follow {String(lec?.following)}</span>
    </div>
  )
}

function App() {
  return (
    <LectureStage slug="2026-34" meta={{ sec: 120, cues: lecture.cues.length }} keys={false}>
      <Probe />
      <main style={{ width: 900, margin: '0 auto', font: '16px sans-serif' }}>
        <button id="pick" type="button" aria-pressed="false" style={{ minHeight: 44 }} onClick={(e) => e.currentTarget.setAttribute('aria-pressed', 'true')}>
          근거 고르기(학습자 선택)
        </button>
        {keys.map((k, i) =>
          i % 3 === 2 ? (
            <details key={k} data-testid={`det-${i}`} style={{ margin: '400px 0' }}>
              <summary>접힌 층 {k}</summary>
              <article data-lecture-target={k} data-block={k} style={{ height: 200, border: '1px solid #999' }}>{k}</article>
            </details>
          ) : (
            <article key={k} data-lecture-target={k} data-block={k} style={{ margin: '400px 0', height: 200, border: '1px solid #999' }}>
              {k}
            </article>
          ),
        )}
      </main>
    </LectureStage>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
