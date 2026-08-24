// apps/web/src/components/game/CourseBoard.tsx
//
// 자료별 게임 코스 보드 — "이 자료로는 이 순서로 하세요" 를 한 장에 그린다.
//
// 왜 카드 격자 위에 따로 두는가:
//   스코프를 걸고 허브에 오면 19장이 평평하게 깔린다. 그건 "고를 거리 목록" 이지
//   **답** 이 아니다. 학습자가 자료를 들고 왔을 때 실제로 원하는 것은
//   "이 챕터로 뭘 하면 되는지" 한 줄이고, 그다음이 둘러보기다.
//   (Progressive Disclosure — 본질을 먼저, 깊이는 요청 시.)
//
// 이 컴포넌트는 계산하지 않는다. `resolveCourse` 가 준 결과만 그린다 —
// 무엇이 왜 뽑혔는지의 근거는 lib/game/sets.ts 의 헤더에 실측과 함께 있다.
//
// 서버 컴포넌트다('use client' 없음). 링크와 정적 마크업뿐이라 클라이언트로 내릴 이유가 없다.

import Link from 'next/link'
import type { CSSProperties } from 'react'

import { GAME_MARKS, gamePlayHref, type GameEntry, type GameSlug } from '@/lib/game/catalog'
import type { ResolvedCourse } from '@/lib/game/sets'

/** 코스 링크에 실을 스코프 — 허브 카드와 같은 인자를 쓴다. */
export interface CourseScope {
  set?: string
  text?: string
  book?: string
  chapter?: number | null
  from?: string
}

const ROLE_ORDINAL = ['①', '②', '③', '④'] as const

