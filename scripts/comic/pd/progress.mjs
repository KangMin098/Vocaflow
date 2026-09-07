// scripts/comic/pd/progress.mjs
//
// 스테이지 진행 방출 — 각 스테이지 스크립트가 아이템(페이지·컷)을 처리할 때마다
// work 루트에 progress.json 을 갱신한다. admin 모니터가 이걸 읽어 "어디 콘텐츠의 몇 번째가
// 진행 중인지 · 진행율"을 라이브로 보여준다. 실패해도 조용히 무시(파이프라인에 영향 0).

import fs from 'node:fs'
import path from 'node:path'

export function emitProgress(root, obj) {
  try {
    const pct = obj.total ? Math.round((100 * obj.done) / obj.total) : null
    fs.writeFileSync(path.join(root, 'progress.json'), JSON.stringify({ ...obj, pct, updatedAt: new Date().toISOString() }))
  } catch { /* noop */ }
}
