// apps/web/src/components/admin/articles/ArticleWordSetPreviewModal.tsx
//
// 글 단어장 검수 모달 (책 ChapterWordSetPreviewModal 미러).
// - 글은 단일 섹션 = 단어장 1개 → 추출 단어 전수 + 뜻 + 발음 + 본문 첫 문장 표시
// - vocab 은 검수 페이지에서 이미 service-role 로 로드한 데이터를 props 로 받음 (재fetch X)
// - 껍데기는 `ui/Dialog` — Admin 팝업도 학습자 팝업과 같은 참조 골격을 쓴다
//   (DD-68 · tines-mapping §28). 같은 사람이 두 화면을 오가는데 팝업이 다르게 열릴 이유가 없다.

'use client'

import { Volume2 } from 'lucide-react'

import { Dialog } from '@/components/ui/Dialog'
import type { ReviewVocab } from '@/lib/articles/review-types'
import { RegisterBadge } from '@/components/library/RegisterBadge'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  cefrLevel: string | null
  words: ReviewVocab[]
}

export function ArticleWordSetPreviewModal({ open, onClose, title, cefrLevel, words }: Props) {
  function speak(w: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(w)
    u.lang = 'en-US'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  }

  if (!open) return null

  return (
    <Dialog
      onClose={onClose}
      size="lg"
      crumbs={['Admin', '글 검수', '글 단어장']}
      title={title}
      ariaLabel={`${title} 단어 검수`}
      byline="학습가치(LV) 내림차순"
      tags={[`${words.length}단어`, ...(cefrLevel ? [`CEFR ${cefrLevel}`] : [])]}
      footer={
        <p className="font-body text-[10px] leading-relaxed text-[var(--t2)]">
          ※ <code className="font-mono">library_article_vocabularies</code> — 글 발행 시 학습자 WordVault
          추출 대상. 고어·시대어 register 는 본문 툴팁으로 노출.
        </p>
      }
    >
        <div>
          {words.length === 0 ? (
            <p className="font-body text-[13px] text-[var(--t2)]">
              추출된 단어가 없어요. 상단에서 “지금 처리/재분석”을 실행하세요.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--bd)]/40">
              {words.map((w) => (
                <li key={w.word} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 w-7 shrink-0 font-display text-[11px] font-[700] tabular-nums text-[var(--t2)]">
                    #{w.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-english text-[15px] font-[600] text-[var(--t1)]">
                        {w.word}
                      </span>
                      <RegisterBadge register={w.wordRegister} />
                      {w.pos && (
                        <span className="font-body text-[10px] text-[var(--t2)]">{w.pos}</span>
                      )}
                      {w.vLevel != null && (
                        <span className="rounded-[var(--r-full)] bg-[var(--bg3)] px-2 py-1 font-mono text-[9px] font-[700] text-[var(--t2)]">
                          V{w.vLevel}
                        </span>
                      )}
                      {w.cefrLevel && (
                        <span className="rounded-[var(--r-full)] bg-[var(--bg3)] px-2 py-1 font-display text-[9px] font-[700] text-[var(--t2)]">
                          {w.cefrLevel}
                        </span>
                      )}
                    </div>
                    <p className="truncate font-body text-[12px] text-[var(--t2)]">
                      {w.meaningKo ?? '— (사전 미등재)'}
                    </p>
                    {w.firstSentence && (
                      <p className="mt-0.5 line-clamp-2 font-english text-[11px] italic leading-snug text-[var(--t2)]">
                        “{w.firstSentence}”
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => speak(w.word)}
                    aria-label={`${w.word} 발음 듣기`}
                    className="min-h-[44px] mt-0.5 shrink-0 rounded-full p-2 text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--p)]"
                  >
                    <Volume2 size={14} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
    </Dialog>
  )
}
