# WordBlitz 긴급 수정 - 집게/조이스틱/박스 디자인

## 현재 캡처 진단

### 잘 된 부분 (유지)
- 박스 4면 + 빨간 프레임 ✓
- VOCAFLOW LED 사인 ✓
- 천장 레일 (검정 가로 막대) ✓
- 인형 7개 분포 + 색상 보존 ✓
- 박스 비율 적절 ✓

### 치명적 문제 (즉시 수정)

#### 문제 1: 집게 본체 안 보임
**원인**: 집게 GLB가 박스 안 인형 사이에 처박혀 있거나 너무 작음
**현상**: 천장 레일에서 케이블이 안 보이고, 집게 본체도 안 보임

#### 문제 2: 조이스틱이 박스 안 침투
**원인**: 조이스틱 좌표가 박스 안쪽 (Z=0.6 등)에 들어감
**현상**: 빨간 공이 인형들 사이에 보임 (검정 패널 위)
**증거**: 캡처 중앙 인형들 사이의 빨간 공 = 조이스틱

#### 문제 3: 박스 디자인 초보 수준
**현상**:
- 빨간 프레임 평면 (그라디언트, 베벨, 광택 없음)
- 천장 레일 너무 단순한 검정 막대
- VOCAFLOW 사인 단조 노란 박스
- 콘솔 텅 빈 빨간 박스 (디자인 요소 0)
- 모서리 세부 디테일 없음
- 빛/그림자 표현 빈약

---

## 수정 지시 (3가지 동시)

### 🔥 수정 1: 집게 위치 + 크기 (CRITICAL)

#### ClawModel.tsx 완전 수정

```typescript
// 현재 문제 추정:
//   - holderRef position이 박스 안쪽 잘못된 위치
//   - 케이블이 천장 레일과 연결 안 됨
//   - 집게 너무 작아서 안 보임

const CLAW_TARGET_SIZE = 2.2;  // 1.8 → 2.2 (인형보다 확실히 크게)
const RAIL_Y = 4.5;            // 천장 레일 위치 (ClawMachine과 일치)
const CEILING_Y = 5.0;         // 박스 천장
const CABLE_TOP_Y = RAIL_Y;    // 케이블 시작점

export function ClawModel({ liveStateRef, grabbedPlushieRef }) {
  const { scene: glbScene } = useGLTF('/wordblitz/FBX_Claw_Rigged_Type-2_new-21.glb');
  const holderRef = useRef();
  const bodyRef = useRef();
  const cableRef = useRef();
  const armsRef = useRef([]);
  
  const clonedScene = useMemo(() => {
    const clone = glbScene.clone(true);
    
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    if (maxDim > 0 && isFinite(maxDim)) {
      const scale = CLAW_TARGET_SIZE / maxDim;
      clone.scale.setScalar(scale);
      
      // 집게 본체 위쪽이 케이블에 매달림
      clone.position.x = -center.x * scale;
      clone.position.y = -box.max.y * scale;
      clone.position.z = -center.z * scale;
    }
    
    // 메탈릭 실버 머티리얼
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          if (m.isMaterial) {
            // 어두운 메탈릭 - 박스 안에서 잘 보임
            m.color = new THREE.Color(0xC0C0CA);  // 실버
            m.metalness = 0.85;
            m.roughness = 0.25;
            m.envMapIntensity = 1.5;
            m.needsUpdate = true;
          }
        });
        
        if (child.name && /arm|claw|finger|grip|hook|joint/i.test(child.name)) {
          armsRef.current.push(child);
        }
      }
      if (child.isBone) {
        armsRef.current.push(child);
      }
    });
    
    console.log('[Claw] 본/팔:', armsRef.current.length, '개');
    console.log('[Claw] 크기:', maxDim.toFixed(2), '→ 스케일:', (CLAW_TARGET_SIZE / maxDim).toFixed(2));
    return clone;
  }, [glbScene]);
  
  useFrame(() => {
    const live = liveStateRef.current;
    
    if (holderRef.current) {
      holderRef.current.position.x = live.clawX * 2.2;
      holderRef.current.position.y = live.clawY;
      holderRef.current.position.z = 0;  // ★ 항상 박스 중앙
    }
    
    if (bodyRef.current) {
      bodyRef.current.rotation.z = live.clawSwing;
    }
    
    if (cableRef.current) {
      // 케이블: 레일(Y=4.5)에서 집게 위쪽까지
      const cableLength = CABLE_TOP_Y - live.clawY - 0.3;
      cableRef.current.scale.y = Math.max(0.1, cableLength);
      cableRef.current.position.y = cableLength / 2 + 0.3;
    }
    
    if (armsRef.current.length >= 4) {
      const closeAmount = (1 - live.clawOpen) * 0.7;
      armsRef.current.forEach((arm) => {
        arm.rotation.x = closeAmount;
      });
    }
    
    if (grabbedPlushieRef?.current && holderRef.current) {
      const grabbed = grabbedPlushieRef.current;
      grabbed.position.x = holderRef.current.position.x;
      grabbed.position.y = holderRef.current.position.y - 1.8;
      grabbed.position.z = 0;
      grabbed.rotation.z = live.clawSwing * 0.7;
    }
  });
  
  return (
    <group ref={holderRef} position={[0, 4.2, 0]}>
      {/* 케이블 - 두껍게 + 메탈릭 (보임) */}
      <mesh ref={cableRef}>
        <cylinderGeometry args={[0.06, 0.06, 1, 12]} />
        <meshStandardMaterial 
          color={0x2A3340} 
          roughness={0.3} 
          metalness={0.85} 
        />
      </mesh>
      
      {/* 집게 마운트 (케이블과 집게 연결부) - 디테일 추가 */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.15, 16]} />
        <meshStandardMaterial 
          color={0x202028} 
          roughness={0.35} 
          metalness={0.85}
        />
      </mesh>
      
      {/* 집게 본체 (흔들림 그룹) */}
      <group ref={bodyRef}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
```

