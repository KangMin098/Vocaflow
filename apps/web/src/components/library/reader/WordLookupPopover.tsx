// apps/web/src/components/library/reader/WordLookupPopover.tsx
// 본문 단어 클릭 시 뜨는 사전 툴팁 — 자체 dict+lemma 해소 (외부 의존 없음).
//
// found: 해소 단어 + 한국어 뜻 + 품사·CEFR·V-Level + 예문 + 발음(Web Speech).
// not_found: "사전에 없는 단어" (불어·고유명사·OCR — 영어 어휘 아님) + 발음만.
//
// 위치: anchorRect(클릭한 단어의 viewport 좌표) 아래에 fixed 배치, 뷰포트 클램프.
// 닫기: 바깥 클릭 · Esc · 스크롤.
// 초점(선택 · nonmodalFocus): 호출자가 켤 때만(지금은 Stories 독서 — StoryUnitText) 열리면 창 자체에 초점을 옮긴다(preventScroll ·
//   이름 있는 role=dialog · 뜻 영역을 aria-describedby 로 · 불러오는 동안 aria-busy). 초점이 창 밖으로 나가면 닫는다(다시 옮기지 않는다).
//   모달이 아니다 — 초점 가두기 · aria-modal 없음. 닫힌 이유(onClose(reason))로 호출자가 초점을 되돌릴지 정한다.
//   끄면(기본) 기존 화면들의 동작 그대로다(초점은 누른 낱말에 남는다).

'use client'

