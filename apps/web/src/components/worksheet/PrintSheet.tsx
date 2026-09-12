// apps/web/src/components/worksheet/PrintSheet.tsx
//
// **인쇄 학습지의 단일 출처** — 두 자리에서 같은 종이가 나온다.
//
//   · `/fit`            비로그인 교사가 지문 하나로 만든다 (QR → vocaflow.app/fit)
//   · `/text/new` 추출  학급이 있는 교사가 만든다        (QR → 학급 초대 링크)
//
// 두 종이를 각자 짓지 않는 이유는 이 저장소가 이미 여러 번 겪은 것이다 —
// 이름·경로·수치·목록·카드 쿼리·만화 제목이 갈렸다. 종이는 갈라지면 더 티가 난다:
// 한쪽만 교육과정 표시가 있거나, 한쪽만 이름 칸이 없는 유인물이 같은 교무실에 돈다.
//
// ⚠️ **`document.body` 직속으로 portal 한다.** 결과 화면 안에 두면 인쇄할 때 나머지를
//    접을 방법이 없다 — `display:none` 은 조상과 함께 학습지까지 지우고, `visibility` 는
//    잉크만 지우고 **높이를 남겨 빈 장을 만든다**(실측: 1장짜리가 4쪽).
//    body 직속이면 `body > *:not(.vf-sheet)` 한 줄로 높이까지 접힌다.
//
// ⚠️ 색을 쓰지 않는다. 학교 인쇄기는 대부분 흑백이고, 회색조로 떨어진 옅은 색은
//    글자를 읽기 어렵게 만든다.

'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { printSizeMm, qrSvg } from '@/lib/worksheet/qr'

/** 한 장에 올릴 낱말 상한 — A4 한 면에 24줄이 넘으면 글자가 작아져 못 읽는다. */
export const MAX_SHEET_ROWS = 24

export type SheetMode = 'list' | 'quiz' | 'both'

export interface SheetRow {
  word: string
  meaning: string | null
  /** 교육과정 표시 등 짧은 기호. 빈 문자열이면 칸만 비워 둔다. */
  mark?: string
}

export interface SheetQr {
  url: string
  /** QR 옆 한 줄 — **무엇을 위한 코드인지** 말해야 학생이 찍는다. */
  caption: string
}

export interface PrintSheetProps {
  /** 머리 왼쪽 — 이 종이가 무엇인지. */
  heading: { list: string; quiz: string }
  /** 머리 아래 한 줄 — 기준·낱말 수 등. */
  meta: string
  rows: SheetRow[]
  mode: SheetMode
  /** 발 왼쪽 — 표시 기호의 뜻. 없으면 생략한다. */
  legend?: string
  qr?: SheetQr | null
  /** 표시 칸을 쓰는가. 안 쓰면 뜻 칸이 넓어진다. */
  showMarkColumn?: boolean
}

export function PrintSheet({
  heading,
  meta,
  rows,
  mode,
  legend,
  qr,
  showMarkColumn = true,
}: PrintSheetProps) {
  // portal 은 DOM 이 있어야 한다 — 서버 렌더에서는 아무것도 그리지 않는다.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const capped = rows.slice(0, MAX_SHEET_ROWS)
  if (!mounted || capped.length === 0) return null

  const showList = mode === 'list' || mode === 'both'
  const showQuiz = mode === 'quiz' || mode === 'both'

  const page = (answers: boolean) => (
    <Page
      title={answers ? heading.list : heading.quiz}
      meta={meta}
      rows={capped}
      answers={answers}
      legend={legend}
      qr={qr ?? null}
      showMarkColumn={showMarkColumn}
    />
  )

  return createPortal(
    // 화면에서는 `hidden`, 인쇄에서만 `.vf-sheet` 규칙이 켠다.
    <div className="vf-sheet hidden" aria-hidden>
      {showList && page(true)}
      {showQuiz && (
        <div className={showList ? 'vf-page-break' : undefined}>{page(false)}</div>
      )}
    </div>,
    document.body,
  )
}

