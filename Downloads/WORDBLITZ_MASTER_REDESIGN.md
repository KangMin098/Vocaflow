# WordBlitz 완전 재설계 지시문 (프로 레벨)

> **"초등학교 수준" → "고품격 3D 게임 수준"으로 끌어올리는 마스터 프롬프트**

---

## 0. 메타 - 이 작업의 본질

### 왜 이전 시도가 모두 실패했나

```
시도 1~10 (실패 패턴):
  1. 좌표 추측
  2. 코드 작성
  3. 사용자 적용
  4. "이상함" 피드백
  5. 좌표만 수정
  6. 다시 1번으로 → 무한 루프

근본 원인:
  ✗ 시각적 검증 없이 코드만 작성
  ✗ 단편적 패치만 반복 (좌표만 만짐)
  ✗ 진짜 게임 디자이너 시각 결여
  ✗ 레퍼런스 분석 없이 추측만
```

### 이번 작업의 원칙

```
✓ 진짜 게임 디자이너처럼 사고
✓ 레퍼런스 먼저 분석 (UFO Catcher, 아케이드)
✓ 화면 직접 보면서 검증 (개발 서버 + 캡처)
✓ 체크리스트 100% 통과까지 멈추지 않음
✓ 각 컴포넌트 독립적으로 검증 후 통합
```

---

## 1. 프로젝트 컨텍스트

### Vocaflow란
영어 학습 플랫폼 (한국 시장).
- **목표**: 영단어를 즐겁게 학습 (게임화)
- **타겟**: 한국 영어 학습자 (10~30대)
- **디자인 철학**: "Quiet UI", 인지심리학 기반, 시도적 즐거움

### WordBlitz란
인형뽑기 메커니즘으로 영단어 학습:
- 한국어 뜻 보고 → 인형(영단어) 뽑기 → 학습
- 정답이면 +120 점, 오답 +30 점
- 잡은 인형은 컬렉션 (Endowment Effect)

### 학술 원리 (이미 검증됨)
```
Variable Reward (Skinner)        → 랜덤 인형 색상
Anticipation (Schultz)           → 1.5초 하강 시간
Active Recall                    → 한국어 → 영단어
Endowment Effect (Thaler)        → 인형 컬렉션
Tangible Memory                  → 단어 ↔ 인형 시각 연결
```

---

## 2. 레퍼런스 분석 (반드시 먼저 보기)

### 진짜 인형뽑기 = UFO Catcher (일본 SEGA)

작업 시작 전 **반드시 다음 이미지 검색**해서 시각 분석:

```
검색어:
1. "UFO Catcher SEGA" - 클래식 일본 인형뽑기
2. "Crane game machine arcade" - 일반 인형뽑기 비주얼
3. "Animal Crossing claw machine" - 게임화된 큐티 버전
4. "Toy Story 2 claw machine" - 영화의 시그니처 장면
```

### 분석할 핵심 요소

#### 외관 (Outer)
```
1. 박스 비율: 가로 ≈ 세로 (정사각형 가까움 또는 가로 길게)
2. 4면 유리: 투명, 반사 효과
3. 상단 사인: LED + 큰 텍스트 + 깜박임
4. 빨간/노란/파란 외부 프레임 (강렬한 색)
5. 콘솔 패널: 박스 정면 아래 직접 연결
```

#### 콘솔 (Control Panel)
```
1. 콘솔 너비 = 박스 너비 (또는 살짝 큼)
2. 콘솔 높이 = 박스의 1/4 ~ 1/3
3. 컨트롤 배치:
   - 좌측: 동전 슬롯 또는 작은 버튼 (꾸미기용)
   - 중앙: 큰 조이스틱 (빨간 공이 끝)
   - 우측: 거대한 빨간 DROP 버튼 (또는 좌우 X/Y 버튼)
4. 인스트럭션 라벨 (작은 텍스트)
```

#### 내부 (Inner)
```
1. 인형 무더기 (자연스럽게 쌓임, 일렬 X)
2. 안쪽 색깔 바닥 (밝은 색)
3. 출구 슬라이드 (옆에 작은 통로)
4. 천장 메탈 레일 (집게가 매달리는)
```

#### 집게 (Claw)
```
1. 메탈릭 실버/그레이
2. 4개 손가락 (또는 3개)
3. 천장 X-축 레일 + Y-축 케이블
4. 닫힐 때 finger 회전 (안쪽으로)
```

#### 분위기 (Atmosphere)
```
1. 네온 라이팅 (분홍, 청록)
2. 어두운 배경 (집중 효과)
3. 사운드: 모터 소리, 잡는 소리, 음악
```

---

## 3. 작업 환경

```
프로젝트: C:\Users\kille\Vocaflow\
구조: Turborepo 모노레포
스택: Next.js 14 + React Three Fiber + drei + Tailwind
의존성: 모두 설치됨

기존 파일 위치:
  apps/web/public/wordblitz/
    FBX_Claw_Rigged_Type-2_new-21.glb (집게 GLB, 사용자 변환)
    plushies/
      Bear.glb, Carrot Character.glb, Cool Bannana Guy.glb,
      Dog.glb, Easter rabbit.glb, Frog Hat.glb,
      Kitten.glb, Panda.glb, Unicorn.glb

  apps/web/src/
    lib/wordblitz/data.ts, types.ts
    components/game/wordblitz/
      WordBlitzGame.tsx, WordBlitzUI.tsx, WordBlitzUI.module.css
      ClawScene.tsx, ClawMachine.tsx, ClawModel.tsx
      Plushie.tsx, PlushieModel.tsx
      useWordBlitzGame.ts
    app/(app)/play/wordblitz/page.tsx

라우트: http://localhost:3000/play/wordblitz
```

