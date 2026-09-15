'use client'

// apps/web/src/app/(main)/csat/overlay/OverlayClient.tsx
//
// **평가원 문제지 위에 우리 분석을 얹는다 — 파일은 이 브라우저 밖으로 나가지 않는다.**
//
// 구조가 이 화면의 요점이다:
//   ① 학습자가 평가원에서 받은 PDF 를 떨어뜨린다 → `crypto.subtle` 이 **이 자리에서** SHA-256
//   ② 서버로 가는 것은 **해시 64자뿐** → 그 회차의 좌표와 우리 분석이 돌아온다
//   ③ PDF.js 가 파일을 **메모리에서** 렌더하고, 그 위에 좌표로 상자를 얹는다
//
// ⚠️ **원본을 서버로 올리지 않는다.** 올리면 우리가 전송·복제하는 것이 되어, `csat_items` 의
//    RLS 로 그어 둔 경계를 화면이 우회하는 셈이 된다.
// ⚠️ **「분석이 얹힌 PDF 내려받기」를 만들지 않는다.** 그 순간 변형 복제물이 된다.
//    화면 위의 레이어까지가 이 설계의 선이다.
// ⚠️ IndexedDB·localStorage 에 **파일을 남기지 않는다.** 새로 고치면 다시 떨어뜨리는 것이
//    맞다 — 남겨서 얻는 편의보다 「우리가 안 갖고 있다」를 코드로 보이는 편이 크다.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { track } from '@/lib/analytics/client'
import { locateQuote, type HighlightBox, type PdfTextItem } from '@/lib/csat/pdf-text-locate'

interface AnchorBox {
  p: number
  x: number
  y: number
  w: number
  h: number
}
interface AnchorItem extends AnchorBox {
  no: number
  col: number
  marks: (AnchorBox & { n: number })[]
}
interface OverlayItem {
  item_id: string
  no: number
  slug: string
  type_id: string | null
  type_name: string | null
  points: number | null
  answer: number | null
  ready: boolean
  measured_ability: string | null
  design_intent: string | null
  answer_quote: string | null
  choice_analysis: {
    n: number
    verdict?: string
    trap?: string
    why_tempting?: string
    how_to_reject?: string
    why_correct?: string
  }[]
  solve_procedure: { step: string; on_fail?: string }[]
  time_budget_sec: number | null
}
interface Payload {
  exam_id: string
  exam_label: string
  paper_form: string | null
  anchors: {
    pages: { p: number; w: number; h: number }[]
    form_pages: number
    total_pages: number
    items: AnchorItem[]
  }
  items: OverlayItem[]
}

const CIRCLED = ['', '①', '②', '③', '④', '⑤']

/** 이 브라우저에서 해시. 파일은 여기서 벗어나지 않는다. */
async function sha256Of(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

type Status =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'unknown'; exams: string[] }
  | { kind: 'ready'; payload: Payload }
  | { kind: 'error'; message: string }

