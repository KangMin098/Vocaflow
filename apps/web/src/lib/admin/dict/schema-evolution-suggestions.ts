// apps/web/src/lib/admin/dict/schema-evolution-suggestions.ts
//
// Schema Evolution Tier 1-5 제안 — 16 컬럼 확장 후보.
//   Tier 1 — Learning Core      (5): audio_url, audio_url_uk, audio_url_us, image_url, mnemonic_ko
//   Tier 2 — Korean Learner     (3): common_errors_ko, usage_warning_ko, konglish_alert
//   Tier 3 — Vocab Network      (2): related_words, confusion_pairs
//   Tier 4 — Meta Ops           (3): last_quality_audit_at, usage_count_30d, user_difficulty_avg
//   Tier 5 — Content Extension  (3): pronunciation_notes, etymology_brief, contextual_examples
//
// 입력: SchemaPresenceData (queries.ts fetchSchemaPresence)
// 출력: SchemaEvolutionTier[] + Migration SQL 생성기

import type {
  SchemaEvolutionTier,
  SchemaPresenceData,
  SchemaTier,
} from './types'

// ─────────────────────────────────────────────────────────────
// Tier 정의 (16 컬럼)
// ─────────────────────────────────────────────────────────────

interface ColumnSpec {
  name: string
  type: string
  nullable: boolean
  purpose: string
}

const TIER_DEFINITIONS: Array<{
  tier: SchemaTier
  label: string
  rationale: string
  columns: ColumnSpec[]
  priority: number
}> = [
  // ─── Tier 1 — Learning Core ────────────────────────────────
  {
    tier: 1 as SchemaTier,
    label: 'Tier 1 — Learning Core',
    rationale:
      'SpellForge / WordBlitz / Dictation 청각 학습 + Flashcard 시각 학습. R4 결정적.',
    priority: 1,
    columns: [
      {
        name: 'audio_url',
        type: 'TEXT',
        nullable: true,
        purpose: '기본 audio URL (UK/US 미구분 fallback)',
      },
      {
        name: 'audio_url_uk',
        type: 'TEXT',
        nullable: true,
        purpose: 'UK 발음 audio',
      },
      {
        name: 'audio_url_us',
        type: 'TEXT',
        nullable: true,
        purpose: 'US 발음 audio',
      },
      {
        name: 'image_url',
        type: 'TEXT',
        nullable: true,
        purpose: 'Flashcard 시각 자산 — concrete noun 우선',
      },
      {
        name: 'mnemonic_ko',
        type: 'TEXT',
        nullable: true,
        purpose: '한국어 학습자 암기 보조 (스토리/이미지 연상)',
      },
    ],
  },

  // ─── Tier 2 — Korean Learner ──────────────────────────────
  {
    tier: 2 as SchemaTier,
    label: 'Tier 2 — Korean Learner Specific',
    rationale:
      '한국어 학습자 특이 결함 (Konglish, 발음 혼동, 사용 주의). R4 + 학습 효율.',
    priority: 2,
    columns: [
      {
        name: 'common_errors_ko',
        type: 'TEXT[]',
        nullable: true,
        purpose: '한국 학습자 빈번 실수 사례 (e.g., "fun" 명사로 오용)',
      },
      {
        name: 'usage_warning_ko',
        type: 'TEXT',
        nullable: true,
        purpose: '사용 주의사항 (지역 차이, register, 민감 어휘 등)',
      },
      {
        name: 'konglish_alert',
        type: 'BOOLEAN',
        nullable: true,
        purpose: 'Konglish 단어 플래그 (handphone/officetel 등)',
      },
    ],
  },

  // ─── Tier 3 — Vocab Network ───────────────────────────────
  {
    tier: 3 as SchemaTier,
    label: 'Tier 3 — Vocabulary Network',
    rationale: '단어 간 의미망 — 추천/추출 정확도 ↑. R1 + R4.',
    priority: 3,
    columns: [
      {
        name: 'related_words',
        type: 'TEXT[]',
        nullable: true,
        purpose: '의미상 관련 단어 (parent/child/sibling)',
      },
      {
        name: 'confusion_pairs',
        type: 'JSONB',
        nullable: true,
        purpose: '혼동 단어 쌍 (affect/effect, accept/except)',
      },
    ],
  },

  // ─── Tier 4 — Meta Ops ────────────────────────────────────
  {
    tier: 4 as SchemaTier,
    label: 'Tier 4 — Meta Ops',
    rationale: '운영/품질 추적 — Dashboard freshness + 사용량 기반 보정.',
    priority: 4,
    columns: [
      {
        name: 'last_quality_audit_at',
        type: 'TIMESTAMPTZ',
        nullable: true,
        purpose: '마지막 사람/Claude 감수 시점',
      },
      {
        name: 'usage_count_30d',
        type: 'INTEGER',
        nullable: true,
        purpose: '최근 30일 사용자 학습 노출 횟수',
      },
      {
        name: 'user_difficulty_avg',
        type: 'NUMERIC(4,2)',
        nullable: true,
        purpose: 'SRS difficulty 평균 (실 사용자 데이터 집계)',
      },
    ],
  },

  // ─── Tier 5 — Content Extension ───────────────────────────
  {
    tier: 5 as SchemaTier,
    label: 'Tier 5 — Content Extension',
    rationale: '심화 학습 콘텐츠 — 고급 사용자 / 어원 학습 / 다중 예문.',
    priority: 5,
    columns: [
      {
        name: 'pronunciation_notes',
        type: 'TEXT',
        nullable: true,
        purpose: '발음 주의 (silent letters, stress shift)',
      },
      {
        name: 'etymology_brief',
        type: 'TEXT',
        nullable: true,
        purpose: '어원 간략 (라틴/그리스/게르만 기원)',
      },
      {
        name: 'contextual_examples',
        type: 'JSONB',
        nullable: true,
        purpose: '맥락별 예문 (formal/informal/business/casual)',
      },
    ],
  },
]