### CLAUDE.md (디자인 SSoT)
프로젝트 루트의 `CLAUDE.md` v06.4가 디자인 SSoT.
폰트, 색상, 간격 등 모든 디자인 결정의 단일 기준.

---

## 4. 비주얼 디자인 마스터 가이드

### 4-1. 색 팔레트 (게임 전용)

```typescript
// apps/web/src/lib/wordblitz/theme.ts (신규 생성)
export const WB_COLORS = {
  // 외부 프레임 (메인)
  frameRed: 0xE63946,        // 빨간 메탈릭 프레임
  frameRedDark: 0xC1232E,    // 어두운 빨강 (베벨)
  frameRedLight: 0xFF6B7A,   // 밝은 빨강 (하이라이트)
  
  // 콘솔
  consoleBody: 0xC1232E,     // 콘솔 본체
  consoleBlack: 0x0A0510,    // 컨트롤 베이스
  consolePurple: 0x2A1A4A,   // 보라 패널
  
  // 박스 내부
  innerFloor: 0xF5E6D3,      // 부드러운 베이지 (인형 색상 보존)
  innerWall: 0x1A0F2E,       // 어두운 보라 (대비)
  
  // 액센트
  goldYellow: 0xFFD93D,      // 정답 + LED
  goldDeep: 0xE0AC1E,        // 정답 그림자
  neonPink: 0xFF6B9D,        // 네온 (살짝)
  neonCyan: 0x6BB6FF,        // 네온 (살짝)
  
  // 집게
  clawSilver: 0xC0C0C8,
  clawDark: 0x2A3340,
  cableBlack: 0x0F1018,
  
  // 배경
  bgDeepPurple: 0x0A0510,    // 가장 어두운
  bgPurple: 0x1A0530,        // 메인 배경
  bgPurpleLight: 0x2A1058,   // 그라디언트 끝
} as const;
```

### 4-2. 박스 크기 + 비율 (CRITICAL)

화면 비율에 적응하도록 **반응형 카메라** 사용:

```typescript
// 화면 비율 (대부분 와이드 16:9)
// 박스 비율 목표: 가로 1.3 : 세로 1 (살짝 가로 길게)

박스 크기:
  width: 6.5    (가로)
  height: 5.0   (세로)
  depth: 2.8    (깊이)

콘솔 크기:
  width: 6.7    (박스보다 살짝 큼)
  height: 1.2   (높이)
  depth: 2.0    (깊이, 박스보다 짧음 → 사용자 쪽 튀어나옴)

상단 LED 사인:
  width: 6.3
  height: 0.6
  position: 박스 위 (0.4 갭)
```

### 4-3. 좌표계 (절대 변경 금지)

```
Y 축 (세로) - 모든 좌표의 단일 기준
═══════════════════════════════════════
Y =  6.0  ━━━ 화면 위 여백
Y =  5.6  ━━━ ┃ LED 사인 (높이 0.6)
Y =  5.0  ━━━ ┃ 박스 천장 ★
Y =  4.5  ━━━ ┃ 천장 레일
Y =  4.2  ━━━ ┃ 집게 home
Y =  2.8  ━━━ ┃ 박스 중간
Y =  1.5  ━━━ ┃ 집게 drop
Y =  1.0  ━━━ ┃ 인형 머리
Y =  0.0  ━━━ ┻ 박스 바닥 ★
Y = -0.3  ━━━ 박스 외부 베이스
Y = -0.9  ━━━ ┳ 콘솔 윗면 (박스 직접 연결)
Y = -1.5  ━━━ ┃ 콘솔 중심
Y = -2.1  ━━━ ┻ 콘솔 바닥
Y = -2.5  ━━━ 화면 아래 여백
═══════════════════════════════════════

전체 세로: 5.6 - (-2.1) = 7.7
카메라 lookAt Y: 1.7 (전체 세로의 중심점)
```

### 4-4. 카메라 (반응형 + 정확한 위치)

```typescript
// ClawScene.tsx
import { useState, useEffect } from 'react';

// 화면 비율 추적
function useAspectRatio() {
  const [aspect, setAspect] = useState(16 / 9);
  
  useEffect(() => {
    const update = () => setAspect(window.innerWidth / window.innerHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  
  return aspect;
}

// 카메라 자동 계산
function getCameraConfig(aspect: number) {
  // 박스 + 콘솔 전체 세로: 7.7
  // 박스 가로: 6.5
  
  // FOV 35도 기준, Z 거리 = (높이/2) / tan(FOV/2)
  // 가로 비율 적응: 좁은 화면이면 더 멀리
  
  const targetHeight = 8.5;  // 화면에 보일 세로 (여백 포함)
  const fov = 35;
  const fovRad = (fov * Math.PI) / 180;
  
  // 세로 기준 Z 거리
  let z = targetHeight / 2 / Math.tan(fovRad / 2);
  
  // 가로 기준 보정 (좁은 화면이면 더 멀리)
  const targetWidth = 7.5;  // 화면에 보일 가로
  const zForWidth = targetWidth / 2 / Math.tan(fovRad / 2) / aspect;
  z = Math.max(z, zForWidth);
  
  return {
    position: [0, 1.7, z] as [number, number, number],
    fov,
    lookAt: [0, 1.7, 0] as [number, number, number],
  };
}
```

