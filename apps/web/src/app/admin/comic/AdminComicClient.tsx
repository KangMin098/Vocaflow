// apps/web/src/app/admin/comic/AdminComicClient.tsx
// CCP admin 콘솔 클라이언트 — Catalog(큐 적재) / Published(발행·회수).
// 보라 액센트(#8B5CF6) · QC 게이트(panels_pass) 강제 발행.

'use client'

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArchiveRestore, BookImage, CheckCircle2, CircleSlash, Clock, Cpu, ExternalLink, FlaskConical, Loader2, Palette, Plus, RotateCcw, ShieldCheck, XCircle } from 'lucide-react'
import type { ComicCatalogRow, ComicModel, ComicStats, ComicStyle, ComicTest } from '@/lib/comic/admin-queries'
import { archiveComicAction, createComicTestAction, enqueueComicJobsAction, setComicModelStatusAction, setComicStyleStatusAction, setComicPublishedAction } from './actions'
import { StyleSwatch, genreHue } from '@/components/comic/StyleSwatch'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { FORMAT_ORDER, formatMeta } from '@/lib/comic/format'
import { ScrollText, BookOpen } from 'lucide-react'

const ACCENT = '#8B5CF6'
type TabKey = 'catalog' | 'published' | 'tests' | 'models' | 'styles'
/** 탭 라벨 — 화면 표시와 화면도움말 조회에 같은 문자열을 쓴다(라벨을 바꾸면 help/comic.ts 도 함께). */
const TAB_LABEL: Record<TabKey, string> = {
  catalog: 'Catalog',
  published: 'Published',
  styles: '스타일',
  tests: '테스트',
  models: '모델',
}

const COMIC_STATUS_META: Record<ComicCatalogRow['comicStatus'], { label: string; tone: string }> = {
  none: { label: '없음', tone: 'var(--t3)' },
  draft: { label: '초안', tone: 'var(--info)' },
  published: { label: '발행됨', tone: 'var(--memory-stable)' },
  archived: { label: '보관', tone: 'var(--t3)' },
}