**검증**: 
- F12 Console에 `[Claw] 본/팔: X개` + `[Claw] 크기: XX → 스케일: XX` 출력
- 박스 안 인형 위에 집게 보여야 함

---

### 🔥 수정 2: 조이스틱 박스 밖으로 (CRITICAL)

#### ClawMachine.tsx 콘솔 좌표 강제 분리

**문제**: 캡처에서 빨간 공이 박스 안 인형 사이에 보임 = 콘솔 좌표가 박스 안에 들어감

#### 절대 좌표 다시 정의

```typescript
// 박스 (Y: 0 ~ 5)
박스 외부 베이스 Y = -0.3
박스 바닥 Y = 0
박스 천장 Y = 5

// 콘솔 (Y: -2.5 ~ -0.4) ★ 박스와 명확히 분리
콘솔 윗면 Y = -0.4   ← 박스 베이스(-0.3) 바로 아래
콘솔 중심 Y = -1.5
콘솔 바닥 Y = -2.5

// 콘솔 컨트롤은 콘솔 윗면(-0.4) 위에
컨트롤 Y = -0.4 + 컨트롤 높이/2

// 콘솔 깊이 - 박스보다 사용자 쪽으로 튀어나옴
콘솔 Z = 0.8 (앞쪽으로 0.8 이동)  ★
박스 Z = 0
```

#### 콘솔 + 컨트롤 코드