이 함수를 ClawScene에서 사용:

```typescript
function ClawScene({ ... }) {
  const aspect = useAspectRatio();
  const camConfig = useMemo(() => getCameraConfig(aspect), [aspect]);
  
  return (
    <Canvas
      camera={{
        position: camConfig.position,
        fov: camConfig.fov,
        near: 0.1,
        far: 100,
      }}
      onCreated={({ camera }) => {
        camera.lookAt(...camConfig.lookAt);
      }}
      ...
    >
      ...
    </Canvas>
  );
}
```

### 4-5. 라이팅 마스터 (인형 색상 보존 + 분위기)

```typescript
{/* 1. Hemisphere - 자연스러운 환경광 (위 밝고 아래 살짝 어두움) */}
<hemisphereLight 
  args={[0xFFFFFF, 0x202030, 1.0]}  // sky, ground, intensity
/>

{/* 2. 천장 면조명 (박스 안 메인 조명) - 그림자 없음 */}
<rectAreaLight
  width={5.5}
  height={2}
  intensity={3}
  color={0xFFFFFF}
  position={[0, 4.8, 0]}
  rotation={[-Math.PI / 2, 0, 0]}
/>

{/* 3. 정면 fill (인형 색상 보존, 약함) */}
<directionalLight
  color={0xFFFFFF}
  intensity={0.4}
  position={[0, 3, 8]}
/>

{/* 4. 콘솔 액센트 (콘솔만 비춤) */}
<spotLight
  color={0xFFFFFF}
  intensity={20}
  position={[0, 3, 5]}
  angle={Math.PI / 6}
  penumbra={0.5}
  distance={6}
  target-position={[0, -1.5, 1]}
/>

{/* 5. 네온 액센트 (분위기) */}
<pointLight color={0xFF6B9D} intensity={5} distance={6} position={[-3.5, 2, 1]} />
<pointLight color={0x6BB6FF} intensity={5} distance={6} position={[3.5, 2, 1]} />

{/* 6. 톤 매핑 - 색상 자연스럽게 */}
gl={{ 
  antialias: true, 
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.0,
}}
```

### 4-6. 머티리얼 디자인 가이드

#### 박스 외부 프레임
```typescript
// 빨간 메탈릭 - PBR 머티리얼
<meshStandardMaterial
  color={0xE63946}
  roughness={0.3}      // 살짝 광택
  metalness={0.6}      // 메탈릭
  envMapIntensity={1.5}
/>
```

#### 박스 내부 바닥
```typescript
// 부드러운 베이지 (인형 색 보존)
<meshStandardMaterial
  color={0xF5E6D3}
  roughness={0.85}     // 무광
  metalness={0.05}
/>
```

#### 유리 (앞 + 좌우)
```typescript
<meshPhysicalMaterial
  color={0xFFFFFF}
  metalness={0}
  roughness={0.05}
  transmission={0.9}    // 투명도
  thickness={0.1}
  ior={1.5}            // 굴절률 (유리)
  opacity={0.15}
  transparent
/>
```

#### LED 사인
```typescript
<meshStandardMaterial
  color={0xFFD93D}
  emissive={0xFFD93D}
  emissiveIntensity={0.8}    // 자체 발광 (animated)
  roughness={0.2}
/>
```

---

## 5. 컴포넌트 별 상세 사양

### 5-1. ClawMachine.tsx (박스 + 콘솔 통합)

#### 구조 계층
```
<group>
  {/* 외부 베이스 */}
  <BaseFooting />
  
  {/* 박스 부분 (Y: 0 ~ 5) */}
  <BoxFrame />          // 빨간 4면 프레임
  <BoxInterior />       // 내부 (벽 + 바닥)
  <BoxGlass />          // 앞쪽 + 좌우 유리
  <CeilingLight />      // 천장 면조명
  <TopRail />           // 천장 메탈 레일 (집게가 매달림)
  
  {/* 사인 (Y: 5.0 ~ 5.6) */}
  <LEDSign />           // VOCAFLOW + 깜박임
  
  {/* 콘솔 (Y: -0.3 ~ -2.1) */}
  <ConsoleBase />       // 빨간 본체 (사다리꼴)
  <ConsoleSurface />    // 윗면 (살짝 기울어진 패널)
  <ConsoleControls>     // 컨트롤들
    <SmallButtons />    // 좌측 동전 슬롯 + 작은 버튼
    <Joystick />        // 중앙 큰 조이스틱
    <DropButton />      // 우측 거대 빨간 버튼
    <InstructionPlate />// "← MOVE → / DROP" 텍스트
  </ConsoleControls>
</group>
```

#### 콘솔 디테일 (CRITICAL)

콘솔이 가장 안 보이는 부분이었으므로 **매우 상세하게**:

