// apps/web/src/app/(main)/hub-lab/_variants/VariantG.tsx
//
// 관문 첫 줄(GatewayLead) — **네 상태를 한 화면에** 세워 두는 자리.
//
// 왜 랩에 두나: 이 줄은 검증 계정에서 거의 항상 **안 보인다.** 그 계정은 e2e 가 매일 돌아
// 늘 `today` 상태이고, `today` 는 설계상 아무것도 그리지 않기 때문이다. 즉 본 화면(/hub)을
// 아무리 찍어도 **이 기능이 존재하는 이유인 복귀 상태는 영원히 캡처되지 않는다**
// (실제로 첫 라운드 캡처에 한 번도 안 나왔고, 그게 정상 동작이다).
//
// 렌더 회귀는 `components/home/__tests__/GatewayLead.test.tsx` 가 잠근다. 여기는 그 테스트가
// 못 보는 것 — **시각 무게**를 본다. 이 줄이 무대의 단일 CTA 와 경쟁하지 않는지는
// 나란히 놓고 봐야만 판단할 수 있다.
//
// 상태는 합성한다(실데이터 아님) — 시간을 되돌릴 수는 없기 때문이다.
// 랩 전용이므로 본 화면에는 이 합성이 절대 나가지 않는다.

import { GatewayLead } from '@/components/home/GatewayLead'
import { TodayFocus } from '@/components/home/TodayFocus'
import { classifyGateway, type LastTouch } from '@/lib/learner/gateway-state'

/** '지금' 을 고정해 캡처가 날마다 달라지지 않게 한다. */
const NOW = Date.parse('2026-08-16T03:00:00Z')

function ago(days: number): string {
  return new Date(NOW - days * 86_400_000).toISOString()
}

function touch(days: number, over: Partial<LastTouch> = {}): LastTouch {
  return {
    module: 'dictation',
    title: 'A Christmas Carol — Marley’s Ghost',
    href: '/dictate/setup?textId=demo',
    at: ago(days),
    ...over,
  }
}

const CASES: { caption: string; note: string; state: ReturnType<typeof classifyGateway> }[] = [
  {
    caption: 'first — 학습 기록 없음',
    note: '아무것도 그리지 않는다. 진단 유도는 TodayFocus 단독 책임.',
    state: classifyGateway(null, NOW),
  },
  {
    caption: 'today — 오늘 이미 했음',
    note: '아무것도 그리지 않는다. "돌아왔네요" 는 거짓이고 진행은 흐름이 이미 말한다.',
    state: classifyGateway(touch(0), NOW),
  },
  {
    caption: 'returning — 어제',
    note: '하루는 "어제 이어서". 숫자를 세지 않는다.',
    state: classifyGateway(touch(1), NOW),
  },
  {
    caption: 'returning — 사흘',
    note: '2~6일은 일수를 사실로만 짚는다.',
    state: classifyGateway(touch(3), NOW),
  },
  {
    caption: 'away — 107일',
    note: '7일 이상은 **일수를 지운다.** 오래 비울수록 숫자가 비난이 된다(철학 ③).',
    state: classifyGateway(touch(107), NOW),
  },
  {
    caption: 'returning — 돌아갈 자리를 모를 때',
    note: '링크를 만들지 않는다. 빈 링크를 파느니 줄만 남긴다.',
    state: classifyGateway(touch(3, { href: null, title: null }), NOW),
  },
]

export function VariantG() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-editorial text-[24px] font-[500] tracking-[-0.012em] text-[var(--t1)]">
          관문 첫 줄 — 네 상태
        </h1>
        <p className="mt-1 max-w-[62ch] font-body text-[13px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
          본 화면에서는 검증 계정이 늘 <code>today</code> 라 이 줄이 거의 안 보인다. 여기서만
          복귀 상태를 눈으로 확인한다. 확인할 것: <strong>무대의 단일 CTA 와 무게가 겹치지
          않는가</strong> · 오래 비운 사람에게 숫자가 새지 않는가.
        </p>
      </header>

      {/* 첫 방문 카드 — 검증 계정은 진단 완료 상태라 **본 화면에서 절대 렌더되지 않는다.**
          다크모드에서 흰 바탕에 흰 글자였던 결함이 몇 달간 안 보인 이유가 정확히 이것이다.
          여기 세워 두면 테마 캡처(HUB_SHOT_THEME=dark)로 함께 잡힌다. */}
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-[var(--p)]">
            first — 첫 방문 카드 (TodayFocus)
          </span>
          <span className="font-body text-[11.5px] text-[var(--t3)] [word-break:keep-all]">
            진단 전 유일한 제안. 라이트/다크 양쪽에서 글자가 읽히는지 확인.
          </span>
        </div>
        <TodayFocus />
      </section>

      {CASES.map((c) => (
        <section key={c.caption} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-[var(--p)]">
              {c.caption}
            </span>
            <span className="font-body text-[11.5px] text-[var(--t3)] [word-break:keep-all]">
              {c.note}
            </span>
          </div>

          {/* 아무것도 안 그리는 상태도 **자리를 보여줘야** 판단이 된다 —
              빈 결과를 그냥 두면 "깨진 건가?" 와 구별되지 않는다. */}
          <div className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] p-2">
            <GatewayLead state={c.state} />
            <EmptyMarker state={c.state} />
          </div>
        </section>
      ))}
    </div>
  )
}

function EmptyMarker({ state }: { state: ReturnType<typeof classifyGateway> }) {
  if (state.phase !== 'first' && state.phase !== 'today') return null
  return (
    <p className="px-2 py-1 font-mono text-[10.5px] text-[var(--t4)]">
      (렌더 없음 — 의도된 동작)
    </p>
  )
}
