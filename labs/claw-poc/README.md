# claw-poc

한국 오락실 클로 머신 물리(2-prong grip) 검증용 **독립 PoC**.
Vocaflow 본체(apps/web, packages/\*) 와 **완전 무관** — pnpm workspace 밖.

## Stack

- Vite 5 + React 18 + TypeScript 5
- `@react-three/fiber` (R3F v8)
- `@react-three/rapier` (Rapier WASM 물리)
- `@react-three/drei` (카메라·헬퍼)
- `leva` (grip force · friction · damping 실시간 노브)

## Run

```bash
cd labs/claw-poc
npm install          # ← npm 사용 (pnpm workspace 격리 위해)
npm run dev          # → http://localhost:5173
```

## 검증 목표

1. **잡힘** — grip force 충분, 인형 mass·friction 정상일 때 클로가 상승할 때 놓치지 않음
2. **미끄러짐** — grip force 부족 → 상승 중 슬금슬금 빠져나감
3. **떨어짐** — grip 완전 놓침 → 인형이 다시 통 안으로 떨어짐

Leva 노브 3개(`gripForce`, `plushFriction`, `plushMass`)로 위 3상태 재현 가능해야 통과.

## 향후

- 웹 물리 확정 → Vocaflow 본체 이식(경로 1) 결정
- Expo Hermes(RN)에서 Rapier WASM 구동 여부는 별도 검증 필요
