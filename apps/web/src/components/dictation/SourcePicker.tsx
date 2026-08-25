// apps/web/src/components/dictation/SourcePicker.tsx
//
// 자료 고르기 — 도서 / 스크립트 / 단어장 3탭.
//
// 왜 3탭인가: 학습자가 가진 받아쓸 수 있는 것은 정확히 이 셋이고, 셋은 성격이 다르다.
//   · 도서   — 챕터를 이어간다 (긴 호흡)
//   · 스크립트 — 내가 넣은 자료 (관심사)
//   · 단어장  — 단어가 사는 문장 (복습)
// 한 목록에 섞으면 "지금 뭘 골라야 하지"가 되고, 그 순간 매일 오는 이유가 사라진다.
//
// 비어 있는 탭은 숨기지 않고 "어디서 채우는지"를 링크로 알려준다 — 빈 탭을 감추면
// 학습자는 그 경로가 존재한다는 것 자체를 모른다.

'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, BookOpen, ClipboardPaste, FileText, Layers } from 'lucide-react'

import type { DictationCatalog } from '@/lib/dictation/catalog'
import { stashCustomScript } from '@/lib/dictation/source'
import { MATERIAL_LABEL } from '@/lib/learner/plan-activities'

type TabId = 'books' | 'scripts' | 'sets'

// 라벨 출처 = `MATERIAL_LABEL`. 여기 'scripts' 는 **학습자가 직접 넣은 본문**(script → Texts)이지
// 라이브러리의 공개 짧은 글(article=Dispatches)이 아니다 — 둘을 같은 이름으로 부르면 안 된다.
// (내부 키는 'scripts' 로 둔다 — 저장된 탭 상태·라우트 파라미터가 그 값을 쓴다. 바뀐 것은 이름뿐.)
const TABS: Array<{ id: TabId; label: string; icon: typeof BookOpen }> = [
  { id: 'books', label: MATERIAL_LABEL.book, icon: BookOpen },
  { id: 'scripts', label: MATERIAL_LABEL.script, icon: FileText },
  { id: 'sets', label: MATERIAL_LABEL.word_set, icon: Layers },
]

const EMPTY_COPY: Record<TabId, { text: string; href: string; cta: string }> = {
  books: {
    text: '학습에 추가한 도서가 아직 없어요. 도서를 담으면 챕터를 그대로 받아쓸 수 있어요.',
    href: '/library',
    cta: '라이브러리 열기',
  },
  scripts: {
    text: '내가 넣은 스크립트가 없어요. 관심 있는 영어 글을 넣으면 그 문장으로 받아쓰기가 만들어져요.',
    href: '/text/new',
    cta: '스크립트 추가',
  },
  sets: {
    text: '구독한 단어장이 없어요. 단어장을 구독하면 그 단어가 실제로 쓰인 문장을 받아쓰게 돼요.',
    href: '/wordvault',
    cta: '단어장 둘러보기',
  },
}