```typescript
// 1. 콘솔 본체 - 사다리꼴 (앞쪽 살짝 튀어나옴)
const ConsoleBase = () => {
  // 단순 box보다는 BufferGeometry로 사다리꼴 만들기
  // 또는 box로 단순화 + 앞쪽 panel 추가
  
  return (
    <group position={[0, -1.5, 0.8]}>
      {/* 콘솔 본체 (메인) */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[6.7, 1.2, 2.0]} />
        <meshStandardMaterial 
          color={0xC1232E} 
          roughness={0.3} 
          metalness={0.5} 
        />
      </mesh>
      
      {/* 콘솔 앞면 (사용자 쪽) - 빨간 메탈 */}
      <mesh position={[0, 0, 1.0]}>
        <planeGeometry args={[6.7, 1.2]} />
        <meshStandardMaterial 
          color={0xE63946} 
          roughness={0.4} 
          metalness={0.5} 
        />
      </mesh>
      
      {/* 콘솔 윗면 (컨트롤 패널) - 살짝 기울어짐 */}
      <mesh position={[0, 0.6, 0]} rotation={[-Math.PI / 12, 0, 0]}>
        <boxGeometry args={[6.5, 0.1, 1.8]} />
        <meshStandardMaterial 
          color={0x1A0F2E} 
          roughness={0.6} 
          metalness={0.3} 
        />
      </mesh>
    </group>
  );
};

// 2. 좌측 컨트롤 영역 (동전 슬롯 + 작은 버튼)
const LeftControls = () => (
  <group position={[-2.2, -0.7, 1.6]}>  {/* 콘솔 윗면 위 */}
    {/* 동전 슬롯 - 황금 메탈 */}
    <mesh>
      <boxGeometry args={[0.8, 0.1, 0.4]} />
      <meshStandardMaterial color={0xFFD93D} roughness={0.3} metalness={0.7} />
    </mesh>
    
    {/* 슬롯 구멍 (어두운 검정) */}
    <mesh position={[0, 0.06, 0]}>
      <boxGeometry args={[0.4, 0.02, 0.05]} />
      <meshBasicMaterial color={0x000000} />
    </mesh>
    
    {/* 작은 빨간 버튼 1 (← LEFT) */}
    <mesh position={[-0.25, 0.1, 0.4]} castShadow>
      <cylinderGeometry args={[0.12, 0.12, 0.08, 24]} />
      <meshStandardMaterial color={0xE63946} roughness={0.3} metalness={0.4} />
    </mesh>
    {/* 작은 버튼 2 (RIGHT →) */}
    <mesh position={[0.25, 0.1, 0.4]} castShadow>
      <cylinderGeometry args={[0.12, 0.12, 0.08, 24]} />
      <meshStandardMaterial color={0xE63946} roughness={0.3} metalness={0.4} />
    </mesh>
  </group>
);

// 3. 중앙 조이스틱 (CRITICAL - 가장 잘 보여야 함)
const Joystick = ({ tiltRef }) => {
  const stickRef = useRef();
  
  useFrame(() => {
    if (stickRef.current) {
      stickRef.current.rotation.z = -tiltRef.current * 0.4;
    }
  });
  
  return (
    <group position={[0, -0.7, 1.5]}>  {/* 콘솔 윗면 위 중앙 */}
      {/* 조이스틱 베이스 (검정 cylinder) */}
      <mesh castShadow>
        <cylinderGeometry args={[0.35, 0.45, 0.15, 32]} />
        <meshStandardMaterial color={0x0A0510} roughness={0.6} metalness={0.5} />
      </mesh>
      
      {/* 베이스 윗면 (어두운 회색) */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.02, 32]} />
        <meshStandardMaterial color={0x202028} roughness={0.4} />
      </mesh>
      
      {/* 검정 hole (조이스틱 구멍) */}
      <mesh position={[0, 0.085, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.04, 24]} />
        <meshBasicMaterial color={0x000000} />
      </mesh>
      
      {/* 조이스틱 stick + ball (회전 그룹) */}
      <group ref={stickRef} position={[0, 0.1, 0]}>
        {/* Stick (검정 메탈 막대) */}
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.08, 0.8, 16]} />
          <meshStandardMaterial color={0x111118} roughness={0.4} metalness={0.7} />
        </mesh>
        
        {/* 빨간 공 (스틱 끝, 가장 큰 빨간 요소) */}
        <mesh position={[0, 0.85, 0]} castShadow>
          <sphereGeometry args={[0.32, 32, 24]} />
          <meshStandardMaterial 
            color={0xE63946} 
            roughness={0.25} 
            metalness={0.2} 
          />
        </mesh>
        
        {/* 빨간 공 하이라이트 (광택) */}
        <mesh position={[-0.1, 0.95, 0.15]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial color={0xFFFFFF} transparent opacity={0.6} />
        </mesh>
      </group>
    </group>
  );
};

// 4. 우측 DROP 버튼 (가장 큰 시각 요소)
const DropButton = ({ pressedRef }) => {
  const buttonRef = useRef();
  
  useFrame(() => {
    if (buttonRef.current) {
      const target = pressedRef.current > 0.5 ? -0.05 : 0;
      buttonRef.current.position.y += (target - buttonRef.current.position.y) * 0.3;
    }
  });
  
  return (
    <group position={[2.2, -0.7, 1.5]}>
      {/* 검정 베이스 */}
      <mesh castShadow>
        <cylinderGeometry args={[0.5, 0.55, 0.15, 32]} />
        <meshStandardMaterial color={0x0A0510} roughness={0.6} metalness={0.5} />
      </mesh>
      
      {/* 베이스 윗면 (살짝 안쪽) */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 0.02, 32]} />
        <meshStandardMaterial color={0x202028} roughness={0.4} />
      </mesh>
      
      {/* 빨간 큰 버튼 (눌림 애니메이션) */}
      <mesh ref={buttonRef} position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.4, 0.18, 32]} />
        <meshStandardMaterial 
          color={0xE63946} 
          roughness={0.3} 
          metalness={0.3}
          emissive={0xE63946}
          emissiveIntensity={0.1}
        />
      </mesh>
      
      {/* 버튼 윗면 하이라이트 */}
      <mesh position={[0, 0.30, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.005, 32]} />
        <meshStandardMaterial 
          color={0xFF6B7A} 
          roughness={0.2} 
          metalness={0.4}
        />
      </mesh>
      
      {/* DROP! 텍스트 (위에 떠 있는 라벨) */}
      <mesh position={[0, 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.7, 0.7]} />
        <meshBasicMaterial map={dropTextTexture} transparent depthWrite={false} />
      </mesh>
    </group>
  );
};
```

