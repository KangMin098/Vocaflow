'use client'

// apps/web/src/components/csat/OverlayPanel.tsx
//
// **오버레이 옆 패널 — 풀기 한 장, 그리고 한 겹씩 열리는 해설.**
//
// ── 이 컴포넌트가 지키는 계약 ────────────────────────────────────────
// 풀기 단계에서는 `steps` 가 **오지 않는다**(null). 숨기는 것이 아니라 **없다** —
// 감추기(`hidden`·`display:none`)로 하면 개발자 도구·선택·읽기 도구에 다 보이고,
// 무엇보다 «답을 보기 전에 스스로 답한다» 는 설계가 코드로는 하나도 지켜지지 않는다.
// 그래서 부르는 쪽이 제출 전에는 만들지도 않고, 여기서는 받을 수도 없다.
//
// ⚠️ 원문(지문·선지 문장)은 들어오지 않는다. 여기 뜨는 문자열은 우리 분석이고
//    `answer_quote` 한 줄만 짧은 인용이다 — `lib/csat/overlay.ts` 의 경계 그대로다.
// ⚠️ 시간은 **재되 몰아붙이지 않는다.** 권장 시간을 넘겨도 색이 변하지 않는다
//    (CLAUDE.md 「정답률 빨간 글씨 압박」 금지 — 초시계도 같은 압박이다).

import type { RevealStep } from '@/lib/csat/overlay-reveal'

const CIRCLED = ['', '①', '②', '③', '④', '⑤']

/** 문제지 위에 켜고 끌 수 있는 겹. 색 하나에 뜻 하나, 그리고 모양도 서로 다르다(색맹 대응). */
export type LayerKey = 'numbers' | 'evidence' | 'choices' | 'traps' | 'vocab'

export type LayerState = Record<LayerKey, boolean>

export const LAYER_LABEL: Record<LayerKey, string> = {
  numbers: '문항 번호',
  evidence: '근거',
  choices: '선지',
  traps: '함정',
  vocab: '어휘',
}

export const ALL_LAYERS_ON: LayerState = {
  numbers: true,
  evidence: true,
  choices: true,
  traps: true,
  vocab: true,
}

export interface OverlayPanelMeta {
  no: number
  slug: string
  type_name: string | null
  points: number | null
  time_budget_sec: number | null
  measured_ability: string | null
  ready: boolean
  answer: number | null
}

/**
 * 종이 위에서 **실제로 찾았는가.** 화면이 「밑줄 친 자리예요」라고 말하려면 밑줄이 있어야 한다.
 *
 * - `null` — 옆에 종이가 없다(링크 모드). 종이 이야기를 하지 않는다.
 * - `quote` — 근거 문장: 찾는 중 / 찾음 / 못 찾음(스캔본·추출 오차)
 * - `vocabFound` — 어휘 중 몇 개를 찾았나
 */
export interface PaperFind {
  quote: 'pending' | 'found' | 'missing'
  vocabFound: number
}

export interface OverlayPanelProps {
  item: OverlayPanelMeta
  /** **제출 전에는 null.** 해설은 만들어지지도 않는다(위 계약). */
  steps: RevealStep[] | null
  picked: number | null
  step: number
  /** 이 문항을 연 뒤 흐른 초 */
  elapsed: number
  layers: LayerState
  /** 문제지가 옆에 없는 자리(링크 모드)에서는 겹 스위치를 숨긴다 — 켤 종이가 없다. */
  showLayers?: boolean
  /** 닫을 것이 없는 자리에서는 닫기 단추를 숨긴다 — 눌러도 아무 일 없는 단추는 고장으로 읽힌다. */
  showClose?: boolean
  onPick: (n: number) => void
  onSubmit: () => void
  onStep: (i: number) => void
  onLayer: (k: LayerKey) => void
  onClose: () => void
  /** 종이 위에서 찾은 결과. 없으면(링크 모드) 종이 이야기를 하지 않는다. */
  paper?: PaperFind | null
  /** 같은 회차 다음 문항 — 문제지를 다시 떨어뜨리지 않고 넘어간다 */
  nextNo?: number | null
  onNext?: () => void
}