function Row({
  href,
  badge,
  title,
  meta,
}: {
  href: string
  badge: string
  title: string
  meta: string
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-3 rounded-[var(--r-md)] border border-transparent px-3 py-3 transition-all duration-[var(--dur-normal)] hover:border-[var(--bd)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
      >
        <span className="shrink-0 rounded-full bg-[var(--bg3)] px-2 py-1 font-mono text-[10px] font-[700] text-[var(--t2)]">
          {badge}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-body text-[13px] font-[600] text-[var(--t1)]">
            {title}
          </span>
          <span className="block truncate font-body text-[11px] text-[var(--t2)]">{meta}</span>
        </span>
        <ArrowRight
          size={14}
          className="shrink-0 text-[var(--t2)] opacity-0 transition-opacity group-hover:opacity-100"
        />
      </Link>
    </li>
  )
}

export function SourcePicker({ catalog }: { catalog: DictationCatalog }) {
  const [tab, setTab] = useState<TabId>('books')
  // 사용자가 직접 고른 뒤에는 자동 전환하지 않는다.
  const chosenRef = useRef(false)

  const counts: Record<TabId, number> = {
    books: catalog.books.length,
    scripts: catalog.scripts.length,
    sets: catalog.sets.length,
  }

  // 가진 것이 있는 탭을 기본으로 연다 — 빈 탭을 먼저 보여주면 "쓸 게 없다"로 읽힌다.
  // 카탈로그는 비동기로 도착하므로 첫 렌더의 useState 초기값으로는 정할 수 없다
  // (그렇게 했더니 도서를 가진 사용자에게도 늘 '단어장' 탭이 열려 있었다).
  useEffect(() => {
    if (chosenRef.current) return
    const total = counts.books + counts.scripts + counts.sets
    if (total === 0) return
    const first: TabId = counts.books > 0 ? 'books' : counts.scripts > 0 ? 'scripts' : 'sets'
    setTab(first)
  }, [counts.books, counts.scripts, counts.sets])

  const pick = (id: TabId) => {
    chosenRef.current = true
    setTab(id)
  }

  return (
    <section className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
      <div className="flex items-center gap-2" role="tablist" aria-label="받아쓸 자료 종류">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => pick(t.id)}
              // 44px 하한은 프로젝트 절대 규칙 — py-2 로는 30px 였다(실측 92x30).
              // 자료를 고르는 첫 조작이라 모바일에서 가장 많이 눌리는 곳이다.
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] px-3 py-2 font-display text-[12px] font-[600] transition-colors duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 ${
                active
                  ? 'bg-[var(--p-light)] text-[var(--on-p-tint)]'
                  : 'text-[var(--t2)] hover:bg-[var(--bg2)]'
              }`}
            >
              <Icon size={13} strokeWidth={2.2} />
              {t.label}
              <span className="font-mono text-[10px] tabular-nums opacity-70">{counts[t.id]}</span>
            </button>
          )
        })}
      </div>

      <ul className="flex flex-col">
        {tab === 'books' &&
          catalog.books.map((b) => (
            <Row
              key={b.bookId}
              href={`/dictate/setup?text=${b.resumeTextId}`}
              badge={b.cefr ?? 'B1'}
              title={b.title}
              meta={`${b.resumeChapterTitle || `Chapter ${b.resumeChapterIdx}`} · 담은 챕터 ${b.chapterCount}개`}
            />
          ))}

        {tab === 'scripts' &&
          catalog.scripts.map((s) => (
            <Row
              key={s.textId}
              href={`/dictate/setup?text=${s.textId}`}
              badge={s.cefr ?? 'B1'}
              title={s.title}
              meta={`${s.wordCount.toLocaleString()} words`}
            />
          ))}

        {tab === 'sets' &&
          catalog.sets.map((s) => (
            <Row
              key={s.setId}
              href={`/dictate/setup?set=${s.setId}`}
              badge={s.coverEmoji ?? (s.cefr ?? 'B1')}
              title={s.title}
              // category 는 'library_book' 같은 내부 슬러그라 그대로 내보내지 않는다.
              meta={`단어 ${s.wordCount}개`}
            />
          ))}

        {counts[tab] === 0 && (
          <li className="flex flex-col items-start gap-3 px-3 py-5">
            <p className="font-body text-[12px] leading-relaxed text-[var(--t2)]">
              {EMPTY_COPY[tab].text}
            </p>
            <Link
              href={EMPTY_COPY[tab].href}
              // 빈 탭에서 **유일한** 다음 걸음이다 — 여기가 44px 미만이면 막다른 곳에 가깝다
              className="inline-flex min-h-[44px] items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--t1)] transition-colors hover:border-[var(--p)] hover:bg-[var(--p-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
            >
              {EMPTY_COPY[tab].cta}
              <ArrowRight size={13} />
            </Link>
          </li>
        )}
      </ul>

      {/* 스크립트 탭에서만 — 지금 당장 받아쓰고 싶은 글을 붙여넣는 길 */}
      {tab === 'scripts' && <QuickPaste />}
    </section>
  )
}

/**
 * 붙여넣고 바로 받아쓰기.
 *
 * 자료 목록에 남기지 않는다 — 한 번 받아쓰려고 texts 를 만들면 워크스페이스가 조각글로
 * 어지러워진다. 대신 받아쓴 **기록은 남는다**(source_kind='custom'). 이 구분을 UI 에서도
 * 분명히 밝힌다: 저장은 안 되지만 기록은 남는다.
 */
function QuickPaste() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [script, setScript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const text = script.trim()
    if (text.length < 20) {
      setError(`조금만 더 있으면 돼요 — 지금 ${text.length}자, 최소 20자가 필요해요.`)
      return
    }
    setError(null)
    stashCustomScript({ title: title.trim() || '붙여넣은 글', script: text })
    router.push('/dictate/setup?custom=1')
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] px-4 py-3 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:border-[var(--p)] hover:bg-[var(--p-light)] hover:text-[var(--on-p-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
      >
        <ClipboardPaste size={13} />
        영어 글을 붙여넣어 바로 받아쓰기
      </button>
    )
  }

  return (
    <div className="mt-1 flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목 (선택)"
        aria-label="붙여넣을 글의 제목"
        className="rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-body text-[13px] focus:border-[var(--bdf)] focus:outline-none"
      />
      <textarea
        value={script}
        onChange={(e) => {
          setScript(e.target.value)
          if (error) setError(null)
        }}
        placeholder="영어 스크립트를 붙여넣으세요 (최소 20자)"
        aria-label="붙여넣을 영어 스크립트"
        aria-invalid={error != null}
        rows={4}
        className={`resize-none rounded-[var(--r-sm)] border bg-[var(--bg)] px-3 py-2 font-body text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--p)]/20 ${
          error
            ? 'border-[var(--warning)] focus:border-[var(--warning)]'
            : 'border-[var(--bd)] focus:border-[var(--bdf)]'
        }`}
      />
      {error && (
        <p role="status" className="font-body text-[12px] italic text-[var(--warning)]">
          {error}
        </p>
      )}
      <p className="font-body text-[11px] leading-relaxed text-[var(--t2)]">
        이 글은 자료 목록에 저장되지 않아요. 받아쓴 기록과 단어 복습은 그대로 남습니다.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setError(null)
          }}
          className="flex-1 rounded-[var(--r-sm)] border border-[var(--bd)] py-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
        >
          취소
        </button>
        <button
          type="button"
          onClick={submit}
          className="flex-1 rounded-[var(--r-sm)] bg-[var(--p)] py-2 font-display text-[12px] font-[600] text-[var(--on-p)] transition-colors hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
        >
          받아쓰기 준비
        </button>
      </div>
    </div>
  )
}
