// apps/web/src/components/game/CourseLauncher.tsx
//
// 자료 화면(단어장 미리보기 · 도서 상세 · 스크립트)에 붙는 **코스 런처** —
// "이 자료로는 이 순서로" 를 세 칩으로 제시하고, 전체는 Game Lab 으로 넘긴다.
//
// 왜 게임 목록이 아니라 코스인가:
//   자료 화면에 19종을 나열하면 선택 과부하다(인지 부하 ~4항목). 그렇다고 "아케이드로 가기"
//   한 줄만 두면 학습자는 자료를 들고 19장 앞에 다시 서게 된다 — 결정을 미룬 것뿐이다.
//   코스는 **결정을 대신 내려 준 결과**를 3개로 보여주고, 원하면 전부 열람하게 한다.
//
// 풀 크기로 내려앉는 규칙과 근거는 lib/game/sets.ts 에 있다. 이 컴포넌트는 그리기만 한다.
// 순수 계산(resolveCourse)이라 클라이언트에서도 서버에서도 같은 결과가 나온다.

import Link from 'next/link'

import { gamePlayHref } from '@/lib/game/catalog'
import { resolveCourse, type ResourceKind } from '@/lib/game/sets'

export interface CourseLauncherScope {
  set?: string
  text?: string
  book?: string
  chapter?: number | null
  /** 게임에서 닫았을 때 돌아올 자리 */
  from: string
}

export default function CourseLauncher({
  kind,
  poolSize,
  scope,
  /** 헤딩 문구 — 자료 화면마다 자리가 달라 라벨을 밖에서 정한다. */
  heading = '이 자료로 할 코스',
  className = '',
}: {
  kind: ResourceKind
  poolSize: number
  scope: CourseLauncherScope
  heading?: string
  className?: string
}) {
  const resolved = resolveCourse(kind, poolSize)
  const stages = resolved.stages.filter((s) => s.game)

  // 허브로 넘기는 링크는 코스가 서지 않아도 유효하다 — 거기서 맛보기로 열리거나
  // 단어를 더 모으라는 안내를 받는다. 코스 칩만 조건부로 감춘다.
  const hubHref = hubHrefFor(scope)

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-0.5 font-display text-[11px] font-[700] text-[var(--t2)]">{heading}</span>

        {stages.map((s, i) => (
          <Link
            key={s.role}
            href={gamePlayHref(s.game!.slug, {
              set: scope.set,
              text: scope.text,
              book: scope.book,
              chapter: scope.chapter ?? null,
              from: scope.from,
            })}
            title={`${s.label} — ${s.game!.name} · ${s.game!.tagline}`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg2)] px-3 font-display text-[11.5px] font-[700] text-[var(--t2)] no-underline transition-colors hover:border-[#8B5CF6] hover:bg-[#8B5CF6]/10 hover:text-[#6D28D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
          >
            <span aria-hidden>{'①②③④'[i] ?? '·'}</span>
            <span aria-hidden>{s.game!.emoji}</span>
            {s.game!.name}
          </Link>
        ))}

        <Link
          href={hubHref}
          title="Game Lab — 이 자료의 단어로 전체 실험 열람"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-full)] border border-[#8B5CF6]/45 bg-[#8B5CF6]/10 px-3 font-display text-[11.5px] font-[700] text-[#6D28D9] no-underline transition-colors hover:border-[#8B5CF6] hover:bg-[#8B5CF6]/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
        >
          <span aria-hidden>🕹</span>
          Game Lab
          <span aria-hidden>→</span>
        </Link>
      </div>

      {/* 코스가 덜 섰으면 그 사실을 숨기지 않는다 — 눌렀는데 안 되는 것보다 낫다. */}
      {resolved.unlockAt != null && (
        <p className="mt-1.5 font-body text-[11.5px] leading-relaxed text-[var(--t2)]">
          단어 {resolved.poolSize}개로 {stages.length}단계가 열렸어요
          {resolved.unlockAt > resolved.poolSize && (
            <> · {resolved.unlockAt - resolved.poolSize}개 더 모으면 다음 단계가 열립니다</>
          )}
          .
        </p>
      )}
    </div>
  )
}

/** 같은 스코프를 유지한 Game Lab URL. 허브 `readScope` 와 같은 키를 쓴다. */
function hubHrefFor(scope: CourseLauncherScope): string {
  const q = new URLSearchParams()
  if (scope.set) q.set('set', scope.set)
  if (scope.text) q.set('text', scope.text)
  if (scope.book) q.set('book', scope.book)
  if (scope.chapter != null && scope.chapter > 0) q.set('chapter', String(scope.chapter))
  if (scope.from) q.set('from', scope.from)
  const qs = q.toString()
  return qs ? `/arcade?${qs}` : '/arcade'
}
