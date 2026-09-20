// apps/web/src/app/(evidence)/admin/csat/evidence/page.tsx
// @form: 시험지 사물 — 막힌 공정에 찍히는 주묵 권점
//
// **골든 목업에서 그대로 옮긴 화면이다** (`docs/design/golden/admin-csat-mockup.html`).
// 판정 기준은 하나: 1280·375 에서 목업 캡처와 이 라우트 캡처의 **차이가 0**. 다르면 여기를 고친다.
//
// 지금 단계는 「보이는 것」만이다 — 값은 목업의 값을 그대로 쓴다(아래 MOCK).
// 실제 데이터(`lib/csat/evidence-operations*`)는 화면이 승인된 뒤에 잇는다.
//
// 이 라우트는 **공용 관리자 껍데기를 쓰지 않는다.** 사이드바·판심을 여기서 직접 그리므로
// 파일이 `app/(evidence)/` 라우트 그룹에 있다(그룹은 URL 을 바꾸지 않고 `app/admin/layout.tsx`
// 만 벗긴다). 그래서 그 레이아웃이 하던 admin 가드를 이 파일이 직접 호출한다.

import { requireAdmin } from '@/lib/auth/require-admin'

import s from './golden.module.css'

export const dynamic = 'force-dynamic'

/** 목업의 값 — 승인 전까지는 여기가 데이터 출처다(DB 연결은 승인 뒤). */
const MOCK = {
  when: '2026-09-20 11:31 KST',
  blocked: { no: '③', label: '내용 판정', count: '12,123' },
  rail: [
    { group: '재료' },
    { n: '①', label: '원문 수집' },
    { n: '②', label: '추출 · 조판' },
    { n: '③', label: '내용 판정', current: true, stuck: true },
    { n: '④', label: '적격 캐시' },
    { group: '공정' },
    { n: '⑤', label: '문항 재고' },
    { n: '⑥', label: '해설 채움' },
    { group: '출고' },
    { n: '⑦', label: '권 조판' },
    { n: '⑧', label: '발행' },
  ] as ({ group: string } | { n: string; label: string; current?: boolean; stuck?: boolean })[],
  rows: [
    { n: '①', label: '원문 수집', num: '109,043', mark: '✓', verdict: '통과', next: '—' },
    { n: '②', label: '추출 · 조판', num: '87,466', mark: '✓', verdict: '통과', next: '—' },
    {
      n: '③',
      label: '내용 판정',
      num: '12,123',
      mark: '✗',
      verdict: '막힘',
      next: '판정 드레인',
      stuck: true,
      picked: true,
    },
    { n: '④', label: '적격 캐시', num: '13,271', mark: '◐', verdict: '대기', next: '③ 이후' },
    { n: '⑤', label: '문항 재고', num: '879,534', mark: '✓', verdict: '통과', next: '—' },
    { n: '⑥', label: '해설 채움', num: '61%', mark: '◐', verdict: '대기', next: '해설 드레인' },
    { n: '⑦', label: '권 조판', num: '312', mark: '✓', verdict: '통과', next: '—' },
    { n: '⑧', label: '발행', num: '250', mark: '·', verdict: '해당 없음', next: '—' },
  ],
  gauges: [
    { label: '판정 없음', value: '12,123' },
    { label: '판정만으로 열리는 것', value: '0' },
    { label: '밴드가 함께 막는 것', value: '12,121' },
  ],
  command: 'node scripts/csat/gate-raw-with-items-ids.mjs --write .agent-logs/raw-judge --per 100',
}

export default async function AdminCsatEvidencePage() {
  await requireAdmin('/admin/csat/evidence')

  return (
    <div className={s.shell}>
      <aside className={s.rail} aria-label="주 메뉴">
        <div className={s.plate}>
          <span className={s.seal} aria-hidden="true">
            V
          </span>
          <b>Vocaflow</b>
          <span className={s.badge}>Admin</span>
        </div>
        <nav className={s.marginal}>
          {MOCK.rail.map((entry) =>
            'group' in entry ? (
              <h2 key={entry.group}>{entry.group}</h2>
            ) : (
              <a
                key={entry.n}
                href="#"
                aria-current={entry.current ? 'page' : undefined}
                className={entry.stuck ? s.stuck : undefined}
              >
                <span className={s.n} aria-hidden="true">
                  {entry.n}
                </span>
                {entry.label}
              </a>
            )
          )}
        </nav>
        <p className={s.foot}>번호는 순서다 — 진도도 자격도 아니다.</p>
      </aside>

      <main className={s.main}>
        <div className={s.head}>
          <h1>교재 공장 — 공정 현황판</h1>
          <span className={s.when}>{MOCK.when}</span>
        </div>

        <div className={s.body}>
          <p className={s.sub}>조작 버튼은 없다. 각 공정이 다음에 돌릴 명령을 들고 있다.</p>

          {/* A3 — 가장 앞선 막힌 단계 한 줄 */}
          <p className={s.blocked}>
            <span className={s.gwon} aria-hidden="true">
              •
            </span>
            <span>
              <strong>
                {MOCK.blocked.no} {MOCK.blocked.label}
              </strong>
              이 가장 앞에서 막혀 있다 — 판정 없는 원문 <strong>{MOCK.blocked.count}편</strong>이 뒤
              공정을 전부 대기시킨다.
            </span>
          </p>

          <table>
            <caption>공정 8칸 — 번호는 순서다. 판정은 색이 아니라 기호 + 글자가 말한다.</caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">공정</th>
                <th scope="col">눈금</th>
                <th scope="col">판정</th>
                <th scope="col">다음</th>
              </tr>
            </thead>
            <tbody>
              {MOCK.rows.map((row) => (
                <tr
                  key={row.n}
                  className={[row.stuck ? s.stuck : '', row.picked ? s.picked : '']
                    .filter(Boolean)
                    .join(' ')}
                >
                  <td className={s.n}>{row.n}</td>
                  <td>{row.label}</td>
                  <td className={s.num}>{row.num}</td>
                  <td className={s.verdict}>
                    <span className={s.mark}>
                      {row.mark} <b>{row.verdict}</b>
                    </span>
                  </td>
                  <td className={`${s.next} ${s.mark}`}>{row.next}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className={s.detail} aria-label="고른 공정 상세">
            <h2>
              ③ <em>내용 판정</em> — 원문이 학습에 쓸 수 있는지 사람·에이전트가 판정한다
            </h2>
            <div className={s.gauges}>
              {MOCK.gauges.map((g) => (
                <p key={g.label} className={s.gauge}>
                  {g.label}
                  <b>{g.value}</b>
                </p>
              ))}
            </div>
            <p className={s.cmd}>
              <code>{MOCK.command}</code>
              <button type="button">복사</button>
            </p>
          </section>

          <p className={s.foot}>눈금은 전부 DB 실측이다. 상수는 없다.</p>
        </div>
      </main>
    </div>
  )
}
