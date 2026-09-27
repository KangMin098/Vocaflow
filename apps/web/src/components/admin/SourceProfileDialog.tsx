// apps/web/src/components/admin/SourceProfileDialog.tsx
//
// **소스 이름을 누르면 뜨는 수집 프로필 팝업.** 관리자가 그 소스를 몰라도 「무엇을 얼마나 받았고, 어디까지 가렸고,
// 어느 수준이며, 권리는 어떤가」를 한 화면에서 읽게 한다. 값은 전부 DB 실측(`/api/admin/sources/[source]/profile`).
//
// 골격은 관리자 「정오표」(DESIGN.md A1·A2·A3): 번호 + 괘선 행 여섯 줄, 막힌 행에만 주묵 권점,
// 첫 줄에 가장 먼저 볼 문제 한 줄(없으면 비운다). 표본 분포는 표본 크기를 함께 적는다.

'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'

import { Dialog } from '@/components/ui/Dialog'
import {
  CEFR_LEVELS, EVIDENCE_LABEL, GRADE_LABEL, LICENSE_LABEL, RETENTION_LABEL, STATUS_LABEL, VERDICT_LABEL, V_LEVELS,
  ARTICLE_STATUSES, profileIssues, type SourceProfile,
} from '@/lib/admin/source-profile'
import { getSourceGuide } from '@/lib/articles/source-guide'
import type { SourceKey } from '@vocaflow/library-pipeline/curation-spec'
import styles from './source-profile.module.css'

type Seg = { key: string; label: string; value: number; color: string }

const fmt = (n: number) => n.toLocaleString()
/** 0건은 비율을 적지 않는다(「0.0%」는 읽는 눈만 붙잡는다) · 0.1% 미만은 `<0.1%`. */
const pct = (x: number, n: number) => {
  if (!n || !x) return ''
  const r = (x / n) * 100
  return r < 0.1 ? '<0.1%' : `${r.toFixed(r < 10 ? 1 : 0)}%`
}
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '—')

