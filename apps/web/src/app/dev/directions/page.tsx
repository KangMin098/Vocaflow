// apps/web/src/app/dev/directions/page.tsx
//
// 디자인 방향 3안 비교 — **같은 화면·같은 내용·같은 폭**으로만 비교한다.
//
// 왜 한 페이지인가: 시안을 따로 찍으면 폭·데이터·시각이 달라지고, 그 차이가 디자인 차이로
// 오해된다. 세 안을 나란히 두면 다른 것은 **디자인뿐**이다.
//
// 대상 화면은 `/hub`(Today) — 학습자가 가장 자주 보는 진입면이고, 단어·흐름·CTA·빈 상태가
// 한 화면에 다 있어서 방향의 차이가 가장 크게 드러난다.
//
// ⚠️ 이 화면은 개발 전용(`/dev/*`)이다. 학습자 라우트가 아니며 실데이터를 읽지 않는다 —
//    내용은 실제 `/hub` 에서 나오는 것과 같은 모양의 고정값이다(시안이므로).
//    방향이 확정되면 이 파일은 `docs/design/02-directions.md` 의 근거로만 남는다.

import type { Metadata } from 'next'

import { koDisplay, koText } from './fonts'

export const metadata: Metadata = { title: '디자인 방향 3안', robots: { index: false } }

// ══════════════════════════════════════════════════════════════
// 공통 내용 — 세 안이 정확히 같은 것을 그린다
// ══════════════════════════════════════════════════════════════
const DATE = '9월 16일 수요일'
const WORD = 'coherent'
const GLOSS = '일관된, 조리 있는'
const SENTENCE = 'She gave a coherent account of what had happened that night.'
const SOURCE = 'A Christmas Carol · 3장'
const BLOCKS = [
  { label: '읽기', hint: '30분', done: true },
  { label: '복습', hint: '12개', done: false, now: true },
  { label: '받아쓰기', hint: '1편', done: false },
  { label: '퀴즈', hint: '8문항', done: false },
  { label: '점검', hint: '2분', done: false },
]
const REST = [
  { w: 'sealing', state: 'risk' as const },
  { w: 'prudent', state: 'shaky' as const },
  { w: 'vex', state: 'shaky' as const },
  { w: 'ledger', state: 'stable' as const },
]
const MORE = 8
const STREAK = 6

const MEM = {
  stable: '#2E7D5A',
  shaky: '#B5803A',
  risk: '#9C3A30',
}