// ─────────────────────────────────────────────────────────────
// generateSchemaEvolutionPlan — Tier 별 진행 상황 + 정렬
// ─────────────────────────────────────────────────────────────

export function generateSchemaEvolutionPlan(
  schema: SchemaPresenceData,
): SchemaEvolutionTier[] {
  return TIER_DEFINITIONS.map((t) => ({
    tier: t.tier,
    label: t.label,
    rationale: t.rationale,
    priority: t.priority,
    columns: t.columns.map((c) => ({
      name: c.name,
      type: c.type,
      nullable: c.nullable,
      purpose: c.purpose,
      present: schema.tierColumns[c.name] ?? false,
    })),
  })).sort((a, b) => a.priority - b.priority)
}

// ─────────────────────────────────────────────────────────────
// Migration SQL 생성기 — Tier 1 (audio_url 등)
// ─────────────────────────────────────────────────────────────

/**
 * 특정 Tier 의 Migration SQL 생성.
 * ALTER TABLE ADD COLUMN IF NOT EXISTS — 멱등 안전.
 */
export function generateMigrationSql(
  schema: SchemaPresenceData,
  targetTier: SchemaTier,
): string {
  const def = TIER_DEFINITIONS.find((t) => t.tier === targetTier)
  if (!def) {
    return `-- ⚠ Tier ${targetTier} 정의 없음`
  }

  const lines: string[] = []
  lines.push(`-- supabase/migrations/dict_schema_evolution_tier${targetTier}.sql`)
  lines.push(`-- ${def.label}`)
  lines.push(`-- ${def.rationale}`)
  lines.push('')
  lines.push('ALTER TABLE public.shared_dictionary')

  const alters: string[] = []
  for (const col of def.columns) {
    const present = schema.tierColumns[col.name] ?? false
    if (present) {
      alters.push(`  -- ✅ ${col.name} 이미 존재 (skip)`)
      continue
    }
    const nullClause = col.nullable ? '' : ' NOT NULL'
    alters.push(`  ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}${nullClause}`)
  }
  // ADD COLUMN 만 join — 주석 라인은 별도
  const actualAlters = alters.filter((a) => !a.trim().startsWith('--'))
  if (actualAlters.length === 0) {
    lines.push('  ; -- 모든 컬럼 이미 존재')
  } else {
    lines.push(actualAlters.join(',\n'))
    lines.push(';')
  }

  // 주석 추가 (purpose)
  lines.push('')
  for (const col of def.columns) {
    const present = schema.tierColumns[col.name] ?? false
    if (present) continue
    lines.push(
      `COMMENT ON COLUMN public.shared_dictionary.${col.name} IS '${col.purpose.replace(/'/g, "''")}';`,
    )
  }

  // Tier 1 audio_url 부분 인덱스 권장
  if (targetTier === 1) {
    lines.push('')
    lines.push('-- 부분 인덱스 — audio 보유 단어 빠른 필터')
    lines.push(
      `CREATE INDEX IF NOT EXISTS idx_shared_dictionary_has_audio
  ON public.shared_dictionary (word)
  WHERE audio_url IS NOT NULL OR audio_url_us IS NOT NULL OR audio_url_uk IS NOT NULL;`,
    )
  }

  // 검증 가드
  lines.push('')
  lines.push('-- 검증')
  lines.push('DO $$')
  lines.push('BEGIN')
  for (const col of def.columns) {
    const present = schema.tierColumns[col.name] ?? false
    if (present) continue
    lines.push(`  IF NOT EXISTS (SELECT 1 FROM information_schema.columns`)
    lines.push(
      `    WHERE table_schema='public' AND table_name='shared_dictionary' AND column_name='${col.name}')`,
    )
    lines.push(`  THEN RAISE EXCEPTION '${col.name} column missing after migration';`)
    lines.push(`  END IF;`)
  }
  lines.push(`  RAISE NOTICE 'Tier ${targetTier} migration OK';`)
  lines.push('END $$;')

  return lines.join('\n')
}

/**
 * Tier 1 Migration SQL — 가장 즉시 사용 가능.
 */
export function generateTier1Migration(schema: SchemaPresenceData): string {
  return generateMigrationSql(schema, 1 as SchemaTier)
}

// ─────────────────────────────────────────────────────────────
// Plan summary — UI 헬퍼
// ─────────────────────────────────────────────────────────────

export interface SchemaEvolutionSummary {
  totalColumns: number
  totalPresent: number
  totalMissing: number
  byTier: Array<{
    tier: SchemaTier
    label: string
    present: number
    total: number
    pct: number
  }>
  /** 다음 권장 Tier (가장 우선순위 높으며 미완성) */
  nextRecommendedTier: SchemaTier | null
}

export function summarizeEvolution(plan: SchemaEvolutionTier[]): SchemaEvolutionSummary {
  let totalColumns = 0
  let totalPresent = 0
  const byTier: SchemaEvolutionSummary['byTier'] = []

  for (const t of plan) {
    const present = t.columns.filter((c) => c.present).length
    totalColumns += t.columns.length
    totalPresent += present
    byTier.push({
      tier: t.tier,
      label: t.label,
      present,
      total: t.columns.length,
      pct: t.columns.length > 0 ? Math.round((present / t.columns.length) * 100) : 0,
    })
  }

  const nextRecommendedTier =
    plan.find((t) => t.columns.some((c) => !c.present))?.tier ?? null

  return {
    totalColumns,
    totalPresent,
    totalMissing: totalColumns - totalPresent,
    byTier,
    nextRecommendedTier,
  }
}
