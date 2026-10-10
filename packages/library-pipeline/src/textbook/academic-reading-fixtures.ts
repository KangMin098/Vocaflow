// packages/library-pipeline/src/textbook/academic-reading-fixtures.ts
import { articleLicenseSchema, readingTargetSchema } from './academic-reading'
import { readingAnalysisSchema } from './academic-reading-contract'

export const target = readingTargetSchema.parse({
  family: 'P03',
  age_band: 'middle_1',
  language_band: 'middle',
  reasoning_band: 'middle_1',
  passage_v_level: 3,
  skills: ['R4'],
  exam: 'none',
  words: { min: 180, max: 250 },
  share_alike: false,
  resources: [],
})
export const quote = 'Warm water changes ocean habitats.'
export const profile = {
  lexical_level: { level: 3, evidence: quote },
  syntax_level: { level: 3, evidence: quote },
  abstraction_level: { level: 4, evidence: quote },
  information_density: { level: 4, evidence: quote },
  discourse_level: { level: 4, evidence: quote },
  inference_level: { level: 4, evidence: quote },
  background_knowledge: { level: 4, evidence: quote },
  age_appropriateness: { appropriate: true, evidence: quote },
  exam_level: { exam: 'none' as const, evidence: quote },
  overall_level: { level: 4, evidence: quote },
}
export const analysis = readingAnalysisSchema.parse({
  source_profile: profile,
  passage_profile: profile,
  source_claims: [{ claim: quote, quote }],
  discourse: [{ relation: 'Cause and effect', quote }],
  preserved_claims: [{ source_quote: quote, passage_quote: quote }],
  added_background: [],
  item_plan: [
    {
      skill: 'R4',
      kind: 'question',
      item_reasoning_level: 7,
      item_difficulty: 5,
      difficulty_evidence: 'The learner must separate the main idea from details.',
      prompt: 'What changes ocean habitats?',
      expected_response: 'Warmer water changes habitats.',
      evidence: [quote],
      resource_evidence: [],
      time_limit_seconds: null,
    },
  ],
  parallel_pair: null,
})
export const rights = articleLicenseSchema.parse({
  canonical_source: 'noaa',
  canonical_url: 'https://www.climate.gov/example',
  original_author: 'NOAA author',
  published_at: null,
  license: 'Public Domain',
  license_url: 'https://www.climate.gov/copyright',
  commercial_use: true,
  derivative_use: true,
  ai_processing: 'allowed',
  third_party_text: false,
  third_party_image: true,
  attribution_required: true,
  share_alike: false,
  original_work_id: null,
  discovered_via: null,
  checked_at: '2026-10-02T00:00:00Z',
  evidence: 'Article-specific copyright statement was checked.',
})
