# Vocaflow WordBlitz - 진짜 인형뽑기 기계 완전 재설계

## 작업 컨텍스트

당신은 Vocaflow(영어 학습 플랫폼) 프로젝트의 시니어 엔지니어입니다.
이 프로젝트의 **WordBlitz 게임 모드**는 인형뽑기 메커니즘으로 영단어를 학습하는 게임입니다.

지금까지 10회 이상 시도했지만 비주얼 결과가 계속 부족했습니다.
이번에는 **반드시 진짜 인형뽑기 기계**처럼 만들어야 합니다.

이 작업의 디자인 SSoT(Single Source of Truth)는 프로젝트 루트의 `CLAUDE.md` v06.4 입니다.
의심스러울 때는 반드시 CLAUDE.md를 참고합니다.

---

## 프로젝트 환경

```
경로: C:\Users\kille\Vocaflow\
구조: Turborepo 모노레포 (apps/web + apps/mobile)
스택: Next.js 14 + React Three Fiber + TypeScript + Tailwind
플랫폼: Windows + Git Bash + VS Code
```

### WordBlitz 관련 기존 파일 위치

```
apps/web/
├── public/wordblitz/
│   ├── FBX_Claw_Rigged_Type-2_new-21.glb       (집게 모델, 이미 있음)
│   └── plushies/
│       ├── Bear.glb
│       ├── Carrot Character.glb
│       ├── Cool Bannana Guy.glb
│       ├── Dog.glb
│       ├── Easter rabbit.glb
│       ├── Frog Hat.glb
│       ├── Kitten.glb
│       ├── Panda.glb
│       └── Unicorn.glb
└── src/
    ├── lib/wordblitz/
    │   ├── data.ts                    (단어 + 인형 매핑)
    │   └── types.ts
    ├── components/game/wordblitz/
    │   ├── WordBlitzGame.tsx          (메인 컨테이너)
    │   ├── WordBlitzUI.tsx            (HUD, Banner, Toast)
    │   ├── WordBlitzUI.module.css
    │   ├── ClawScene.tsx              (3D 씬)
    │   ├── ClawMachine.tsx            (인형뽑기 박스 + 콘솔)
    │   ├── ClawModel.tsx              (집게)
    │   ├── Plushie.tsx                (인형 컨테이너)
    │   ├── PlushieModel.tsx           (인형 GLB 로더)
    │   └── useWordBlitzGame.ts        (게임 로직)
    └── app/(app)/play/wordblitz/
        └── page.tsx
```

### 라우트
```
http://localhost:3000/play/wordblitz
```

### 의존성 (이미 설치됨)
```
three, @react-three/fiber, @react-three/drei, react-error-boundary
```

---

## 현재 문제점 (해결해야 할 사항)

스크린샷을 직접 확인하면서 다음 문제를 모두 해결하세요:

### 1. 비율 / 카메라 문제
- 박스가 화면 위쪽으로 잘리거나, 너무 작거나, 양옆에 검은 여백이 큼
- 콘솔(조이스틱 패널)이 화면 아래로 잘림
- 박스와 콘솔 사이가 부자연스럽게 떨어져 있음

### 2. 집게가 안 보이거나 어색함
- 집게 GLB 모델 (`FBX_Claw_Rigged_Type-2_new-21.glb`)이 화면 위쪽에 잘려서 케이블만 보임
- 집게가 너무 작아서 인형보다 작아 보임
- 집게 4팔 회전이 동작 안 함 (Bone 식별 실패 가능성)

### 3. 인형 색상 / 위치 / 크기 문제
- 인형이 일렬로만 정렬되어 자연스러운 무더기 느낌이 없음
- 모든 인형 크기가 통일 안 됨 (어떤 건 크고 어떤 건 작음)
- 라벨(단어)이 인형 옆에 떠 있어서 어떤 인형 라벨인지 헷갈림
- GLB 인형의 고유 색상이 조명 때문에 망가짐

### 4. 조이스틱 콘솔 미완성
- 조이스틱이 인형 옆에 빨간 점으로만 표시됨 (좌표 잘못)
- DROP 버튼 안 보이거나 너무 작음
- 콘솔이 박스와 연결되지 않은 떠있는 박스로 보임

