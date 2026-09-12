// apps/web/src/lib/library/reading-time.ts
//
// 읽는 데 걸리는 시간을 **사람이 읽는 문장으로** 바꾼다.
//
// 왜 모아 뒀나 (2026-08-26 실측):
//   두 화면이 각자 `약 ${Math.round(readingMinutes / 60)}시간` 을 적고 있었다
//   (`UserPreviewClient` · `NetflixDetailSheet`). 그래서 **60분 미만인 책이 전부
//   "약 0 시간"** 으로 표시됐다 — 발행 13권 중 2권, 발행 대기 303권 중 21권.
//
//   0 은 "짧다" 가 아니라 **"내용이 없다"** 로 읽힌다. 하필 그 대상이 짧은 책이라,
//   처음 완주해 보기 좋은 콘텐츠가 가장 부실해 보이는 결과가 된다.
//   (`Ammachi's Amazing Machines` 는 실제로 2분짜리다.)
//
// ⚠️ 값이 없으면 **문장 자체를 만들지 않는다**(`null`). "약 0 시간" 을 고쳐 놓고
//    "약 0 분" 을 새로 만들면 아무것도 나아지지 않는다 — 모르면 그 줄을 안 보여준다.

/** 분 단위를 시간/분 문장으로. 값이 없거나 0 이하면 `null` — 화면은 그 줄을 숨긴다. */
export function formatReadingTime(minutes: number | null | undefined): string | null {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return null

  // 한 시간이 안 되면 분으로 말한다. 반올림해서 0 이 되는 구간(30초 미만)은 위에서 걸러진다.
  if (minutes < 60) return `약 ${Math.max(1, Math.round(minutes))}분`

  return `약 ${Math.round(minutes / 60)}시간`
}