#### LED 사인 디테일

```typescript
const LEDSign = () => {
  const matRef = useRef();
  
  useFrame(({ clock }) => {
    if (matRef.current) {
      // 깜박임 (호흡)
      matRef.current.emissiveIntensity = 0.6 + Math.sin(clock.elapsedTime * 1.5) * 0.2;
    }
  });
  
  return (
    <group position={[0, 5.3, 1.3]}>  {/* 박스 위 + 살짝 앞 */}
      {/* 사인 박스 (배경) */}
      <mesh castShadow>
        <boxGeometry args={[6.3, 0.6, 0.2]} />
        <meshStandardMaterial 
          ref={matRef}
          color={0xFFD93D}
          emissive={0xFFD93D}
          emissiveIntensity={0.6}
          roughness={0.3}
        />
      </mesh>
      
      {/* 사인 텍스트 (앞면) */}
      <mesh position={[0, 0, 0.11]}>
        <planeGeometry args={[6.0, 0.5]} />
        <meshBasicMaterial map={signTexture} />
      </mesh>
      
      {/* 사인 빛 그림자 (박스 천장에 비침) */}
      <pointLight 
        color={0xFFD93D} 
        intensity={3} 
        distance={3}
        position={[0, -0.5, -0.5]}
      />
    </group>
  );
};
```

### 5-2. ClawModel.tsx (집게)

#### 핵심 - 집게가 보여야 함

```typescript
const CLAW_TARGET_SIZE = 1.8;  // ★ 인형보다 큼 (인형 1.0)

export function ClawModel({ liveStateRef, grabbedPlushieRef }) {
  const { scene: glbScene } = useGLTF('/wordblitz/FBX_Claw_Rigged_Type-2_new-21.glb');
  const holderRef = useRef();
  const bodyRef = useRef();
  const cableRef = useRef();
  const armsRef = useRef([]);
  
  const clonedScene = useMemo(() => {
    const clone = glbScene.clone(true);
    
    // 자동 스케일 - 크게! (인형보다 커야 함)
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    if (maxDim > 0) {
      const scale = CLAW_TARGET_SIZE / maxDim;
      clone.scale.setScalar(scale);
      
      clone.position.x = -center.x * scale;
      clone.position.y = -box.max.y * scale;  // 위쪽이 케이블에 매달림
      clone.position.z = -center.z * scale;
    }
    
    // 머티리얼 - 메탈릭 실버
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          if (m.isMaterial) {
            m.metalness = 0.8;     // 메탈릭
            m.roughness = 0.3;     // 살짝 광택
            m.envMapIntensity = 1.5;
            m.needsUpdate = true;
          }
        });
        
        // 본 식별
        if (child.name && /arm|claw|finger|grip|hook|joint/i.test(child.name)) {
          armsRef.current.push(child);
        }
      }
      if (child.isBone) {
        armsRef.current.push(child);
      }
    });
    
    console.log('[Claw]', armsRef.current.length, '개 본 발견');
    return clone;
  }, [glbScene]);
  
  // X 레일 위치 (천장에서 좌우 이동) - 시각적 디테일
  const railRef = useRef();
  
  useFrame(() => {
    const live = liveStateRef.current;
    
    // 집게 위치
    if (holderRef.current) {
      holderRef.current.position.x = live.clawX * 2.5;  // X 범위
      holderRef.current.position.y = live.clawY;
    }
    
    // 진자 흔들림
    if (bodyRef.current) {
      bodyRef.current.rotation.z = live.clawSwing;
    }
    
    // 케이블 길이 (천장에서 집게까지)
    if (cableRef.current) {
      const cableLength = 5.0 - live.clawY - 0.2;  // 천장 Y=5
      cableRef.current.scale.y = Math.max(0.1, cableLength);
      cableRef.current.position.y = cableLength / 2 + 0.2;
    }
    
    // X 레일 (집게 따라 이동)
    if (railRef.current) {
      railRef.current.position.x = live.clawX * 2.5;
    }
    
    // 4팔 회전
    if (armsRef.current.length >= 4) {
      const closeAmount = (1 - live.clawOpen) * 0.7;  // 더 강하게 닫힘
      armsRef.current.forEach((arm) => {
        arm.rotation.x = closeAmount;
      });
    }
    
    // 잡힌 인형 따라가기
    if (grabbedPlushieRef?.current && holderRef.current) {
      const grabbed = grabbedPlushieRef.current;
      grabbed.position.x = holderRef.current.position.x;
      grabbed.position.y = holderRef.current.position.y - 1.6;
      grabbed.position.z = 0;
      grabbed.rotation.z = live.clawSwing * 0.7;
    }
  });
  
  return (
    <>
      {/* X 레일 (천장에 박힌) - 집게 따라 이동 */}
      <group ref={railRef} position={[0, 4.6, 0]}>
        <mesh>
          <boxGeometry args={[0.3, 0.15, 0.3]} />
          <meshStandardMaterial color={0x2A3340} roughness={0.4} metalness={0.7} />
        </mesh>
      </group>
      
      {/* 집게 그룹 */}
      <group ref={holderRef} position={[0, 4.2, 0]}>
        {/* 케이블 */}
        <mesh ref={cableRef}>
          <cylinderGeometry args={[0.05, 0.05, 1, 8]} />
          <meshStandardMaterial color={0x0F1018} roughness={0.5} metalness={0.6} />
        </mesh>
        
        {/* 집게 본체 */}
        <group ref={bodyRef}>
          <primitive object={clonedScene} />
        </group>
      </group>
    </>
  );
}
```