// ══════════════════════════════════════════════════════════════
// 방향 A — 활자 지면 (Editorial Page)
//   장치: 카드 0개 · 괘선과 섹션 번호 · 스케일 대비(본문의 4배 헤드라인) · 단색 잉크
//   정체성: 인쇄된 학습 일지. 상자가 아니라 판면이 구조를 만든다.
// ══════════════════════════════════════════════════════════════
function DirectionA() {
  const paper = '#FBFAF6'
  const ink = '#1A1714'
  const ink2 = 'rgba(26,23,20,.62)'
  const rule = '#DCD6C9'
  return (
    <Phone bg={paper} ink={ink}>
      <div style={{ padding: '22px 20px 0' }}>
        {/* 머리 — 로고가 아니라 판권면처럼 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            borderBottom: `2px solid ${ink}`,
            paddingBottom: 8,
          }}
        >
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, letterSpacing: '.02em', fontWeight: 600 }}>
            Vocaflow
          </span>
          <span style={{ fontSize: 11, color: ink2, letterSpacing: '.06em' }}>{DATE}</span>
        </div>

        {/* 01 오늘 */}
        <SectionRule n="01" title="오늘" rule={rule} ink2={ink2} />
        <h1
          style={{
            fontFamily: 'var(--font-ko-display)',
            fontSize: 30,
            lineHeight: 1.28,
            fontWeight: 600,
            letterSpacing: '-.01em',
            margin: '2px 0 0',
            wordBreak: 'keep-all',
          }}
        >
          되찾을 단어 <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}>12</span>개,
          <br />
          읽을 글 한 편.
        </h1>
        <p style={{ fontFamily: 'var(--font-ko-text)', fontSize: 13, color: ink2, marginTop: 10, lineHeight: 1.6 }}>
          어제까지 {STREAK}일 이어왔어요.
        </p>

        {/* 02 단어 — 지면의 주인공 */}
        <SectionRule n="02" title="첫 단어" rule={rule} ink2={ink2} />
        <div style={{ marginTop: 4 }}>
          <div
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 52,
              lineHeight: 1.02,
              fontWeight: 500,
              letterSpacing: '-.02em',
            }}
          >
            {WORD}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-ko-display)',
              fontSize: 19,
              fontWeight: 400,
              marginTop: 6,
              color: ink,
            }}
          >
            {GLOSS}
          </div>
          <p
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 14,
              lineHeight: 1.62,
              color: ink2,
              marginTop: 12,
              borderLeft: `2px solid ${rule}`,
              paddingLeft: 12,
            }}
          >
            {SENTENCE}
          </p>
          <div style={{ fontSize: 10.5, color: ink2, marginTop: 8, letterSpacing: '.04em' }}>{SOURCE}</div>
        </div>

        {/* 03 흐름 — 목록이 아니라 한 줄 조판 */}
        <SectionRule n="03" title="오늘의 흐름" rule={rule} ink2={ink2} />
        <ol style={{ listStyle: 'none', margin: '2px 0 0', padding: 0 }}>
          {BLOCKS.map((b, i) => (
            <li
              key={b.label}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                padding: '9px 0',
                borderBottom: i < BLOCKS.length - 1 ? `1px solid ${rule}` : 'none',
                opacity: b.done ? 0.45 : 1,
              }}
            >
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 11, color: ink2, width: 14 }}>
                {b.done ? '✓' : i + 1}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-ko-display)',
                  fontSize: 16,
                  fontWeight: b.now ? 600 : 400,
                  textDecoration: b.done ? 'line-through' : 'none',
                  flex: 1,
                }}
              >
                {b.label}
              </span>
              <span style={{ fontFamily: 'var(--font-ko-text)', fontSize: 11.5, color: ink2 }}>{b.hint}</span>
            </li>
          ))}
        </ol>

        {/* 단일 CTA — 버튼이 아니라 잉크 블록 */}
        <button
          style={{
            marginTop: 20,
            width: '100%',
            minHeight: 52,
            background: ink,
            color: paper,
            border: 'none',
            borderRadius: 2,
            fontFamily: 'var(--font-ko-display)',
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: '.01em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 18px',
          }}
        >
          <span>복습 시작</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 13, opacity: 0.7 }}>12 →</span>
        </button>

        {/* 04 뒤이어 */}
        <SectionRule n="04" title="뒤이어" rule={rule} ink2={ink2} />
        <p
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 15,
            lineHeight: 1.75,
            marginTop: 2,
            color: ink,
          }}
        >
          {REST.map((r, i) => (
            <span key={r.w}>
              <span style={{ borderBottom: `2px solid ${MEM[r.state]}`, paddingBottom: 1 }}>{r.w}</span>
              {i < REST.length - 1 ? ' · ' : ''}
            </span>
          ))}
          <span style={{ fontFamily: 'var(--font-ko-text)', fontSize: 12, color: ink2 }}> 외 {MORE}개</span>
        </p>
        <div style={{ height: 26 }} />
      </div>
      <TabBar variant="a" />
    </Phone>
  )
}

