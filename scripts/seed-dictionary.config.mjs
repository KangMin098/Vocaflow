// scripts/seed-dictionary.config.mjs
//
// 외부 시드 데이터 (SQLite) → Supabase import 설정.
// 메인 스크립트(seed-dictionary.mjs)에서 import 하여 사용.

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export const config = {
  // ── 입력 파일 ──
  // 외부 시드 데이터 (SQLite). 사전 처리로 .db 단일 파일만 유지.
  dbPath: join(ROOT, 'data/import/dictionary-seed.db'),

  // ── Supabase ──
  // service_role 키는 RLS 우회 (write 정책 통과). .env.local 에서 로드.
  envFile: join(ROOT, '.env.local'),
  envKeys: {
    url: 'NEXT_PUBLIC_SUPABASE_URL',
    serviceRole: 'SUPABASE_SERVICE_ROLE_KEY',
  },

  // ── 필드 매핑 ──
  // 노트 모델의 필드 이름은 데크마다 다름. col.models 에서 ord 동적 매핑.
  // 매칭은 lowercase + 첫 일치 이름. 여러 후보를 두어 변형 흡수.
  fieldMap: {
    word: ['word', 'expression', 'front', 'term'],
    pos: ['pos', 'part of speech', 'type'],
    cefr: ['cefr', 'level', 'cefr level'],
    h1: ['heading 1', 'h1', 'topic 1', 'category 1'],
    h2: ['heading 2', 'h2', 'topic 2', 'category 2'],
    h3: ['heading 3', 'h3', 'topic 3', 'category 3'],
    example: ['example', 'sentence', 'example sentence'],
  },

  // ── 필터 ──
  filters: {
    // POS 정상값 (소문자). 빈 값 / 변형 흡수.
    validPos: new Set([
      'noun', 'verb', 'adjective', 'adverb',
      'pronoun', 'preposition', 'conjunction', 'interjection',
      'determiner', 'auxiliary verb', 'modal verb', 'number',
      'idiom', 'phrasal verb', 'abbreviation', 'exclamation',
      'n.', 'v.', 'adj.', 'adv.', 'prep.', 'conj.', 'pron.',
    ]),
    // 제외할 POS 패턴 — 비워두면 모두 학습 대상에 포함 (idiom·phrasal verb 등).
    skipPosContains: [],
    // CEFR 정상값
    validCefr: new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  },

  // ── 배치 ──
  batchSize: 500,        // Supabase upsert 1회당 row 수
  dryRun: false,         // true 면 INSERT 안 하고 통계만

  // ── slug 규칙 ──
  slugSeparator: '-',
}