### 5. 인터랙션
- GLB 인형의 자체 애니메이션이 재생 안 됨
- 정답 인형 강조가 약함

---

## 설계 목표 - 진짜 인형뽑기 기계

### 비율 참고 (실제 인형뽑기)

```
비율: 박스 1 : 콘솔 0.3 (콘솔이 박스보다 짧음)
박스: 가로 ≈ 세로 (정사각형 가까움)
콘솔: 박스보다 살짝 좁고 깊이 있음

세로 단면도:
┌─────┐  ┌──────────┐
│LED  │  │ VOCAFLOW │ ← 사인 (박스 위)
├─────┤  ├──────────┤
│ ╔═╗ │  │ ╔══════╗ │
│ ║🪝║ │  │ ║ 🪝   ║ │ ← 박스 (대부분)
│ ║  ║ │  │ ║      ║ │
│ ║🐰║ │  │ ║ 🐰🐶 ║ │ ← 인형 무더기
│ ╚═╝ │  │ ╚══════╝ │
├─────┤  ├──────────┤
│●🕹️ ●│  │ ●🕹️ DROP│ ← 콘솔
└─────┘  └──────────┘
```

### 새 좌표계 (Y축 세로) - 반드시 이 좌표계 사용

```
Y =  9.0  ━━━ 화면 위쪽 여백
Y =  8.0  ━━━ ┃ LED 사인 (VOCAFLOW)
Y =  7.0  ━━━ ┃ 박스 천장
Y =  6.0  ━━━ ┃ 집게 home 위치
Y =  5.0  ━━━ ┃ 박스 안 빈 공간
Y =  4.0  ━━━ ┃ 카메라 lookAt
Y =  3.0  ━━━ ┃
Y =  2.0  ━━━ ┃ 집게 drop 위치
Y =  1.0  ━━━ ┃ 인형 머리 (높이 1)
Y =  0.0  ━━━ ┻ 박스 내부 바닥
Y = -0.5  ━━━ 박스 외부 베이스 (검정)
Y = -1.0  ━━━ ┳ 콘솔 윗면 ★ 박스와 직접 연결 (떠있지 않음)
Y = -1.5  ━━━ ┃ 조이스틱/버튼 영역
Y = -2.0  ━━━ ┻ 콘솔 바닥
```

### 박스 크기

```
박스: width 5, height 7, depth 2.5
콘솔: width 5.2, height 1.0, depth 1.8
```

### 카메라 위치

```typescript
// 화면 비율 적응형
camera={{
  position: [0, 3, 11],   // 박스 + 콘솔 모두 보임
  fov: 38,                // 좁은 화각 (압축감)
}}
camera.lookAt(0, 3, 0);   // 박스 중간 향함
```

---

## 구체적 작업 지시

### Phase 1: 현재 상태 파악 (시작 전)

1. 다음 명령으로 개발 서버 실행
```bash
cd apps/web
pnpm dev
```

2. 브라우저에서 `http://localhost:3000/play/wordblitz` 접속

3. F12 Console 확인:
   - GLB 로드 성공/실패 메시지
   - `[Claw] 본/팔 발견: X개` 메시지
   - 에러 메시지

4. **현재 화면을 직접 보고 문제점 확인**

### Phase 2: 컴포넌트 완전 재작성

다음 7개 파일을 **완전히** 새로 작성하세요. 부분 수정 금지. 이전 코드를 신뢰하지 말고 처음부터 작성하세요.

#### 2-1. ClawMachine.tsx (인형뽑기 박스 + 콘솔)

**요구사항:**
- 박스: 4면 빨간 프레임 + 뒤쪽 보라 벽 + 천장 + 분홍/베이지 바닥 + 앞 유리창
- 콘솔: 박스 바로 아래 직접 연결 (Y=-1 ~ -2). 떠있는 박스 X
- 콘솔 컨트롤: 좌측 작은 빨간 버튼 2개 + 중앙 빨간 공 조이스틱 + 우측 큰 DROP 버튼
- LED 사인: 박스 위 (Y=8). 노란색 + "VOCAFLOW" 텍스트 + 깜박임
- 모든 좌표는 위 좌표계 표를 정확히 따를 것
- 조이스틱은 외부 ref(joystickTilt)에 따라 기울어짐 (-1 ~ 1 → -0.4 ~ 0.4 rad)
- DROP 버튼은 외부 ref(dropPressed)에 따라 살짝 눌림 (Y -0.06)

