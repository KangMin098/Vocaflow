// apps/web/src/components/ui/press/Gwonjeom.tsx
//
// **권점(圈點) 아이콘** — 옛 판본에서 눈여겨볼 글자 옆에 찍던 동그라미 표식.
//
// 이 자리에 있던 것은 lucide `Sparkles`(✦✦) 였다. 「추천」·「새것」·「쉬운 판」을 말하려고
// 학습자 화면 45개 파일이 그것을 썼는데, 지금 그 반짝이는 지금 전 세계 AI 생성 UI 가
// 공통으로 다는 표식이다 — 붙이는 순간 우리 화면이 아니라 **출신 표시**가 된다
// (워드마크에서 먼저 뺀 이유와 같다 · docs/design/00-inventory.md §0-5).
//
// 권점은 뜻이 같다(「여기를 보라」) · 이미 워드마크와 `JuMark dot` 이 쓰는 모양이다 ·
// 한국어 판면의 문법에서 왔다. `createLucideIcon` 으로 만들어 **lucide 아이콘과 같은 타입**이다 —
// `size`·`strokeWidth`·`className` 이 그대로 먹고, `LucideIcon` 자리에도 들어간다.
// 그래서 호출부는 이름만 바꾸면 된다(마크업·동작 불변).

import { createLucideIcon } from 'lucide-react'

export const Gwonjeom = createLucideIcon('gwonjeom', [
  ['circle', { cx: '12', cy: '12', r: '7.5', key: 'ring' }],
  ['circle', { cx: '12', cy: '12', r: '2.25', fill: 'currentColor', key: 'dot' }],
])