const mmss = (sec: number) => {
  const s = Math.max(0, Math.floor(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const BTN =
  'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none'

export function OverlayPanel({
  item,
  steps,
  picked,
  step,
  elapsed,
  layers,
  showLayers = true,
  showClose = true,
  onPick,
  onSubmit,
  onStep,
  onLayer,
  onClose,
  paper = null,
  nextNo = null,
  onNext,
}: OverlayPanelProps) {
  const solving = steps === null
  const cur = steps && step >= 0 && step < steps.length ? steps[step] : null

  return (
    <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-bold text-[var(--t1)]">
          {item.no}번
          {item.type_name ? (
            <span className="ml-2 text-xs font-normal text-[var(--t3)]">{item.type_name}</span>
          ) : null}
        </h2>
        {showClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="해설 닫기"
          className={`-m-2 min-h-[44px] min-w-[44px] rounded-[var(--r-md)] p-2 text-sm text-[var(--t3)] hover:text-[var(--t1)] ${BTN}`}
        >
          닫기
        </button>
        ) : null}
      </div>

      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[var(--t3)]">
        {item.points ? <span>{item.points}점</span> : null}
        {item.time_budget_sec ? <span>권장 {item.time_budget_sec}초</span> : null}
        {/* 흐른 시간은 «지금 얼마나 썼나» 만 말한다. 넘겨도 색이 변하지 않는다. */}
        <span className="tabular-nums" aria-label={`푼 시간 ${mmss(elapsed)}`}>
          {mmss(elapsed)}
        </span>
      </p>

      {!item.ready ? (
        <p className="mt-3 break-keep text-sm leading-relaxed text-[var(--t2)]">
          이 문항은 분석 준비 중이에요. 문제지에서 풀어 보시고, 다른 문항 번호를 눌러 보세요.
        </p>
      ) : solving ? (
        <SolveCard item={item} picked={picked} onPick={onPick} onSubmit={onSubmit} />
      ) : (
        <>
          <Verdict picked={picked} answer={item.answer} />
          {item.measured_ability ? (
            <p className="mt-1 break-keep text-xs leading-relaxed text-[var(--t3)]">
              재는 힘 — {item.measured_ability}
            </p>
          ) : null}
          <Stepper steps={steps!} step={step} onStep={onStep} />
          {cur ? <StepCard step={cur} showTrap={layers.traps} paper={paper} /> : null}
          {nextNo != null && onNext && step >= steps!.length - 1 ? (
            <button
              type="button"
              onClick={onNext}
              className={`mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p)] px-4 text-sm text-[var(--on-p)] hover:bg-[var(--p-hover)] active:bg-[var(--p-dark)] disabled:opacity-50 ${BTN}`}
            >
              다음 문항 {nextNo}번 풀기 →
            </button>
          ) : null}
          {showLayers ? <Layers layers={layers} onLayer={onLayer} /> : null}
          <a
            href={`/csat/item/${item.slug}`}
            className={`mt-4 inline-flex min-h-[44px] items-center text-sm text-[var(--t2)] underline decoration-dotted underline-offset-2 hover:text-[var(--t1)] ${BTN}`}
          >
            이 문항 해설 전문 보기 →
          </a>
        </>
      )}
    </div>
  )
}

/**
 * **풀기 한 장.** 여기에는 답도, 근거도, 오답 분석도 없다 — 있을 수가 없다(`steps` 가 안 온다).
 *
 * 고르지 않고도 넘어갈 수 있게 둔다(「모르겠어요, 그냥 보기」). 강제하면 아무 번호나 찍고
 * 넘어가는 학습자가 생기고, 그러면 정답률 기록이 거짓이 된다.
 */
function SolveCard({
  item,
  picked,
  onPick,
  onSubmit,
}: {
  item: OverlayPanelMeta
  picked: number | null
  onPick: (n: number) => void
  onSubmit: () => void
}) {
  return (
    <div className="mt-3">
      <p className="break-keep text-sm leading-relaxed text-[var(--t2)]">
        문제지에서 {item.no}번을 먼저 풀어 보세요. 답을 고르면 해설이 한 겹씩 열려요.
      </p>

      <fieldset className="mt-3">
        <legend className="text-xs text-[var(--t3)]">내 답</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPick(n)}
              aria-pressed={picked === n}
              className={`min-h-[44px] min-w-[44px] rounded-[var(--r-md)] border px-3 text-base ${BTN} ${
                picked === n
                  ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]'
                  : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)] hover:border-[var(--p)] active:bg-[var(--bg3)]'
              }`}
            >
              {CIRCLED[n]}
            </button>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={onSubmit}
        className={`mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p)] px-4 text-sm text-[var(--on-p)] hover:bg-[var(--p-hover)] active:bg-[var(--p-dark)] ${BTN}`}
      >
        {picked ? '답 맞춰 보기' : '답을 안 고르고 보기'}
      </button>
      <p className="mt-2 text-xs leading-relaxed text-[var(--t3)]">
        키보드: <kbd className="font-mono">1</kbd>~<kbd className="font-mono">5</kbd> 로 고르고{' '}
        <kbd className="font-mono">Enter</kbd> 로 열어요.
      </p>
    </div>
  )
}

/**
 * 채점 한 줄. **틀렸다고 붉게 쓰지 않는다** — 맞았으면 짚어 주고, 아니면 «어디서 갈렸는지»
 * 를 보러 가자고 말한다(철학 3). 색 말고 글자로도 말한다.
 */
function Verdict({ picked, answer }: { picked: number | null; answer: number | null }) {
  if (answer == null) return null
  if (picked == null) {
    return (
      <p className="mt-3 text-sm text-[var(--t2)]">
        답은 <strong className="text-base text-[var(--t1)]">{CIRCLED[answer]}</strong> 예요.
      </p>
    )
  }
  const hit = picked === answer
  return (
    <p className="mt-3 break-keep text-sm leading-relaxed text-[var(--t2)]">
      <span className={hit ? 'text-[var(--success)]' : 'text-[var(--t2)]'}>
        {hit ? '맞았어요' : `고른 답은 ${CIRCLED[picked]}`}
      </span>
      {' · '}답 <strong className="text-base text-[var(--t1)]">{CIRCLED[answer]}</strong>
      {hit ? null : ' — 어디서 갈렸는지 아래에서 짚어 볼게요.'}
    </p>
  )
}

/** 단계 표시줄. 지나온 겹은 눌러서 되돌아갈 수 있다(되감기 없는 순차는 그냥 불편함이다). */
function Stepper({ steps, step, onStep }: { steps: RevealStep[]; step: number; onStep: (i: number) => void }) {
  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-1" role="group" aria-label="해설 단계">
        {steps.map((s, i) => (
          <button
            key={`${s.kind}-${s.choice ?? i}`}
            type="button"
            onClick={() => onStep(i)}
            aria-current={i === step ? 'step' : undefined}
            disabled={i > step}
            className={`min-h-[44px] rounded-[var(--r-md)] border px-2 text-xs ${BTN} ${
              i === step
                ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]'
                : i < step
                  ? 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:border-[var(--p)]'
                  : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t4)]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onStep(step - 1)}
          disabled={step <= 0}
          className={`min-h-[44px] min-w-[44px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 text-sm text-[var(--t1)] hover:border-[var(--p)] active:bg-[var(--bg3)] disabled:cursor-not-allowed disabled:text-[var(--t4)] disabled:hover:border-[var(--bd)] ${BTN}`}
        >
          ← 앞 겹
        </button>
        <button
          type="button"
          onClick={() => onStep(step + 1)}
          disabled={step >= steps.length - 1}
          className={`min-h-[44px] flex-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 text-sm text-[var(--t1)] hover:border-[var(--p)] active:bg-[var(--bg3)] disabled:cursor-not-allowed disabled:text-[var(--t4)] disabled:hover:border-[var(--bd)] ${BTN}`}
        >
          {step >= steps.length - 1 ? '다 열었어요' : '다음 겹 →'}
        </button>
      </div>
    </>
  )
}

/** 지금 겹 한 장. 문제지 위의 강조와 **같은 것**을 말한다 — 둘이 어긋나면 눈이 헤맨다. */
function StepCard({ step, showTrap, paper }: { step: RevealStep; showTrap: boolean; paper: PaperFind | null }) {
  return (
    <div className="mt-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
      {step.kind === 'evidence' ? (
        // 밑줄이 **실제로 있을 때만** 「밑줄 친 자리」라고 말한다. 못 찾은 것을 숨기지 않는다 —
        // 조용히 비워 두면 학습자는 밑줄을 찾아 종이를 헤맨다.
        paper?.quote === 'found' ? (
          <p className="text-xs text-[var(--t3)]">문제지에 밑줄 친 자리예요</p>
        ) : paper?.quote === 'missing' ? (
          <p className="mb-1 inline-flex rounded-[var(--r-md)] bg-[var(--bg3)] px-2 py-0.5 text-xs text-[var(--t2)]">
            이 문장은 문제지에서 자동으로 찾지 못했어요 — 지문에서 직접 짚어 보세요
          </p>
        ) : null
      ) : null}

      {showTrap && step.trap ? (
        <span className="mb-2 inline-flex items-center rounded-[var(--r-md)] bg-[var(--warning-light)] px-2 py-0.5 text-xs text-[var(--warning-ink)]">
          {step.trap}
        </span>
      ) : null}

      {step.body ? (
        step.kind === 'evidence' ? (
          <blockquote className="border-l-2 border-[var(--success)] pl-3 text-sm leading-relaxed text-[var(--t2)]">
            {step.body}
          </blockquote>
        ) : (
          <p className="break-keep text-sm leading-relaxed text-[var(--t2)]">{step.body}</p>
        )
      ) : null}

      {step.whyTempting ? (
        <p className="mt-2 break-keep text-sm leading-relaxed text-[var(--t3)]">끌리는 이유 — {step.whyTempting}</p>
      ) : null}

      {step.procedure.length ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-[var(--t2)]">
          {step.procedure.map((s, i) => (
            <li key={i} className="break-keep">
              {s.step}
              {s.on_fail ? <span className="block text-xs text-[var(--t3)]">막히면 — {s.on_fail}</span> : null}
            </li>
          ))}
        </ol>
      ) : null}

      {step.vocab.length ? (
        <>
          <p className="break-keep text-xs text-[var(--t3)]">
            이 문항이 요구한 낱말
            {paper
              ? paper.vocabFound > 0
                ? ` — ${step.vocab.length}개 중 ${paper.vocabFound}개를 문제지에 점선으로 표시했어요`
                : ' — 이 쪽에서는 찾지 못했어요'
              : ''}
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {step.vocab.map((w) => (
              <li
                key={w}
                className="rounded-[var(--r-md)] border border-[var(--info)] px-2 py-0.5 text-sm text-[var(--info)]"
              >
                {w}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

/** 겹 켜고 끄기. 표시가 많아지면 종이가 안 읽힌다 — 끄는 길을 학습자 손에 준다. */
function Layers({ layers, onLayer }: { layers: LayerState; onLayer: (k: LayerKey) => void }) {
  const keys: LayerKey[] = ['numbers', 'evidence', 'choices', 'traps', 'vocab']
  return (
    <fieldset className="mt-4 border-t border-[var(--bd)] pt-3" id="csat-overlay-layers">
      <legend className="sr-only">문제지에 표시할 겹</legend>
      <p className="text-xs text-[var(--t3)]">문제지 표시</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onLayer(k)}
            aria-pressed={layers[k]}
            className={`min-h-[44px] rounded-[var(--r-md)] border px-2.5 text-xs ${BTN} ${
              layers[k]
                ? 'border-[var(--p)] bg-[var(--p-light)] text-[var(--on-p-tint)]'
                : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t3)] hover:border-[var(--p)]'
            }`}
          >
            {LAYER_LABEL[k]}
            {/* 켜짐을 색만으로 말하지 않는다 */}
            <span className="ml-1 font-mono" aria-hidden="true">
              {layers[k] ? '＋' : '−'}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
