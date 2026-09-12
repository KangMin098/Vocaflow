// apps/web/src/lib/marketing/differentiators.ts
//
// **이 제품이 다른 점 세 가지** — 공개 화면이 공유하는 단일 출처.
//
// 왜 모아 뒀나: 랜딩과 요금제가 같은 것을 각자 적으면 반드시 갈라진다. 이 저장소가
// 이름(`axes.ts`)·경로(`protected-routes.ts`)·수치(`trust-signals.ts`)에서 이미 세 번 겪은 모양이다.
// 포지셔닝은 그중에서도 갈라지면 가장 티가 나는 축이라 — 두 화면이 다른 약속을 하게 된다.
//
// **지어낸 후기 대신 검증 가능한 동작을 말한다.** `basis` 는 장식이 아니라 그 약속의 근거이고,
// 근거를 못 대는 항목은 여기 들어올 수 없다.

export interface Differentiator {
  title: string
  body: string
  /** 이 약속이 서 있는 근거 — 논문 또는 계산식. 없으면 항목 자체가 성립하지 않는다. */
  basis: string
}

export const DIFFERENTIATORS: readonly Differentiator[] = [
  {
    title: '내 기준 커버리지',
    body: '글의 난이도가 아니라 "내가 아는 비율"을 잽니다. 같은 글도 사람마다 다른 숫자가 나와요.',
    basis: '근거 · Hu & Nation (2000) 읽기 이해 임계 98/95%',
  },
  {
    title: '숫자가 시간에 따라 변합니다',
    body: '복습을 미루면 커버리지가 내려갑니다. 2주 뒤 이 글이 얼마나 어려워지는지 미리 보여줘요.',
    basis: '근거 · FSRS 기억 안정도 R(t) = exp(ln 0.9 · t / S)',
  },
  {
    title: '"몇 개만 하면 되는지"',
    body: '막연히 단어를 외우는 대신, 이 글이 편하게 읽히는 최소 단어 수를 계산해 줍니다.',
    basis: '근거 · 출현 빈도 기여도 순 최소 집합',
  },
] as const
