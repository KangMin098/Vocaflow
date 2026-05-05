# WordBlitz 긴급 수정 - 비율 + 카메라 재정렬

## 현재 문제 (스크린샷 기준)

캡처 분석 결과 다음 5가지 문제 동시 발생:

```
1. 박스 위쪽 잘림        → 천장 + LED 사인 안 보임
2. 박스 안 텅 빔          → 박스 height 7 너무 큼
3. 집게 안 보임            → 박스 위 잘림 때문에 케이블 끝만
4. 콘솔 안 보임            → 화면 아래 잘림
5. 라벨 겹침               → 7개 라벨이 한 줄에 압축
```

## 근본 원인

```
박스 비율: width 5, height 7 (세로 1.4배)
화면 비율: ~ 1700 × 800 (가로 2.1배)
→ 와이드 화면에 세로 긴 박스 → 위아래 잘림 + 양옆 여백
→ 카메라 [0, 3, 11]로는 전체 못 담음
```

---

## 즉시 수정 - 3개 파일만

### 1. ClawMachine.tsx의 MACHINE 상수 변경

```typescript
export const MACHINE = {
  // 박스 - 가로 길게 (와이드 화면 적응)
  width: 6,        // 5 → 6 (가로 늘림)
  height: 5,       // 7 → 5 (세로 줄임) ★
  depth: 2.5,
  
  // 집게 좌표 (height 5 기준 재계산)
  clawHomeY: 4.2,  // 천장 4.7 - 0.5
  clawDropY: 1.5,  // 인형 머리 1.0 위
  clawXRange: 2.2, // 1.8 → 2.2 (박스 가로 늘림)
  
  // 콘솔 - 박스 바로 아래 (떠있지 않음)
  consoleY: -0.7,        // 콘솔 중심 Y
  consoleHeight: 0.9,    // 1.0 → 0.9 (살짝 얇게)
  consoleWidth: 6.2,     // 박스보다 살짝 큼
  consoleDepth: 1.6,     // 1.8 → 1.6
} as const;
```

### 2. ClawMachine.tsx의 모든 좌표 재계산

박스 height 7 → 5로 줄였으므로 모든 Y 좌표 재계산 필요:

