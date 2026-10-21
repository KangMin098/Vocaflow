// apps/web/src/lib/reader/type-prefs.ts
//
// 읽기 본문의 글자 크기 · 줄 간격 — 기기에 저장하고 읽기 화면이 열릴 때 적용한다.
//
// 왜(2026-10-18 learner-tines-audit S3 ④): 타이포 설정 팝오버가 열리는 순간 자기 초기값(19px · 1.85)을
// 문서에 써서, 아무것도 고르지 않아도 본문이 15px → 19px 로 바뀌었다. 고른 값은 저장되지 않아 다음 화면에서 사라졌다.
// 기본값 15px · 1.55 는 v06.62 사용자 피드백(「너무 큼」)으로 정한 값이라 그대로 둔다(globals.css `--reader-*`).

export interface ReaderTypePrefs {
  fontSize: number
  lineHeight: number
}

export const READER_TYPE_DEFAULT: ReaderTypePrefs = { fontSize: 15, lineHeight: 1.55 }

const KEY = 'vocaflow-reader-type'

/** 저장값 → 없거나 깨졌으면 기본값. 저장소 접근이 막힌 환경(사생활 모드 등)에서도 던지지 않는다. */
export function readReaderTypePrefs(): ReaderTypePrefs {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null
    if (!raw) return READER_TYPE_DEFAULT
    const v = JSON.parse(raw) as Partial<ReaderTypePrefs>
    const fontSize = typeof v.fontSize === 'number' && v.fontSize >= 12 && v.fontSize <= 32 ? v.fontSize : READER_TYPE_DEFAULT.fontSize
    const lineHeight = typeof v.lineHeight === 'number' && v.lineHeight >= 1.2 && v.lineHeight <= 2.6 ? v.lineHeight : READER_TYPE_DEFAULT.lineHeight
    return { fontSize, lineHeight }
  } catch {
    return READER_TYPE_DEFAULT
  }
}

export function saveReaderTypePrefs(prefs: ReaderTypePrefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    /* 저장 못 해도 이번 화면에는 적용된다 */
  }
}

/** 본문이 읽는 CSS 변수(`--reader-font-size` · `--reader-line-height`)에 쓴다. */
export function applyReaderTypePrefs(prefs: ReaderTypePrefs): void {
  const root = document.documentElement.style
  root.setProperty('--reader-font-size', `${prefs.fontSize}px`)
  root.setProperty('--reader-line-height', String(prefs.lineHeight))
}