export default function OverlayClient({
  catalog,
  initialExam,
  initialNo,
}: {
  catalog: { built: string; exams: string[] }
  /** 링크 모드에서 넘어온 겨냥 — 파일을 열면 그 문항을 바로 펼친다 */
  initialExam: string | null
  initialNo: number | null
}) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [page, setPage] = useState(1)
  const [openNo, setOpenNo] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  /** 렌더된 캔버스의 실제 표시 크기 — 상자를 %로 얹으려면 이것이 기준이다 */
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null)
  /** 근거 문장이 이 쪽에서 차지하는 자리. 비어 있으면 못 찾은 것이고, 그때는 안 칠한다. */
  const [quoteBoxes, setQuoteBoxes] = useState<HighlightBox[]>([])

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const docRef = useRef<{ getPage: (n: number) => Promise<unknown>; destroy?: () => Promise<void> } | null>(null)
  /** 렌더는 겹치면 캔버스가 찢어진다 — 마지막 요청만 살린다 */
  const renderSeq = useRef(0)
  /** 근거 자리를 이미 센 문항. 쪽을 넘나들며 같은 문항을 다시 세지 않는다. */
  const locatedFor = useRef<string | null>(null)

  const payload = status.kind === 'ready' ? status.payload : null
  const formPages = payload?.anchors.form_pages ?? 0

  const itemsByNo = useMemo(() => {
    const m = new Map<number, OverlayItem>()
    for (const it of payload?.items ?? []) m.set(it.no, it)
    return m
  }, [payload])

  const anchorsOnPage = useMemo(
    () => (payload?.anchors.items ?? []).filter((a) => a.p === page),
    [payload, page],
  )
  const pageBox = useMemo(
    () => payload?.anchors.pages.find((p) => p.p === page) ?? null,
    [payload, page],
  )

  const open = openNo == null ? null : (itemsByNo.get(openNo) ?? null)
  const openAnchor = openNo == null ? null : (anchorsOnPage.find((a) => a.no === openNo) ?? null)

  const reset = useCallback(async () => {
    renderSeq.current += 1
    if (docRef.current?.destroy) await docRef.current.destroy().catch(() => {})
    docRef.current = null
    setCanvasSize(null)
    setPage(1)
    setOpenNo(null)
  }, [])

  const accept = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return
      if (file.type && file.type !== 'application/pdf') {
        setStatus({ kind: 'error', message: 'PDF 파일만 열 수 있어요.' })
        return
      }
      await reset()
      setStatus({ kind: 'reading' })
      try {
        const hash = await sha256Of(file)
        const res = await fetch('/api/csat/overlay', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sha256: hash }),
        })
        const json = await res.json()
        if (!json?.ok) {
          setStatus({ kind: 'error', message: json?.error ?? '분석을 불러오지 못했어요.' })
          return
        }
        // **파일을 떨어뜨렸다** — 이 화면의 값어치 전체가 딛고 선 전제인데 지금까지 한 번도
        // 확인된 적이 없었다(파일이 서버로 안 오는 것이 설계의 요점이라 어떤 표에도 흔적이 없다).
        track({ name: 'csat_overlay_loaded', props: { known: json.known === true } })
        if (!json.known) {
          setStatus({ kind: 'unknown', exams: json.exams ?? [] })
          return
        }

        // PDF.js 는 클라이언트에서만 부른다. 워커는 번들러가 자산으로 뽑아 준다 —
        // CDN 을 가리키면 오프라인·사내망에서 조용히 멈춘다.
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString()
        const data = new Uint8Array(await file.arrayBuffer())
        const doc = await pdfjs.getDocument({ data }).promise
        docRef.current = doc as unknown as typeof docRef.current
        const loaded = json as Payload
        // 링크 모드에서 온 겨냥이 이 회차의 것이면 그 문항을 바로 펼친다 —
        // 30번을 보려고 왔는데 1쪽부터 다시 찾게 하면 두 번 일하는 것이다.
        if (initialExam && initialExam === loaded.exam_id && initialNo) {
          const aim = loaded.anchors.items.find((a) => a.no === initialNo)
          if (aim) {
            setPage(aim.p)
            setOpenNo(initialNo)
          }
        }
        setStatus({ kind: 'ready', payload: loaded })
      } catch (e) {
        setStatus({ kind: 'error', message: e instanceof Error ? e.message : '파일을 열지 못했어요.' })
      }
    },
    [reset, initialExam, initialNo],
  )

  // 쪽을 그린다. 표시 폭에 맞춰 배율을 잡고, 실제 캔버스 크기를 상자 기준으로 남긴다.
  useEffect(() => {
    if (!payload || !canvasRef.current || !docRef.current) return
    const seq = (renderSeq.current += 1)
    const canvas = canvasRef.current
    let cancelled = false

    ;(async () => {
      try {
        const pdfPage = (await docRef.current!.getPage(page)) as {
          getViewport: (o: { scale: number }) => { width: number; height: number }
          render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> }
        }
        if (cancelled || seq !== renderSeq.current) return

        const parentWidth = canvas.parentElement?.clientWidth ?? 800
        const base = pdfPage.getViewport({ scale: 1 })
        // 화면 폭에 맞춘다. 2단 조판이라 너무 작으면 글자가 안 읽히므로 최소 배율을 둔다.
        const scale = Math.max(0.55, Math.min(2, parentWidth / base.width))
        const vp = pdfPage.getViewport({ scale: scale * (window.devicePixelRatio || 1) })
        const css = pdfPage.getViewport({ scale })

        canvas.width = Math.floor(vp.width)
        canvas.height = Math.floor(vp.height)
        canvas.style.width = `${Math.floor(css.width)}px`
        canvas.style.height = `${Math.floor(css.height)}px`

        const ctx = canvas.getContext('2d')
        if (!ctx) return
        await pdfPage.render({ canvasContext: ctx, viewport: vp }).promise
        if (cancelled || seq !== renderSeq.current) return
        setCanvasSize({ w: Math.floor(css.width), h: Math.floor(css.height) })
      } catch {
        if (!cancelled) setStatus({ kind: 'error', message: '이 쪽을 그리지 못했어요.' })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [payload, page])

  /**
   * **근거 문장이 이 쪽의 어디에 있는가** — 학습자의 PDF 에서 직접 찾는다.
   *
   * 좌표는 우리가 가질 수 없다(문제지는 우리 것이 아니다). 대신 인용문(우리 저작물)을
   * PDF.js 텍스트 레이어에 대고 찾으면 브라우저가 스스로 자리를 안다. 계산은 순수 모듈
   * `lib/csat/pdf-text-locate.ts` 가 하고 여기서는 부르기만 한다(그래야 검사할 수 있다).
   *
   * 못 찾으면 **아무것도 안 칠한다** — 틀린 자리를 자신 있게 칠하는 것이 더 나쁘다.
   */
  useEffect(() => {
    setQuoteBoxes([])
    const quote = open?.answer_quote
    if (!docRef.current || !quote) return
    let cancelled = false
    ;(async () => {
      try {
        const p = (await docRef.current!.getPage(page)) as {
          getTextContent?: () => Promise<{ items: unknown[] }>
        }
        if (cancelled || !p.getTextContent) return
        const content = await p.getTextContent()
        if (cancelled) return
        const items = (content.items as PdfTextItem[]).filter(
          (t) => typeof t?.str === 'string' && Array.isArray(t?.transform),
        )
        const boxes = locateQuote(items, quote)
        setQuoteBoxes(boxes)
        // 문항 하나에 **한 번만** 센다 — 쪽을 넘나들며 같은 문항을 다시 그려도 세지 않는다.
        // 이 수가 우리가 PDF 텍스트 매칭의 성패를 아는 **유일한 길**이다(좌표는 우리에게 없다).
        if (open && locatedFor.current !== open.item_id) {
          locatedFor.current = open.item_id
          track({ name: 'csat_overlay_located', props: { found: boxes.length > 0 } })
        }
      } catch {
        // 텍스트 레이어가 없는 문제지(스캔본)도 있다. 그 경우 조용히 안 칠한다 —
        // 이 기능이 없어도 나머지 상자는 그대로 쓸모 있다.
        if (!cancelled) setQuoteBoxes([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [page, open?.answer_quote, payload])

  /** PDF 좌표(왼아래 원점) → 캔버스 위 % 위치. 배율이 바뀌어도 %는 그대로다. */
  const pct = useCallback(
    (b: AnchorBox) => {
      if (!pageBox) return null
      return {
        left: `${(b.x / pageBox.w) * 100}%`,
        // PDF 의 y 는 **아래에서** 재고 화면은 위에서 잰다. 상자 높이만큼 더 올려야 글자를 덮는다.
        top: `${((pageBox.h - b.y - b.h) / pageBox.h) * 100}%`,
        width: `${(b.w / pageBox.w) * 100}%`,
        height: `${(b.h / pageBox.h) * 100}%`,
      }
    },
    [pageBox],
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section>
        {/* ── 떨어뜨리는 자리 ─────────────────────────────────────── */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            void accept(e.dataTransfer?.files?.[0])
          }}
          className={`rounded-[var(--r-md)] border border-dashed p-4 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] motion-reduce:transition-none ${
            dragging ? 'border-[var(--p)] bg-[var(--bg3)]' : 'border-[var(--bd)] bg-[var(--bg)]'
          }`}
        >
          <div className="flex flex-wrap items-center gap-3">
            {/* placeholder 가 아니라 실제 레이블을 둔다 */}
            <label
              htmlFor="csat-pdf"
              className="inline-flex min-h-[44px] cursor-pointer items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg3)] px-4 text-sm text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--p)] active:bg-[var(--bd)] motion-reduce:transition-none"
            >
              문제지 PDF 고르기
            </label>
            <input
              id="csat-pdf"
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(e) => void accept(e.target.files?.[0])}
            />
            <p className="text-xs leading-relaxed text-[var(--t3)]">
              끌어다 놓아도 돼요. <strong className="text-[var(--t2)]">파일은 이 브라우저에서만 열립니다</strong> —
              서버로 가는 것은 파일을 알아보는 지문(해시) 64자뿐이에요.
            </p>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-[var(--t3)]">
            원본은{' '}
            <a
              href="https://www.suneung.re.kr/boardCnts/list.do?boardID=1500234&m=0403&s=suneung"
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-dotted underline-offset-2 hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
            >
              한국교육과정평가원 기출문제
            </a>
            에서 받으실 수 있어요. 좌표가 준비된 회차 {catalog.exams.length}개.
          </p>
        </div>

        {/* ── 상태 ─────────────────────────────────────────────────── */}
        {status.kind === 'reading' ? (
          <p className="mt-4 text-sm text-[var(--t2)]">문제지를 열고 있어요…</p>
        ) : null}

        {status.kind === 'error' ? (
          <p className="mt-4 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4 text-sm text-[var(--t2)]">
            {status.message}
          </p>
        ) : null}

        {status.kind === 'unknown' ? (
          // 막다른 화면을 두지 않는다 — 다음 한 걸음을 함께 적는다
          <div className="mt-4 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
            <p className="text-sm leading-relaxed text-[var(--t2)]">
              이 파일은 아직 좌표가 없는 회차예요. 영어 영역 <strong>문제지</strong>인지(정답표·듣기 대본이
              아닌지) 확인해 주세요.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--t3)]">
              준비된 회차: {status.exams.join(' · ')}
            </p>
          </div>
        ) : null}

        {/* ── 문제지 + 오버레이 ───────────────────────────────────── */}
        {payload ? (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--t2)]">
                <strong className="text-[var(--t1)]">{payload.exam_label}</strong>
                {payload.paper_form ? (
                  <span className="ml-2 rounded bg-[var(--bg3)] px-1.5 py-0.5 text-[11px] text-[var(--t3)]">
                    {payload.paper_form === '단일' ? '형 구분 없음' : `${payload.paper_form}형 기준`}
                  </span>
                ) : null}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="min-h-[44px] min-w-[44px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 text-sm text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-[var(--bd)] disabled:cursor-not-allowed disabled:text-[var(--t3)] disabled:hover:border-[var(--bd)] motion-reduce:transition-none"
                >
                  ← 앞
                </button>
                <span className="tabular-nums text-xs text-[var(--t3)]">
                  {page} / {formPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(formPages, p + 1))}
                  disabled={page >= formPages}
                  className="min-h-[44px] min-w-[44px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 text-sm text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-[var(--bd)] disabled:cursor-not-allowed disabled:text-[var(--t3)] disabled:hover:border-[var(--bd)] motion-reduce:transition-none"
                >
                  뒤 →
                </button>
              </div>
            </div>

            {payload.anchors.total_pages > formPages ? (
              <p className="mt-2 text-xs leading-relaxed text-[var(--t3)]">
                이 문제지에는 두 형이 이어 붙어 있어요. 분석은 {payload.paper_form ?? '한'}형 기준이라 앞{' '}
                {formPages}쪽만 보여 드려요 — 선지 순서가 형마다 달라서요.
              </p>
            ) : null}

            <div className="relative mt-3 overflow-x-auto">
              <div className="relative inline-block">
                <canvas ref={canvasRef} className="block max-w-full rounded-[var(--r-md)] border border-[var(--bd)]" />
                {canvasSize && pageBox ? (
                  <div
                    className="pointer-events-none absolute left-0 top-0"
                    style={{ width: canvasSize.w, height: canvasSize.h }}
                  >
                    {anchorsOnPage.map((a) => {
                      const box = pct(a)
                      if (!box) return null
                      const meta = itemsByNo.get(a.no)
                      const isOpen = openNo === a.no
                      // 듣기 문항은 분석 사정권이 아니다 — 상자를 두지 않는다(누를 것이 없다)
                      if (!meta) return null
                      return (
                        <button
                          key={a.no}
                          type="button"
                          onClick={() => setOpenNo(isOpen ? null : a.no)}
                          aria-pressed={isOpen}
                          aria-label={`${a.no}번 ${meta.type_name ?? ''} 해설 ${isOpen ? '닫기' : '열기'}`}
                          className={`pointer-events-auto absolute -m-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--r-md)] border-2 text-[10px] font-bold tabular-nums transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none ${
                            isOpen
                              ? 'border-[var(--p)] bg-[var(--p)]/12 text-[var(--p)]'
                              : meta.ready
                                ? 'border-[var(--p)]/35 bg-transparent text-transparent hover:border-[var(--p)] hover:bg-[var(--p)]/8 hover:text-[var(--p)]'
                                : 'border-[var(--bd)] bg-transparent text-transparent hover:border-[var(--t3)] hover:text-[var(--t3)]'
                          }`}
                          style={{ left: box.left, top: box.top }}
                        >
                          {a.no}
                        </button>
                      )
                    })}

                    {/* **근거 문장을 학습자의 종이 위에 칠한다.**
                        이전에는 이 문장이 옆 패널에 글자로만 떴고, 학습자는 종이에서 눈으로
                        찾아야 했다 — 이 기능이 없애려던 바로 그 일이다. 좌표는 우리에게 없지만
                        학습자의 브라우저에는 있다(PDF.js 텍스트 레이어). 나가는 것은 여전히
                        해시 64자뿐이다. */}
                    {quoteBoxes.map((b, i) => {
                      // `pct` 는 앵커 상자를 받으므로 쪽 번호를 붙여 준다 — 이 상자들은
                      // 지금 그리는 쪽에서 방금 찾은 것이라 언제나 `page` 다.
                      const box = pct({ ...b, p: page })
                      if (!box) return null
                      return (
                        <span
                          key={`q${i}`}
                          // 밑줄로 그린다 — 글자를 덮으면 읽을 수 없다. 색 말고도 «밑줄» 이라는
                          // 모양으로 말한다(색맹 대응).
                          className="absolute border-b-[3px] border-[var(--success)]"
                          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
                        />
                      )
                    })}

                    {/* 펼친 문항의 선지 자리 — 오답 분석이 가리키는 곳을 실제로 보여 준다 */}
                    {openAnchor?.marks.map((m) => {
                      const box = pct(m)
                      if (!box) return null
                      const ca = open?.choice_analysis.find((c) => c.n === m.n)
                      const correct = open?.answer === m.n
                      return (
                        <span
                          key={m.n}
                          title={correct ? '정답' : (ca?.trap ?? '')}
                          // 색만으로 말하지 않는다 — 정답은 실선, 오답은 파선으로 모양도 다르다
                          // (색맹 대응: CLAUDE.md 「색상만으로 정보 전달」 금지).
                          className={`absolute rounded-sm border-2 ${
                            correct ? 'border-solid border-[var(--success)]' : 'border-dashed border-[var(--warning)]'
                          }`}
                          style={{
                            left: box.left,
                            top: box.top,
                            width: box.width,
                            height: box.height,
                          }}
                        />
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-[var(--t3)]">
              문항 번호 자리를 누르면 해설이 열려요. 분석이 준비된 문항은 테두리가 진해요.
            </p>
          </>
        ) : null}
      </section>

      {/* ── 옆 패널: 우리가 쓴 것만 ───────────────────────────────── */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        {!open ? (
          <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
            <h2 className="font-display text-sm font-bold text-[var(--t1)]">해설</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--t2)]">
              {payload
                ? '문제지에서 문항 번호를 누르면 여기에 「답이 왜 이것인가」가 열려요.'
                : '문제지를 열면 문항마다 해설을 붙여 드려요.'}
            </p>
          </div>
        ) : (
          <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-display text-base font-bold text-[var(--t1)]">
                {open.no}번
                {open.type_name ? <span className="ml-2 text-xs font-normal text-[var(--t3)]">{open.type_name}</span> : null}
              </h2>
              <button
                type="button"
                onClick={() => setOpenNo(null)}
                className="-m-2 min-h-[44px] min-w-[44px] rounded-[var(--r-md)] p-2 text-sm text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
                aria-label="해설 닫기"
              >
                닫기
              </button>
            </div>

            <p className="mt-1 text-xs text-[var(--t3)]">
              {open.points ? `${open.points}점` : ''}
              {open.time_budget_sec ? ` · 권장 ${open.time_budget_sec}초` : ''}
            </p>

            {!open.ready ? (
              <p className="mt-3 text-sm leading-relaxed text-[var(--t2)]">
                이 문항은 분석 준비 중이에요.
              </p>
            ) : (
              <>
                {open.answer ? (
                  <p className="mt-3 text-sm text-[var(--t1)]">
                    답 <strong className="text-base">{CIRCLED[open.answer]}</strong>
                  </p>
                ) : null}

                {open.answer_quote ? (
                  <blockquote className="mt-2 border-l-2 border-[var(--p)] pl-3 text-sm leading-relaxed text-[var(--t2)]">
                    {open.answer_quote}
                  </blockquote>
                ) : null}

                {open.design_intent ? (
                  <p className="mt-3 text-sm leading-relaxed text-[var(--t2)]">{open.design_intent}</p>
                ) : null}

                {open.choice_analysis.length ? (
                  <ul className="mt-3 space-y-2">
                    {open.choice_analysis
                      .slice()
                      .sort((a, b) => a.n - b.n)
                      .map((c) => (
                        <li key={c.n} className="text-sm leading-relaxed text-[var(--t2)]">
                          <span className="font-bold text-[var(--t1)]">{CIRCLED[c.n] ?? c.n}</span>{' '}
                          {c.n === open.answer ? (c.why_correct ?? '') : (c.how_to_reject ?? c.trap ?? '')}
                        </li>
                      ))}
                  </ul>
                ) : null}

                {open.solve_procedure.length ? (
                  <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-[var(--t2)]">
                    {open.solve_procedure.map((s, i) => (
                      <li key={i}>{s.step}</li>
                    ))}
                  </ol>
                ) : null}

                <a
                  href={`/csat/item/${open.slug}`}
                  className="mt-4 inline-flex min-h-[44px] items-center text-sm text-[var(--t2)] underline decoration-dotted underline-offset-2 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
                >
                  이 문항 해설 전문 보기 →
                </a>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