**MACHINE 상수 export:**
```typescript
export const MACHINE = {
  width: 5,
  height: 7,
  depth: 2.5,
  clawHomeY: 6,
  clawDropY: 2,
  clawXRange: 1.8,
  consoleY: -1.5,
  consoleHeight: 1.0,
  consoleWidth: 5.2,
  consoleDepth: 1.8,
} as const;
```

#### 2-2. ClawScene.tsx (3D 씬)

**요구사항:**
- 카메라: position [0, 3, 11], fov 38, lookAt [0, 3, 0]
- 조명: ambientLight intensity 1.0 + directionalLight intensity 0.3 만 사용
  - **spotLight, pointLight 사용 금지** (인형 색상 망가짐)
  - toneMapping: NoToneMapping (색상 변환 없음)
- 배경: 어두운 보라 그라디언트 + 별 200개
- ClawMachine + ClawModel + Plushie 렌더
- joystickTiltRef + dropPressedRef를 ClawMachine에 전달
- ConsoleStateSync 컴포넌트로 게임 상태 → 콘솔 ref 동기화

#### 2-3. ClawModel.tsx (집게)

**요구사항:**
- GLB URL: `/wordblitz/FBX_Claw_Rigged_Type-2_new-21.glb`
- 자동 스케일: max dimension 1.5 기준
- 천장(Y=7)에서 매달림 - 케이블 자동 길이
- 위치: holderRef.position을 [clawX × 1.8, clawY, 0] 으로 설정
- bodyRef는 진자 흔들림 (clawSwing rotation.z)
- 4팔 본 식별: 메쉬 이름 정규식 `/arm|claw|finger|grip|hook/i`
- 본 발견 시 닫힘 정도 만큼 회전.x 적용
- F12 Console에 본 발견 개수 출력
- 잡힌 인형 ref 따라가기 (집게 아래 1.6 위치)

#### 2-4. PlushieModel.tsx (인형 GLB)

**요구사항:**
- drei `useGLTF` + `useAnimations` 사용
- 자동 스케일: Y축(높이) 기준 1.0 → 모든 인형 동일 높이
- 발이 정확히 Y=0에 닿도록 box.min.y 보정
- **머티리얼 그대로 (emissive 적용 X)** - 색상 보존
- GLB 애니메이션 자동 재생 (있으면 첫 번째)
- 애니메이션 없으면 미세 회전 + 둥둥 (살아있는 느낌)
- 각 인형 고유 seed prop으로 다양화
- ErrorBoundary + Suspense로 sphere 폴백

#### 2-5. Plushie.tsx (인형 컨테이너)

**요구사항:**
- PlushieModel + 단어 라벨 + 정답 글로우 ring
- 라벨: 인형 위 Y=1.4. 카메라 향함 (lookAt). depthTest false
- 라벨 텍스처: Lora 폰트, 흰색 배경 + 검정 테두리. 정답이면 황금
- 정답 인형: 둥둥 효과 + 글로우 ring 회전
- forwardRef로 grabbedPlushieRef 전달

#### 2-6. useWordBlitzGame.ts (게임 로직)

**요구사항:**
- GAME_CONFIG: clawHomeY 6, clawDropY 2, clawXRange 1.8
- PLUSHIE_POSITIONS 사용해서 7개 인형 배치 (지그재그 무더기)
- 인형 Y = 0.1 (박스 바닥 위)
- 인형 회전 Y: -0.3 ~ 0.3 rad 랜덤 (자연스러움)
- 진자 물리: velocity-spring-damping (현재 코드 유지)
- 키보드: ←→ 이동, Space/Enter Drop
- 라운드 시퀀스: dropping → grabbing → returning → showing-result
- targetsRef와 liveStateRef 외부 노출 (ClawScene 동기화용)

#### 2-7. data.ts (단어 + 인형 매핑)

