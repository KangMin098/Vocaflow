// apps/web/src/lib/articles/__tests__/source-map.test.ts
// v06.222 재설계 — 학습 지도 밴드 적응성 순수 로직 검증.
//   getLearnerBand / buildScriptsMap / bandGuidance 가 학습자 V레벨에 따라
//   밴드·배너 카피·추천 트랙을 올바르게 계산하는지 (하드코딩 아닌 실집계).
//   (UI 배선(useUserVLevel→배너 렌더)은 04-ui-smoke 의 밴드-무관 스캐폴드 테스트가 커버.
//    실 로그인 세션의 클라이언트 V레벨 fetch 는 storageState 한계로 e2e 단언 대신 여기서 로직 검증.)

import { describe, it, expect } from 'vitest'

import {
  bandGuidance,
  buildScriptsMap,
  cefrRangeLabel,
  getLearnerBand,
  vToCefrLabel,
} from '../source-map'
import type { PublishedArticle } from '../types'

/** 최소 아티클 팩토리 — 트랙 매핑에 필요한 source + V레벨만 유의미. */
function mk(source: string, v: number, wc = 500): PublishedArticle {
  return {
    id: `${source}-v${v}-${wc}`,
    title: `${source} sample V${v}`,
    author: null,
    source,
    source_url: null,
    cefr_level: null,
    word_count: wc,
    reading_minutes: null,
    category_tags: null,
    published_at: null,
    article_v_level: v,
    register: null,
    audio_url: source === 'voa' ? 'https://audio.example/x.mp3' : null,
  }
}

// 실 분포를 축약한 대표 세트 — 5개 트랙에 콘텐츠 (news 트랙은 실서비스처럼 빈 채로).
//   listen(voa) V2–4 · easy(simple_wikipedia) V3–6 · argue(the_conversation) V4–6
//   data(owid) V5–6 · topic(plos) V6–7(최고 심도)
const ARTICLES: PublishedArticle[] = [
  mk('voa', 2), mk('voa', 3), mk('voa', 4),
  mk('simple_wikipedia', 3), mk('simple_wikipedia', 4), mk('simple_wikipedia', 5), mk('simple_wikipedia', 6),
  mk('the_conversation', 4), mk('the_conversation', 5), mk('the_conversation', 6),
  mk('owid', 5), mk('owid', 6),
  mk('plos', 6), mk('plos', 7),
]

describe('getLearnerBand — V레벨 → 밴드 경계', () => {
  it('0/음수 = 미진단', () => {
    expect(getLearnerBand(0)).toBe('undiagnosed')
    expect(getLearnerBand(-1)).toBe('undiagnosed')
  })
  it('1–3 = 초급', () => {
    expect(getLearnerBand(1)).toBe('beginner')
    expect(getLearnerBand(3)).toBe('beginner')
  })
  it('4–6 = 중급', () => {
    expect(getLearnerBand(4)).toBe('intermediate')
    expect(getLearnerBand(6)).toBe('intermediate')
  })
  it('7+ = 고급', () => {
    expect(getLearnerBand(7)).toBe('advanced')
    expect(getLearnerBand(11)).toBe('advanced')
  })
})

describe('vToCefrLabel / cefrRangeLabel', () => {
  it('V레벨 → CEFR 근사', () => {
    expect(vToCefrLabel(2)).toBe('A2')
    expect(vToCefrLabel(4)).toBe('B1')
    expect(vToCefrLabel(6)).toBe('B2')
    expect(vToCefrLabel(9)).toBe('C2')
  })
  it('동일 밴드는 단일, 다르면 범위', () => {
    expect(cefrRangeLabel(5, 6)).toBe('B2') // V5·V6 모두 B2
    expect(cefrRangeLabel(2, 4)).toBe('A2–B1') // voa V2–4
  })
})