export default function CourseBoard({
  resolved,
  scope,
  resourceLabel,
}: {
  resolved: ResolvedCourse
  scope: CourseScope
  /** 자료명 — "《오즈의 마법사》 Chapter 3" 처럼 이미 조립된 문자열 */
  resourceLabel?: string
}) {
  const { course, stages, playable, extras, poolSize, unlockAt } = resolved

  // 한 단계도 서지 않으면 코스를 그리지 않는다. 빈 코스를 제목만 남기고 보여 주는 것은
  // "여기 뭔가 있는데 당신은 못 한다" 는 말이라, 격려가 아니라 벽이다.
  if (playable === 0) {
    return (
      <section className="crs" aria-labelledby="crs-title">
        <div className="crs-head">
          <p className="crs-eyebrow">Course</p>
          <h2 id="crs-title" className="crs-title">
            {course.name}
          </h2>
        </div>
        <p className="crs-empty">
          지금 이 자료에는 단어가 {poolSize}개예요.{' '}
          {unlockAt != null ? (
            <>
              <strong>{unlockAt - poolSize}개만 더</strong> 모으면 코스가 열립니다.
            </>
          ) : (
            <>단어를 조금 더 모으면 코스가 열립니다.</>
          )}{' '}
          그동안은 아래 실험들을 자유롭게 둘러보세요.
        </p>
      </section>
    )
  }

  return (
    <section className="crs" aria-labelledby="crs-title">
      <div className="crs-head">
        <p className="crs-eyebrow">Course · {playable}단계</p>
        <h2 id="crs-title" className="crs-title">
          {course.name}
        </h2>
        {resourceLabel && <p className="crs-res">{resourceLabel}</p>}
        <p className="crs-why">{course.rationale}</p>
      </div>

      <ol className="crs-steps">
        {stages.map((s, i) =>
          s.game ? (
            <li key={s.role} className="crs-step">
              <Link
                href={gamePlayHref(s.game.slug, { ...scope, chapter: scope.chapter ?? null })}
                className="crs-link"
                style={moodVars(s.game)}
              >
                <span className="crs-ord" aria-hidden="true">
                  {ROLE_ORDINAL[i]}
                </span>
                <span className="crs-mark" aria-hidden="true">
                  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    {GAME_MARKS[s.game.slug as GameSlug]}
                  </svg>
                </span>
                <span className="crs-body">
                  <span className="crs-role">{s.label}</span>
                  <span className="crs-name">{s.game.name}</span>
                  <span className="crs-tag">{s.game.tagline}</span>
                </span>
                <span className="crs-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ) : (
            <li key={s.role} className="crs-step crs-step--locked">
              <div className="crs-link crs-link--locked">
                <span className="crs-ord" aria-hidden="true">
                  {ROLE_ORDINAL[i]}
                </span>
                <span className="crs-body">
                  <span className="crs-role">{s.label}</span>
                  <span className="crs-name crs-name--muted">단어 {s.needs ?? 0}개가 더 있으면 열려요</span>
                  <span className="crs-tag">지금은 앞 단계만으로도 한 바퀴가 됩니다.</span>
                </span>
              </div>
            </li>
          ),
        )}
      </ol>

      {extras.length > 0 && (
        <div className="crs-extra">
          <span className="crs-extra-label">더 해 볼 것</span>
          <ul className="crs-extra-list">
            {extras.map((g) => (
              <li key={g.slug}>
                <Link
                  href={gamePlayHref(g.slug, { ...scope, chapter: scope.chapter ?? null })}
                  className="crs-chip"
                  style={moodVars(g)}
                >
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function moodVars(g: GameEntry): CSSProperties {
  return {
    ['--m-a']: g.mood.a,
    ['--m-b']: g.mood.b,
    ['--m-glow']: g.mood.glow,
    ['--m-accent']: g.mood.accent,
  } as CSSProperties
}

/**
 * 코스 보드 스타일 — 허브가 자기 `<style>` 안에 함께 싣는다.
 * 별도 style 태그를 두면 Game Lab 한 화면에 두 개가 생기고, 토큰 정의가 갈린다.
 */
export const COURSE_CSS = `
.crs{
  margin: 0 0 34px;
  padding: 22px 22px 20px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.10);
  background: linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.018));
  box-shadow: 0 18px 44px -30px rgba(0,0,0,.9);
}
.crs-head{ margin-bottom: 16px; }
.crs-eyebrow{
  margin:0 0 6px; font-size:11px; letter-spacing:.16em; text-transform:uppercase;
  color: rgba(255,255,255,.46);
}
.crs-title{ margin:0; font-size:21px; font-weight:640; letter-spacing:-.01em; color: rgba(255,255,255,.94); }
.crs-res{ margin:6px 0 0; font-size:13px; color: rgba(255,255,255,.62); }
.crs-why{ margin:9px 0 0; font-size:13px; line-height:1.66; color: rgba(255,255,255,.56); max-width:62ch; }
.crs-empty{ margin:0; font-size:13.5px; line-height:1.7; color: rgba(255,255,255,.6); max-width:62ch; }
.crs-empty strong{ color: rgba(255,255,255,.88); font-weight:600; }

.crs-steps{ list-style:none; margin:0; padding:0; display:grid; gap:9px; }
.crs-step{ margin:0; }
.crs-link{
  display:flex; align-items:center; gap:14px;
  padding:13px 15px; border-radius:13px; text-decoration:none;
  border:1px solid rgba(255,255,255,.09);
  background: linear-gradient(120deg, color-mix(in srgb, var(--m-a) 26%, transparent), rgba(255,255,255,.02));
  transition: transform var(--dur-normal,.18s) var(--ease,cubic-bezier(.2,.7,.3,1)),
              border-color var(--dur-normal,.18s) var(--ease,cubic-bezier(.2,.7,.3,1)),
              box-shadow var(--dur-normal,.18s) var(--ease,cubic-bezier(.2,.7,.3,1));
}
.crs-link:hover{ transform: translateY(-1px); border-color: color-mix(in srgb, var(--m-accent) 44%, transparent); box-shadow: 0 12px 30px -22px var(--m-glow); }
.crs-link:active{ transform: translateY(0); }
.crs-link:focus-visible{ outline:2px solid var(--m-accent); outline-offset:2px; }
.crs-link--locked{ opacity:.5; background: rgba(255,255,255,.02); }
.crs-ord{ flex:none; width:22px; font-size:14px; color: rgba(255,255,255,.5); text-align:center; }
.crs-mark{ flex:none; width:26px; height:26px; color: var(--m-accent); }
.crs-mark svg{ width:100%; height:100%; }
.crs-body{ flex:1 1 auto; min-width:0; display:grid; gap:2px; }
.crs-role{ font-size:10.5px; letter-spacing:.14em; text-transform:uppercase; color: rgba(255,255,255,.44); }
.crs-name{ font-size:15px; font-weight:600; color: rgba(255,255,255,.93); }
.crs-name--muted{ font-size:13.5px; font-weight:500; color: rgba(255,255,255,.66); }
.crs-tag{ font-size:12.5px; color: rgba(255,255,255,.55); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.crs-arrow{ flex:none; color: var(--m-accent); font-size:15px; }

.crs-extra{ margin-top:15px; padding-top:14px; border-top:1px solid rgba(255,255,255,.07); }
.crs-extra-label{ display:block; margin-bottom:8px; font-size:11px; letter-spacing:.14em; text-transform:uppercase; color: rgba(255,255,255,.4); }
.crs-extra-list{ list-style:none; margin:0; padding:0; display:flex; flex-wrap:wrap; gap:7px; }
.crs-chip{
  display:inline-flex; align-items:center; min-height:32px; padding:0 12px;
  border-radius:999px; text-decoration:none; font-size:12.5px;
  color: var(--m-accent); border:1px solid color-mix(in srgb, var(--m-accent) 30%, transparent);
  background: color-mix(in srgb, var(--m-a) 16%, transparent);
  transition: background var(--dur-normal,.18s) var(--ease,cubic-bezier(.2,.7,.3,1)),
              border-color var(--dur-normal,.18s) var(--ease,cubic-bezier(.2,.7,.3,1));
}
.crs-chip:hover{ background: color-mix(in srgb, var(--m-a) 30%, transparent); border-color: color-mix(in srgb, var(--m-accent) 52%, transparent); }
.crs-chip:focus-visible{ outline:2px solid var(--m-accent); outline-offset:2px; }

@media (max-width: 560px){
  .crs{ padding:18px 15px 16px; }
  .crs-tag{ display:none; }
}
`