```typescript
// ClawMachine.tsx 내부
export const MACHINE = {
  width: 6.5,
  height: 5.0,
  depth: 2.8,
  
  // 박스 좌표
  boxFloorY: 0,
  boxCeilingY: 5.0,
  
  // 집게
  clawHomeY: 4.2,
  clawDropY: 1.5,
  clawXRange: 2.2,
  
  // 콘솔 - 박스 밖! ★
  consoleY: -1.5,        // 콘솔 중심
  consoleHeight: 1.2,
  consoleWidth: 6.7,
  consoleDepth: 2.0,
  consoleZ: 0.8,         // ★ 사용자 쪽으로 0.8 튀어나옴
  
  // 콘솔 윗면 (컨트롤 배치 기준)
  consoleSurfaceY: -0.9,  // -1.5 + 0.6 (height/2)
} as const;

// 콘솔 본체 (박스 명확히 분리)
<group position={[0, MACHINE.consoleY, MACHINE.consoleZ]}>
  {/* 메인 박스 */}
  <mesh castShadow receiveShadow>
    <boxGeometry args={[
      MACHINE.consoleWidth,
      MACHINE.consoleHeight,
      MACHINE.consoleDepth
    ]} />
    <meshStandardMaterial 
      color={0xC1232E} 
      roughness={0.3} 
      metalness={0.5} 
    />
  </mesh>
  
  {/* 앞면 살짝 밝은 빨강 (베벨 효과) */}
  <mesh position={[0, 0, MACHINE.consoleDepth / 2 + 0.001]}>
    <planeGeometry args={[
      MACHINE.consoleWidth - 0.1,
      MACHINE.consoleHeight - 0.1
    ]} />
    <meshStandardMaterial 
      color={0xE63946} 
      roughness={0.35} 
      metalness={0.5} 
    />
  </mesh>
  
  {/* 콘솔 윗면 (어두운 패널) - 컨트롤 베이스 */}
  <mesh position={[0, MACHINE.consoleHeight / 2 - 0.05, 0]}>
    <boxGeometry args={[
      MACHINE.consoleWidth - 0.2,
      0.1,
      MACHINE.consoleDepth - 0.1
    ]} />
    <meshStandardMaterial 
      color={0x1A0F2E} 
      roughness={0.6} 
      metalness={0.3}
    />
  </mesh>
</group>

// 컨트롤들 (콘솔 윗면 = consoleSurfaceY 기준)
const SURFACE_Y = MACHINE.consoleSurfaceY;  // -0.9
const CONSOLE_Z = MACHINE.consoleZ;          // 0.8

// ─── 좌측 동전 슬롯 + 작은 버튼 ───
<group position={[-2.4, SURFACE_Y, CONSOLE_Z]}>
  {/* 동전 슬롯 (황금) */}
  <mesh position={[0, 0.05, -0.4]}>
    <boxGeometry args={[0.7, 0.1, 0.3]} />
    <meshStandardMaterial 
      color={0xFFD93D} 
      roughness={0.3} 
      metalness={0.7} 
    />
  </mesh>
  
  {/* 슬롯 구멍 */}
  <mesh position={[0, 0.11, -0.4]}>
    <boxGeometry args={[0.35, 0.02, 0.04]} />
    <meshBasicMaterial color={0x000000} />
  </mesh>
  
  {/* 작은 버튼 1 (← LEFT, 빨간) */}
  <mesh position={[-0.25, 0.1, 0.3]} castShadow>
    <cylinderGeometry args={[0.13, 0.13, 0.1, 24]} />
    <meshStandardMaterial 
      color={0xE63946} 
      roughness={0.3} 
      metalness={0.4} 
    />
  </mesh>
  
  {/* 작은 버튼 2 (RIGHT →, 파란) */}
  <mesh position={[0.25, 0.1, 0.3]} castShadow>
    <cylinderGeometry args={[0.13, 0.13, 0.1, 24]} />
    <meshStandardMaterial 
      color={0x4A90E2} 
      roughness={0.3} 
      metalness={0.4} 
    />
  </mesh>
</group>

// ─── 중앙 조이스틱 (CRITICAL - 가장 잘 보여야 함) ───
<group position={[0, SURFACE_Y, CONSOLE_Z]}>
  {/* 조이스틱 베이스 (어두운 메탈) */}
  <mesh castShadow>
    <cylinderGeometry args={[0.4, 0.5, 0.18, 32]} />
    <meshStandardMaterial 
      color={0x0A0510} 
      roughness={0.5} 
      metalness={0.6} 
    />
  </mesh>
  
  {/* 베이스 윗면 (회색 메탈) */}
  <mesh position={[0, 0.1, 0]}>
    <cylinderGeometry args={[0.36, 0.36, 0.02, 32]} />
    <meshStandardMaterial 
      color={0x303038} 
      roughness={0.4} 
      metalness={0.7}
    />
  </mesh>
  
  {/* 검정 hole */}
  <mesh position={[0, 0.11, 0]}>
    <cylinderGeometry args={[0.2, 0.2, 0.04, 24]} />
    <meshBasicMaterial color={0x000000} />
  </mesh>
  
  {/* 조이스틱 stick + ball - tiltRef로 회전 */}
  <group ref={stickGroupRef} position={[0, 0.13, 0]}>
    {/* Stick (검정 메탈) */}
    <mesh position={[0, 0.45, 0]} castShadow>
      <cylinderGeometry args={[0.07, 0.09, 0.9, 16]} />
      <meshStandardMaterial 
        color={0x111118} 
        roughness={0.4} 
        metalness={0.7} 
      />
    </mesh>
    
    {/* 빨간 공 (가장 큰 빨간 액센트) */}
    <mesh position={[0, 0.95, 0]} castShadow>
      <sphereGeometry args={[0.32, 32, 24]} />
      <meshStandardMaterial 
        color={0xE63946} 
        roughness={0.25} 
        metalness={0.2} 
      />
    </mesh>
    
    {/* 빨간 공 하이라이트 */}
    <mesh position={[-0.1, 1.05, 0.15]}>
      <sphereGeometry args={[0.06, 16, 16]} />
      <meshBasicMaterial 
        color={0xFFFFFF} 
        transparent 
        opacity={0.5} 
      />
    </mesh>
  </group>
</group>

// ─── 우측 DROP 버튼 (가장 큼) ───
<group position={[2.4, SURFACE_Y, CONSOLE_Z]}>
  {/* 검정 베이스 */}
  <mesh castShadow>
    <cylinderGeometry args={[0.55, 0.6, 0.15, 32]} />
    <meshStandardMaterial 
      color={0x0A0510} 
      roughness={0.5} 
      metalness={0.6} 
    />
  </mesh>
  
  {/* 베이스 윗면 (회색) */}
  <mesh position={[0, 0.08, 0]}>
    <cylinderGeometry args={[0.5, 0.5, 0.02, 32]} />
    <meshStandardMaterial 
      color={0x303038} 
      roughness={0.4} 
      metalness={0.7}
    />
  </mesh>
  
  {/* 빨간 큰 DROP 버튼 (눌림) */}
  <mesh ref={dropButtonRef} position={[0, 0.22, 0]} castShadow>
    <cylinderGeometry args={[0.42, 0.42, 0.2, 32]} />
    <meshStandardMaterial 
      color={0xE63946} 
      roughness={0.3} 
      metalness={0.3}
      emissive={0xE63946}
      emissiveIntensity={0.15}
    />
  </mesh>
  
  {/* 버튼 윗면 하이라이트 */}
  <mesh position={[0, 0.32, 0]}>
    <cylinderGeometry args={[0.42, 0.42, 0.005, 32]} />
    <meshStandardMaterial 
      color={0xFF6B7A} 
      roughness={0.2} 
      metalness={0.5}
    />
  </mesh>
  
  {/* DROP! 텍스트 */}
  <mesh position={[0, 0.36, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[0.7, 0.3]} />
    <meshBasicMaterial 
      map={dropTextTexture} 
      transparent 
      depthWrite={false} 
    />
  </mesh>
</group>
```

