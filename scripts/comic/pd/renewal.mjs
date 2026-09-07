// scripts/comic/pd/renewal.mjs
//
// 저작권 갱신 위험 — **"1964년 이전 발행"은 PD 가 아니다.** 갱신되지 않았을 때만 PD 다.
//
// ── 왜 이 파일이 필요한가 (조사 2026-08-17) ──────────────────────
// 적재된 969호를 "1940~63년이니 대체로 PD" 로 다루려던 참에 조사해 보니 사실이 아니었다.
// Fawcett 은 **갱신된 구간이 실재**하고, 그 구간은 지금 DC 소유다 —
// DC 는 Fawcett 저작권을 갱신했고 게시 사이트에 삭제 요구를 보낸 이력이 있다.
//
//   MASTER COMICS #61 이상          갱신됨
//   WOW COMICS #36~69 (1945~)       갱신됨
//   WHIZ COMICS #3~6                갱신됨 (#2 는 미갱신 — Captain Marvel 첫 등장)
//   Captain Marvel 계열 1951년 이후  CBS 가 1977년 갱신
//
// 반대로 Ace Magazines 는 조사된 전 타이틀에서 갱신 통지가 발견되지 않았다
// (SUPER-MYSTERY · LIGHTNING · FOUR FAVORITES · OUR FLAG · SURE-FIRE …).
//
// **이 표는 판정이 아니라 위험 등급이다.** 최종 확정은 사람이 CCE 갱신 편을 보고 한다
// (발행 게이트가 근거 URL 과 확인자를 요구한다). 여기서 하는 일은 **블랭킷 발행을 막는 것**이다 —
// "Fawcett 은 대체로 PD" 라는 한 문장이 582호를 한꺼번에 위험에 빠뜨릴 수 있었다.
//
// 출처: herogoggles.com/copyright1.html (골든에이지 갱신 조사) ·
//       en.wikisource.org/wiki/Atomic_War! (Ace, 미갱신 PD 판정) ·
//       National Comics Publications v. Fawcett Publications.

/** @typedef {'renewed'|'likely-pd'|'unknown'} RenewalLevel */

/**
 * 시리즈별 갱신 규칙. `renewedIssues(issueNo, year)` 가 true 면 **그 호는 갱신됐다** = 발행 불가.
 * 규칙이 없는 시리즈는 발행사 기본값으로 떨어진다.
 */
export const SERIES_RENEWAL = [
  {
    seriesKey: 'master-comics',
    note: 'MASTER COMICS #61 이상은 갱신됨 — 그 이하만 PD 후보',
    renewed: (no) => no != null && no >= 61,
  },
  {
    seriesKey: 'wow-comics',
    note: 'WOW COMICS #36~69(1945~)는 갱신됨',
    renewed: (no) => no != null && no >= 36 && no <= 69,
  },
  {
    seriesKey: 'whiz-comics',
    // #2 는 미갱신(Captain Marvel 첫 등장), #3~6 은 갱신. 그 위는 조사 필요.
    note: 'WHIZ COMICS #3~6 은 갱신됨. #2 는 미갱신. 그 외는 호별 확인 필요',
    renewed: (no) => no != null && no >= 3 && no <= 6,
  },
  {
    seriesKey: 'marvel-family',
    note: 'Marvel Family 계열은 1951년 이후 CBS 가 1977년 갱신 — DC 소유',
    renewed: (_no, year) => year != null && year >= 1951,
  },
  {
    seriesKey: 'captain-marvel',
    note: 'Captain Marvel 계열은 1951년 이후 갱신됨(CBS 1977)',
    renewed: (_no, year) => year != null && year >= 1951,
  },
  {
    seriesKey: 'captain-marvel-jr',
    note: 'Captain Marvel Jr. 계열은 1951년 이후 갱신됨(CBS 1977)',
    renewed: (_no, year) => year != null && year >= 1951,
  },
  {
    seriesKey: 'mary-marvel',
    note: 'Mary Marvel 계열은 1951년 이후 갱신됨(CBS 1977)',
    renewed: (_no, year) => year != null && year >= 1951,
  },
]

/**
 * 발행사 기본 위험도.
 * Ace 는 조사된 전 타이틀 미갱신 → `likely-pd`. Fawcett 은 갱신 구간이 실재 → `unknown`(호별 확인).
 */
export const PUBLISHER_DEFAULT = {
  Ace: {
    level: 'likely-pd',
    // 근거는 **발행사 단위**다 — 개별 타이틀의 CCE 원본을 짚은 것이 아니다.
    // ① herogoggles 갱신 조사: 조사된 Ace 전 타이틀에서 갱신 통지 미발견
    // ② Ace 는 1956년 폐간, 권리를 주장하는 승계사가 없다
    // ③ Comic Book Plus 등 PD 전용 큐레이션 사이트가 Ace 호러물을 호스팅한다
    // 이 셋은 강한 정황이지 1차 확인은 아니다. 그래서 `likely-pd` 이고 `renewed` 가 아니다 —
    // 발행 게이트는 여전히 사람의 근거 기록을 요구한다.
    note: 'Ace Magazines — 조사된 전 타이틀에서 갱신 통지 미발견(1956년 폐간, 승계 권리자 없음). 발행사 단위 정황 — 호별 1차 확인은 별도',
  },
  Fawcett: {
    level: 'unknown',
    note: 'Fawcett — 갱신이 산발적이고 갱신 구간은 현재 DC 소유. 시리즈·호별 확인 필수',
  },
  Gilberton: {
    level: 'unknown',
    note: 'Classics Illustrated — 갱신 여부 호별 확인 필요',
  },
}

/**
 * 한 호의 갱신 위험도.
 * @returns {{ level: RenewalLevel, note: string, blocking: boolean }}
 *   `blocking:true` = 갱신된 것으로 알려진 구간 → **발행하면 안 된다**.
 */
export function assessRenewal({ seriesKey, issueNo, publishedYear, publisher }) {
  const rule = SERIES_RENEWAL.find((r) => r.seriesKey === seriesKey)
  if (rule && rule.renewed(issueNo ?? null, publishedYear ?? null)) {
    return { level: 'renewed', note: rule.note, blocking: true }
  }
  if (rule) {
    // 규칙은 있으나 이 호는 갱신 구간 밖 — 그래도 "확인함" 은 아니다.
    return { level: 'unknown', note: `${rule.note} (이 호는 해당 구간 밖 — 확인 필요)`, blocking: false }
  }
  const p = PUBLISHER_DEFAULT[publisher ?? '']
  if (p) return { ...p, blocking: false }
  return { level: 'unknown', note: '발행사 갱신 이력 미조사 — 확인 필요', blocking: false }
}
