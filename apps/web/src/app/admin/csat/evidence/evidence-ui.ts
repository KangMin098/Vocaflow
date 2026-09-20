// apps/web/src/app/admin/csat/evidence/evidence-ui.ts
//
// **이 화면의 판면 — Tailwind 유틸 문자열 한 곳.** (Gate 4 (ii) · DD-56 이관)
//
// 왜 상수인가: CSS 모듈(`evidence.module.css`)을 지우고 Tailwind 로 옮기는데, 그대로 옮기면
// 한 요소에 200자짜리 클래스 문자열이 붙어 **diff 를 아무도 못 읽는다.** 그래서 역할 단위로
// 이름을 붙여 여기 모은다 — 값은 전부 토큰이고, 라쳇(`average-signal-ratchet`)이 이 파일도 읽는다.
//
// 44px 터치 타깃은 **여기서 붙이지 않는다** — 관리자 레이아웃 루트가 일괄 보장한다
// (`globals.css` 의 `[data-admin-root]` · DD-58 A5). 화면마다 붙이면 반드시 빠뜨린다.
//
// 「정오표」 골격(DD-58 A1): 목록은 **번호 + 괘선 행**이고, 막힌 행에만 **주묵 권점**을 찍는다(A2).
// 원색 주묵(`--ju`)은 점·선에만 — 면은 `--ju-light` tint 까지다(A4).

/** 인터랙티브 4상태 — 옛 `.console button/a/summary` 서술자 규칙을 요소에 직접 붙인 것. */
export const CTRL =
  'transition-opacity duration-[var(--dur-normal)] ease-[var(--ease)] ' +
  'hover:text-[var(--admin-strong)] active:opacity-[0.72] ' +
  'disabled:opacity-45 disabled:cursor-not-allowed ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--admin)]'

export const BTN =
  `${CTRL} inline-flex items-center justify-center gap-2 rounded-[var(--r-sm)] ` +
  'border border-[var(--bd)] bg-[var(--bg)] px-[14px] py-2 text-[13px]'

export const BTN_PRIMARY =
  `${BTN} border-[var(--admin-strong)] bg-[var(--admin-strong)] text-[var(--on-p)] hover:text-[var(--on-p)] hover:opacity-95`

export const MUTED = 'text-[13px] leading-[1.65] text-[var(--t2)]'
export const EYEBROW = 'text-[11px] font-semibold tracking-[0.12em] text-[var(--admin-strong)]'
export const LINE = 'flex flex-wrap items-center gap-3'
export const ACTIONS = LINE
export const HEADER = `${LINE} mb-5 justify-between`

/** 탭 — 밑줄이 현재 위치를 말한다(색 단독 금지: `aria-current` 가 함께 있다). */
export const NAV = 'mb-6 flex gap-6 border-b border-[var(--bd)]'
export const NAV_BTN =
  `${CTRL} border-b-[3px] border-transparent px-[2px] py-[10px] text-sm text-[var(--t2)] ` +
  'aria-[current=page]:border-[var(--admin)] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--admin-strong)]'

export const HERO =
  'grid grid-cols-1 gap-5 border-t-[3px] border-[var(--admin)] bg-[var(--bg)] p-5 md:grid-cols-[1.15fr_1fr] md:gap-8 md:p-7'
export const NUMBER =
  'text-[52px] font-[650] leading-[1.2] tracking-[-0.05em] tabular-nums md:text-[64px] [&>span]:text-2xl [&>span]:font-normal [&>span]:text-[var(--t2)]'
export const DISTRIBUTION = 'my-4 mb-2 flex h-2 bg-[var(--bd)] [&>span]:bg-[var(--success-ink)]'
export const RECOMMEND =
  'border-t border-[var(--bd)] pt-[18px] md:border-l md:border-t-0 md:pl-7 md:pt-0 [&>h4]:my-2 [&>h4]:text-[22px] [&>h4]:font-semibold'

