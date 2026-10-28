// apps/web/scripts/judgment-harness/cases/r-fact.check.mjs
// 정보 일치 도구(R-FACT) 격리 브라우저 검사(제품 E2E 아님) — r-notice 와 같은 절차, Olmsted ② · [u3] 으로.
import { makeCheck } from './r-notice.check.mjs'

export const check = makeCheck({ choice: 2, unit: 'u3', second: 'Paul Farmer' })