**요구사항:**
- PLUSHIE_TYPES 9개 (사용자 다운로드 파일명 정확히):
  - Bear.glb, Kitten.glb, Easter rabbit.glb, Dog.glb,
  - Panda.glb, Frog Hat.glb, Unicorn.glb,
  - Carrot Character.glb, Cool Bannana Guy.glb
- PLUSHIE_POSITIONS 7개 (앞줄 4개 + 뒷줄 3개 지그재그)

**좌표:**
```typescript
export const PLUSHIE_POSITIONS = [
  // 앞줄 (Z = 0.5) - 카메라 가까이
  { x: -1.7, z: 0.5 },
  { x: -0.6, z: 0.5 },
  { x: 0.6,  z: 0.5 },
  { x: 1.7,  z: 0.5 },
  // 뒷줄 (Z = -0.4) - 지그재그
  { x: -1.1, z: -0.4 },
  { x: 0,    z: -0.4 },
  { x: 1.1,  z: -0.4 },
];
```

### Phase 3: 검증 (반드시 직접 확인)

각 수정 후 반드시:

1. 브라우저 새로고침 (Ctrl+Shift+R)
2. F12 Console 에러 확인
3. **화면을 직접 보고 다음 체크리스트 통과 확인:**

#### 체크리스트

- [ ] 박스 4면(좌/우/위/뒤)이 모두 화면에 보임
- [ ] LED 사인이 박스 위에 보임 (VOCAFLOW 텍스트)
- [ ] 집게 GLB 모델이 박스 안에 보임 (케이블 + 4팔 모두)
- [ ] 집게가 박스 천장에서 매달려 있음
- [ ] 인형 7개가 박스 안에 분포되어 있음 (앞줄 4 + 뒷줄 3)
- [ ] 모든 인형 크기가 통일됨 (같은 높이)
- [ ] 인형 라벨이 인형 위에 정확히 표시됨
- [ ] 정답 인형은 노란 라벨 + 바닥 글로우 ring
- [ ] 콘솔이 박스 바로 아래 직접 연결됨 (떠있지 않음)
- [ ] 조이스틱 (빨간 공)이 콘솔 위에 명확히 보임
- [ ] DROP 버튼이 콘솔 우측에 큰 빨간 원으로 보임
- [ ] 인형 색상이 GLB 원본 그대로 보임 (망가지지 않음)

### Phase 4: 인터랙션 검증

- [ ] ←→ 키 누르면 집게가 좌우 이동
- [ ] 집게 이동 시 조이스틱이 그 방향으로 기울어짐
- [ ] Space 누르면 집게 하강
- [ ] 하강 시 DROP 버튼 살짝 눌림
- [ ] 집게 닫히고 인형 잡음
- [ ] 집게 상승 시 인형 매달려 올라옴
- [ ] 정답이면 노란 토스트, 오답이면 빨간 토스트
- [ ] TTS로 영단어 발음
- [ ] 다음 라운드 자동 시작

### Phase 5: 미세 조정

화면을 직접 보고 다음 미세 조정 시도:

1. 박스가 너무 크거나 작으면 → MACHINE.width/height 조정
2. 카메라가 너무 가깝거나 멀면 → camera.position.z 조정 (8 ~ 14)
3. 인형이 너무 크거나 작으면 → PLUSHIE_TARGET_HEIGHT 조정 (0.8 ~ 1.2)
4. 집게가 너무 크거나 작으면 → ClawModel scale 조정 (1.2 ~ 2.0)
5. 조이스틱 위치 어색하면 → ClawMachine 콘솔 좌표 조정

---

## 디자인 시스템 준수 (CLAUDE.md)

### 폰트 (반드시 사용)
- Display/UI: Plus Jakarta Sans
- Body: DM Sans
- 영어 단어: Lora (serif)
- 코드/게임: JetBrains Mono
- 게임 텍스트 (LED 사인 등): Bungee

### 색상 (CSS Variables 우선)
- 게임 전용 고정 색상은 CSS Variables 예외:
  - 황금: #FFD93D (정답, LED 사인)
  - 빨강: #E63946 (박스 프레임, 콘솔)

### 형식 정책
- **GLB만 사용** (FBX 사용 금지)
- 인형 GLB 파일명 정확히 매칭 (대소문자, 공백 포함)