```typescript
// 좌표 새 기준 (박스 height 5):
// Y =  5.5  ━━━ LED 사인 (박스 위 0.5)
// Y =  5.0  ━━━ 박스 천장 ★ NEW
// Y =  4.2  ━━━ 집게 home
// Y =  1.5  ━━━ 집게 drop
// Y =  1.0  ━━━ 인형 머리
// Y =  0.0  ━━━ 박스 바닥
// Y = -0.2  ━━━ 박스 외부 베이스
// Y = -0.7  ━━━ 콘솔 중심 ★ 박스 직접 연결
// Y = -1.2  ━━━ 콘솔 바닥

// LED 사인 위치 (천장 위)
<mesh position={[0, MACHINE.height + 0.5, d - 0.1]}>
  // height + 0.5 = 5.5
</mesh>

// 베이스 (박스 아래)
<mesh position={[0, -0.35, 0]}>  // 콘솔 위에 살짝
  <boxGeometry args={[MACHINE.width + 0.4, 0.3, MACHINE.depth + 0.4]} />
</mesh>

// 콘솔 본체 (Y = -0.7, 박스 베이스와 연결)
<mesh position={[0, MACHINE.consoleY, 0]}>
  <boxGeometry args={[
    MACHINE.consoleWidth,
    MACHINE.consoleHeight,
    MACHINE.consoleDepth
  ]} />
</mesh>

// 콘솔 컨트롤 좌표 (consoleY 기준)
const cy = MACHINE.consoleY;  // -0.7
const consoleSurfaceY = cy + MACHINE.consoleHeight / 2;  // -0.25 (콘솔 윗면)

// 좌측 보라 패널
<mesh position={[-2.0, consoleSurfaceY + 0.05, cd - 0.4]}>
  <boxGeometry args={[1.4, 0.1, 0.8]} />
</mesh>

// 좌측 작은 버튼 1
<mesh position={[-2.3, consoleSurfaceY + 0.15, cd - 0.4]}>
  <cylinderGeometry args={[0.14, 0.14, 0.1, 16]} />
</mesh>

// 좌측 작은 버튼 2
<mesh position={[-1.7, consoleSurfaceY + 0.15, cd - 0.4]}>
  <cylinderGeometry args={[0.14, 0.14, 0.1, 16]} />
</mesh>

// 중앙 조이스틱 베이스
<mesh position={[0, consoleSurfaceY + 0.05, cd - 0.4]}>
  <boxGeometry args={[1.6, 0.1, 0.8]} />
</mesh>

// 검정 cylinder (조이스틱 base)
<mesh position={[0, consoleSurfaceY + 0.16, cd - 0.4]}>
  <cylinderGeometry args={[0.28, 0.36, 0.1, 24]} />
</mesh>

// 조이스틱 stick + ball
<group ref={stickGroupRef} position={[0, consoleSurfaceY + 0.21, cd - 0.4]}>
  <mesh position={[0, 0.3, 0]}>
    <cylinderGeometry args={[0.06, 0.08, 0.6, 16]} />
  </mesh>
  <mesh position={[0, 0.7, 0]}>
    <sphereGeometry args={[0.25, 32, 24]} />
    <meshStandardMaterial color={0xE63946} />
  </mesh>
</group>

// 우측 DROP 패널
<mesh position={[2.0, consoleSurfaceY + 0.05, cd - 0.4]}>
  <boxGeometry args={[1.4, 0.1, 0.8]} />
</mesh>

// DROP 베이스
<mesh position={[2.0, consoleSurfaceY + 0.16, cd - 0.4]}>
  <cylinderGeometry args={[0.36, 0.4, 0.1, 24]} />
</mesh>

// 빨간 큰 DROP 버튼
<mesh ref={dropButtonRef} position={[2.0, consoleSurfaceY + 0.30, cd - 0.4]}>
  <cylinderGeometry args={[0.32, 0.32, 0.16, 24]} />
</mesh>

// DROP! 텍스트
<mesh position={[2.0, consoleSurfaceY + 0.39, cd - 0.4]} rotation={[-Math.PI / 2, 0, -0.1]}>
  <planeGeometry args={[0.5, 0.5]} />
</mesh>
```

### 3. ClawScene.tsx 카메라 재조정

```typescript
<Canvas
  camera={{
    // 이전: [0, 2, 16] - 너무 멀고 위치 부적절
    // 이전: [0, 3, 11] - 박스 잘림
    // 새 위치: 박스 5 + 콘솔 1 + LED 0.5 = 6.5 세로
    //         카메라 lookAt = 박스 중심 (Y=2.5)와 콘솔 중심 (-0.7) 의 중간 = 1
    
    position: [0, 1.5, 10],   // ★ Y 낮추고 거리 적당히
    fov: 42,                   // 38 → 42 (더 넓게)
    near: 0.1,
    far: 100,
  }}
  shadows
  gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
  onCreated={({ camera }) => {
    camera.lookAt(0, 1.5, 0);  // 박스 + 콘솔 중심 (조정)
  }}
>
```

### 4. ClawModel.tsx 천장 좌표 변경

```typescript
// 이전: const CEILING_Y = 7;
// 새 좌표: 박스 height 5
const CEILING_Y = 5;  // ★ 박스 천장

// 케이블 길이도 자동으로 맞춰짐 (CEILING_Y - clawY)

// 그룹 초기 위치
return (
  <group ref={holderRef} position={[0, 4.2, 0]}>  // 6 → 4.2 (clawHomeY)
    ...
  </group>
);
```

### 5. useWordBlitzGame.ts GAME_CONFIG 업데이트

```typescript
export const GAME_CONFIG = {
  CLAW_HOME_Y: 4.2,    // 6 → 4.2 ★
  CLAW_DROP_Y: 1.5,    // 2 → 1.5 ★
  CLAW_X_RANGE: 2.2,   // 1.8 → 2.2
  PLUSHIE_COUNT: 7,
  GRAB_RADIUS: 1.5,
  TIMING: { ... }      // 그대로
} as const;
```

