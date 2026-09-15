// apps/web/src/components/textfit/Worksheet.tsx
//
// `/fit` 의 인쇄 학습지 — **비로그인 교사**가 지문 하나로 만드는 종이.
//
// 종이 모양은 `components/worksheet/PrintSheet.tsx` 가 소유한다. 여기서 하는 일은
// 이 화면의 데이터를 그 모양에 맞추는 것뿐이다 — 두 자리(여기와 `/text/new` 추출)에서
// 나오는 종이가 갈리면 같은 교무실에 서로 다른 유인물이 돈다.
//
// ── QR 이 가리키는 곳 ───────────────────────────────────────────────
// 여기서는 **학급 초대가 아니라 `/fit`** 이다. 이 종이를 만든 사람은 아직 학급이 없고
// (로그인조차 안 했다), 이 종이의 다음 독자는 학생이 아니라 **그것을 집어 든 옆자리 교사**다.
// 학생에게 낱말을 보내는 경로는 학급 초대이고, 그건 학급이 있는 교사가 `/text/new` 에서 만든다.

'use client'

import {
  CURRICULUM_BAND_MARK,
  type CurriculumBand,
} from '@/lib/textfit/curriculum'
import { LEVEL_LABEL, type LevelProfile, type ProfileLevel } from '@/lib/textfit/profile'
import { absoluteUrl } from '@/lib/seo/site'
import {
  MAX_SHEET_ROWS,
  PrintSheet,
  type SheetMode,
  type SheetRow,
} from '@/components/worksheet/PrintSheet'

export type WorksheetMode = SheetMode

export function Worksheet({ profile, mode }: { profile: LevelProfile; mode: WorksheetMode }) {
  const rows: SheetRow[] = profile.hardestWords.slice(0, MAX_SHEET_ROWS).map((w) => ({
    word: w.surface,
    meaning: w.meaningKo ?? null,
    mark: bandMark(w.curriculumBand),
  }))

  const level = profile.fitLevel as ProfileLevel | null
  const c = profile.curriculum

  const meta = [
    level ? `${LEVEL_LABEL[level]} 기준` : '난이도 판정 없음',
    profile.textVLevel != null ? `지문 어휘 V${profile.textVLevel}` : null,
    `낱말 ${rows.length}개`,
    c ? `교육과정 기본 어휘 밖 ${c.outside}개` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <PrintSheet
      heading={{ list: '어휘 목록', quiz: '어휘 확인' }}
      meta={meta}
      rows={rows}
      mode={mode}
      legend={
        '교육과정 표시 — * 초등 권장 · ** 중·고 공통 · · 그 외 과목 · ' +
        '빈칸은 기본 어휘 목록 밖 (교육부 고시 제2022-33호 [별책 14])'
      }
      qr={{ url: absoluteUrl('/fit'), caption: '지문을 넣으면\n이 표가 만들어져요' }}
    />
  )
}

/** 밴드 표시 — 색을 쓸 수 없는 지면이라 기호로만 구분한다. */
function bandMark(band: CurriculumBand | null | undefined): string {
  if (band === undefined || band === null) return ''
  return CURRICULUM_BAND_MARK[band] || '·'
}