export const SECTION =
  'border-b border-[var(--bd)] py-6 [&>h3]:mb-2 [&>h3]:text-base [&>h3]:font-semibold [&_h4]:mb-2 [&_h4]:text-base [&_h4]:font-semibold'
export const SPLIT = 'grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-8'

/** 정오표 한 행 — 번호 칸 + 이름 + 눈금. 막힌 행은 `data-stuck` 으로 권점을 켠다(A2). */
export const ROW =
  `${CTRL} relative flex w-full items-center justify-between gap-3 border-b border-[var(--bd)] py-3 pl-6 text-left text-sm ` +
  '[&>strong]:tabular-nums ' +
  "data-[stuck=true]:before:absolute data-[stuck=true]:before:left-0 data-[stuck=true]:before:top-1/2 " +
  "data-[stuck=true]:before:-translate-y-1/2 data-[stuck=true]:before:text-[18px] data-[stuck=true]:before:leading-none " +
  "data-[stuck=true]:before:text-[var(--ju)] data-[stuck=true]:before:content-['•']"

/** 행 앞 번호(①②③…) — 정오표의 「번호는 순서다」. */
export const ROW_NO = 'mr-2 inline-block w-5 shrink-0 text-[var(--t2)] tabular-nums'

/** A3 규격 — 가장 앞선 막힌 단계 한 줄. 색이 아니라 문장 + 주묵 표식. */
export const BLOCKED_LINE =
  'mb-4 flex items-baseline gap-2 rounded-[var(--r-sm)] border border-[var(--bd)] border-l-2 border-l-[var(--ju)] bg-[var(--bg)] px-3 py-[10px] text-sm'

export const PIPELINE_GRID = 'mt-[14px] grid grid-cols-1 border-y border-[var(--bd)] md:grid-cols-5'
export const PIPELINE_CELL =
  `${CTRL} grid grid-cols-[1fr_auto] gap-1.5 border-b border-[var(--bd)] px-3 py-[18px] text-left ` +
  'md:block md:border-b-0 md:border-r md:last:border-r-0 ' +
  '[&>strong]:block [&>strong]:text-[22px] [&>strong]:tabular-nums md:[&>strong]:my-2 ' +
  '[&>span]:block [&>span]:text-xs [&>span]:text-[var(--t2)]'

export const BADGE = 'inline-flex items-center gap-[5px] text-xs font-medium'
export const WARN = 'text-[var(--warning-ink)]'
export const BAD = 'text-[var(--error-ink)]'
export const GOOD = 'text-[var(--success-ink)]'

export const QUEUE = 'list-none p-0'
export const ISSUE =
  'grid grid-cols-[36px_1fr] gap-2 border-b border-[var(--bd)] py-[22px] md:grid-cols-[58px_1fr_auto] md:gap-4 ' +
  '[&>h3]:mb-1.5 [&>h3]:text-[17px] [&>h3]:font-semibold'
export const PRIORITY = 'pt-1 font-mono text-[13px] text-[var(--t2)]'
/** 접힘 — `+`/`−` 는 열림 상태를 **형태로** 말한다(색 단독 금지). */
export const DETAILS =
  "mt-2 text-[13px] [&>summary]:flex [&>summary]:cursor-pointer [&>summary]:items-center [&>summary]:text-[var(--admin-strong)] " +
  "[&>summary]:before:mr-2 [&>summary]:before:content-['+'] open:[&>summary]:before:content-['−']"

export const FILTERS =
  'mb-[18px] flex flex-wrap items-end gap-3 ' +
  '[&_label]:grid [&_label]:gap-1.5 [&_label]:text-xs [&_label]:text-[var(--t2)] [&_label]:max-md:min-w-[140px] [&_label]:max-md:flex-1 ' +
  '[&_input]:max-w-full [&_input]:rounded-[var(--r-sm)] [&_input]:border [&_input]:border-[var(--bd)] [&_input]:bg-[var(--bg)] [&_input]:px-2.5 [&_input]:py-2 [&_input]:text-[var(--t1)] ' +
  '[&_select]:max-w-full [&_select]:rounded-[var(--r-sm)] [&_select]:border [&_select]:border-[var(--bd)] [&_select]:bg-[var(--bg)] [&_select]:px-2.5 [&_select]:py-2 [&_select]:text-[var(--t1)]'

