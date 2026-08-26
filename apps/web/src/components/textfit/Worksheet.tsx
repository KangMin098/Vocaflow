// apps/web/src/components/textfit/Worksheet.tsx
//
// **인쇄용 학습지** — 이 제품이 교사에게 내놓는 첫 실물.
//
// ── 왜 종이인가 ─────────────────────────────────────────────────────
// 교사의 수업 준비는 화면에서 끝나지 않는다. 유인물·쪽지시험이 교무실과 교실에 남고,
// 옆자리 선생님이 그것을 집어 든다 — CAC 0 채널에서 브랜드가 실제로 옮겨 다니는 경로다.
// 2026-08-26 실측: 이 저장소에 인쇄 규칙이 **하나도 없었다**(`@media print` 0개).
// 결과 화면이 주는 것은 정보였고, 교사가 가져갈 **산출물**은 없었다.
//
// ── 무엇을 싣고 무엇을 안 싣나 ──────────────────────────────────────
// **지문은 싣지 않는다.** `/fit` 은 붙여넣은 글을 저장하지 않고(그것이 이 화면의 약속이다),
// 교과서·문제집 지문은 남의 저작물이다. 낱말과 뜻만 옮긴다 — 그것이 교사가 만들려던 것이다.
//
// ── 두 장인 이유 ────────────────────────────────────────────────────
// 어휘 목록은 **나눠 주는 것**이고 빈칸지는 **걷는 것**이다. 교사는 대개 둘 다 만든다.
// 그래서 한 번의 인쇄로 둘이 나오게 하되(`both`), 하나만 필요할 때를 위해 고를 수 있게 한다.
//
// ⚠️ 화면에서는 보이지 않는다. 인쇄에서만 켜진다(`globals.css` 의 `.vf-sheet`).
//    미리보기를 화면에 겹쳐 그리면 결과 화면이 두 배로 길어지고, 그건 Calm UI 가 아니다.
//
// ⚠️ **`document.body` 직속으로 portal 한다.** 결과 화면 안에 두면 인쇄할 때 나머지를
//    접을 방법이 없다 — `display:none` 은 조상과 함께 학습지까지 지우고,
//    `visibility` 는 잉크만 지우고 **높이를 남겨 빈 장을 만든다**(실측: 1장짜리가 4쪽).
//    body 직속이면 `body > *:not(.vf-sheet)` 한 줄로 높이까지 접힌다.

'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  CURRICULUM_BAND_MARK,
  type CurriculumBand,
} from '@/lib/textfit/curriculum'
import { LEVEL_LABEL, type LevelProfile, type ProfileLevel } from '@/lib/textfit/profile'

export type WorksheetMode = 'list' | 'quiz' | 'both'

/** 한 장에 올릴 낱말 상한 — A4 한 면에 24줄이 넘으면 글자가 작아져 못 읽는다. */
const MAX_ROWS = 24

interface Props {
  profile: LevelProfile
  mode: WorksheetMode
}

export function Worksheet({ profile, mode }: Props) {
  // portal 은 DOM 이 있어야 한다 — 서버 렌더에서는 아무것도 그리지 않는다.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const rows = profile.hardestWords.slice(0, MAX_ROWS)
  if (!mounted || rows.length === 0) return null

  const showList = mode === 'list' || mode === 'both'
  const showQuiz = mode === 'quiz' || mode === 'both'

  return createPortal(
    // 화면에서는 `hidden`, 인쇄에서만 `.vf-sheet` 규칙이 켠다.
    <div className="vf-sheet hidden" aria-hidden>
      {showList && <Page profile={profile} rows={rows} answers />}
      {showQuiz && (
        <div className={showList ? 'vf-page-break' : undefined}>
          <Page profile={profile} rows={rows} answers={false} />
        </div>
      )}
    </div>,
    document.body,
  )
}

function Page({
  profile,
  rows,
  answers,
}: {
  profile: LevelProfile
  rows: LevelProfile['hardestWords']
  /** 뜻을 인쇄하는가. `false` 면 빈칸지다. */
  answers: boolean
}) {
  const level = profile.fitLevel as ProfileLevel | null
  const c = profile.curriculum

  return (
    <section style={{ fontFamily: 'serif', color: '#000' }}>
      {/* 머리 — 학년·반·이름 자리는 한국 유인물의 관례다. 없으면 교사가 손으로 그린다. */}
      <header style={{ borderBottom: '2px solid #000', paddingBottom: 6, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            {answers ? '어휘 목록' : '어휘 확인'}
          </h1>
          <span style={{ fontSize: 10.5 }}>학년 ____ 반 ____ 이름 ____________</span>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 10.5 }}>
          {level ? `${LEVEL_LABEL[level]} 기준` : '난이도 판정 없음'}
          {profile.textVLevel != null && ` · 지문 어휘 V${profile.textVLevel}`}
          {` · 낱말 ${rows.length}개`}
          {c && ` · 교육과정 기본 어휘 밖 ${c.outside}개`}
        </p>
      </header>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <Th width="8%">번호</Th>
            <Th width="30%">단어</Th>
            <Th width="52%">뜻</Th>
            <Th width="10%">교육과정</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w, i) => (
            <tr key={w.lemma}>
              <Td align="center">{i + 1}</Td>
              <Td>
                <span style={{ fontWeight: 700 }}>{w.surface}</span>
              </Td>
              {/*
                빈칸지에서는 뜻 칸을 비운다. 밑줄을 따로 긋지 않는다 —
                칸 테두리가 이미 쓸 자리를 만들고, 밑줄까지 넣으면 줄이 겹쳐 지저분해진다.
              */}
              <Td>{answers ? (w.meaningKo ?? '') : ''}</Td>
              <Td align="center">{bandMark(w.curriculumBand)}</Td>
            </tr>
          ))}
        </tbody>
      </table>

      {/*
        꼬리 — 근거와 출처. 교사가 학교에서 "이 기준이 뭐냐" 는 질문을 받았을 때 이 줄이 답이다.
        주소를 함께 적는 이유는 홍보가 아니라 **이 종이를 집어 든 다음 사람**을 위해서다.
      */}
      <footer style={{ marginTop: 10, borderTop: '1px solid #000', paddingTop: 5, fontSize: 9 }}>
        <p style={{ margin: 0 }}>
          교육과정 표시 — <b>*</b> 초등 권장 · <b>**</b> 중·고 공통 · <b>·</b> 그 외 과목 ·
          빈칸은 기본 어휘 목록 밖 (교육부 고시 제2022-33호 [별책 14])
        </p>
        <p style={{ margin: '3px 0 0' }}>vocaflow.app/fit — 지문을 붙여넣으면 이 표가 만들어져요</p>
      </footer>
    </section>
  )
}

/** 밴드 표시 — 색을 쓸 수 없는 지면이라 기호로만 구분한다. */
function bandMark(band: CurriculumBand | null | undefined): string {
  if (band === undefined) return ''
  if (band === null) return ''
  return CURRICULUM_BAND_MARK[band] || '·'
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
