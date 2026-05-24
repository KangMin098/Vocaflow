// apps/web/src/lib/admin/vrl/queries.ts
// VRL Admin Dashboard / Taxonomy 데이터 쿼리 (Server-side only)
//
// 데이터 소스: shared_dictionary · vocaflow_levels · vocaflow_tracks ·
//             vocaflow_domains · vocaflow_skills · vrl_data_integrity_concerns ·
//             vrl_diagnostic_tests · user_profiles · user_level_snapshots ·
//             user_diagnostic_results

import type { SupabaseClient } from '@supabase/supabase-js'

export interface VrlDashboardData {
  kpi: {
    totalWords: number
    classified: number
    classifiedPct: number
    concernsOpen: number
    concernsTotal: number
    diagnosticTests: number
    userProfiles: number
    snapshots: number
  }
  /** V-Level별 — totalInLevel = rule_v1, doneInLevel = v_level NOT NULL */
  byLevel: Array<{
    level: number
    koreanName: string
    cumulativeWordCount: number | null
    newWordsInLevel: number | null
    classifiedCount: number
    pct: number
    method: string | null
    confidence: number | null
  }>
}

export interface VrlTaxonomyData {
  levels: Array<{
    level: number
    koreanName: string
    koreanSchool: string | null
    englishName: string | null
    cefrMin: string | null
    cefrMax: string | null
    testScoreHints: string | null
    cumulativeWordCount: number | null
    newWordsInLevel: number | null
    estimatedStudyHours: number | null
    ageRange: string | null
    classificationMethod: string | null
    classificationConfidence: number | null
  }>
  tracks: Array<{
    id: string
    nameKo: string
    nameEn: string | null
    descriptionKo: string | null
    displayHint: string | null
    totalWords: number | null
  }>
  domains: Array<{
    id: string
    nameKo: string
    descriptionKo: string | null
    totalWords: number | null
  }>
  skills: Array<{
    id: string
    nameKo: string
    descriptionKo: string | null
    totalWords: number | null
  }>
}

export async function fetchVrlDashboard(
  client: SupabaseClient,
): Promise<VrlDashboardData> {
  // 1. KPI 8종 — 병렬 (count: 'exact', head: true 패턴)
  const [
    totalRes,
    classRes,
    concernOpenRes,
    concernTotalRes,
    diagRes,
    profRes,
    snapRes,
    levelsRes,
  ] = await Promise.all([
    client.from('shared_dictionary').select('*', { count: 'exact', head: true }),
    client
      .from('shared_dictionary')
      .select('*', { count: 'exact', head: true })
      .not('v_level', 'is', null),
    client
      .from('vrl_data_integrity_concerns')
      .select('*', { count: 'exact', head: true })
      .eq('resolved', false),
    client.from('vrl_data_integrity_concerns').select('*', { count: 'exact', head: true }),
    client
      .from('vrl_diagnostic_tests')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    client.from('user_profiles').select('*', { count: 'exact', head: true }),
    client.from('user_level_snapshots').select('*', { count: 'exact', head: true }),
    client
      .from('vocaflow_levels')
      .select(
        'level, korean_name, cumulative_word_count, new_words_in_level, classification_method, classification_confidence',
      )
      .order('level', { ascending: true }),
  ])

  const totalWords = totalRes.count ?? 0
  const classified = classRes.count ?? 0

  // 2. V-Level별 classified 카운트 (shared_dictionary v_level GROUP BY)
  const { data: perLevel } = await client
    .from('shared_dictionary')
    .select('v_level')
    .not('v_level', 'is', null)

  const byLevelMap = new Map<number, number>()
  for (const row of (perLevel ?? []) as Array<{ v_level: number }>) {
    byLevelMap.set(row.v_level, (byLevelMap.get(row.v_level) ?? 0) + 1)
  }

  type LevelRow = {
    level: number
    korean_name: string
    cumulative_word_count: number | null
    new_words_in_level: number | null
    classification_method: string | null
    classification_confidence: number | null
  }
  const levels = (levelsRes.data ?? []) as LevelRow[]

  const byLevel: VrlDashboardData['byLevel'] = levels.map((l) => {
    const cls = byLevelMap.get(l.level) ?? 0
    const newCount = l.new_words_in_level ?? 0
    const pct = newCount > 0 ? Math.min(100, (cls / newCount) * 100) : 0
    return {
      level: l.level,
      koreanName: l.korean_name,
      cumulativeWordCount: l.cumulative_word_count,
      newWordsInLevel: l.new_words_in_level,
      classifiedCount: cls,
      pct: Math.round(pct * 10) / 10,
      method: l.classification_method,
      confidence: l.classification_confidence,
    }
  })

  return {
    kpi: {
      totalWords,
      classified,
      classifiedPct:
        totalWords > 0 ? Math.round((classified / totalWords) * 1000) / 10 : 0,
      concernsOpen: concernOpenRes.count ?? 0,
      concernsTotal: concernTotalRes.count ?? 0,
      diagnosticTests: diagRes.count ?? 0,
      userProfiles: profRes.count ?? 0,
      snapshots: snapRes.count ?? 0,
    },
    byLevel,
  }
}

