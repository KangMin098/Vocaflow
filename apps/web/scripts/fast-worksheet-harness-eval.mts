// apps/web/scripts/fast-worksheet-harness-eval.mts
// 격리 하네스 전용 — stdin { action, bundle, current } → stdout 응답 본문. API 경로와 같은 실제 evaluateFast/fastView/fastFiles 를 돈다
// (Playwright 로더가 워크스페이스 패키지를 못 읽어 tsx 자식 프로세스로 부른다). 인증 · 원천 DB 조회는 route.test.ts 몫.
import { readFileSync } from 'node:fs'

import { evaluateFast, fastFiles, fastView } from '../src/lib/csat/map/v62/factory-bridge/fast-worksheet'
import { LocalProductionError } from '../src/lib/csat/map/v62/factory-bridge/local-production'

const { action, bundle, current } = JSON.parse(readFileSync(0, 'utf8')) as { action: 'preview' | 'export'; bundle: unknown; current: unknown }
try {
  const s = evaluateFast(bundle, current)
  process.stdout.write(JSON.stringify({ status: 200, body: action === 'preview' ? { status: 'ok', view: fastView(s), writes: 'not_performed' } : { status: 'ok', files: fastFiles(s, null), writes: 'not_performed' }, target: s.target }))
} catch (e) {
  if (!(e instanceof LocalProductionError)) throw e
  process.stdout.write(JSON.stringify({ status: 409, body: { status: 'rejected', code: e.code, detail: e.detail } }))
}