### 충돌 회피 (Parts Kit v05)
- `GameHUD` → `WordBlitzHUD` (ScriptQuiz와 충돌 회피)
- `ResultToast` → `WordBlitzResultToast`

---

## 학술 원리 (CLAUDE.md §00 Philosophy)

이 게임 디자인이 다음 학습 원리를 살리고 있는지 확인:

- **Variable Reward (Skinner)**: 랜덤 색상 인형 → 도파민 자극
- **Anticipation (Schultz)**: 1.5초 하강 시간 → 기대감
- **Active Recall**: 한국어 → 영단어 인출
- **Endowment Effect**: 잡은 인형 = 컬렉션
- **Tangible Memory**: 단어 ↔ 인형 시각 연결

---

## 코드 품질 요구사항

### 절대 금지
- TODO 주석
- placeholder 코드 (// 여기에 구현)
- 미완성 코드
- 임의 클래스명 변경 (Parts Kit 컴포넌트)
- 색상 하드코딩 (게임 전용 예외 외)
- Inter, Roboto, Arial 폰트

### 반드시 포함
- 파일 경로 첫 줄 주석
- TypeScript 타입 명시
- React 컴포넌트는 'use client' 지시문
- 다크모드 대응 (`data-theme="dark"`)
- 모바일 반응형 (Mobile 390px / Tablet 768px / Desktop 1280px)
- 접근성 (WCAG AA, 터치 타겟 44×44px)

---

## 결과물

### 1. 동작하는 페이지

`http://localhost:3000/play/wordblitz` 접속 시 위 체크리스트 100% 통과

### 2. 캡처 + 보고

작업 완료 후 다음 보고:

```
## 완료 사항
- [수정한 파일 목록]
- [해결한 문제 목록]
- [체크리스트 통과 여부]

## 변경 사항 (CLAUDE.md v06.5 패치 사항)
- WordBlitz 좌표계 v5
- 인형 9종 GLB 매칭
- 조이스틱 콘솔 추가

## 알려진 제약
- [있다면 명시]

## 다음 작업 추천
- [Flashcard v2 React 변환 등]
```

### 3. CLAUDE.md 업데이트

다음 섹션을 CLAUDE.md에 추가:

```markdown
### WordBlitz 좌표계 (v5)

박스: width 5, height 7, depth 2.5
콘솔: width 5.2, height 1.0, depth 1.8

Y =  8.0  LED 사인
Y =  7.0  박스 천장
Y =  6.0  집게 home
Y =  2.0  집게 drop
Y =  1.0  인형 머리
Y =  0.0  박스 바닥
Y = -1.0  콘솔 윗면 (박스와 직접 연결)
Y = -2.0  콘솔 바닥

카메라: [0, 3, 11], fov 38, lookAt [0, 3, 0]
```

---

## 디버깅 가이드

### "GLB 로드 실패: DataCloneError"
→ drei `useGLTF` 사용했는지 확인 (vanilla GLTFLoader 사용 X)

### "본/팔 발견: 0개"
→ GLB 모델에 따라 메쉬 이름이 다를 수 있음
→ F12 Console에 모든 메쉬 이름 출력 후 정규식 수정

### 화면 검정
→ 카메라 z 위치 너무 가까움 (Z < 5)
→ 또는 lookAt 좌표 잘못됨

### 인형 색상 망가짐
→ spotLight 또는 pointLight 사용 중
→ ambientLight + directionalLight만 사용

### 조이스틱이 박스 안에 있음
→ MACHINE.consoleY 좌표 잘못 (양수 X, -1.5 정도여야 함)

---

## 결론 - 가장 중요한 것

### 이번에는 단편적 패치 금지

이전 시도에서 매번 한 가지씩만 고쳐서 다른 부분이 계속 망가졌습니다.

이번에는:
1. **7개 파일 완전 재작성**
2. **체크리스트 12개 모두 통과 후에만 완료 보고**
3. **본인이 직접 화면 확인** (Vocaflow 페이지 접속)

타협 금지. 진짜 인형뽑기 같아야 함.

### 시간 예산
- Phase 1 (현재 파악): 5분
- Phase 2 (재작성): 30분
- Phase 3 (검증): 10분
- Phase 4 (인터랙션): 10분
- Phase 5 (미세 조정): 15분

총 70분 예상.