function Stack({ segs, total }: { segs: Seg[]; total: number }) {
  const shown = segs.filter((s) => s.value > 0)
  return (
    <>
      <div className={styles.stack} role="img" aria-label={shown.map((s) => `${s.label} ${fmt(s.value)}`).join(', ')}>
        {shown.map((s) => (
          <span key={s.key} style={{ width: `${(s.value / Math.max(1, total)) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div className={styles.legend}>
        {segs.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} aria-hidden />
            {s.label}
            <b>{fmt(s.value)}</b>
            <em>{pct(s.value, total)}</em>
          </span>
        ))}
      </div>
    </>
  )
}

function Row({ no, name, hint, flagged, children }: { no: number; name: string; hint?: string; flagged: boolean; children: ReactNode }) {
  return (
    <section className={`${styles.row} ${flagged ? styles.flagged : ''}`} aria-label={name}>
      <span className={styles.no}>{String(no).padStart(2, '0')}</span>
      <span className={styles.name}>
        {name}
        {hint ? <small>{hint}</small> : null}
      </span>
      <div className={styles.cell}>{children}</div>
    </section>
  )
}

/** 정적 설명(SOURCE_SPECS) — 등록되지 않은 소스면 없다. */
function guideOf(source: string) {
  try {
    return getSourceGuide(source as SourceKey)
  } catch {
    return null
  }
}

export function SourceProfileDialog({ source, label, onClose }: { source: string | null; label?: string; onClose: () => void }) {
  const [profile, setProfile] = useState<SourceProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!source) return
    let alive = true
    setProfile(null)
    setError(null)
    fetch(`/api/admin/sources/${encodeURIComponent(source)}/profile`, { cache: 'no-store' })
      .then(async (r) => {
        const body = await r.json()
        if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`)
        if (alive) setProfile(body as SourceProfile)
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
  }, [source])

  if (!source) return null
  const guide = guideOf(source)
  const issues = profile ? profileIssues(profile) : []
  const flagged = new Set(issues.map((i) => i.row))

  return (
    <Dialog
      onClose={onClose}
      size="lg"
      title={label ?? source}
      byline={
        <span>
          <code>{source}</code>
          {profile ? ` · 수집 ${day(profile.firstAt)} ~ ${day(profile.lastAt)} · 측정 ${profile.measuredAt.slice(11, 16)}` : ''}
        </span>
      }
      ariaLabel={`${label ?? source} 수집 프로필`}
    >
      <div className={styles.body}>
        {error ? <p className={`${styles.state} ${styles.error}`}>프로필을 읽지 못했습니다 — {error}</p> : null}
        {!profile && !error ? <p className={styles.state}>DB 에서 세는 중…</p> : null}
        {profile ? (
          <>
            {issues.length ? (
              <p className={styles.lead}>
                <span>{issues[0]!.text}</span>
                {issues.length > 1 ? <span className={styles.more}>외 {issues.length - 1}건 · 권점 행</span> : null}
              </p>
            ) : null}

            {guide ? (
              <dl className={styles.guide} aria-label="소스 설명">
                <div><dt>소재</dt><dd>{guide.topics?.join(' · ') || '—'}</dd></div>
                <div><dt>문체</dt><dd>{guide.registers?.join(' · ') || '—'}</dd></div>
                <div><dt>겨냥 CEFR</dt><dd>{guide.cefr ? `${guide.cefr.min}–${guide.cefr.max}` : '—'}</dd></div>
                <div><dt>표기 라이선스</dt><dd>{guide.license}{guide.attributionRequired ? ' · 출처 표시' : ''}</dd></div>
              </dl>
            ) : null}

            <Row no={1} name="재고" hint="원천 · 파생물 · 상태" flagged={flagged.has(1)}>
              <div className={styles.figure}>
                <span className={styles.big}>{fmt(profile.total)}</span>
                <span className={styles.unit}>편</span>
                <span className={styles.facts}>
                  <span>원천 <b>{fmt(profile.units.originals)}</b></span>
                  <span>파생물 <b>{fmt(profile.units.derived)}</b></span>
                  {profile.audio ? <span>원음 있음 <b>{fmt(profile.audio)}</b></span> : null}
                </span>
              </div>
              <Stack
                total={profile.total}
                segs={ARTICLE_STATUSES.map((s) => ({
                  key: s,
                  label: STATUS_LABEL[s],
                  value: profile.status[s],
                  color: { ready: 'var(--success)', queued: 'var(--info)', published: 'var(--p)', archived: 'var(--bd-strong)', failed: 'var(--error)' }[s],
                }))}
              />
            </Row>

            <Row no={2} name="판정" hint="보관 · 내용 · 적격" flagged={flagged.has(2)}>
              <div>
                <div className={styles.sub}>보관 판정(원천 단위)</div>
                <Stack
                  total={profile.total}
                  segs={[
                    { key: 'keep', label: RETENTION_LABEL.keep!, value: profile.retention.keep ?? 0, color: 'var(--success)' },
                    { key: 'hold', label: RETENTION_LABEL.hold!, value: profile.retention.hold ?? 0, color: 'var(--warning)' },
                    { key: 'discard', label: RETENTION_LABEL.discard!, value: profile.retention.discard ?? 0, color: 'var(--error)' },
                    { key: 'none', label: RETENTION_LABEL.none!, value: profile.retention.none, color: 'var(--bg3)' },
                  ]}
                />
              </div>
              <div className={styles.split}>
                <div>
                  <div className={styles.sub}>내용 판정</div>
                  <div className={styles.chips}>
                    {(['use', 'narrative', 'reject', 'none'] as const).map((k) => (
                      <span key={k} className={styles.chip}>{VERDICT_LABEL[k]}<b>{fmt((profile.verdict as Record<string, number>)[k] ?? 0)}</b></span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className={styles.sub}>게시 적격(판정 캐시)</div>
                  <div className={styles.chips}>
                    {(['usable', 'blocked', 'unjudged', 'unknown', 'uncached'] as const).map((k) => (
                      <span key={k} className={styles.chip} data-warn={k === 'uncached' && profile.eligibility.uncached > 0}>
                        {GRADE_LABEL[k]}<b>{fmt((profile.eligibility as Record<string, number>)[k] ?? 0)}</b>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Row>

            <Row no={3} name="수준" hint="V-Level · CEFR · 어수" flagged={flagged.has(3)}>
              <div className={styles.split}>
                <div>
                  <div className={styles.sub}>V-Level(측정 · 미측정 {fmt(profile.vLevel.unknown)})</div>
                  <div className={styles.hist} role="img" aria-label={V_LEVELS.map((v) => `V${v} ${profile.vLevel[v]}`).join(', ')}>
                    {(() => {
                      const max = Math.max(1, ...V_LEVELS.map((v) => profile.vLevel[v] ?? 0))
                      return [...V_LEVELS.map((v) => ({ k: `V${v}`, n: profile.vLevel[v] ?? 0 })), { k: '?', n: profile.vLevel.unknown }].map((b) => (
                        <div key={b.k} className={styles.bar} data-zero={b.n === 0}>
                          <b>{b.n ? fmt(b.n) : ''}</b>
                          <span style={{ height: `${(b.n / max) * 64}px` }} />
                          <small>{b.k}</small>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
                <div>
                  <div className={styles.sub}>CEFR</div>
                  <Stack
                    total={profile.total}
                    segs={[...CEFR_LEVELS, 'unknown'].map((c, i) => ({
                      key: c,
                      label: c === 'unknown' ? '미측정' : c,
                      value: (profile.cefr as Record<string, number>)[c] ?? 0,
                      color: c === 'unknown' ? 'var(--bg3)' : `color-mix(in oklab, var(--p) ${30 + i * 13}%, var(--bg))`,
                    }))}
                  />
                  <p className={styles.note}>
                    어수(최근 {fmt(profile.sample.size)}편) 사분위 {profile.sample.words.p25 ?? '—'} · <b>{profile.sample.words.p50 ?? '—'}</b> · {profile.sample.words.p75 ?? '—'}어
                  </p>
                </div>
              </div>
            </Row>

            <Row no={4} name="권리" hint="보관 기준 아님 · 기록만" flagged={flagged.has(4)}>
              <div className={styles.chips}>
                {Object.entries(profile.license).map(([k, v]) => (v ? (
                  <span key={k} className={styles.chip} data-warn={k === 'restricted' || k === 'unknown'}>{LICENSE_LABEL[k] ?? k}<b>{fmt(v)}</b></span>
                ) : null))}
              </div>
              <div className={styles.facts}>
                <span>확인 방식 —</span>
                {Object.entries(profile.rights.evidence).map(([k, v]) => (v ? <span key={k}>{EVIDENCE_LABEL[k] ?? k} <b>{fmt(v)}</b></span> : null))}
                <span>태그 없음 <b>{fmt(profile.rights.untagged)}</b></span>
                <span>해소 필요 <b>{fmt(profile.rights.needsResolution)}</b></span>
              </div>
            </Row>

            <Row no={5} name="구성" hint={`최근 ${fmt(profile.sample.size)}편 표본`} flagged={flagged.has(5)}>
              <div className={styles.split}>
                <div>
                  <div className={styles.sub}>피드</div>
                  <div className={styles.chips}>
                    {profile.sample.feeds.map((f) => <span key={f.key} className={styles.chip}>{f.key}<b>{fmt(f.count)}</b></span>)}
                  </div>
                </div>
                <div>
                  <div className={styles.sub}>소재 분류</div>
                  <div className={styles.chips}>
                    {profile.sample.topics.map((t) => <span key={t.key} className={styles.chip}>{t.key}<b>{fmt(t.count)}</b></span>)}
                  </div>
                </div>
              </div>
            </Row>

            <Row no={6} name="최근 원문" hint="새로 받은 순 12편" flagged={flagged.has(6)}>
              <table className={styles.table}>
                <thead>
                  <tr><th>제목</th><th>상태</th><th className={styles.num}>V</th><th>CEFR</th><th className={styles.num}>어수</th><th className={styles.num}>수집</th></tr>
                </thead>
                <tbody>
                  {profile.recent.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noreferrer" title={r.title}>
                            {r.title}
                            {r.derived ? <span className={styles.tag}>파생</span> : null}
                            <ExternalLink size={11} aria-hidden style={{ display: 'inline', marginLeft: 4, verticalAlign: -1 }} />
                          </a>
                        ) : (
                          <span title={r.title}>{r.title}{r.derived ? <span className={styles.tag}>파생</span> : null}</span>
                        )}
                      </td>
                      <td>{STATUS_LABEL[r.status as keyof typeof STATUS_LABEL] ?? r.status}</td>
                      <td className={styles.num}>{r.vLevel ?? '—'}</td>
                      <td>{r.cefr ?? '—'}</td>
                      <td className={styles.num}>{r.words != null ? fmt(r.words) : '—'}</td>
                      <td className={styles.num}>{r.createdAt.slice(5, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Row>
          </>
        ) : null}
      </div>
    </Dialog>
  )
}

/** 목록 안에서 소스 이름 자리에 그대로 서는 버튼 — 누르면 프로필 팝업. */
export function SourceNameButton({ source, label }: { source: string; label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={styles.nameButton} onClick={() => setOpen(true)} aria-haspopup="dialog" title={`${label} 수집 프로필`}>
        {label}
      </button>
      {open ? <SourceProfileDialog source={source} label={label} onClose={() => setOpen(false)} /> : null}
    </>
  )
}