### 5-3. PlushieModel.tsx (인형)

#### 핵심 - 인형 크기 통일 + 색상 보존 + GLB 애니메이션

```typescript
const PLUSHIE_TARGET_HEIGHT = 1.0;  // 모든 인형 높이 통일

function PlushieGLB({ type, isTarget, seed = 0 }) {
  const { scene, animations } = useGLTF(type.modelUrl);
  const groupRef = useRef();
  
  const cloned = useMemo(() => {
    const clone = scene.clone(true);
    
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Y(높이) 기준 스케일 - 모든 인형 동일 높이
    if (size.y > 0) {
      const scale = PLUSHIE_TARGET_HEIGHT / size.y;
      clone.scale.setScalar(scale);
      
      // 발이 정확히 0에 닿음
      clone.position.x = -center.x * scale;
      clone.position.y = -box.min.y * scale;
      clone.position.z = -center.z * scale;
    }
    
    // 머티리얼 - 그대로 유지! emissive 적용 X
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        
        // PBR 살짝 보정 (low-poly GLB도 자연스럽게)
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
            m.envMapIntensity = 0.8;
            m.needsUpdate = true;
          }
        });
      }
    });
    
    return clone;
  }, [scene]);
  
  // GLB 애니메이션 자동 재생
  const { actions, names } = useAnimations(animations, groupRef);
  
  useEffect(() => {
    if (names.length === 0) return;
    
    const action = actions[names[0]];
    if (action) {
      action.reset().fadeIn(0.5).play();
      action.timeScale = 0.6 + Math.random() * 0.4;  // 다양화
    }
    
    return () => action?.fadeOut(0.5);
  }, [actions, names]);
  
  // 애니메이션 없으면 미세 효과
  useFrame(({ clock }) => {
    if (!groupRef.current || names.length > 0) return;
    
    const t = clock.elapsedTime + seed;
    groupRef.current.position.y = Math.sin(t * 1.2) * 0.02;
    groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.05;
  });
  
  return (
    <group ref={groupRef}>
      <primitive object={cloned} />
    </group>
  );
}
```

### 5-4. Plushie.tsx (인형 컨테이너)

#### 라벨 - 인형 위에 정확히 + 카메라 향함

```typescript
export const Plushie = forwardRef(function Plushie({ data, isGrabbed }, ref) {
  // ...
  
  return (
    <group ref={groupRef} position={data.position} rotation={[0, data.rotationY, 0]}>
      {/* GLB 인형 */}
      <PlushieModel type={data.type} isTarget={data.isTarget} seed={seed} />
      
      {/* 단어 라벨 (인형 머리 위 + 카메라 향함) */}
      <mesh ref={labelRef} position={[0, 1.3, 0]}>
        <planeGeometry args={[1.2, 0.32]} />
        <meshBasicMaterial 
          map={labelTex} 
          transparent 
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      
      {/* 정답 글로우 ring (바닥) */}
      {data.isTarget && !isGrabbed && (
        <mesh ref={glowRingRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.65, 32]} />
          <meshBasicMaterial 
            color={0xFFD93D} 
            transparent 
            opacity={0.6} 
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      
      {/* 정답 빛 (위로 솟는 광선) */}
      {data.isTarget && !isGrabbed && (
        <mesh position={[0, 1.0, 0]}>
          <cylinderGeometry args={[0.05, 0.3, 2, 16, 1, true]} />
          <meshBasicMaterial 
            color={0xFFD93D} 
            transparent 
            opacity={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
});
```

#### 인형 배치 - 자연스러운 무더기

```typescript
// data.ts
export const PLUSHIE_POSITIONS = [
  // 앞줄 4개 (Z = 0.6, 카메라 가까이)
  { x: -2.5, z: 0.6, rotY: 0.2 },
  { x: -0.85, z: 0.5, rotY: -0.1 },
  { x: 0.85, z: 0.5, rotY: 0.15 },
  { x: 2.5, z: 0.6, rotY: -0.25 },
  // 뒷줄 3개 (Z = -0.4, 지그재그)
  { x: -1.7, z: -0.4, rotY: 0.4 },
  { x: 0, z: -0.5, rotY: 0 },
  { x: 1.7, z: -0.4, rotY: -0.3 },
];
```

