// apps/web/src/components/csat/theater/__tests__/s2b-browser.fixture.tsx
// DB·인증·강의가 없는 실제 패널 격리 렌더. 입력은 서버 projection 결과를 러너가 주입한다.
import { createRoot } from 'react-dom/client'
import type { InquiryV3 } from '@/lib/csat/inquiry/labels'
import { RESOURCE_STATE_TEXT, type InquiryResourceState } from '@/lib/csat/inquiry/interactive-34'
import { V3Design, V3Judgment } from '../InquiryV3Panels'
import { InquiryResourceNotice } from '../inquiry/Interactive34'
import styles from '../theater.module.css'

declare global {
  interface Window { __s2bV3: InquiryV3; __s2bEvidence: unknown[] }
}
window.__s2bEvidence = []
const state = location.hash.slice(1)
const props = { answerRevealed: state !== 'CLOSED', sourceUnitsHash: state === 'BOUND' ? window.__s2bV3.units_hash : undefined, v3: window.__s2bV3, linkable: true, selectedKey: null, onEvidence: (sentences: number[], key: string) => window.__s2bEvidence.push({ sentences, key }) }
const node = document.getElementById('root')
if (!node) throw new Error('격리 렌더 대상 부재')
createRoot(node).render(<main data-design-scope="csat" className={`${styles.workspace} break-keep`} style={{ display: 'block', height: 'auto', padding: 24 }}>
  <h1>2026-34 공개 후 분석 · 패널 격리 검증</h1>
  <p>정상 인증·원문 PDF·강의 통합·학습 효과 검증은 포함하지 않습니다.</p>
  {state in RESOURCE_STATE_TEXT ? <InquiryResourceNotice state={state as InquiryResourceState} /> : <>
    <V3Judgment {...props} /><V3Design {...props} />
  </>}
</main>)