**검증**:
- 조이스틱 빨간 공이 콘솔 위 (박스 밖)에 명확히 보임
- 박스 안 인형 사이에 빨간 공 절대 X

---

### 🔥 수정 3: 박스 디자인 강화 (디자인 수준 ↑)

#### 빨간 프레임에 베벨 + 그라디언트 추가

```typescript
// ClawMachine.tsx - BoxFrame 컴포넌트

// 좌측 빨간 프레임 (베벨 + 광택)
<group position={[-w, h / 2, 0]}>
  {/* 메인 본체 (어두운 빨강) */}
  <mesh castShadow receiveShadow>
    <boxGeometry args={[0.25, h, MACHINE.depth]} />
    <meshStandardMaterial 
      color={0xC1232E} 
      roughness={0.3} 
      metalness={0.6}
    />
  </mesh>
  
  {/* 앞면 (밝은 빨강) - 베벨 효과 */}
  <mesh position={[0, 0, MACHINE.depth / 2 + 0.001]}>
    <planeGeometry args={[0.25, h]} />
    <meshStandardMaterial 
      color={0xE63946} 
      roughness={0.3} 
      metalness={0.6}
    />
  </mesh>
  
  {/* 안쪽 골드 라인 (디테일) */}
  <mesh position={[0.13, 0, MACHINE.depth / 2 - 0.05]}>
    <boxGeometry args={[0.02, h - 0.4, 0.1]} />
    <meshStandardMaterial 
      color={0xFFD93D} 
      emissive={0xFFD93D}
      emissiveIntensity={0.3}
      roughness={0.3} 
      metalness={0.7}
    />
  </mesh>
</group>

// 우측 빨간 프레임 (대칭)
<group position={[w, h / 2, 0]}>
  {/* 동일 구조 (반전) */}
  ...
  <mesh position={[-0.13, 0, MACHINE.depth / 2 - 0.05]}>
    <boxGeometry args={[0.02, h - 0.4, 0.1]} />
    <meshStandardMaterial 
      color={0xFFD93D} 
      emissive={0xFFD93D}
      emissiveIntensity={0.3}
    />
  </mesh>
</group>

// 천장 - 그라디언트 + 디테일
<group position={[0, h, 0]}>
  {/* 메인 천장 */}
  <mesh castShadow>
    <boxGeometry args={[MACHINE.width, 0.25, MACHINE.depth]} />
    <meshStandardMaterial 
      color={0xC1232E} 
      roughness={0.3} 
      metalness={0.6}
    />
  </mesh>
  
  {/* 앞면 빨간 패널 */}
  <mesh position={[0, 0, MACHINE.depth / 2 + 0.001]}>
    <planeGeometry args={[MACHINE.width, 0.25]} />
    <meshStandardMaterial 
      color={0xE63946} 
      roughness={0.3} 
      metalness={0.6}
    />
  </mesh>
  
  {/* 천장 안쪽 - 분홍 그라디언트 (캡처에서 보이는 효과) */}
  <mesh position={[0, -0.13, 0]} rotation={[Math.PI / 2, 0, 0]}>
    <planeGeometry args={[MACHINE.width - 0.4, MACHINE.depth - 0.4]} />
    <meshStandardMaterial 
      color={0xFF8A95}
      roughness={0.7}
      metalness={0.1}
      emissive={0xFF6B7A}
      emissiveIntensity={0.2}
    />
  </mesh>
</group>
```