export const CHIPS =
  'flex flex-wrap gap-2 pb-3 text-xs ' +
  `[&>button]:border [&>button]:border-[var(--admin)] [&>button]:bg-[var(--bg)] [&>button]:px-2.5 [&>button]:py-1.5`

export const TABLE_WRAP = 'overflow-auto [contain:paint]'
export const TABLE =
  'w-full min-w-[720px] border-collapse text-left text-[13px] ' +
  '[&_th]:whitespace-nowrap [&_th]:border-y [&_th]:border-[var(--bd)] [&_th]:p-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-[var(--t2)] ' +
  '[&_th:first-child]:w-1/4 [&_th:nth-child(4)]:w-[28%] ' +
  '[&_td]:border-b [&_td]:border-[var(--bd)] [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top ' +
  '[&_td_button]:text-left [&_td_button]:underline [&_td_button]:underline-offset-4 ' +
  '[&_td_small]:mt-1 [&_td_small]:block [&_td_small]:text-[var(--t2)] ' +
  "[&_tr[data-selected='true']]:bg-[color-mix(in_srgb,var(--admin)_12%,var(--bg))]"

export const PAGINATION = 'mt-3 flex items-center justify-end gap-4 text-[13px]'
export const TECHNICAL =
  "mt-6 border-t border-[var(--bd)] py-3 text-[13px] [&>summary]:flex [&>summary]:cursor-pointer [&>summary]:items-center [&>summary]:font-medium " +
  "[&>summary]:before:mr-2 [&>summary]:before:content-['+'] open:[&>summary]:before:content-['−']"
export const COVERAGE =
  'grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 [&_progress]:h-1.5 [&_progress]:w-[75px] [&_progress]:accent-[var(--admin)]'

export const ALERT = 'mb-4 border-l-[3px] border-[var(--error-ink)] bg-[var(--bg)] p-4'
export const EMPTY = 'bg-[var(--bg)] px-4 py-9 text-center'
export const CODE = 'whitespace-pre-wrap break-words bg-[var(--bg2)] p-3 text-xs'

export const BACKDROP = 'fixed inset-0 z-[49] cursor-default bg-[color-mix(in_srgb,var(--t1)_8%,transparent)]'
export const INSPECTOR =
  'fixed inset-y-0 right-0 z-50 flex w-[min(620px,100%)] flex-col border-l border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-float)] ' +
  '[&>header]:flex [&>header]:items-center [&>header]:justify-between [&>header]:gap-3 [&>header]:border-b [&>header]:border-[var(--bd)] [&>header]:px-6 [&>header]:py-4 ' +
  '[&>header_h2]:text-[17px] [&>header_h2]:font-semibold'
export const INSPECTOR_BODY =
  'flex-1 overflow-auto px-6 pb-6 ' +
  "[&_details]:border-b [&_details]:border-[var(--bd)] [&_details]:py-3.5 " +
  "[&_summary]:flex [&_summary]:cursor-pointer [&_summary]:items-center [&_summary]:gap-2 [&_summary]:text-[15px] [&_summary]:font-semibold " +
  "[&_summary]:before:content-['+'] [&_details[open]_summary]:before:content-['−'] " +
  '[&_p]:text-sm [&_p]:leading-[1.8] [&_li]:text-sm [&_li]:leading-[1.8] [&_dd]:text-sm [&_dd]:leading-[1.8] ' +
  '[&_dt]:mt-3.5 [&_dt]:text-xs [&_dt]:text-[var(--t2)] ' +
  '[&_blockquote]:my-3.5 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--admin)] [&_blockquote]:pl-3'

/** 화면 루트 — 옛 `.console`. 줄바꿈 규칙은 한글 판면의 기본이다. */
export const CONSOLE = 'break-keep [overflow-wrap:anywhere] text-[var(--t1)]'