### 6. data.ts PLUSHIE_POSITIONS 새 박스 width 6에 맞춤

```typescript
export const PLUSHIE_POSITIONS = [
  // 앞줄 (Z = 0.5) - 4개, X 범위 -2.2 ~ 2.2
  { x: -2.2, z: 0.5 },
  { x: -0.7, z: 0.5 },
  { x: 0.7,  z: 0.5 },
  { x: 2.2,  z: 0.5 },
  // 뒷줄 (Z = -0.4) - 3개, 지그재그
  { x: -1.4, z: -0.4 },
  { x: 0,    z: -0.4 },
  { x: 1.4,  z: -0.4 },
];
```

---

## 검증 체크리스트 (수정 후)

화면을 직접 보고 다음 모두 통과해야 함:

### 비주얼 검증
- [ ] 박스 4면 모두 보임 (천장 + 좌우 + 뒤쪽)
- [ ] LED 사인 (VOCAFLOW)이 박스 위 정상 위치
- [ ] 집게 GLB 모델이 박스 안 명확히 보임 (케이블 + 4팔)
- [ ] 인형 7개가 박스 안 적당히 분포 (앞 4 + 뒤 3)
- [ ] 박스 베이스(검정)가 박스 아래 보임
- [ ] 콘솔(빨간)이 박스 베이스 아래 직접 연결
- [ ] 조이스틱 (빨간 공)이 콘솔 위 명확히 보임
- [ ] DROP 버튼 + DROP! 텍스트 보임
- [ ] 화면 양옆 검은 여백 거의 없음 (박스 적절한 크기)
- [ ] 인형 색상 GLB 원본 그대로 (망가지지 않음)

### 인터랙션 검증
- [ ] ←→ 키 누르면 집게 좌우 이동
- [ ] 집게 이동 시 조이스틱 그 방향 기울어짐
- [ ] Space 누르면 집게 하강 (Y 4.2 → 1.5)
- [ ] DROP 버튼 살짝 눌림
- [ ] 인형 잡고 상승

---

## 화면 비율 시뮬레이션

```
와이드 화면 (1700×800, 비율 2.1:1):

박스 width 6, height 5 (1.2:1)
카메라 [0, 1.5, 10], fov 42

화면에 보일 모습:
┌────────────────────────────────────────┐
│         ┌───VOCAFLOW───┐               │ ← LED 사인
│         │              │                │
│         │      🪝      │                │ ← 집게 (보임!)
│         │              │                │
│         │              │                │
│         │ 🐰🐶🐱🦄    │                │ ← 인형 4 + 3
│         │  🧸  🐻  🐼  │                │
│         └──────────────┘                │
│         ╔══════════════╗                │
│         ║ ●● 🕹️ DROP! ║                │ ← 콘솔 (보임!)
│         ╚══════════════╝                │
└────────────────────────────────────────┘
```

---

## 만약 여전히 비율 안 맞으면

화면을 보면서 다음 시도:

### 시도 1: 박스 더 작게
```typescript
width: 5.5, height: 4.5
```

### 시도 2: 카메라 더 멀리
```typescript
camera={{ position: [0, 1.5, 12], fov: 42 }}
```

### 시도 3: FOV 더 넓게
```typescript
camera={{ position: [0, 1.5, 10], fov: 50 }}
```

각 시도마다 화면 캡처해서 확인.

---

## 디버깅 - F12 Console 출력 추가

ClawScene.tsx에 다음 디버그 추가:

```typescript
useEffect(() => {
  console.log('[Scene] Camera:', camera.position.toArray());
  console.log('[Scene] Camera fov:', camera.fov);
  console.log('[Scene] MACHINE:', {
    width: MACHINE.width,
    height: MACHINE.height,
    consoleY: MACHINE.consoleY,
  });
}, []);
```

이 출력이 일치하는지 확인.

---

## 결론

**이전 좌표(height 7) 모두 잘못됨. 박스 비율 1.2:1 (가로 길게)로 재설계.**

위 변경 적용 후 위 체크리스트 모두 통과하면 완료.
통과 못하면 화면 캡처 + Console 출력 알려주세요.
