// apps/web/src/components/csat/diagnosis/tints.ts
//
// 팝업의 작은 색 표식 — 등급 · 영역 · 함정 계열 · 시험 종류마다 한 색. 면 전체가 아니라 원 · 타일 · 칩에만 쓴다.
// 색만으로 뜻을 전하지 않는다 — 표식 안이나 옆에 늘 글자(등급 숫자 · 번호 · 이름)가 함께 있다.

export const GRADE_TINT = ['#16a34a', '#0d9488', '#2563eb', '#d97706', '#e11d48', '#e11d48', '#e11d48', '#e11d48', '#e11d48']
export const gradeTint = (g: number | null) => (g ? GRADE_TINT[Math.min(9, Math.max(1, g)) - 1] : '#8b8984')

/** 문항 번호 → 영역 색(듣기 1–17 보라 · 독해 18–40 민트 · 장문 41–45 호박) */
export const areaTint = (no: number) => (no <= 17 ? '#7c5cfa' : no >= 41 ? '#d97706' : '#0d9488')

const FAMILY_TINT: Record<string, string> = {
  C1: '#e11d48', C2: '#8b8984', C3: '#2563eb', C4: '#7c5cfa', C5: '#0d9488', C6: '#d97706', C7: '#16a34a', C8: '#db2777', C9: '#0891b2',
}
export const familyTint = (family: string | null | undefined) => (family ? FAMILY_TINT[family] ?? '#8b8984' : '#8b8984')

export const GROUP_TINT = { hakpyeong: '#0d9488', mock: '#2563eb', suneung: '#e11d48' } as const
