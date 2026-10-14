// apps/web/src/lib/textbook/practice-rpc.ts
//
// v6.2 P-F7a — 교재 연습 문항 조회 경로 선택(순수 · 서버 액션 파일 밖).
// 권 단위 함수 `textbook_practice_items_for(series, step)` 가 V레벨 · 권 유형 · 발행을 DB 에서 정한다.
// 승인안 A 적용 전에는 그 함수가 없으므로 **함수 없음일 때만** 옛 V레벨 함수로 간다 — 다른 오류(권한 · 네트워크)는 그대로 실패.
// 적용 뒤 옛 함수 실행 권한을 회수하면 이 갈래는 권한 오류가 되어 화면은 「불러오지 못했어요」(fail-closed).
// ⚠️ RPC 이름은 호출부에서 리터럴로 쓴다(`rpc-call-sites.test.ts` — 권한 감사가 이름을 정적으로 모은다).
//    그래서 이름을 받는 범용 함수가 아니라 두 호출을 따로 받는다.

export interface RpcResult {
  data: unknown
  error: { code?: string; message?: string } | null
}

export interface VolumePracticeCalls {
  /** `rpc('textbook_practice_items_for', { p_series, p_step, p_limit })` */
  volume: (series: string, step: number, limit: number) => PromiseLike<RpcResult>
  /** `rpc('textbook_practice_items', { p_v_level, p_limit })` — 승인안 A 적용 전 전용 */
  legacy: (vLevel: number, limit: number) => PromiseLike<RpcResult>
}

/** PostgREST 「함수 없음」 — 스키마 캐시에 없음(PGRST202) · DB 에 없음(42883) */
export function isMissingFunction(error: RpcResult['error']): boolean {
  return error?.code === 'PGRST202' || error?.code === '42883'
}

export async function fetchVolumePracticeRows(
  calls: VolumePracticeCalls,
  volume: { series: string; step: number; vLevel: number },
  limit: number,
): Promise<RpcResult & { path: 'volume' | 'legacy_v_level' }> {
  const scoped = await calls.volume(volume.series, volume.step, limit)
  if (!isMissingFunction(scoped.error)) return { ...scoped, path: 'volume' }
  const legacy = await calls.legacy(volume.vLevel, limit)
  return { ...legacy, path: 'legacy_v_level' }
}
