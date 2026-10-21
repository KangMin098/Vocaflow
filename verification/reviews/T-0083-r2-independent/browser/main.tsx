import { createRoot } from 'react-dom/client'
import { AuthoredSupplyCard } from '@/components/csat/diagnosis/map/AuthoredSupplyCard'
import { outgoingCtx } from '@/lib/csat/map/v62/return-ctx'
const q = new URLSearchParams(location.search)
const past = q.get('state') === 'past'
const saved = { status: 'installed', goalVersionId: 7, byTemplate: { 'ws.sentence-core': { workspaceId: '11111111-2222-4333-8444-555555555555', latest: { version: 3 } } } }
createRoot(document.getElementById('root')!).render(<div style={{ padding: 16, maxWidth: 760 }}><AuthoredSupplyCard kind={q.get('state') === 'support_control' ? 'support' : 'instructional'} task="s.attachment" taskName="수식 관계" template="ws.sentence-core" planSaved past={past} ctx={outgoingCtx(saved as never, 's.sentence_core', 'ws.sentence-core')} /></div>)