function SectionRule({ n, title, rule, ink2 }: { n: string; title: string; rule: string; ink2: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        marginTop: 26,
        paddingBottom: 6,
        borderBottom: `1px solid ${rule}`,
      }}
    >
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 11, color: ink2, letterSpacing: '.08em' }}>{n}</span>
      <span style={{ fontFamily: 'var(--font-ko-text)', fontSize: 11.5, color: ink2, letterSpacing: '.04em' }}>
        {title}
      </span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 방향 B — 주묵(朱墨) 판면 (Vermillion Annotation)
//   장치: 붉은 교정 잉크가 **면적으로** 존재한다 · 밑줄/권점이 상태를 말한다 ·
//         숫자에 형광 자국 · 카드 대신 여백과 표식
//   정체성: 선생이 붉은 붓으로 표시해 준 책장. 한국 학습 정서의 원형이다.
//   근거: Memory Decay 를 "칩" 이 아니라 "표식" 으로 옮긴다(vocaflow-design §C 렌즈 1·2)
// ══════════════════════════════════════════════════════════════
function DirectionB() {
  const paper = '#FBF8F2'
  const ink = '#17140F'
  const ink2 = 'rgba(23,20,15,.60)'
  const ju = '#C0392B' // 주묵 — 면적을 갖는 유일한 색
  const juSoft = 'rgba(192,57,43,.13)'
  return (
    <Phone bg={paper} ink={ink}>
      {/* 머리띠 — 붉은 잉크가 처음부터 면적으로 있다 */}
      <div
        style={{
          background: ju,
          color: '#FFF7F0',
          padding: '11px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 600, letterSpacing: '.03em' }}>
          Vocaflow
        </span>
        <span style={{ fontFamily: 'var(--font-ko-text)', fontSize: 11, opacity: 0.86 }}>
          {DATE} · {STREAK}일째
        </span>
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        {/* 오늘 — 숫자에 붓 자국 */}
        <h1
          style={{
            fontFamily: 'var(--font-ko-display)',
            fontSize: 27,
            lineHeight: 1.34,
            fontWeight: 500,
            margin: 0,
            wordBreak: 'keep-all',
          }}
        >
          오늘 되찾을 단어{' '}
          <span style={{ position: 'relative', display: 'inline-block' }}>
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: -3,
                right: -3,
                bottom: 2,
                height: '46%',
                background: juSoft,
                transform: 'skewX(-9deg)',
              }}
            />
            <span style={{ position: 'relative', fontFamily: 'var(--font-serif)', fontWeight: 600, color: ju }}>
              12
            </span>
          </span>
          개
        </h1>
        <p style={{ fontFamily: 'var(--font-ko-text)', fontSize: 13, color: ink2, marginTop: 8, lineHeight: 1.6 }}>
          읽을 글 한 편이 함께 놓여 있어요.
        </p>

        {/* 단어 — 권점(圈點)을 찍는다 */}
        <div style={{ marginTop: 22, paddingLeft: 14, borderLeft: `3px solid ${ju}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 44,
                lineHeight: 1.05,
                fontWeight: 500,
                letterSpacing: '-.02em',
              }}
            >
              {WORD}
            </span>
            <span
              aria-hidden
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                border: `2px solid ${ju}`,
                display: 'inline-block',
                marginBottom: 8,
              }}
            />
          </div>
          <div style={{ fontFamily: 'var(--font-ko-display)', fontSize: 18, marginTop: 4 }}>{GLOSS}</div>
          <p
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 14,
              lineHeight: 1.6,
              color: ink2,
              marginTop: 10,
            }}
          >
            She gave a{' '}
            <span style={{ color: ink, borderBottom: `2px solid ${ju}` }}>coherent</span> account of what had
            happened that night.
          </p>
          <div style={{ fontFamily: 'var(--font-ko-text)', fontSize: 10.5, color: ink2, marginTop: 7 }}>{SOURCE}</div>
        </div>

        {/* 흐름 — 체크가 아니라 붉은 사선(檢) */}
        <div
          style={{
            fontFamily: 'var(--font-ko-text)',
            fontSize: 11,
            color: ink2,
            marginTop: 26,
            letterSpacing: '.06em',
          }}
        >
          오늘의 흐름
        </div>
        <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column' }}>
          {BLOCKS.map((b) => (
            <li
              key={b.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '10px 0',
                borderBottom: '1px solid rgba(23,20,15,.09)',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 16,
                  height: 16,
                  flexShrink: 0,
                  borderRadius: 1,
                  border: b.done ? 'none' : `1.5px solid ${b.now ? ju : 'rgba(23,20,15,.22)'}`,
                  background: b.done ? ju : 'transparent',
                  color: '#FFF7F0',
                  fontSize: 11,
                  lineHeight: '14px',
                  textAlign: 'center',
                }}
              >
                {b.done ? '✓' : ''}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-ko-display)',
                  fontSize: 16,
                  fontWeight: b.now ? 600 : 400,
                  color: b.done ? ink2 : ink,
                  flex: 1,
                }}
              >
                {b.label}
              </span>
              {b.now && (
                <span
                  style={{
                    fontFamily: 'var(--font-ko-text)',
                    fontSize: 10.5,
                    color: ju,
                    border: `1px solid ${ju}`,
                    borderRadius: 1,
                    padding: '2px 6px',
                  }}
                >
                  지금
                </span>
              )}
              <span style={{ fontFamily: 'var(--font-ko-text)', fontSize: 11.5, color: ink2 }}>{b.hint}</span>
            </li>
          ))}
        </ol>

        <button
          style={{
            marginTop: 20,
            width: '100%',
            minHeight: 52,
            background: ju,
            color: '#FFF7F0',
            border: 'none',
            borderRadius: 3,
            fontFamily: 'var(--font-ko-display)',
            fontSize: 16,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 18px',
          }}
        >
          <span>복습 시작</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 13, opacity: 0.85 }}>12 →</span>
        </button>

        {/* 뒤이어 — 밑줄 두께가 곧 망각도 */}
        <div
          style={{
            fontFamily: 'var(--font-ko-text)',
            fontSize: 11,
            color: ink2,
            marginTop: 24,
            letterSpacing: '.06em',
          }}
        >
          뒤이어
        </div>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 16, lineHeight: 1.9, marginTop: 6 }}>
          {REST.map((r, i) => (
            <span key={r.w}>
              <span
                style={{
                  borderBottom: `${r.state === 'risk' ? 3 : r.state === 'shaky' ? 2 : 1}px solid ${MEM[r.state]}`,
                  paddingBottom: 1,
                }}
              >
                {r.w}
              </span>
              {i < REST.length - 1 ? '  ' : ''}
            </span>
          ))}
          <span style={{ fontFamily: 'var(--font-ko-text)', fontSize: 12, color: ink2 }}> 외 {MORE}개</span>
        </p>
        <div style={{ height: 26 }} />
      </div>
      <TabBar variant="b" />
    </Phone>
  )
}

// ══════════════════════════════════════════════════════════════
// 방향 C — 도구함 (Instrument)
//   장치: 라운드 거의 0 · 모노 라벨 · 격자 괘선 · 밀도 높은 표 · 상태는 작은 사각형
//   정체성: 잘 만든 계측기. 장식이 아니라 눈금이 위계를 만든다.
// ══════════════════════════════════════════════════════════════
function DirectionC() {
  const paper = '#F3F2EE'
  const panel = '#FCFCFA'
  const ink = '#14171A'
  const ink2 = 'rgba(20,23,26,.58)'
  const line = '#D9D8D2'
  const acc = '#0F2540'
  return (
    <Phone bg={paper} ink={ink}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 16px',
          borderBottom: `1px solid ${line}`,
          background: panel,
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em' }}>
          VOCAFLOW
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: ink2 }}>09.16 WED · D+{STREAK}</span>
      </div>

      <div style={{ padding: 16 }}>
        {/* 계기 3열 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', border: `1px solid ${line}`, background: panel }}>
          {[
            ['복습', '12'],
            ['읽기', '1'],
            ['퀴즈', '8'],
          ].map(([k, v], i) => (
            <div key={k} style={{ padding: '11px 10px', borderLeft: i ? `1px solid ${line}` : 'none' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: ink2, letterSpacing: '.1em' }}>
                {k.toUpperCase()}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 26,
                  fontWeight: 700,
                  lineHeight: 1.1,
                  marginTop: 3,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {v}
              </div>
            </div>
          ))}
        </div>

        {/* 단어 패널 */}
        <div style={{ border: `1px solid ${line}`, borderTop: 'none', background: panel, padding: '14px 12px' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9.5,
              color: ink2,
              letterSpacing: '.1em',
              marginBottom: 6,
            }}
          >
            NEXT ITEM
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 34, fontWeight: 500, letterSpacing: '-.02em' }}>
              {WORD}
            </span>
            <span aria-hidden style={{ width: 8, height: 8, background: MEM.risk, display: 'inline-block' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: ink2 }}>R 0.41</span>
          </div>
          <div style={{ fontFamily: 'var(--font-ko-text)', fontSize: 15, marginTop: 4 }}>{GLOSS}</div>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 13, lineHeight: 1.55, color: ink2, marginTop: 9 }}>
            {SENTENCE}
          </p>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: ink2, marginTop: 7 }}>{SOURCE}</div>
        </div>

        {/* 흐름 표 */}
        <div style={{ border: `1px solid ${line}`, borderTop: 'none', background: panel }}>
          {BLOCKS.map((b, i) => (
            <div
              key={b.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderTop: i ? `1px solid ${line}` : 'none',
                background: b.now ? 'rgba(15,37,64,.05)' : 'transparent',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  flexShrink: 0,
                  background: b.done ? acc : 'transparent',
                  border: `1.5px solid ${b.done ? acc : 'rgba(20,23,26,.3)'}`,
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-ko-text)',
                  fontSize: 14,
                  fontWeight: b.now ? 600 : 400,
                  color: b.done ? ink2 : ink,
                  flex: 1,
                }}
              >
                {b.label}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: ink2 }}>{b.hint}</span>
            </div>
          ))}
        </div>

        <button
          style={{
            marginTop: 14,
            width: '100%',
            minHeight: 48,
            background: acc,
            color: '#F3F2EE',
            border: 'none',
            borderRadius: 2,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '.1em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          START REVIEW · 12
        </button>

        {/* 뒤이어 — 표 */}
        <div style={{ marginTop: 16, border: `1px solid ${line}`, background: panel }}>
          {REST.map((r, i) => (
            <div
              key={r.w}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '7px 12px',
                borderTop: i ? `1px solid ${line}` : 'none',
              }}
            >
              <span aria-hidden style={{ width: 7, height: 7, background: MEM[r.state] }} />
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, flex: 1 }}>{r.w}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: ink2 }}>
                {r.state === 'risk' ? '0.41' : r.state === 'shaky' ? '0.78' : '0.96'}
              </span>
            </div>
          ))}
          <div
            style={{
              padding: '7px 12px',
              borderTop: `1px solid ${line}`,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: ink2,
            }}
          >
            +{MORE} MORE
          </div>
        </div>
        <div style={{ height: 22 }} />
      </div>
      <TabBar variant="c" />
    </Phone>
  )
}

// ══════════════════════════════════════════════════════════════
// 공통 껍데기
// ══════════════════════════════════════════════════════════════
function Phone({ bg, ink, children }: { bg: string; ink: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 390,
        minHeight: 844,
        background: bg,
        color: ink,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 18px 48px rgba(0,0,0,.14)',
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

const TABS = ['오늘', '서재', '금고', '성장']

function TabBar({ variant }: { variant: 'a' | 'b' | 'c' }) {
  const on = variant === 'b' ? '#C0392B' : variant === 'c' ? '#0F2540' : '#1A1714'
  const off = 'rgba(26,23,20,.44)'
  const border = variant === 'c' ? '#D9D8D2' : 'rgba(26,23,20,.12)'
  return (
    <nav
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4,1fr)',
        borderTop: `1px solid ${border}`,
        background: variant === 'c' ? '#FCFCFA' : 'transparent',
      }}
    >
      {TABS.map((t, i) => (
        <div
          key={t}
          style={{
            minHeight: 52,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            color: i === 0 ? on : off,
          }}
        >
          {variant === 'c' ? (
            <span aria-hidden style={{ width: 12, height: 2, background: i === 0 ? on : off }} />
          ) : (
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: variant === 'b' ? '50%' : 1,
                background: i === 0 ? on : 'transparent',
                border: i === 0 ? 'none' : `1px solid ${off}`,
              }}
            />
          )}
          <span
            style={{
              fontFamily: variant === 'c' ? 'var(--font-mono)' : 'var(--font-ko-text)',
              fontSize: variant === 'c' ? 9.5 : 11,
              fontWeight: i === 0 ? 600 : 400,
              letterSpacing: variant === 'c' ? '.08em' : 0,
            }}
          >
            {t}
          </span>
        </div>
      ))}
    </nav>
  )
}

function Column({
  id,
  name,
  tagline,
  children,
}: {
  id: string
  name: string
  tagline: string
  children: React.ReactNode
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <header style={{ maxWidth: 390 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '.12em',
            color: 'rgba(255,255,255,.5)',
          }}
        >
          {id}
        </div>
        <h2 style={{ fontFamily: 'var(--font-ko-display)', fontSize: 21, margin: '3px 0 4px', color: '#fff' }}>
          {name}
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-ko-text)',
            fontSize: 12.5,
            lineHeight: 1.6,
            color: 'rgba(255,255,255,.66)',
            margin: 0,
            wordBreak: 'keep-all',
          }}
        >
          {tagline}
        </p>
      </header>
      {children}
    </section>
  )
}

export default function DirectionsPage() {
  return (
    <div
      className={`${koDisplay.variable} ${koText.variable}`}
      style={{ background: '#17181A', minHeight: '100vh', padding: '36px 28px 56px' }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-ko-display)',
          fontSize: 26,
          color: '#fff',
          margin: '0 0 6px',
        }}
      >
        디자인 방향 3안 — 같은 화면(/hub), 같은 내용
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-ko-text)',
          fontSize: 13,
          color: 'rgba(255,255,255,.6)',
          margin: '0 0 30px',
          maxWidth: 760,
          lineHeight: 1.65,
          wordBreak: 'keep-all',
        }}
      >
        세 안 모두 한글 웹폰트(Hahmlet · IBM Plex Sans KR)를 켠 상태다. 지금 학습자 앱은 한글에
        웹폰트가 없어 OS 기본꼴로 나온다 — 그 차이도 함께 보인다.
      </p>
      <div style={{ display: 'flex', gap: 34, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Column
          id="A"
          name="활자 지면"
          tagline="상자를 없앤다. 괘선·섹션 번호·스케일 대비만으로 위계를 만든다. 인쇄된 학습 일지."
        >
          <DirectionA />
        </Column>
        <Column
          id="B"
          name="주묵(朱墨) 판면"
          tagline="붉은 교정 잉크가 면적으로 존재한다. 망각도가 밑줄 두께가 되고, 체크가 붉은 표식이 된다."
        >
          <DirectionB />
        </Column>
        <Column
          id="C"
          name="도구함"
          tagline="라운드 0, 모노 라벨, 격자 괘선. 장식 대신 눈금이 위계를 만드는 계측기."
        >
          <DirectionC />
        </Column>
      </div>
    </div>
  )
}
