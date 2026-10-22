import 'D:/workspace/Vocaflow-final-product/apps/web/src/app/globals.css'
import { createRoot } from 'react-dom/client'
import { WordVaultBrowseClient } from '@/components/wordvault/WordVaultBrowseClient'
import { WordVaultStudyClient } from '@/components/wordvault/WordVaultStudyClient'
import { VocabLearningCard } from '@/components/csat/diagnosis/map/VocabLearningCard'
import { vocabMapReturnHref } from '@/lib/csat/map-return'
import { vocabRowToWord } from '@/lib/wordvault/browse-queries'
const q = new URLSearchParams(location.search)
const scene = q.get('scene')
const mapBack = vocabMapReturnHref(Object.fromEntries(q))
const row = (id: string, word: string) => ({ id, word, meaning: '뜻 ' + word, example_sentence: null, pronunciation: null, pos: 'n', cefr_level: 'B1', difficulty: null, stability: null, last_review_at: null, next_review_at: null, module_history: [], review_count: 0, text_id: null, shared_set_id: 's1', created_at: '2026-10-01T00:00:00Z' })
const words = [row('w1', 'evidence'), row('w2', 'claim')].map((r, i) => vocabRowToWord(r as never, i))
const book = { bookId: 'b1', bookTitle: '테스트 도서', chapterIdx: 1, currentTextId: null, chapters: [{ id: 's1', chapterIdx: 1, title: '1장', isCurrent: true }, { id: 's2', chapterIdx: 2, title: '2장', isCurrent: false }] }
const ctx = { mapTask: q.get('map_task'), ws: q.get('ws'), mapWs: q.get('map_ws'), mapPlan: q.get('map_plan'), mapGoal: q.get('map_goal'), mapItem: q.get('map_item'), mapAttempt: q.get('map_attempt') }
const el = scene === 'browse'
  ? <WordVaultBrowseClient words={words} textChips={[]} setChips={[{ id: 's1', label: '1장', count: 2 }]} bookContext={book} mapBack={mapBack} />
  : scene === 'review-empty'
    ? <WordVaultStudyClient words={[]} mode="review" {...(mapBack ? { mapBack, backHref: mapBack } : {})} />
    : <div style={{ maxWidth: 760, padding: 16 }}><VocabLearningCard kind="support" taskName="기본 의미 접근" ctx={ctx as never} /></div>
createRoot(document.getElementById('root')!).render(el)