function Page({
  title,
  meta,
  rows,
  answers,
  legend,
  qr,
  showMarkColumn,
}: {
  title: string
  meta: string
  rows: SheetRow[]
  /** 뜻을 인쇄하는가. `false` 면 빈칸지다. */
  answers: boolean
  legend?: string
  qr: SheetQr | null
  showMarkColumn: boolean
}) {
  const code = qr ? qrSvg(qr.url) : null
  const mm = code ? printSizeMm(code.modules) : 0

  return (
    <section style={{ fontFamily: 'serif', color: '#000' }}>
      {/* 머리 — 학년·반·이름 자리는 한국 유인물의 관례다. 없으면 교사가 손으로 그린다. */}
      <header style={{ borderBottom: '2px solid #000', paddingBottom: 6, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h1>
          <span style={{ fontSize: 10.5 }}>학년 ____ 반 ____ 이름 ____________</span>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 10.5 }}>{meta}</p>
      </header>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <Th width="8%">번호</Th>
            <Th width={showMarkColumn ? '30%' : '34%'}>단어</Th>
            <Th width={showMarkColumn ? '52%' : '58%'}>뜻</Th>
            {showMarkColumn && <Th width="10%">교육과정</Th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.word}-${i}`}>
              <Td align="center">{i + 1}</Td>
              <Td>
                <span style={{ fontWeight: 700 }}>{r.word}</span>
              </Td>
              {/*
                빈칸지에서는 뜻 칸을 비운다. 밑줄을 따로 긋지 않는다 —
                칸 테두리가 이미 쓸 자리를 만들고, 밑줄까지 넣으면 줄이 겹쳐 지저분해진다.
              */}
              <Td>{answers ? (r.meaning ?? '') : ''}</Td>
              {showMarkColumn && <Td align="center">{r.mark ?? ''}</Td>}
            </tr>
          ))}
        </tbody>
      </table>

      {/*
        꼬리 — 근거와 돌아오는 길.
        QR 은 오른쪽에 둔다: 종이를 접어도 잘 남는 자리이고, 표와 겹치지 않는다.
      */}
      <footer
        style={{
          marginTop: 10,
          borderTop: '1px solid #000',
          paddingTop: 6,
          fontSize: 9,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          {legend && <p style={{ margin: 0 }}>{legend}</p>}
          <p style={{ margin: legend ? '3px 0 0' : 0 }}>
            {qr ? qr.url.replace(/^https?:\/\//, '') : 'vocaflow.app/fit'}
          </p>
        </div>
        {code && (
          <div style={{ textAlign: 'center', width: `${mm}mm` }}>
            {/*
              SVG 로 넣는다 — 비트맵은 화면 해상도로 굳어 인쇄에서 모듈 경계가 뭉갠다.
              QR 은 그 경계가 전부다. 흰 여백(quiet zone)은 여기서 준다.
            */}
            <div
              style={{ width: `${mm}mm`, height: `${mm}mm`, background: '#fff', padding: '1.5mm' }}
              dangerouslySetInnerHTML={{
                __html: code.markup.replace('<svg', '<svg width="100%" height="100%"'),
              }}
            />
            <p style={{ margin: '2px 0 0', fontSize: 7.5, lineHeight: 1.3 }}>{qr?.caption}</p>
          </div>
        )}
      </footer>
    </section>
  )
}

function Th({ children, width }: { children: React.ReactNode; width: string }) {
  return (
    <th
      style={{
        width,
        border: '1px solid #000',
        padding: '4px 6px',
        fontSize: 10.5,
        fontWeight: 700,
        textAlign: 'left',
      }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'center'
}) {
  return (
    <td
      style={{
        border: '1px solid #000',
        padding: '5px 6px',
        textAlign: align,
        // 빈칸지에서 손글씨가 들어갈 높이 — 12pt 글자 기준 한 줄 반.
        height: 22,
      }}
    >
      {children}
    </td>
  )
}
