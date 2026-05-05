// apps/web/src/lib/wordblitz/theme.ts
// WordBlitz 컬러 팔레트 + 치수 (Premium Arcade — v06.7 재설계 2)
//
// 핵심 결정:
//   - 박스 차콜 + 골드 (이전 빨강 폐기)
//   - 박스 내부는 밝게 (천장 LED light box 따뜻한 노란빛)
//   - 인형 색이 풍부히 보이게
//   - 조이스틱/DROP 빨강 보존 (실제 arcade 클래식)
//   - 박스 너비 8.0 (이전 9.0 → 인형 시각 임팩트)

export const WB_COLORS = {
  /* ─── 메인 프레임 (차콜) ─── */
  frameDark: 0x16161D,
  frameMid: 0x252533,
  frameLight: 0x3D3D52,

  /* ─── 콘솔 ─── */
  consoleBody: 0x1A1A24,
  consolePanel: 0x14141C,
  consoleBlack: 0x0A0A12,
  consoleDeep: 0x2A1A4A,

  /* ─── 박스 내부 ─── */
  innerFloor: 0x2A1F3D,        // 광택 어두운 보라
  innerFloorEdge: 0x3D2A5C,
  innerWall: 0x1A0F2E,         // 뒷벽 (그라디언트 텍스처 baseline)
  innerCeilingLight: 0xFFE8B0, // ★ 따뜻한 노란빛 light box (인형 잘 보이게)

  /* ─── 액센트 ─── */
  goldYellow: 0xFFD93D,
  goldDeep: 0xC9A227,
  neonCyan: 0x06D4E8,
  neonPink: 0xEC4899,
  neonAmber: 0xF59E0B,

  /* ─── 인터랙티브 빨강 (조이스틱 + DROP만 - 클래식 arcade 보존) ─── */
  interactiveRed: 0xE63946,
  interactiveRedLight: 0xFF6B7A,
  interactiveRedDark: 0xB02A38,

  /* ─── 집게 (Procedural - 강한 발광으로 시각 명확) ─── */
  clawSilver: 0xE8E8F0,
  clawDark: 0x2A3340,
  clawAccent: 0x06D4E8,
  cableBlack: 0x14141C,

  /* ─── 배경 ─── */
  bgDeepPurple: 0x06030F,
  bgPurple: 0x1A0530,
  bgPurpleLight: 0x2A1058,
} as const;

export const WB_DIMS = {
  // 박스 — 10.0×5.6×3.2 (가로 대폭 확장)
  boxWidth: 10.0,
  boxHeight: 5.6,
  boxDepth: 3.2,
  // 집게
  clawHomeY: 2.8,
  clawDropY: 0.9,
  clawXRange: 4.0,             // 더 넓은 좌우 이동
  ceilingY: 5.6,
  railY: 5.0,
  // 콘솔
  consoleWidth: 10.4,
  consoleHeight: 1.5,
  consoleDepth: 2.6,
  consoleCenterY: -1.85,
  consoleSurfaceY: -1.10,
  consoleZ: 1.4,               // 더 사용자 쪽 (이전 1.0)
  // 콘솔 패널 양수 기울임 (사용자 쪽 panel normal — 더 큰 각도)
  consoleTilt: Math.PI / 5.5,  // 약 32° (이전 24°)
  // 카메라
  cameraLookAtY: 1.7,
} as const;