export async function fetchVrlTaxonomy(
  client: SupabaseClient,
): Promise<VrlTaxonomyData> {
  const [levelsRes, tracksRes, domainsRes, skillsRes] = await Promise.all([
    client
      .from('vocaflow_levels')
      .select(
        'level, korean_name, korean_school, english_name, cefr_min, cefr_max, test_score_hints, cumulative_word_count, new_words_in_level, estimated_study_hours, age_range, classification_method, classification_confidence',
      )
      .order('level', { ascending: true }),
    client
      .from('vocaflow_tracks')
      .select('id, name_ko, name_en, description_ko, display_hint, total_words')
      .order('display_order', { ascending: true, nullsFirst: false }),
    client
      .from('vocaflow_domains')
      .select('id, name_ko, description_ko, total_words')
      .order('id', { ascending: true }),
    client
      .from('vocaflow_skills')
      .select('id, name_ko, description_ko, total_words')
      .order('id', { ascending: true }),
  ])

  type LevelRow = {
    level: number
    korean_name: string
    korean_school: string | null
    english_name: string | null
    cefr_min: string | null
    cefr_max: string | null
    test_score_hints: string | null
    cumulative_word_count: number | null
    new_words_in_level: number | null
    estimated_study_hours: number | null
    age_range: string | null
    classification_method: string | null
    classification_confidence: number | null
  }
  type TrackRow = {
    id: string
    name_ko: string
    name_en: string | null
    description_ko: string | null
    display_hint: string | null
    total_words: number | null
  }
  type DomainRow = {
    id: string
    name_ko: string
    description_ko: string | null
    total_words: number | null
  }
  type SkillRow = {
    id: string
    name_ko: string
    description_ko: string | null
    total_words: number | null
  }

  return {
    levels: ((levelsRes.data ?? []) as LevelRow[]).map((l) => ({
      level: l.level,
      koreanName: l.korean_name,
      koreanSchool: l.korean_school,
      englishName: l.english_name,
      cefrMin: l.cefr_min,
      cefrMax: l.cefr_max,
      testScoreHints: l.test_score_hints,
      cumulativeWordCount: l.cumulative_word_count,
      newWordsInLevel: l.new_words_in_level,
      estimatedStudyHours: l.estimated_study_hours,
      ageRange: l.age_range,
      classificationMethod: l.classification_method,
      classificationConfidence: l.classification_confidence,
    })),
    tracks: ((tracksRes.data ?? []) as TrackRow[]).map((t) => ({
      id: t.id,
      nameKo: t.name_ko,
      nameEn: t.name_en,
      descriptionKo: t.description_ko,
      displayHint: t.display_hint,
      totalWords: t.total_words,
    })),
    domains: ((domainsRes.data ?? []) as DomainRow[]).map((d) => ({
      id: d.id,
      nameKo: d.name_ko,
      descriptionKo: d.description_ko,
      totalWords: d.total_words,
    })),
    skills: ((skillsRes.data ?? []) as SkillRow[]).map((s) => ({
      id: s.id,
      nameKo: s.name_ko,
      descriptionKo: s.description_ko,
      totalWords: s.total_words,
    })),
  }
}