---

## 6. UI 오버레이 디자인 (Vocaflow 스타일)

### 6-1. WordBlitzUI - 미니멀 + Quiet UI

이전 UI는 그대로 유지하되, **Vocaflow 톤** 적용:

```css
/* WordBlitzUI.module.css */

/* 상단 HUD - 글래스모피즘 */
.wb-hud {
  background: rgba(15, 8, 30, 0.4);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 12px 18px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

/* 한국어 뜻 풍선 - 고품격 */
.wb-meaning {
  background: linear-gradient(135deg, #FFD93D 0%, #FFAA1E 100%);
  border-radius: 16px;
  padding: 14px 28px;
  box-shadow:
    0 8px 24px rgba(255, 217, 61, 0.4),
    0 0 60px rgba(255, 217, 61, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    inset 0 -2px 0 rgba(0, 0, 0, 0.1);
}

.wb-meaning-text {
  font-family: 'Lora', serif;
  font-weight: 700;
  font-size: 22px;
  color: #2A1810;
  letter-spacing: -0.01em;
}
```

---

## 7. 작업 흐름 (반드시 이 순서)

### Step 1: 환경 설정 + 레퍼런스 분석 (10분)

1. 개발 서버 실행 (`pnpm dev`)
2. 브라우저에서 현재 상태 확인
3. F12 Console에서 에러 + GLB 로드 확인
4. 위 §2 레퍼런스 이미지 검색 + 분석

### Step 2: data.ts + types.ts 업데이트 (5분)

```typescript
// 새 좌표
PLUSHIE_POSITIONS = [...]
PLUSHIE_TYPES = [...]  // 9개 GLB 매칭

// 새 게임 설정
GAME_CONFIG.CLAW_HOME_Y = 4.2
GAME_CONFIG.CLAW_DROP_Y = 1.5
```

### Step 3: ClawMachine.tsx 완전 재작성 (30분)

위 §5-1 사양대로 완전히 다시 작성:
- 모든 컴포넌트 분리 (BaseFooting, BoxFrame, ConsoleBase 등)
- 정확한 좌표 사용
- 머티리얼 PBR 적용

**검증 포인트:**
- 박스 4면 보임
- LED 사인 위에 보임
- 콘솔 박스 직접 연결
- 조이스틱 빨간 공 명확히 보임
- DROP 버튼 우측 큰 빨간 원

### Step 4: ClawModel.tsx 재작성 (15분)

위 §5-2 사양대로:
- 집게 크기 1.8 (인형보다 큼)
- 메탈릭 머티리얼
- X 레일 추가
- 본 회전 검증

**검증 포인트:**
- 집게 박스 안에 명확히 보임
- 케이블 천장에서 매달림
- 좌우 이동 시 X 레일 따라옴
- 4팔 닫힘 동작

### Step 5: PlushieModel.tsx + Plushie.tsx 재작성 (20분)

위 §5-3, §5-4 사양대로:
- 모든 인형 높이 1.0 통일
- GLB 애니메이션 자동 재생
- 라벨 인형 위 정확히
- 정답 인형 ring + 빛 광선

**검증 포인트:**
- 7개 인형 모두 같은 높이
- 색상 그대로 (망가짐 없음)
- 라벨 인형 위 + 카메라 향함
- 정답 인형 황금 ring + 위로 솟는 빛

### Step 6: ClawScene.tsx 재작성 (10분)

위 §4-4, §4-5 사양대로:
- 반응형 카메라
- 6단계 라이팅 (hemisphere, rectArea, fill, spot, neon × 2)
- ToneMapping ACES Filmic

**검증 포인트:**
- 화면 비율 맞음 (양옆 검은 여백 최소)
- 인형 색상 보존
- 박스 + 콘솔 모두 보임

### Step 7: 통합 검증 (10분)

체크리스트 (모두 통과 필수):

#### 비주얼 (15개)
- [ ] 박스 4면 모두 보임 (좌/우/위/뒤)
- [ ] LED 사인 박스 위 정확히 (VOCAFLOW + 깜박임)
- [ ] 박스 천장 레일 보임
- [ ] 집게 박스 안 명확히 (인형보다 크게)
- [ ] 케이블 천장에서 매달림
- [ ] 인형 7개 분포 (앞 4 + 뒤 3 지그재그)
- [ ] 모든 인형 동일 높이
- [ ] 인형 색상 GLB 원본 그대로
- [ ] 라벨 인형 위 + 카메라 향함
- [ ] 정답 인형 황금 ring + 빛 광선
- [ ] 박스 외부 베이스 (검정) 보임
- [ ] 콘솔 박스 직접 연결 (떠있지 않음)
- [ ] 조이스틱 빨간 공 명확히
- [ ] DROP 버튼 우측 큰 빨간 원
- [ ] 양옆 검은 여백 최소