#### 사인 디자인 강화

```typescript
// LED 사인 - 단순 노란 박스 → 고급 사인
<group position={[0, MACHINE.height + 0.35, MACHINE.depth / 2 - 0.1]}>
  {/* 사인 백 패널 (어두운 메탈) */}
  <mesh castShadow>
    <boxGeometry args={[MACHINE.width - 0.1, 0.7, 0.2]} />
    <meshStandardMaterial 
      color={0x202028} 
      roughness={0.5} 
      metalness={0.7}
    />
  </mesh>
  
  {/* 사인 메인 (황금 LED) */}
  <mesh position={[0, 0, 0.11]}>
    <boxGeometry args={[MACHINE.width - 0.4, 0.55, 0.05]} />
    <meshStandardMaterial 
      ref={signMatRef}
      color={0xFFD93D}
      emissive={0xFFD93D}
      emissiveIntensity={0.7}
      roughness={0.3}
    />
  </mesh>
  
  {/* 사인 텍스트 (앞면) */}
  <mesh position={[0, 0, 0.14]}>
    <planeGeometry args={[MACHINE.width - 0.5, 0.45]} />
    <meshBasicMaterial map={signTexture} />
  </mesh>
  
  {/* 좌측 별 액센트 */}
  <mesh position={[-MACHINE.width / 2 + 0.4, 0, 0.14]}>
    <circleGeometry args={[0.12, 32]} />
    <meshStandardMaterial 
      color={0xFFFFFF}
      emissive={0xFFFFFF}
      emissiveIntensity={0.5}
    />
  </mesh>
  
  {/* 우측 별 액센트 */}
  <mesh position={[MACHINE.width / 2 - 0.4, 0, 0.14]}>
    <circleGeometry args={[0.12, 32]} />
    <meshStandardMaterial 
      color={0xFFFFFF}
      emissive={0xFFFFFF}
      emissiveIntensity={0.5}
    />
  </mesh>
  
  {/* 사인 빛 (천장 비추는) */}
  <pointLight 
    color={0xFFD93D} 
    intensity={5} 
    distance={4}
    position={[0, -0.5, -0.5]}
  />
</group>
```

#### 콘솔 디자인 강화 (디자인 요소 추가)

