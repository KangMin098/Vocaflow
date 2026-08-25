// apps/web/src/components/workspace/VoicePickerPopover.tsx
//
// v06.32 — TTS voice picker (브라우저 음성 선택).
// tts-controller 의 getEnglishVoices + setVoice + previewVoice 활용.
// neural/premium/standard 배지 + ▶ 미리듣기 + ✓ 선택 표시.

'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Pause, Play, Volume2 } from 'lucide-react'

import { useTTS, type VoiceQuality } from '@/lib/workspace/tts-controller'

const QUALITY_LABEL: Record<VoiceQuality, string> = {
  neural: 'Neural',
  premium: 'Premium',
  standard: 'Standard',
}
const QUALITY_COLOR: Record<VoiceQuality, string> = {
  neural: 'bg-[#8B5CF6] text-white',
  premium: 'bg-[#3B82F6] text-white',
  standard: 'bg-[var(--bg3)] text-[var(--t2)]',
}

export function VoicePickerPopover() {
  const tts = useTTS()
  const [open, setOpen] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const ref = useRef<HTMLDivElement>(null)
  // v06.34 fix — useTTS() 가 매 렌더 새 객체 반환 → ref 로 안정화 (무한 루프 차단)
  const ttsRef = useRef(tts)
  ttsRef.current = tts

  // Voices load (mount + voiceschanged event)
  useEffect(() => {
    const update = () => setVoices(ttsRef.current.getEnglishVoices())
    update()
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.addEventListener('voiceschanged', update)
      return () => window.speechSynthesis.removeEventListener('voiceschanged', update)
    }
    return undefined
  }, []) // ← 빈 deps (mount 1회) — tts 변경에 의한 무한 루프 차단

  // 외부 클릭 / Esc 닫기
  useEffect(() => {
    if (!open) return
    const close = () => {
      setOpen(false)
      ttsRef.current.cancelPreview()
    }
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open]) // ← tts 제거 (ref 사용)

  const selectedVoice = voices.find((v) => v.voiceURI === tts.state.selectedVoiceURI)
  const label = selectedVoice
    ? selectedVoice.name.length > 22
      ? selectedVoice.name.slice(0, 22) + '…'
      : selectedVoice.name
    : '자동'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="음성 선택"
        className="inline-flex items-center gap-2 rounded-[var(--r-full)] bg-white/10 px-3 py-1 font-display text-[11px] font-[600] text-white/95 transition-colors hover:bg-white/20"
      >
        <Volume2 size={11} aria-hidden />
        <span className="hidden sm:inline">{label}</span>
        <ChevronDown size={11} aria-hidden className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-[calc(100%+8px)] right-0 z-[80] flex max-h-[60vh] w-[300px] flex-col overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-xl)]"
        >
          <header className="flex items-center justify-between border-b border-[var(--bd)] px-3 py-2">
            <span className="font-display text-[11px] font-[700] uppercase tracking-wider text-[var(--t2)]">
              브라우저 음성
            </span>
            <span className="font-mono text-[10px] text-[var(--t2)]">{voices.length}개</span>
          </header>

          <ul className="flex-1 overflow-y-auto py-1">
            {/* "자동" 옵션 */}
            <li>
              <button
                type="button"
                onClick={() => {
                  tts.setVoice(null)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--bg2)] ${
                  tts.state.selectedVoiceURI === null ? 'bg-[var(--p-light)]' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[12px] font-[600] text-[var(--t1)]">자동 선택</p>
                  <p className="font-body text-[10px] text-[var(--t2)]">최적 음성 자동 선정</p>
                </div>
                {tts.state.selectedVoiceURI === null && (
                  <span className="text-[var(--p)]" aria-hidden>
                    ✓
                  </span>
                )}
              </button>
            </li>

            {voices.length === 0 && (
              <li className="px-3 py-4 text-center font-body text-[11px] text-[var(--t2)]">
                사용 가능한 음성이 없어요
              </li>
            )}

            {voices.map((v, idx) => {
              const isSelected = tts.state.selectedVoiceURI === v.voiceURI
              const isPreviewing = tts.state.previewingVoiceURI === v.voiceURI
              const quality = tts.classifyVoice(v)
              // 목록은 품질 best-first 정렬 → 첫 항목이 최선 음성.
              const isBest = idx === 0
              return (
                <li key={v.voiceURI}>
                  <div
                    className={`flex items-center gap-2 px-3 py-2 transition-colors hover:bg-[var(--bg2)] ${
                      isSelected ? 'bg-[var(--p-light)]' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        tts.previewVoice(v)
                      }}
                      aria-label={`${v.name} 미리듣기`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg3)] text-[var(--t2)] transition-colors hover:bg-[var(--p)] hover:text-white"
                    >
                      {isPreviewing ? <Pause size={11} /> : <Play size={11} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        tts.setVoice(v.voiceURI)
                        setOpen(false)
                      }}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-[12px] font-[600] text-[var(--t1)]">
                          {v.name}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] text-[var(--t2)]">{v.lang}</span>
                          <span
                            className={`rounded-[2px] px-1 py-px font-display text-[8px] font-[700] ${QUALITY_COLOR[quality]}`}
                          >
                            {QUALITY_LABEL[quality]}
                          </span>
                          {isBest && (
                            <span className="rounded-[2px] bg-[var(--learn-known)] px-1 py-px font-display text-[8px] font-[700] text-white">
                              추천
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-[var(--p)]" aria-hidden>
                          ✓
                        </span>
                      )}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
