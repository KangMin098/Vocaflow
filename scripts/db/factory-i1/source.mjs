// scripts/db/factory-i1/source.mjs
//
// Factory I1 배포 — 정본 SQL 읽기(SHA · 바이트 · 최상위 트랜잭션 제어문 검사). build · restore 가 같이 쓴다.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { SOURCES } from './spec.mjs'

export const ROOT = path.resolve(import.meta.dirname, '../../..')
export const sha256 = (b) => createHash('sha256').update(b).digest('hex')

/** 원본을 읽고 정본 SHA 와 대조. 최상위 트랜잭션 제어문이 있으면 거절(원자 단위를 깨뜨린다). */
export function readSource(id) {
  const s = SOURCES[id]
  const buf = fs.readFileSync(path.join(ROOT, 'supabase/migrations', s.file))
  const got = sha256(buf)
  if (got !== s.sha256) throw new Error(`DEPLOY_BLOCKED[sha] ${id} ${s.file} sha256 ${got} ≠ 정본 ${s.sha256}`)
  const text = buf.toString('utf8')
  if (text.includes('\r')) throw new Error(`DEPLOY_BLOCKED[bytes] ${id} 에 CR 이 있다 — 줄바꿈이 바뀌었다`)
  if (!text.endsWith('\n')) throw new Error(`DEPLOY_BLOCKED[bytes] ${id} 가 줄바꿈으로 끝나지 않는다`)
  // plpgsql 본문의 `begin` · `end;` 는 트랜잭션 제어가 아니다. 0열에서 시작해 세미콜론으로 끝나는 최상위 문만 본다.
  const top = text.split('\n').filter((l) =>
    /^(begin|commit|rollback|abort|end|start\s+transaction)(\s+(work|transaction))?(\s+isolation\s+level\s+[a-z ]+)?\s*;\s*$/i.test(l)
    || /^(savepoint|release(\s+savepoint)?|rollback\s+to(\s+savepoint)?|prepare\s+transaction|commit\s+prepared)\s+\S+\s*;\s*$/i.test(l))
  if (top.length) throw new Error(`DEPLOY_BLOCKED[atomicity] ${id} 에 최상위 트랜잭션 제어문: ${top.join(' | ')}`)
  if (/\$vf\$/.test(text)) throw new Error(`DEPLOY_BLOCKED[bytes] ${id} 가 가드 구분자 $vf$ 를 쓴다`)
  return text
}