import { lookupWord, type WordLookup } from '@/lib/library/reader-queries'
import { createClient } from '@/lib/supabase/client'
import { CircleAlert, RotateCw, Volume2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { RegisterBadge } from '@/components/library/RegisterBadge'
import { PosBadge } from '@/components/library/PosBadge'
import { POPOVER_CARD } from '@/components/ui/tines-kit'

/** 닫힌 이유 — escape · button(닫기 단추) · outside(바깥 누름) · scroll · blur(초점이 창 밖으로 — nonmodalFocus 때만). */
export type WordLookupCloseReason = 'escape' | 'button' | 'outside' | 'scroll' | 'blur'

interface WordLookupPopoverProps {
  surface: string
  anchorRect: DOMRect
  onClose: (reason?: WordLookupCloseReason) => void
  /** Learner PC surfaces only; admin and small-screen dimensions are preserved. */
  desktopLearner?: boolean
  /** 열릴 때 창에 초점 · 창 밖으로 초점이 나가면 닫기(비모달). 기본 false — 기존 화면 동작 유지. */
  nonmodalFocus?: boolean
}

const POPOVER_W = 288

// 선제형 외국어 사전 언어 라벨 + 발음 로케일. 'en' 은 배지 미표기(기본).
const LANG_META: Record<string, { label: string; flag: string; locale: string }> = {
  fr: { label: '프랑스어', flag: '🇫🇷', locale: 'fr-FR' },
  de: { label: '독일어', flag: '🇩🇪', locale: 'de-DE' },
  it: { label: '이탈리아어', flag: '🇮🇹', locale: 'it-IT' },
  es: { label: '스페인어', flag: '🇪🇸', locale: 'es-ES' },
  nl: { label: '네덜란드어', flag: '🇳🇱', locale: 'nl-NL' },
  la: { label: '라틴어', flag: '🏛️', locale: 'la' },
  ca: { label: '카탈루냐어', flag: '🇦🇩', locale: 'ca-ES' },
  ro: { label: '루마니아어', flag: '🇷🇴', locale: 'ro-RO' },
  pt: { label: '포르투갈어', flag: '🇵🇹', locale: 'pt-PT' },
  el: { label: '그리스어', flag: '🇬🇷', locale: 'el-GR' },
  ru: { label: '러시아어', flag: '🇷🇺', locale: 'ru-RU' },
  da: { label: '덴마크어', flag: '🇩🇰', locale: 'da-DK' },
  sv: { label: '스웨덴어', flag: '🇸🇪', locale: 'sv-SE' },
  no: { label: '노르웨이어', flag: '🇳🇴', locale: 'nb-NO' },
  fi: { label: '핀란드어', flag: '🇫🇮', locale: 'fi-FI' },
  ga: { label: '아일랜드어', flag: '🇮🇪', locale: 'ga-IE' },
  cy: { label: '웨일스어', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', locale: 'cy' },
  gd: { label: '스코틀랜드 게일어', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', locale: 'gd' },
  gl: { label: '갈리시아어', flag: '🇪🇸', locale: 'gl-ES' },
  eu: { label: '바스크어', flag: '🇪🇸', locale: 'eu-ES' },
  af: { label: '아프리칸스어', flag: '🇿🇦', locale: 'af-ZA' },
  cs: { label: '체코어', flag: '🇨🇿', locale: 'cs-CZ' },
  pl: { label: '폴란드어', flag: '🇵🇱', locale: 'pl-PL' },
  hu: { label: '헝가리어', flag: '🇭🇺', locale: 'hu-HU' },
  is: { label: '아이슬란드어', flag: '🇮🇸', locale: 'is-IS' },
  enm: { label: '중세 영어', flag: '📜', locale: 'en' },
  ang: { label: '고대 영어', flag: '📜', locale: 'en' },
  sco: { label: '스코트어', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', locale: 'en' },
  xx: { label: '외국어', flag: '🌐', locale: 'en' },
}

export function WordLookupPopover({ surface, anchorRect, onClose, desktopLearner = false, nonmodalFocus = false }: WordLookupPopoverProps) {
  const [result, setResult] = useState<WordLookup | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const bodyId = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // 비모달 초점(선택) — 열린 창으로 초점(스크롤 없이). 낱말이 바뀌어 다시 열려도(같은 창 · 다른 surface) 창으로 옮긴다.
  useEffect(() => {
    if (!nonmodalFocus) return
    ref.current?.focus({ preventScroll: true })
  }, [nonmodalFocus, surface])

  // fetch
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    setResult(null)
    const client = createClient()
    lookupWord(client, surface)
      .then((r) => {
        if (!cancelled) setResult(r)
      })
      .catch(() => {
        if (!cancelled) {
          setResult(null)
          setFailed(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [surface, attempt])

  // close on Esc / scroll / outside click
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose('escape')
    }
    const onScroll = () => onClose('scroll')
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose('outside')
    }
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  // position — 단어 아래, 뷰포트 클램프 (공간 부족 시 위로)
  const left = Math.min(Math.max(8, anchorRect.left), window.innerWidth - POPOVER_W - 8)
  const below = anchorRect.bottom + 6
  const placeAbove = below + 220 > window.innerHeight && anchorRect.top > 240
  const top = placeAbove ? undefined : below
  const bottom = placeAbove ? window.innerHeight - anchorRect.top + 6 : undefined

  const speak = (text: string): void => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    // 외국어 해소분은 해당 언어 로케일로 발음 (없으면 en-US)
    const meta = result?.lang ? LANG_META[result.lang] : undefined
    u.lang = meta?.locale ?? 'en-US'
    window.speechSynthesis.speak(u)
  }

  // 제안(suggestion)은 원단어(surface)를 헤더에 — 추정 단어를 단정하지 않음
  const isSuggestion = result?.matchVia === 'suggestion'
  const headWord = result?.found && !isSuggestion ? (result.resolvedWord ?? surface) : surface

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${surface} 뜻`}
      aria-describedby={nonmodalFocus ? bodyId : undefined}
      aria-busy={nonmodalFocus ? loading : undefined}
      tabIndex={nonmodalFocus ? -1 : undefined}
      onBlur={
        nonmodalFocus
          ? (e) => {
              // 창 안의 다른 조작으로 옮기는 것은 닫지 않는다. 창 밖(다음 조작 · 본문 낱말)으로 나가면 닫는다 — 초점은 사용자가 옮긴 곳에 둔다.
              const next = e.relatedTarget as Node | null
              if (next && !e.currentTarget.contains(next)) onCloseRef.current('blur')
            }
          : undefined
      }
      className={`fixed z-[120] ${POPOVER_CARD} ${nonmodalFocus ? 'outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]' : ''}`}
      style={{ left, top, bottom, width: POPOVER_W }}
      data-word-lookup={nonmodalFocus ? 'nonmodal' : undefined}
    >
      {/* header — 단어 + 발음 + 닫기 */}
      <div className="flex items-center gap-2 border-b border-[var(--bd)] px-4 py-3">
        <span className="min-w-0 flex-1 truncate font-english text-[18px] font-[600] text-[var(--t1)]">
          {headWord}
        </span>
        <button
          type="button"
          onClick={() => speak(headWord)}
          aria-label="발음 듣기"
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--p-light)] text-[var(--on-p-tint)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--p)] hover:text-[var(--on-p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${desktopLearner ? 'lg:h-11 lg:w-11' : ''}`}
        >
          <Volume2 size={14} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onClose('button')}
          aria-label="닫기"
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${desktopLearner ? 'lg:h-11 lg:w-11' : ''}`}
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      {/* body */}
      <div id={bodyId} className="px-4 py-3" aria-live={nonmodalFocus ? 'polite' : undefined}>
        {loading ? (
          <div className="flex items-center gap-2 py-1">
            <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-[var(--bg3)]" />
            <span className="font-body text-[12px] text-[var(--t2)]">찾는 중…</span>
          </div>
        ) : failed && desktopLearner ? (
          <>
            <div className="hidden lg:block" role="status">
              <p className="flex items-center gap-2 font-body text-[13px] font-[600] text-[var(--t1)]">
                <CircleAlert size={16} className="shrink-0" aria-hidden />
                뜻을 불러오지 못했어요
              </p>
              <p className="mt-2 break-keep font-body text-[12px] leading-relaxed text-[var(--t2)]">
                연결 상태를 확인하고 다시 시도해 주세요.
              </p>
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--bd)] px-3 font-body text-[12px] text-[var(--t1)] hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
              >
                <RotateCw size={14} aria-hidden />
                뜻 다시 불러오기
              </button>
            </div>
            <div className="lg:hidden"><NotFoundBody /></div>
          </>
        ) : result?.found && isSuggestion ? (
          <SuggestionBody result={result} />
        ) : result?.found ? (
          <FoundBody result={result} surface={surface} />
        ) : result?.matchVia === 'proper_noun' ? (
          <ProperNounBody />
        ) : (
          <NotFoundBody />
        )}
      </div>
    </div>
  )
}

/**
 * 조회 결과 본문.
 *
 * `export` 인 이유는 **렌더 단언을 걸기 위해서**다. 바깥 컴포넌트는 Supabase 클라이언트와
 * `DOMRect` 를 요구해 단위 테스트에서 세우기 어렵고, 그러면 "학습자가 본다" 를 증명할
 * 방법이 사라진다. 이 저장소는 그 증명을 렌더로만 인정한다(`VocabSetCard.test.tsx` 머리말).
 */
export function FoundBody({ result, surface }: { result: WordLookup; surface: string }) {
  const showResolved =
    result.resolvedWord && result.resolvedWord.toLowerCase() !== surface.toLowerCase()
  const foreign = result.lang && result.lang !== 'en' ? LANG_META[result.lang] : undefined
  return (
    <div className="flex flex-col gap-2">
      {/* meta badges */}
      <div className="flex flex-wrap items-center gap-2">
        {foreign && (
          <span className="inline-flex items-center gap-1 rounded-[var(--r-sm)] bg-[var(--bg3)] px-2 py-1 font-body text-[10px] font-[600] text-[var(--t2)]">
            <span aria-hidden>{foreign.flag}</span>
            {foreign.label}
          </span>
        )}
        <RegisterBadge register={result.wordRegister} />
        <PosBadge pos={result.pos} />
        {result.cefrLevel && (
          <span className="rounded-[var(--r-sm)] bg-[var(--p-light)] px-2 py-1 font-mono text-[10px] font-[600] text-[var(--on-p-tint)]">
            {result.cefrLevel}
          </span>
        )}
        {result.vLevel != null && (
          <span className="rounded-[var(--r-sm)] bg-[var(--bg3)] px-2 py-1 font-mono text-[10px] text-[var(--t2)]">
            V{result.vLevel}
          </span>
        )}
        {showResolved && (
          <span className="font-body text-[10px] text-[var(--t2)]">
            ← {surface} 의 원형
          </span>
        )}
      </div>

      {/* 한국어 뜻 */}
      <p className="font-body text-[14px] leading-relaxed text-[var(--t1)]">{result.meaningKo}</p>

      {/* 예문 — 해석은 있을 때만. 모르는 낱말을 만나 연 창이라, 해석 없는 영어 예문은
          읽히지 않고 넘어간다(그러면 예문 칸이 차 있어도 학습에서는 비어 있다). */}
      {result.exampleEn && (
        <p className="border-l-[3px] border-[var(--bd)] pl-2 font-english text-[12px] italic leading-relaxed text-[var(--t2)]">
          {result.exampleEn}
          {result.exampleKo && (
            <span className="mt-1 block font-body not-italic text-[var(--t2)]">
              {result.exampleKo}
            </span>
          )}
        </p>
      )}

      {/* 자주 함께 쓰는 표현 — 데이터 있을 때만 절제 노출(Progressive Disclosure) · 최대 3개 */}
      {result.collocations && result.collocations.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {result.collocations.slice(0, 3).map((c) => (
            <span
              key={c}
              className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-1 font-english text-[11px] text-[var(--t2)]"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {/*
        낱말 그물 — 파생어 · 유의어 · 반의어.

        플래시카드 정답면(`CardBack`)과 **같은 자리에서 같은 것**을 보여 준다. 읽다가 만난
        낱말과 카드에서 만난 낱말이 다르게 보이면 학습자는 두 곳을 다른 사전으로 여긴다.

        ⚠️ 툴팁은 읽기를 **끊고** 뜬 창이라 카드보다 더 절제한다 — 줄마다 **2개**까지.
        (카드는 3개. 카드는 학습이 목적이고, 여기는 읽던 자리로 빨리 돌아가는 것이 목적이다.)
        유의/반의는 **이름표 글자로** 갈린다 — 색만으로 정보를 전달하지 않는다.
      */}
      {((result.derived?.length ?? 0) > 0
        || (result.synonyms?.length ?? 0) > 0
        || (result.antonyms?.length ?? 0) > 0) && (
        <div className="flex flex-col gap-1">
          {([
            ['파생', result.derived],
            ['비슷', result.synonyms],
            ['반대', result.antonyms],
          ] as const)
            .filter(([, list]) => (list?.length ?? 0) > 0)
            .map(([label, list]) => (
              <div key={label} className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span className="font-body text-[10px] text-[var(--t3)]">{label}</span>
                {list!.slice(0, 2).map((w) => (
                  <span
                    key={w}
                    className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-english text-[11px] text-[var(--t2)]"
                  >
                    {w}
                  </span>
                ))}
              </div>
            ))}
        </div>
      )}

      {/* 학습 차등 안내 (archaic → 읽기 참고용, 암기 대상 아님) */}
      {result.wordRegister === 'archaic_literary' && (
        <p className="font-body text-[11px] leading-relaxed text-[var(--t2)]">
          📜 고어·문어체 — 읽기 참고용이에요 (암기보다 의미만 알아두면 충분해요)
        </p>
      )}

      {/* 외국어 안내 — 영어 학습 대상 아님, 독해 이해용 */}
      {foreign && (
        <p className="font-body text-[11px] leading-relaxed text-[var(--t2)]">
          {foreign.flag} {foreign.label} 낱말 — 독해 이해용이에요 (영어 암기 대상은 아니에요)
        </p>
      )}

      {/* 방언·고어·역사철자 안내 — 표준어로 이해 */}
      {(result.matchVia === 'dialect' || result.matchVia === 'spelling') && result.resolvedWord && (
        <p className="font-body text-[11px] leading-relaxed text-[var(--t2)]">
          🗣 방언·옛 철자 — 표준어 “{result.resolvedWord}” 로 이해하면 돼요
        </p>
      )}
    </div>
  )
}

// 음성 제안 — 정확히 못 찾았을 때 "혹시 이 단어?"(추정, 단정 아님)
function SuggestionBody({ result }: { result: WordLookup }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-body text-[12px] font-[600] text-[var(--t2)]">
        🔍 사전에 정확히 없어요 — 혹시 이 단어일까요?
      </p>
      <div className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="font-english text-[15px] font-[600] text-[var(--t1)]">
            {result.resolvedWord}
          </span>
          <span className="font-body text-[10px] text-[var(--t2)]">(추정)</span>
        </div>
        <p className="mt-1 font-body text-[13px] leading-relaxed text-[var(--t2)]">{result.meaningKo}</p>
      </div>
      <p className="font-body text-[11px] leading-relaxed text-[var(--t2)]">
        방언·옛 철자·오탈자일 수 있어요. 문맥으로 확인하세요.
      </p>
    </div>
  )
}

/**
 * 고유명사 (ADR 0004 D4a).
 *
 * 왜 별도 문구인가: 이전에는 인명·지명이 `lexicon_clean`(Wiktionary 유래)의 동음 일반명사
 * 뜻을 받아 **틀린 뜻**을 보여줬다 — Les Misérables 의 `Louis`(프랑스 금화)에 "세계 헤비급
 * 챔피언이었던 미국 권투선수", Treasure Island 의 `Davy`(Davy Jones)에 "전기화학의 선구자".
 * 이제 코퍼스 대문자 증거(`proper_noun_forms`)로 걸러 "이름"이라고 정직하게 답한다.
 * 틀린 뜻보다 "뜻 없음"이 낫고, 인명·지명이라는 사실 자체가 독해에 필요한 정보다.
 */
function ProperNounBody() {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-body text-[13px] font-[600] text-[var(--t2)]">이름이에요 (인명·지명)</p>
      <p className="font-body text-[11px] leading-relaxed text-[var(--t2)]">
        등장인물이나 장소 이름이라 따로 외울 단어는 아니에요. 읽으면서 누구·어디인지만 잡아두면 돼요.
      </p>
    </div>
  )
}

function NotFoundBody() {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-body text-[13px] font-[600] text-[var(--t2)]">사전에 없는 단어예요</p>
      <p className="font-body text-[11px] leading-relaxed text-[var(--t2)]">
        외국어·고유명사이거나 인식 오류일 수 있어요. 영어 어휘가 아니면 학습 대상에서 제외됩니다.
      </p>
    </div>
  )
}