describe('buildScriptsMap — 밴드/추천 적응', () => {
  it('미진단(0) → effectiveV=5·band undiagnosed·추천 트랙 존재', () => {
    const m = buildScriptsMap(ARTICLES, 0)
    expect(m.band).toBe('undiagnosed')
    expect(m.effectiveV).toBe(5)
    expect(m.recommendedTrackKey).not.toBeNull()
  })

  it('초급(V2) → i+1 콘텐츠 최다인 listen 추천', () => {
    const m = buildScriptsMap(ARTICLES, 2)
    expect(m.band).toBe('beginner')
    // voa: V2(동급)+V3(i+1) 2편 vs easy: V3(i+1) 1편 → listen 최다
    expect(m.recommendedTrackKey).toBe('listen')
  })

  it('중급(V5) → band intermediate', () => {
    const m = buildScriptsMap(ARTICLES, 5)
    expect(m.band).toBe('intermediate')
    expect(m.recommendedTrackKey).not.toBeNull()
  })

  it('고급(V9) → i+1 콘텐츠 없음 → 최고 심도(topic) 추천 (깊이 유도)', () => {
    const m = buildScriptsMap(ARTICLES, 9)
    expect(m.band).toBe('advanced')
    // 전 트랙이 학습자 아래(수월) → 폴백: vMax 최고 = topic(plos V7)
    expect(m.recommendedTrackKey).toBe('topic')
  })

  it('news 트랙(빈 소스)은 제외 · 편수>0 트랙만', () => {
    const m = buildScriptsMap(ARTICLES, 5)
    const keys = m.tracks.map((t) => t.track.key)
    expect(keys).not.toContain('news')
    expect(m.tracks.every((t) => t.count > 0)).toBe(true)
  })

  it('트랙 fit 은 학습자 위치로 달라진다 (argue V4–6)', () => {
    const argueLow = buildScriptsMap(ARTICLES, 2).tracks.find((t) => t.track.key === 'argue')!
    const argueHigh = buildScriptsMap(ARTICLES, 9).tracks.find((t) => t.track.key === 'argue')!
    expect(argueLow.fit).toBe('hard') // V2 는 argue 아래 → 도전
    expect(argueHigh.fit).toBe('easy') // V9 는 argue 위 → 수월
  })

  it('트랙 통계는 실집계 (V범위·음성)', () => {
    const m = buildScriptsMap(ARTICLES, 5)
    const listen = m.tracks.find((t) => t.track.key === 'listen')!
    expect(listen.vMin).toBe(2)
    expect(listen.vMax).toBe(4)
    expect(listen.cefrLabel).toBe('A2–B1')
    expect(listen.hasAudio).toBe(true)
    const easy = m.tracks.find((t) => t.track.key === 'easy')!
    expect(easy.hasAudio).toBe(false)
  })

  it('트랙 정렬: 적합(fit) 우선', () => {
    const m = buildScriptsMap(ARTICLES, 5)
    // 중급(V5) 기준 fit 트랙이 목록 최상단
    expect(m.tracks[0].fit).toBe('fit')
  })
})

describe('bandGuidance — 밴드별 배너 카피', () => {
  it('미진단 → 진단 유도 CTA', () => {
    const g = bandGuidance(buildScriptsMap(ARTICLES, 0))
    expect(g.eyebrow).toBe('레벨 진단')
    expect(g.cta.kind).toBe('diagnostic')
  })
  it('초급 → "초급 추천" + 듣기/쉬운 글 안내', () => {
    const g = bandGuidance(buildScriptsMap(ARTICLES, 2))
    expect(g.eyebrow).toBe('초급 추천')
    expect(g.title).toMatch(/듣기와 쉬운 글부터/)
    expect(g.cta.kind).toBe('track')
  })
  it('중급 → "중급 추천"', () => {
    const g = bandGuidance(buildScriptsMap(ARTICLES, 5))
    expect(g.eyebrow).toBe('중급 추천')
    expect(g.title).toMatch(/수준에 맞는 글이 가장 많아요/)
  })
  it('고급 → "고급 안내" + 솔직 안내(수월)·깊이 유도', () => {
    const g = bandGuidance(buildScriptsMap(ARTICLES, 9))
    expect(g.eyebrow).toBe('고급 안내')
    expect(g.title).toMatch(/대부분 수월하게 읽혀요/)
    expect(g.sub).toMatch(/논증·데이터/)
  })
})
