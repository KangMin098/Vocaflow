// apps/web/src/lib/topic-corpus/client.ts
//
// TCP 전용 서비스 클라이언트.
//
// 왜 별도 헬퍼인가: `@vocaflow/types` 의 `Database` 는 **DB 스키마에서 생성**되므로,
// 마이그레이션 `20260816160000_topic_corpus_ingest` 를 적용하기 전에는 TCP 테이블·RPC 가
// 타입에 없다. 그 상태로 `createAdminClient()` 를 쓰면 새 RPC 이름이 전부 타입 에러가 난다.
//
// 라우트마다 `as any` 를 흩뿌리면 나중에 타입을 재생성했을 때 **어디를 되돌려야 하는지
// 아무도 모른다.** 그래서 완화 지점을 이 파일 하나로 모은다 — 타입 재생성 후 여기만
// `createAdminClient()` 로 되돌리면 전 경로가 다시 타입 검사를 받는다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * RLS 우회 서비스 클라이언트. **반드시 `requireAdmin*` 게이트 뒤에서만** 사용.
 *
 * 제네릭 없는 `SupabaseClient` 라 TCP 객체 이름을 받아들인다. 타입 재생성 뒤에는
 * 반환 타입을 `SupabaseClient<Database>` 로 좁힐 것.
 */
export function createTopicCorpusClient(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient
}