#### 인터랙션 (8개)
- [ ] ←→ 키 → 집게 좌우
- [ ] 집게 이동 → X 레일 따라 이동
- [ ] 집게 이동 → 조이스틱 그 방향 기울어짐
- [ ] Space → 집게 하강
- [ ] Space → DROP 버튼 살짝 눌림
- [ ] 집게 닫기 → 4팔 회전
- [ ] 인형 잡기 → 매달려 올라옴
- [ ] 정답/오답 → 토스트 + TTS

### Step 8: 캡처 + 보고

#### 보고 형식

```markdown
## WordBlitz 재설계 완료

### 수정 파일 (7개)
1. lib/wordblitz/data.ts (PLUSHIE_POSITIONS, PLUSHIE_TYPES)
2. lib/wordblitz/types.ts (rotY 추가)
3. components/game/wordblitz/ClawMachine.tsx (완전 재작성)
4. components/game/wordblitz/ClawModel.tsx (집게 크기 1.8 + X 레일)
5. components/game/wordblitz/PlushieModel.tsx (높이 1.0 통일)
6. components/game/wordblitz/Plushie.tsx (라벨 + 글로우)
7. components/game/wordblitz/ClawScene.tsx (반응형 카메라 + 라이팅)

### 체크리스트
[비주얼 15개 / 인터랙션 8개 모두 통과]

### 캡처
[화면 캡처 첨부]

### CLAUDE.md 업데이트 사항
- WordBlitz 좌표계 v6 추가
- WB_COLORS 팔레트 lib/wordblitz/theme.ts
- 6단계 라이팅 시스템

### 알려진 제약
- (있다면)
```

---

## 8. 디버깅 가이드

### 문제: 집게가 안 보임
```
원인: 1) GLB 로드 실패 → F12 Console 확인
      2) scale 너무 작음 → 1.8 확인
      3) Y 위치 잘못 → 4.2 (박스 천장 5에서 0.8 아래)
```

### 문제: 박스 잘림
```
원인: 1) 카메라 z 너무 가까움 → 자동 계산 확인
      2) FOV 너무 큼 → 35도 권장
      3) 박스 height 너무 큼 → 5.0 확인
```

### 문제: 인형 색상 망가짐
```
원인: 1) spotLight 사용 중 → rectAreaLight + hemisphere 사용
      2) emissive 적용 중 → PlushieModel에서 제거
      3) toneMapping 잘못 → ACESFilmicToneMapping
```

### 문제: 조이스틱 안 보임
```
원인: 1) Y 좌표 잘못 → 콘솔 윗면 위 (Y -0.7)
      2) 빨간 공 너무 작음 → sphere radius 0.32
      3) 조명 부족 → spotLight 콘솔에 비추기
```

---

## 9. 절대 금지 사항

```
✗ TODO 주석
✗ placeholder 코드
✗ 단편적 패치 (좌표만 만지기)
✗ 7개 파일 일부만 수정
✗ 검증 없이 완료 보고
✗ Inter, Roboto, Arial 폰트
✗ 색상 하드코딩 (게임 전용 예외 외)
✗ spotLight 직접 인형에 비추기 (색상 망가짐)
✗ 임의 클래스명 변경 (Parts Kit)
```

---

## 10. 결론

### 이번 작업의 본질

```
✓ 진짜 게임 디자이너처럼 사고
✓ 레퍼런스 (UFO Catcher) 시각 분석 먼저
✓ 7개 파일 완전 재작성 (단편 패치 금지)
✓ 체크리스트 23개 (비주얼 15 + 인터랙션 8) 모두 통과
✓ 화면 직접 보고 검증 (캡처 + 비교)
✓ Vocaflow 디자인 시스템 (CLAUDE.md) 준수
```

### 시간 예산
- Step 1 환경/레퍼런스: 10분
- Step 2 데이터: 5분
- Step 3 박스/콘솔: 30분
- Step 4 집게: 15분
- Step 5 인형: 20분
- Step 6 씬: 10분
- Step 7 검증: 10분
- Step 8 보고: 5분

**총 105분 (약 1시간 45분)**

### 성공 기준

체크리스트 23개 100% 통과 + 사용자 검증.
"진짜 인형뽑기 같다" 피드백 받을 때까지 멈추지 않음.

---

## Appendix: 파일 매핑

| 파일 | 역할 |
|------|------|
| `lib/wordblitz/data.ts` | 단어 + 인형 + 좌표 데이터 |
| `lib/wordblitz/types.ts` | TypeScript 타입 |
| `lib/wordblitz/theme.ts` | 색상 팔레트 (NEW) |
| `components/game/wordblitz/ClawMachine.tsx` | 박스 + 콘솔 |
| `components/game/wordblitz/ClawModel.tsx` | 집게 GLB + 레일 |
| `components/game/wordblitz/Plushie.tsx` | 인형 컨테이너 |
| `components/game/wordblitz/PlushieModel.tsx` | 인형 GLB + 애니메이션 |
| `components/game/wordblitz/ClawScene.tsx` | 3D 씬 + 카메라 + 라이팅 |
| `components/game/wordblitz/WordBlitzGame.tsx` | 메인 컨테이너 |
| `components/game/wordblitz/WordBlitzUI.tsx` | HUD + Banner |
| `components/game/wordblitz/WordBlitzUI.module.css` | 스타일 |
| `components/game/wordblitz/useWordBlitzGame.ts` | 게임 로직 |
| `app/(app)/play/wordblitz/page.tsx` | 라우트 |