export function AdminComicClient({ rows, stats, tests, models, styles }: { rows: ComicCatalogRow[]; stats: ComicStats; tests: ComicTest[]; models: ComicModel[]; styles: ComicStyle[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('catalog')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, start] = useTransition()

  const eligibleToQueue = useMemo(
    () => rows.filter((r) => selected.has(r.bookId)),
    [rows, selected],
  )
  const publishedRows = useMemo(
    () => rows.filter((r) => r.comicStatus !== 'none'),
    [rows],
  )

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      // 삼항을 문으로 쓰면 반환값이 버려져 no-unused-expressions 에 걸린다(빌드 차단).
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const runEnqueue = () => {
    if (eligibleToQueue.length === 0) return
    if (!window.confirm(`${eligibleToQueue.length}권을 만화 생성 큐에 적재할까요?`)) return
    start(async () => {
      const res = await enqueueComicJobsAction(eligibleToQueue.map((r) => r.bookId))
      if (res.ok) {
        window.alert(`적재 ${res.data?.queued ?? 0}권 · 스킵 ${res.data?.skipped ?? 0}권`)
        setSelected(new Set())
        router.refresh()
      } else window.alert(`실패: ${res.error}`)
    })
  }

  const runPublish = (row: ComicCatalogRow, publish: boolean) => {
    if (!window.confirm(`"${row.title}" 만화를 ${publish ? '발행' : '회수'}할까요?`)) return
    start(async () => {
      const res = await setComicPublishedAction(row.bookId, publish)
      if (res.ok) router.refresh()
      else window.alert(`실패: ${res.error}`)
    })
  }

  const runUnarchive = (row: ComicCatalogRow) => {
    if (!window.confirm(`"${row.title}" 만화의 보관을 해제해 검수 상태로 되돌릴까요?`)) return
    start(async () => {
      const res = await archiveComicAction(row.bookId, false)
      if (res.ok) router.refresh()
      else window.alert(`실패: ${res.error}`)
    })
  }

  /** 실패 잡 재시도 — enqueue 는 (book_id, task_type) upsert 라 status·error 를 초기화한다. */
  const runRetry = (row: ComicCatalogRow) => {
    if (!window.confirm(`"${row.title}" 의 실패한 생성 잡을 큐에 다시 올릴까요?`)) return
    start(async () => {
      const res = await enqueueComicJobsAction([row.bookId])
      if (res.ok && (res.data?.queued ?? 0) === 0) window.alert('큐 적재 대상이 아닙니다 (도서 상태 확인).')
      else if (res.ok) router.refresh()
      else window.alert(`실패: ${res.error}`)
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--r-md)] text-white"
          style={{ background: `linear-gradient(135deg, #A78BFA, ${ACCENT})` }}
          aria-hidden
        >
          <BookImage size={18} />
        </span>
        <div>
          <h1 className="font-display text-[20px] font-[800] text-[var(--t1)]">Comic Pipeline</h1>
          <p className="font-body text-[12px] text-[var(--t2)]">
            도서 → 만화 큐레이션 · 생성 · QC 게이트 · 발행 (CCP)
          </p>
        </div>
      </div>

      {/* 화면 도움말 — 탭을 옮기면 내용도 따라간다 */}
      <AdminScreenHelp screen="comic" tab={TAB_LABEL[tab]} className="-mt-2" />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="대상 도서" value={stats.eligible} Icon={BookImage} />
        <StatTile label="초안" value={stats.drafts} Icon={Clock} tone="var(--info)" />
        <StatTile label="발행됨" value={stats.published} Icon={CheckCircle2} tone="var(--memory-stable)" />
        <StatTile label="큐 대기" value={stats.queued} Icon={Loader2} tone={ACCENT} />
        {/* 실패를 따로 센다 — 큐 대기에 섞여 있으면 "언젠가 끝나겠지" 로 읽혀 영영 안 본다. */}
        <StatTile label="생성 실패" value={stats.failed} Icon={XCircle} tone="var(--memory-risk)" />
      </div>

      {/* 순차 작업 가이드 */}
      <div className="rounded-[var(--r-md)] border px-4 py-3" style={{ borderColor: `${ACCENT}40`, background: `${ACCENT}0a` }}>
        <p className="mb-1.5 font-display text-[12px] font-[700] text-[var(--t1)]">작업 순서</p>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-body text-[12px] text-[var(--t2)]">
          <Step n={1}>대상 도서 선택 → <b>만화 생성 큐</b> 적재</Step>
          <Arrow />
          <Step n={2}>Claude Code 드레인(<code className="font-mono text-[11px]">generate-comic.mjs</code>)으로 컷 생성</Step>
          <Arrow />
          <Step n={3}>제목 클릭 → <b>검수</b>에서 QC·컷 확인</Step>
          <Arrow />
          <Step n={4}>QC 통과 시 <b>발행</b> → 학습자 노출</Step>
        </ol>
      </div>

      {/* 빈 목록은 "마이그레이션 미적용" 이 아니다 — 예전 문구는 DB 오류·RLS 거부까지
          전부 빈 배열이 되던 시절의 오진이었다. 지금 오류는 조회에서 throw 되어
          오류 화면으로 가고, 여기 남는 빈 목록은 **정말로 대상 도서가 없는 경우**뿐이다. */}
      {rows.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-4 py-8 text-center font-body text-[13px] text-[var(--t2)]">
          <p>만화화 대상 도서가 없습니다 — 이 목록은 도서 상태가 <b>ready</b> 또는 <b>published</b> 인 것만 담습니다.</p>
          <Link
            href="/admin/library"
            className="inline-flex items-center gap-1 font-display text-[12px] font-[700] underline underline-offset-2"
            style={{ color: ACCENT }}
          >
            라이브러리에서 도서 큐레이션하기 <ExternalLink size={12} />
          </Link>
        </div>
      )}

      {/* 탭 */}
      <div role="tablist" className="flex gap-1 border-b border-[var(--bd)]">
        {(['catalog', 'published', 'styles', 'tests', 'models'] as TabKey[]).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`min-h-[44px] -mb-px border-b-2 px-4 py-2 font-display text-[13px] font-[700] transition-colors ${
              tab === k ? 'text-[var(--t1)]' : 'border-transparent text-[var(--t2)] hover:text-[var(--t1)]'
            }`}
            style={tab === k ? { borderColor: ACCENT } : undefined}
          >
            {TAB_LABEL[k]}
          </button>
        ))}
      </div>

      {/* Catalog */}
      {tab === 'catalog' && (
        <div className="flex flex-col gap-3">
          {selected.size > 0 && (
            <div
              className="flex items-center justify-between rounded-[var(--r-md)] border px-4 py-3"
              style={{ borderColor: `${ACCENT}55`, background: `${ACCENT}0f` }}
            >
              <span className="font-display text-[13px] font-[700] text-[var(--t1)]">
                {selected.size}권 선택됨
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelected(new Set())}
                  className="min-h-[44px] rounded-[var(--r-full)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--t2)] hover:text-[var(--t1)]"
                >
                  해제
                </button>
                <button
                  onClick={runEnqueue}
                  disabled={pending}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-[var(--r-full)] px-4 py-2 font-display text-[12px] font-[700] text-white disabled:opacity-50"
                  style={{ backgroundColor: ACCENT }}
                >
                  {pending ? <Loader2 size={13} className="animate-spin" /> : <BookImage size={13} />}
                  만화 생성 큐
                </button>
              </div>
            </div>
          )}
          <CatalogTable rows={rows} selected={selected} onToggle={toggle} onRetry={runRetry} busy={pending} />
        </div>
      )}

      {/* Published */}
      {tab === 'published' && (
        <div className="overflow-x-auto rounded-[var(--r-md)] border border-[var(--bd)]">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-[var(--bd)] bg-[var(--bg2)] font-display text-[11px] uppercase tracking-wide text-[var(--t2)]">
                <Th>제목</Th><Th>만화</Th><Th>컷</Th><Th>QC</Th><Th>액션</Th>
              </tr>
            </thead>
            <tbody>
              {publishedRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center font-body text-[13px] text-[var(--t2)]">
                    아직 생성된 만화가 없습니다 — 이 표는 <b>컷이 적재된</b> 도서만 담습니다.
                    <span className="mt-1 block">
                      <b className="text-[var(--t1)]">Catalog</b> 탭에서 도서를 골라 [만화 생성 큐] 에 올린 뒤,
                      Claude Code 로 <code className="font-mono text-[12px]">node scripts/lcp/generate-comic.mjs</code>{' '}
                      드레인을 돌리면 여기에 나타납니다.
                    </span>
                  </td>
                </tr>
              )}
              {publishedRows.map((r) => (
                <tr key={r.bookId} className="border-b border-[var(--bd)]/60 last:border-0">
                  <Td>
                <Link
                  href={`/admin/comic/${r.bookId}`}
                  className="font-display text-[13px] font-[600] text-[var(--t1)] underline-offset-2 hover:text-[#8B5CF6] hover:underline"
                >
                  {r.title}
                </Link>
              </Td>
                  <Td><StatusPill status={r.comicStatus} /></Td>
                  <Td className="font-mono text-[12px] tabular-nums text-[var(--t2)]">{r.panelsTotal}</Td>
                  <Td>
                    {r.panelsPass ? (
                      <span className="inline-flex items-center gap-1 font-display text-[12px] font-[700] text-[var(--memory-stable)]">
                        <ShieldCheck size={13} /> 통과
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-display text-[12px] font-[700] text-[var(--memory-risk)]">
                        <CircleSlash size={13} /> 미통과
                      </span>
                    )}
                  </Td>
                  <Td>
                    {/* 세 갈래다 — 예전에는 published 가 아니면 무조건 [발행] 이라
                        보관본이 복원을 건너뛰고 바로 발행되었다. 보관은 관리자가
                        "지금은 내보내지 않는다" 고 내린 결정이므로 먼저 되돌려야 한다. */}
                    {r.comicStatus === 'published' ? (
                      <button
                        onClick={() => runPublish(r, false)}
                        disabled={pending}
                        className="min-h-[44px] rounded-[var(--r-full)] border border-[var(--bd)] px-3 py-1 font-display text-[12px] font-[700] text-[var(--t2)] hover:border-[var(--memory-risk)] hover:text-[var(--memory-risk)] disabled:opacity-50"
                      >
                        회수
                      </button>
                    ) : r.comicStatus === 'archived' ? (
                      <button
                        onClick={() => runUnarchive(r)}
                        disabled={pending}
                        title="보관 해제 후 검수 상태(초안)로 돌아갑니다. 발행은 그다음입니다."
                        className="min-h-[44px] inline-flex items-center gap-1 rounded-[var(--r-full)] border border-[var(--bd)] px-3 py-1 font-display text-[12px] font-[700] text-[var(--info)] hover:border-[var(--info)] disabled:opacity-50"
                      >
                        <ArchiveRestore size={12} /> 복원(검수)
                      </button>
                    ) : (
                      <button
                        onClick={() => runPublish(r, true)}
                        disabled={pending || !r.panelsPass}
                        title={!r.panelsPass ? 'QC 미통과 — 발행 불가' : undefined}
                        className="min-h-[44px] rounded-[var(--r-full)] px-3 py-1 font-display text-[12px] font-[700] text-white disabled:opacity-40"
                        style={{ backgroundColor: ACCENT }}
                      >
                        발행
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'styles' && <StylesTab styles={styles} />}
      {tab === 'tests' && <TestsTab tests={tests} models={models} styles={styles} />}
      {tab === 'models' && <ModelsTab models={models} />}
    </div>
  )
}

function StylesTab({ styles }: { styles: ComicStyle[] }) {
  const router = useRouter()
  const [, start] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [fmt, setFmt] = useState(''); const [age, setAge] = useState(''); const [genre, setGenre] = useState(''); const [pal, setPal] = useState('')
  const uniq = (k: keyof ComicStyle) => [...new Set(styles.map((s) => s[k]).filter(Boolean))] as string[]
  const filtered = styles.filter((s) => (!fmt || s.format === fmt) && (!age || s.age_band === age) && (!genre || s.genre === genre) && (!pal || s.palette === pal))
  const setStatus = (key: string, status: string) => {
    setBusy(key); setErr(null)
    start(async () => { const r = await setComicStyleStatusAction(key, status); setBusy(null); if (r.ok) router.refresh(); else setErr(`${key}: ${r.error}`) })
  }
  const clearAll = () => { setFmt(''); setAge(''); setGenre(''); setPal('') }
  const anyFilter = fmt || age || genre || pal
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--r-md)] border px-4 py-3" style={{ borderColor: `${ACCENT}30`, background: `${ACCENT}0a` }}>
        <p className="font-body text-[12px] leading-relaxed text-[var(--t2)]">
          <b className="text-[var(--t1)]">먼저 구성 방식, 그다음 화풍</b> — 스타일은 두 축입니다. <b>①구성 방식(포맷)</b>은 <b>어떻게 배치하고 읽는가</b>(웹툰=세로 스크롤 / 만화·코믹=페이지 넘김 / 그래픽노블=대형 컷)로, 컷 비율·리더 모드·레이아웃을 정합니다. <b>②화풍</b>은 그 안의 <b>그림체·팔레트</b>(잉크/스크린톤/하프톤/컬러)입니다. 아래는 구성 방식별로 묶었고, 각 카드가 화풍입니다. 장르·연령은 큐레이션 필터. 도서 검수에서 스타일을 지정하면 드레인이 그 화풍으로 생성합니다.
        </p>
        {err && <p className="mt-2 font-body text-[12px] text-[var(--memory-risk)]">스타일 상태 변경 실패 — {err}</p>}
      </div>

      {/* 차원 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSel label="포맷" value={fmt} onChange={setFmt} opts={uniq('format')} />
        <FilterSel label="연령" value={age} onChange={setAge} opts={uniq('age_band')} />
        <FilterSel label="장르" value={genre} onChange={setGenre} opts={uniq('genre')} />
        <FilterSel label="팔레트" value={pal} onChange={setPal} opts={uniq('palette')} />
        {anyFilter && <button onClick={clearAll} className="min-h-11 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-display text-[11px] font-[700] text-[var(--t2)] transition-colors hover:text-[var(--t1)]">초기화</button>}
        <span className="self-center font-body text-[12px] text-[var(--t2)]">{filtered.length}/{styles.length}</span>
      </div>

      {styles.length === 0 ? (
        <div className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-4 py-8 text-center font-body text-[13px] text-[var(--t2)]">
          <p>스타일 카탈로그가 비어 있습니다 — <code className="font-mono text-[12px]">comic_styles</code> 에 행이 없습니다.</p>
          <p className="mt-1">
            시드는 화면이 아니라 마이그레이션이 넣습니다:{' '}
            <code className="font-mono text-[12px]">supabase/migrations/20260808240000_comic_styles.sql</code>{' '}
            적용 여부를 확인하세요. 화풍을 더 넣으려면 같은 표에 행을 추가하는 마이그레이션이 필요합니다.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-7">
          {FORMAT_ORDER.filter((f) => filtered.some((s) => s.format === f)).map((f) => {
            const meta = formatMeta(f)
            const group = filtered.filter((s) => s.format === f)
            const scroll = meta.reader === 'scroll'
            return (
              <section key={f} className="flex flex-col gap-3">
                {/* 구성 방식 헤더 — 읽는 방식 + 레이아웃 설명 */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--r-md)] border-l-[3px] bg-[var(--bg2)] px-4 py-3" style={{ borderLeftColor: ACCENT }}>
                  <span className="inline-flex items-center gap-2 font-display text-[14px] font-[800] text-[var(--t1)]">
                    {scroll ? <ScrollText size={15} style={{ color: ACCENT }} /> : <BookOpen size={15} style={{ color: ACCENT }} />}{meta.label}
                  </span>
                  <span className="rounded-[var(--r-full)] px-2 py-1 font-display text-[10px] font-[700]" style={{ color: ACCENT, background: `${ACCENT}1a` }}>{scroll ? '세로 스크롤' : '페이지 넘김'}</span>
                  <span className="font-mono text-[11px] text-[var(--t2)]">{meta.layout}</span>
                  <span className="font-body text-[11px] text-[var(--t2)]">· 화풍 {group.length}종</span>
                  <p className="w-full font-body text-[11px] leading-relaxed text-[var(--t2)]">{meta.blurb}</p>
                </div>
                {/* 화풍 카드 */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.map((s) => (
                    <figure key={s.key} className="group flex flex-col overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] transition-shadow hover:shadow-[0_2px_16px_rgba(0,0,0,0.08)]">
                      <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-[var(--bd)]">
                        <StyleSwatch format={s.format} palette={s.palette} genre={s.genre} styleKey={s.key} />
                        <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-3" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.62), rgba(0,0,0,0))' }}>
                          <span className="font-display text-[13px] font-[800] leading-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">{s.name}</span>
                          {s.is_default && <span className="shrink-0 rounded-[var(--r-full)] px-2 py-1 font-display text-[9px] font-[700] text-white" style={{ background: ACCENT }}>기본</span>}
                        </div>
                        <div className="absolute right-2 top-2"><ModelStatusPill status={s.status === 'adopted' ? 'adopted' : s.status === 'rejected' ? 'rejected' : 'candidate'} /></div>
                      </div>
                      <figcaption className="flex flex-1 flex-col gap-2 p-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-1 font-display text-[10px] font-[700]" style={{ color: genreHue(s.genre), background: `${genreHue(s.genre)}1a` }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: genreHue(s.genre) }} aria-hidden />{s.genre}
                          </span>
                          {[s.age_band, s.palette].filter(Boolean).map((t) => <span key={t} className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-1 font-display text-[10px] font-[700] text-[var(--t2)]">{t}</span>)}
                          {(s.difficulty_min != null || s.difficulty_max != null) && <span className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-1 font-mono text-[10px] text-[var(--t2)]">V{s.difficulty_min ?? 0}–{s.difficulty_max ?? 11}</span>}
                        </div>
                        {s.art_prompt && <p className="line-clamp-2 font-body text-[11px] leading-relaxed text-[var(--t2)]" title={s.art_prompt}>{s.art_prompt}</p>}
                        <div className="mt-auto flex items-center gap-2 pt-1">
                          <select aria-label={`${s.name} 상태`} value={s.status} disabled={busy === s.key} onChange={(e) => setStatus(s.key, e.target.value)} className="min-h-11 flex-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 py-1 font-body text-[11px] text-[var(--t2)] disabled:opacity-50">
                            {['candidate', 'adopted', 'rejected'].map((st) => <option key={st} value={st}>{st}</option>)}
                          </select>
                          {busy === s.key && <Loader2 size={13} className="animate-spin text-[var(--t2)]" />}
                          {s.source_url && <a href={s.source_url} target="_blank" rel="noreferrer" aria-label="레퍼런스 출처" className="text-[var(--t2)] transition-colors hover:text-[var(--active)]"><ExternalLink size={13} /></a>}
                        </div>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
function FilterSel({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: string[] }) {
  return (
    <label className="inline-flex items-center gap-2">
      <span className="font-display text-[11px] font-[700] text-[var(--t2)]">{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-11 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-2 py-1 font-body text-[12px] text-[var(--t1)]">
        <option value="">전체</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

function ModelsTab({ models }: { models: ComicModel[] }) {
  const router = useRouter()
  const [, start] = useTransition()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const setStatus = (key: string, status: string) => {
    setBusyKey(key); setErr(null)
    start(async () => {
      const r = await setComicModelStatusAction(key, status)
      setBusyKey(null)
      if (r.ok) router.refresh()
      else setErr(`${key}: ${r.error}`)
    })
  }
  const cap = (v: string | null) => (v === 'high' ? 'var(--memory-stable)' : v === 'medium' ? 'var(--memory-shaky)' : v === 'low' ? 'var(--memory-risk)' : 'var(--t3)')
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--r-md)] border px-4 py-3" style={{ borderColor: `${ACCENT}30`, background: `${ACCENT}0a` }}>
        <p className="font-body text-[12px] leading-relaxed text-[var(--t2)]">
          <b className="text-[var(--t1)]">이미지 생성 모델 레지스트리</b> — 시장 조사 기반 카탈로그. <b>comic 적합도</b> 순 정렬 · 실행환경(RunPod/API)·다중참조·텍스트제어·캐릭터/화풍 일관성·VRAM·비용 비교 · 상태(후보/테스트/채택/제외) 관리 · 근거 링크.
        </p>
        {err && <p className="mt-2 font-body text-[12px] text-[var(--memory-risk)]">상태 변경 실패 — {err}</p>}
      </div>
      {models.length === 0 ? (
        <div className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-4 py-8 text-center font-body text-[13px] text-[var(--t2)]">
          <p>모델 카탈로그가 비어 있습니다 — <code className="font-mono text-[12px]">comic_gen_models</code> 에 행이 없습니다.</p>
          <p className="mt-1">
            시드 마이그레이션{' '}
            <code className="font-mono text-[12px]">supabase/migrations/20260808200000_comic_gen_models.sql</code>{' '}
            적용 여부를 확인하세요. 모델이 없으면 <b>테스트</b> 탭에서 실험을 계획할 수 없습니다(모델 선택이 비어 있게 됩니다).
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--r-md)] border border-[var(--bd)]">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-[var(--bd)] bg-[var(--bg2)] font-display text-[11px] uppercase tracking-wide text-[var(--t2)]">
                <Th>Fit</Th><Th>모델</Th><Th>실행환경</Th><Th>비용/장</Th><Th>다중참조</Th><Th>텍스트</Th><Th>캐릭터</Th><Th>화풍</Th><Th>VRAM</Th><Th>상태</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.key} className="border-b border-[var(--bd)]/60 last:border-0 align-top hover:bg-[var(--bg2)]/40">
                  <Td><span className="font-display text-[15px] font-[800] tabular-nums" style={{ color: (m.comic_fit ?? 0) >= 80 ? 'var(--memory-stable)' : (m.comic_fit ?? 0) >= 60 ? 'var(--memory-shaky)' : 'var(--t2)' }}>{m.comic_fit ?? '—'}</span></Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-[13px] font-[700] text-[var(--t1)]">{m.name}</span>
                      {m.source_url && <a href={m.source_url} target="_blank" rel="noreferrer" className="text-[var(--t2)] hover:text-[var(--active)]"><ExternalLink size={12} /></a>}
                    </div>
                    <span className="font-body text-[11px] text-[var(--t2)]">{m.provider} · {m.site}</span>
                    {m.strengths && <p className="mt-0.5 max-w-[280px] font-body text-[11px] text-[var(--t2)]">➕ {m.strengths}</p>}
                    {m.weaknesses && <p className="max-w-[280px] font-body text-[11px] text-[var(--t2)]">➖ {m.weaknesses}</p>}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {(m.run_envs ?? []).map((e) => <EnvPill key={e} env={e} />)}
                      {(!m.run_envs || m.run_envs.length === 0) && <span className="text-[var(--t2)]">—</span>}
                    </div>
                  </Td>
                  <Td className="font-mono text-[12px] tabular-nums text-[var(--t2)]">{m.cost_per_image_usd != null ? `$${m.cost_per_image_usd}` : (m.run_envs ?? []).some((e) => e !== 'api') ? '무료*' : '—'}</Td>
                  <Td>{m.multiref == null ? '—' : m.multiref ? <CheckCircle2 size={14} className="text-[var(--memory-stable)]" /> : <CircleSlash size={14} className="text-[var(--t2)]" />}</Td>
                  <Td className="font-body text-[12px]" ><span style={{ color: m.text_control === 'strong' ? 'var(--memory-stable)' : m.text_control === 'weak' ? 'var(--memory-shaky)' : 'var(--t3)' }}>{m.text_control ?? '—'}</span></Td>
                  <Td className="font-display text-[12px] font-[700]" ><span style={{ color: cap(m.char_consistency) }}>{m.char_consistency ?? '—'}</span></Td>
                  <Td className="font-display text-[12px] font-[700]"><span style={{ color: cap(m.style_consistency) }}>{m.style_consistency ?? '—'}</span></Td>
                  <Td className="font-mono text-[12px] tabular-nums text-[var(--t2)]">{m.min_vram_gb != null ? `${m.min_vram_gb}GB` : '—'}</Td>
                  <Td><ModelStatusPill status={m.status} /></Td>
                  <Td>
                    <select aria-label={`${m.name} 상태 변경`} value={m.status} disabled={busyKey === m.key} onChange={(e) => setStatus(m.key, e.target.value)} className="min-h-11 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 py-1 font-body text-[11px] text-[var(--t2)] disabled:opacity-50">
                      {['candidate', 'testing', 'adopted', 'rejected'].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* 각주가 화면에 없으면 별표는 그냥 오타로 보인다 — 도움말에만 있던 것을 표 밑으로 내린다. */}
      {models.length > 0 && (
        <p className="font-body text-[11px] text-[var(--t2)]">
          <b className="text-[var(--t1)]">무료*</b> — 모델 가중치 사용료가 없다는 뜻이고, <b>GPU 대여 비용은 빠져
          있습니다</b>(RunPod 4090 시간당 요금은 여기서 세지 않습니다). 값이 적힌 행은 API 호출 기준 장당 단가입니다.
        </p>
      )}
    </div>
  )
}
const ENV_META: Record<string, { label: string; tone: string }> = {
  'runpod-4090': { label: 'RunPod', tone: 'var(--memory-stable)' },
  api: { label: 'API', tone: 'var(--t3)' },
}
function EnvPill({ env }: { env: string }) {
  const m = ENV_META[env] ?? { label: env, tone: 'var(--t3)' }
  return <span className="rounded-[var(--r-full)] px-2 py-1 font-display text-[10px] font-[700]" style={{ color: m.tone, background: `color-mix(in srgb, ${m.tone} 12%, transparent)` }}>{m.label}</span>
}
function ModelStatusPill({ status }: { status: string }) {
  const m: Record<string, { label: string; tone: string }> = {
    candidate: { label: '후보', tone: 'var(--t3)' }, testing: { label: '테스트', tone: ACCENT },
    adopted: { label: '채택', tone: 'var(--memory-stable)' }, rejected: { label: '제외', tone: 'var(--memory-risk)' },
  }
  const s = m[status] ?? { label: status, tone: 'var(--t3)' }
  return <span className="rounded-[var(--r-full)] px-2 py-1 font-display text-[11px] font-[700]" style={{ color: s.tone, background: `color-mix(in srgb, ${s.tone} 12%, transparent)` }}>{s.label}</span>
}

function TestsTab({ tests, models, styles }: { tests: ComicTest[]; models: ComicModel[]; styles: ComicStyle[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [form, setForm] = useState({ label: '', backend: '', model: '', site: '', style: '', note: '' })
  const [env, setEnv] = useState('runpod-4090') // 자가호스트 우선
  const [msg, setMsg] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  // 라이브 모니터링: 진행 중(running/planned) 테스트가 있으면 12초마다 서버 재조회 → 상태·결과 자동 갱신
  const anyLive = tests.some((t) => t.status === 'running' || t.status === 'planned')
  useEffect(() => {
    if (!anyLive) return
    const id = setInterval(() => router.refresh(), 12000)
    return () => clearInterval(id)
  }, [anyLive, router])
  // 선택 제약: 고른 환경에서 실행 가능한 모델만
  const envModels = models.filter((m) => (m.run_envs ?? []).includes(env))
  const pickModel = (key: string) => {
    const m = models.find((x) => x.key === key)
    if (m) setForm((f) => ({ ...f, backend: m.key, model: m.name, site: env === 'api' ? (m.site ?? '') : 'runpod-comfyui' }))
  }
  const submit = () => {
    if (!form.label.trim()) { setMsg('테스트 이름을 입력하세요.'); return }
    if (!form.backend) { setMsg('모델을 선택하세요.'); return }
    setMsg(null)
    start(async () => {
      const res = await createComicTestAction({ ...form, env, note: `[환경:${env}]${form.style ? `[스타일:${form.style}]` : ''} ${form.note}`.trim() })
      if (res.ok) { setForm({ label: '', backend: '', model: '', site: '', style: '', note: '' }); router.refresh() }
      else setMsg(`실패: ${res.error}`)
    })
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--r-md)] border px-4 py-3" style={{ borderColor: `${ACCENT}30`, background: `${ACCENT}0a` }}>
        <p className="font-body text-[12px] leading-relaxed text-[var(--t2)]">
          <b className="text-[var(--t1)]">테스트 모드</b> — 더 나은 생성 파이프라인을 위한 실험(백엔드/모델/사이트/파라미터 A·B)을 <b>계획·기록·비교</b>합니다.
          실행은 드레인 스크립트(Claude Code)로 돌리고, 점수·비용·샘플 결과를 이 카드에 축적해 백엔드 판정(예: R30 GPT vs FLUX.2) 근거로 삼습니다.
        </p>
      </div>

      {/* 새 테스트 계획 */}
      <div className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <p className="font-display text-[12px] font-[700] text-[var(--t1)]">새 테스트 계획</p>
        {models.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr]">
            <label className="flex flex-col gap-1">
              <span className="font-display text-[11px] font-[700] text-[var(--t2)]">실행 환경 (자가호스트 우선)</span>
              <select value={env} onChange={(e) => { setEnv(e.target.value); setForm((f) => ({ ...f, backend: '', model: '', site: '' })) }} className="min-h-[44px] rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 font-body text-[13px] text-[var(--t1)] outline-none focus:border-[var(--active)]">
                <option value="runpod-4090">RunPod 4090 (24GB)</option>
                <option value="api">API (폐쇄 모델)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-display text-[11px] font-[700] text-[var(--t2)]">모델 — 이 환경에서 실행 가능한 것만 ({envModels.length})</span>
              <select aria-label="모델 선택" value={form.backend} onChange={(e) => e.target.value ? pickModel(e.target.value) : setForm((f) => ({ ...f, backend: '', model: '', site: '' }))} className="min-h-11 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 font-body text-[13px] text-[var(--t1)] outline-none focus:border-[var(--active)]">
                <option value="">— 모델 선택 —</option>
                {envModels.map((m) => <option key={m.key} value={m.key}>{m.name} · fit {m.comic_fit ?? '?'}{m.min_vram_gb ? ` · ${m.min_vram_gb}GB` : ''}</option>)}
              </select>
              {envModels.length === 0 && <span className="font-body text-[11px] text-[var(--memory-shaky)]">이 환경에서 실행 가능한 모델이 없습니다 — 다른 환경을 선택하세요.</span>}
            </label>
          </div>
        )}
        <Field label="이름*" value={form.label} onChange={set('label')} placeholder="예: Qwen-2511 vs FLUX.2 화풍 일관성" />
        {/* 모델은 위 환경-제약 드롭다운으로만 선택(자유입력 제거 → 제약 강제) */}
        {form.backend && (
          <p className="rounded-[var(--r-sm)] bg-[var(--bg2)] px-3 py-2 font-body text-[12px] text-[var(--t2)]">
            선택: <b className="text-[var(--t1)]">{form.model}</b> · <span className="font-mono text-[11px]">{form.backend}</span> · @{form.site}
          </p>
        )}
        {styles.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="font-display text-[11px] font-[700] text-[var(--t2)]">스타일 (선택 — 실험 매트릭스: 모델×환경×스타일)</span>
            <select aria-label="스타일 선택" value={form.style} onChange={(e) => setForm((f) => ({ ...f, style: e.target.value }))} className="min-h-11 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 font-body text-[13px] text-[var(--t1)] outline-none focus:border-[var(--active)]">
              <option value="">— 스타일 무관 —</option>
              {styles.filter((s) => s.status !== 'rejected').map((s) => <option key={s.key} value={s.key}>{s.name} · {s.format}/{s.genre}</option>)}
            </select>
          </label>
        )}
        <Field label="메모" value={form.note} onChange={set('note')} placeholder="가설·파라미터·기대 결과" />
        <div className="flex items-center gap-3">
          <button onClick={submit} disabled={pending} className="min-h-[44px] inline-flex items-center gap-2 rounded-[var(--r-full)] px-4 py-2 font-display text-[12px] font-[700] text-white disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} 계획 추가
          </button>
          {msg && <span className="font-body text-[12px] text-[var(--memory-risk)]">{msg}</span>}
        </div>
      </div>

      {/* 테스트 목록 */}
      {tests.length === 0 ? (
        <p className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-4 py-8 text-center font-body text-[13px] text-[var(--t2)]">아직 테스트가 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {tests.map((t) => (
            <div key={t.id} className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <FlaskConical size={14} style={{ color: ACCENT }} />
                <span className="font-display text-[13px] font-[700] text-[var(--t1)]">{t.label}</span>
                <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-1 font-display text-[11px] font-[700]" style={{ color: t.status === 'done' ? 'var(--memory-stable)' : t.status === 'failed' ? 'var(--memory-risk)' : ACCENT, background: 'var(--bg2)' }}>
                  {t.status === 'running' && <Loader2 size={10} className="animate-spin" />}{t.status}
                </span>
                {(() => {
                  const url = (t.params as { kernel_url?: string } | null)?.kernel_url
                  return typeof url === 'string' ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="min-h-[44px] inline-flex items-center gap-1 rounded-[var(--r-full)] border px-2 py-1 font-display text-[11px] font-[700] transition-colors hover:bg-[var(--bg2)]" style={{ borderColor: `${ACCENT}40`, color: ACCENT }}>
                      <ExternalLink size={11} />모니터링
                    </a>
                  ) : null
                })()}
                <div className="flex-1" />
                <span className="font-mono text-[11px] text-[var(--t2)]">{new Date(t.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-[var(--t2)]">
                {t.backend && <span className="inline-flex items-center gap-1"><Cpu size={11} />{t.backend}</span>}
                {t.model && <span>· {t.model}</span>}
                {t.site && <span>· {t.site}</span>}
                {t.style && <span className="inline-flex items-center gap-1">· <Palette size={11} />{t.style}</span>}
                {typeof (t.params as { env?: string } | null)?.env === 'string' && <span>· env {(t.params as { env: string }).env}</span>}
                {Array.isArray((t.params as { panels?: unknown } | null)?.panels) && <span>· 컷 {((t.params as { panels: number[] }).panels).join(',')}</span>}
              </div>
              {t.result && (
                <p className="mt-2 rounded-[var(--r-sm)] bg-[var(--bg2)] px-3 py-2 font-body text-[12px] text-[var(--t2)]">
                  {Object.entries(t.result).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' · ')}
                </p>
              )}
              {t.note && <p className="mt-1 font-body text-[12px] italic text-[var(--t2)]">{t.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-display text-[11px] font-[700] text-[var(--t2)]">{label}</span>
      <input value={value} onChange={onChange} placeholder={placeholder} className="rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 font-body text-[13px] text-[var(--t1)] outline-none focus:border-[var(--active)]" />
    </label>
  )
}

function CatalogTable({
  rows,
  selected,
  onToggle,
  onRetry,
  busy,
}: {
  rows: ComicCatalogRow[]
  selected: Set<string>
  onToggle: (id: string) => void
  onRetry: (row: ComicCatalogRow) => void
  busy: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--r-md)] border border-[var(--bd)]">
      <table className="w-full min-w-[760px] text-left">
        <thead>
          <tr className="border-b border-[var(--bd)] bg-[var(--bg2)] font-display text-[11px] uppercase tracking-wide text-[var(--t2)]">
            <Th></Th><Th>제목</Th><Th>저자</Th><Th>V</Th><Th>도서</Th><Th>만화</Th><Th>컷</Th><Th>큐</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.bookId} className="border-b border-[var(--bd)]/60 last:border-0 hover:bg-[var(--bg2)]/40">
              <Td>
                <input
                  type="checkbox"
                  checked={selected.has(r.bookId)}
                  onChange={() => onToggle(r.bookId)}
                  aria-label={`${r.title} 선택`}
                  className={/* 체크박스는 대체 요소(replaced element)라 ::after 로 히트 영역을 넓힐 수 없다 — 이 자리엔 <label> 이 없어 회귀 허용목록에 남는다 */ 'h-4 w-4 accent-[#8B5CF6]'}
                />
              </Td>
              <Td>
                <Link
                  href={`/admin/comic/${r.bookId}`}
                  className="font-display text-[13px] font-[600] text-[var(--t1)] underline-offset-2 hover:text-[#8B5CF6] hover:underline"
                >
                  {r.title}
                </Link>
              </Td>
              <Td className="font-body text-[12px] text-[var(--t2)]">{r.author ?? '—'}</Td>
              <Td className="font-mono text-[12px] tabular-nums text-[var(--t2)]">{r.vLevel ?? '—'}</Td>
              <Td className="font-body text-[12px] text-[var(--t2)]">{r.bookStatus}</Td>
              <Td><StatusPill status={r.comicStatus} /></Td>
              <Td className="font-mono text-[12px] tabular-nums text-[var(--t2)]">
                {r.jobStatus === 'running' && r.panelsDone != null
                  ? `${r.panelsDone}/${r.panelsTotal || '?'}`
                  : r.panelsTotal || '—'}
              </Td>
              <Td>
                {r.jobStatus ? (
                  <div className="flex flex-col items-start gap-1">
                    <span
                      className="inline-flex items-center gap-1 font-display text-[11px] font-[700]"
                      style={{ color: r.jobStatus === 'failed' ? 'var(--memory-risk)' : ACCENT }}
                    >
                      {r.jobStatus === 'running' && <Loader2 size={11} className="animate-spin" />}
                      {/* 색만으로 실패를 알리지 않는다 — 아이콘을 함께 붙인다. */}
                      {r.jobStatus === 'failed' && <XCircle size={11} />}
                      {r.jobStatus}
                    </span>
                    {/* 실패는 스스로 풀리지 않는다 — 사유와 재시도를 같은 자리에 둔다. */}
                    {r.jobStatus === 'failed' && (
                      <>
                        <span
                          className="max-w-[280px] font-mono text-[10px] leading-snug text-[var(--t2)]"
                          title={r.jobError ?? undefined}
                        >
                          {r.jobError ? truncate(r.jobError, 120) : '사유 기록 없음'}
                        </span>
                        <button
                          onClick={() => onRetry(r)}
                          disabled={busy}
                          className="inline-flex min-h-11 items-center gap-1 rounded-[var(--r-full)] border border-[var(--bd)] px-3 font-display text-[11px] font-[700] text-[var(--t2)] transition-colors hover:border-[var(--memory-risk)] hover:text-[var(--memory-risk)] disabled:opacity-50"
                        >
                          <RotateCcw size={11} /> 재시도
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <span className="text-[var(--t2)]">—</span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusPill({ status }: { status: ComicCatalogRow['comicStatus'] }) {
  const m = COMIC_STATUS_META[status]
  return (
    <span
      className="inline-flex items-center rounded-[var(--r-full)] px-2 py-1 font-display text-[11px] font-[700]"
      style={{ color: m.tone, backgroundColor: `color-mix(in srgb, ${m.tone} 12%, transparent)` }}
    >
      {m.label}
    </span>
  )
}

function StatTile({
  label,
  value,
  Icon,
  tone = 'var(--t2)',
}: {
  label: string
  value: number
  Icon: typeof BookImage
  tone?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3">
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)]"
        style={{ backgroundColor: `color-mix(in srgb, ${tone} 12%, transparent)`, color: tone }}
        aria-hidden
      >
        <Icon size={15} />
      </span>
      <div>
        <p className="font-display text-[19px] font-[800] tabular-nums text-[var(--t1)]">{value}</p>
        <p className="font-body text-[11px] text-[var(--t2)]">{label}</p>
      </div>
    </div>
  )
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-2">
      <span
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-display text-[10px] font-[800] text-white"
        style={{ backgroundColor: ACCENT }}
        aria-hidden
      >
        {n}
      </span>
      <span>{children}</span>
    </li>
  )
}
function Arrow() {
  return <span aria-hidden className="text-[var(--t2)]">→</span>
}

/** 긴 오류 문자열이 표 폭을 밀어내지 않게 자른다 — 전문은 title 속성에 남는다. */
function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}

function Th({ children }: { children?: ReactNode }) {
  return <th className="px-3 py-2 font-[700]">{children}</th>
}
function Td({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <td className={`px-3 py-3 ${className}`}>{children}</td>
}
