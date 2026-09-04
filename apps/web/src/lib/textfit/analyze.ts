// apps/web/src/lib/textfit/analyze.ts
//
// 공개 지문 분석의 **서버 코어** — `/api/fit` 과 랜딩 히어로가 같은 함수를 쓴다.
//
// 왜 떼어 냈나 (2026-09-04):
//   랜딩 히어로가 "작동하는 증명"(DESIGN_SYSTEM §🎯 I1)을 서버 렌더로 내려면 분석 결과가
//   **HTML 안에** 있어야 한다. 그런데 분석 로직은 `app/api/fit/route.ts` 의 POST 핸들러
//   본문에 있었고, 서버 컴포넌트에서 자기 API 를 HTTP 로 다시 부르는 것은 같은 프로세스를
//   한 바퀴 돌리는 낭비다(그리고 빌드 타임에는 그 URL 이 없다).
//   → 순수 분석부만 여기로 옮기고, 라우트는 **한도·입력검증·응답**만 맡는다.
//
// ⚠️ 여기에 레이트리밋을 넣지 않는다. 한도는 **외부에서 들어오는 경로**(라우트)의 책임이고,
//    서버 컴포넌트 호출까지 같은 버킷을 쓰면 방문자 한 명이 랜딩을 새로고침하는 것만으로
//    `/fit` 이 막힌다.
//
// 권한·저장: 라우트와 같다 — service_role 미사용(anon 으로 공개 테이블만), 지문 미저장.

import { summarizeCurriculum } from './curriculum'
import { collectCandidates } from './inflect'
import {
  checkRealWords,
  getLevelMap,
  loadCurriculumMarks,
  loadLevelsFor,
  loadMeanings,
} from './level-map'
import { buildLevelProfile } from './profile'
import type { LevelProfile, PublicWord } from './profile'

export interface AnalyzeOptions {
  /**
   * 후보 낱말만 표적 조회할 것인가 — **낱말이 정해진 호출자용.**
   *
   * `false`(기본)는 프로세스 캐시된 전체 레벨 맵을 쓴다. 임의 지문을 받는 `/fit` 은 그쪽이 맞다
   * (지문마다 표적 조회하면 왕복이 지문 길이에 비례한다).
   * `true` 는 랜딩 히어로처럼 **지문이 상수**인 곳에서 쓴다 — 전체 맵 콜드 적재가 88초라
   * 첫 화면이 그동안 비어 있게 된다(`level-map.ts` 의 2026-09-04 실측 주석 참조).
   */
  targetedLevels?: boolean
}

export interface AnalyzeResult {
  profile: LevelProfile
  /**
   * 표제어로 접힌 단어 전체 — **표면형 색칠에 필요하다.**
   *
   * `profile.hardestWords` 는 상위 일부뿐이라 지문의 모든 낱말을 칠할 수 없다.
   * 라우트 응답에는 넣지 않는다(응답이 몇 배가 되고 `/fit` 화면은 쓰지 않는다).
   */
  words: PublicWord[]
  /** 표면형 → 표제어. 원문 순서대로 다시 칠할 때 쓴다. */
  lemmaBySurface: Map<string, string>
}

/**
 * 표면형 빈도표 하나를 레벨 프로파일로 만든다.
 *
 * @param counts 표면형(소문자) → 등장 횟수
 * @param totalTokens 러닝 워드 수 — 커버리지 분모(기능어 포함, Hu & Nation 정의)
 */
export async function analyzeCounts(
  counts: Record<string, number>,
  totalTokens: number,
  options: AnalyzeOptions = {},
): Promise<AnalyzeResult> {
  const surfaces = Object.keys(counts)
  if (surfaces.length === 0) {
    return { profile: buildLevelProfile([], totalTokens), words: [], lemmaBySurface: new Map() }
  }

  const { all, bySurface } = collectCandidates(surfaces)

  // 굴절 후보까지 포함해 물어야 한다 — "allocated" 는 "allocate" 로 접힌 뒤에야 레벨이 붙는다.
  const levels = options.targetedLevels ? await loadLevelsFor(all) : await getLevelMap()

  // 레벨 맵에 없는 후보만 실재어 확인 대상 — 지문당 수십 개 수준이다.
  const unleveled = all.filter((c) => !levels.has(c))
  const realWords = await checkRealWords(unleveled)

  // 표면형 → 표제어로 접으면서 빈도를 합산한다("allocate" 2 + "allocated" 3 = 5).
  const merged = new Map<string, PublicWord>()
  const lemmaBySurface = new Map<string, string>()
  for (const [surface, count] of Object.entries(counts)) {
    const cands = bySurface.get(surface) ?? [surface]
    const lemma = cands.find((c) => levels.has(c)) ?? cands.find((c) => realWords.has(c)) ?? surface
    lemmaBySurface.set(surface, lemma)

    const vLevel = levels.get(lemma) ?? null
    const status: PublicWord['status'] =
      vLevel !== null ? 'leveled' : realWords.has(lemma) ? 'unleveled' : 'unresolved'

    const prev = merged.get(lemma)
    if (prev) prev.count += count
    else merged.set(lemma, { surface, lemma, count, status, vLevel })
  }

  const words = [...merged.values()]
  const profile = buildLevelProfile(words, totalTokens)

  // 가장 어려운 단어에만 뜻을 붙인다 — 교사가 결과를 그대로 가져가 쓸 수 있게.
  const meanings = await loadMeanings(profile.hardestWords.map((w) => w.lemma))
  for (const w of profile.hardestWords) w.meaningKo = meanings.get(w.lemma) ?? null

  // ── 교육과정 기본 어휘 ──
  // `unresolved`(사전 어디에도 없는 토큰)는 세지 않는다 — 고유명사·오탈자가 대부분이라
  // 넣으면 `Prague` 같은 것이 "교육과정 밖" 으로 잡혀 숫자가 부푼다.
  const contentLemmas = words.filter((w) => w.status !== 'unresolved').map((w) => w.lemma)
  const marks = await loadCurriculumMarks(contentLemmas)

  // `null` = 조회 실패. 이때는 **칸을 아예 만들지 않는다** — 빈 값을 넣으면 모든 낱말이
  // "밖" 으로 세어져 멀쩡한 지문에 거짓 경보가 나간다.
  if (marks) {
    profile.curriculum = summarizeCurriculum(contentLemmas, marks)
    for (const w of profile.hardestWords) w.curriculumBand = marks.get(w.lemma)?.band ?? null
  }

  return { profile, words, lemmaBySurface }
}