```typescript
// 콘솔 본체에 추가할 디테일

{/* 콘솔 - 좌측 골드 라인 */}
<mesh position={[-MACHINE.consoleWidth / 2 + 0.05, 0, MACHINE.consoleDepth / 2 + 0.001]}>
  <planeGeometry args={[0.05, MACHINE.consoleHeight - 0.2]} />
  <meshStandardMaterial 
    color={0xFFD93D} 
    emissive={0xFFD93D}
    emissiveIntensity={0.3}
    roughness={0.3}
  />
</mesh>

{/* 콘솔 - 우측 골드 라인 */}
<mesh position={[MACHINE.consoleWidth / 2 - 0.05, 0, MACHINE.consoleDepth / 2 + 0.001]}>
  <planeGeometry args={[0.05, MACHINE.consoleHeight - 0.2]} />
  <meshStandardMaterial 
    color={0xFFD93D} 
    emissive={0xFFD93D}
    emissiveIntensity={0.3}
  />
</mesh>

{/* 콘솔 - 인스트럭션 라벨 (좌측 텍스트) */}
<mesh position={[-1.5, MACHINE.consoleSurfaceY + 0.06, MACHINE.consoleZ + 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
  <planeGeometry args={[0.6, 0.15]} />
  <meshBasicMaterial map={moveTextTexture} transparent />
</mesh>

{/* 콘솔 - DROP 라벨 (우측 텍스트) */}
<mesh position={[2.4, MACHINE.consoleSurfaceY + 0.06, MACHINE.consoleZ - 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
  <planeGeometry args={[0.5, 0.15]} />
  <meshBasicMaterial map={dropLabelTexture} transparent />
</mesh>

{/* 콘솔 - 점수 디스플레이 (위) */}
<group position={[0, MACHINE.consoleY + MACHINE.consoleHeight / 2 + 0.15, MACHINE.consoleZ - 0.7]}>
  <mesh>
    <boxGeometry args={[2, 0.3, 0.1]} />
    <meshStandardMaterial 
      color={0x000000} 
      emissive={0xFF0000}
      emissiveIntensity={0.4}
    />
  </mesh>
</group>
```

#### 텍스처 헬퍼 추가

```typescript
// "← MOVE →" 텍스처
const moveTextTexture = useMemo(() => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 32px Bungee';
  ctx.fillStyle = '#FFD93D';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('← MOVE →', 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}, []);

// "DROP" 텍스처 (작은)
const dropLabelTexture = useMemo(() => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 36px Bungee';
  ctx.fillStyle = '#E63946';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DROP', 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}, []);
```

---

## 검증 체크리스트 (재수정 후)

### 비주얼 (필수)
- [ ] 집게 본체 박스 안에서 명확히 보임 (인형보다 크게)
- [ ] 케이블이 천장 레일과 명확히 연결
- [ ] 집게 메탈릭 실버 색상
- [ ] 조이스틱 빨간 공이 박스 **밖** (콘솔 위)에 보임
- [ ] DROP 버튼 콘솔 우측 큰 빨간 원
- [ ] 콘솔 좌측 동전 슬롯 + 작은 버튼 2개
- [ ] 박스 빨간 프레임에 골드 라인 (안쪽)
- [ ] 천장 안쪽 분홍 그라디언트
- [ ] LED 사인에 좌우 별 액센트
- [ ] 콘솔 좌우 골드 라인
- [ ] "← MOVE →", "DROP" 라벨 텍스트

### 인터랙션
- [ ] ←→ 이동 → 집게가 박스 안 좌우 이동
- [ ] ←→ 이동 → 조이스틱이 박스 밖에서 그 방향 기울어짐
- [ ] Space → 집게 하강 → DROP 버튼 살짝 눌림

---

## 디버깅 - F12 Console 확인

다음 출력이 모두 있어야 함:

```
[Claw] 본/팔: X 개
[Claw] 크기: XX → 스케일: XX
```

만약 `본/팔: 0` 이면:
```typescript
// ClawModel.tsx에 추가
clone.traverse((child) => {
  console.log(child.type, child.name);  // 모든 메쉬/본 이름 출력
});
```
→ 메쉬 이름 보고 정규식 수정

---

## 보고 형식

수정 완료 후:

```markdown
## WordBlitz 긴급 수정 완료

### 해결된 문제
1. ✅ 집게 본체 보임 (스케일 2.2 + 메탈릭 실버)
2. ✅ 조이스틱 박스 밖 (consoleZ 0.8 사용)
3. ✅ 박스 디자인 강화 (베벨, 골드라인, 그라디언트, 별 액센트)

### 캡처
[새 캡처 첨부]

### 다음 단계
- [있다면]
```
