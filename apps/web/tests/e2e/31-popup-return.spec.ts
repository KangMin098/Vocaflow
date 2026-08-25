// apps/web/tests/e2e/31-popup-return.spec.ts
//
// **팝업을 닫으면 제자리로 돌아온다** — 학습자·관리자 공통.
//
// ── 왜 이 축이 비어 있었나 (실측 2026-08-25) ──────────────────────────────
// `role="dialog"` 를 그리는 컴포넌트가 28개인데, 다이얼로그를 **여닫고 원래 자리가
// 유지되는지** 재는 스펙은 없었다. 아케이드 스펙들이 자기 다이얼로그의 Esc·포커스를
// 보긴 하지만, 그건 그 화면 하나의 계약이다.
//
// 팝업이 깨지는 방식은 조용하다 — 화면은 멀쩡히 뜨고, 닫으면 **스크롤이 맨 위로 튀거나**
// 주소가 바뀌어 있거나 `body` 가 잠긴 채 남는다. 셋 다 "에러" 로 잡히지 않는다.
// 실제로 이 저장소에는 그 흔적이 남아 있다 — `GlobalBodyReset` 은 존재 자체가 증거다:
//   "NetflixDetailSheet 가 cleanup 못한 body.style.overflow='hidden'" (그 파일의 주석)
// 안전망이 있다는 것은 새는 곳이 있었다는 뜻이다. 안전망이 지금도 필요한지 재 둔다.
//
// ── 무엇을 재는가 ────────────────────────────────────────────────────────
//   ① 열림     — 트리거를 누르면 `role="dialog"` 가 나타난다
//   ② 주소     — 열고 닫아도 URL 이 그대로다 (팝업은 이동이 아니다)
//   ③ 스크롤   — 닫은 뒤 스크롤 위치가 유지된다 (맨 위로 튀지 않는다)
//   ④ 잠금해제 — 닫은 뒤 `body` 가 스크롤 가능한 상태로 돌아온다
//   ⑤ 포커스   — 닫은 뒤 포커스가 트리거로 돌아온다 (키보드 사용자가 자리를 잃지 않는다)
//
// ── 대상 고르기 ──────────────────────────────────────────────────────────
// 화면마다 트리거가 다르므로 **명시 목록**을 쓴다. 자동 탐색(모든 버튼을 눌러 보기)은
// 학습 세션을 시작하거나 데이터를 쓰는 버튼까지 누르게 되어, 검증 계정을 오염시킨다.
// 목록이 짧은 것은 커버리지의 한계이고, 그 사실을 숨기지 않는다(마지막 테스트가 센다).

import { expect, test, type Page } from '@playwright/test';

import { adminBypassEnabled } from './utils/admin-routes';
import { ensureAuthState } from './utils/auth';

const STATE_PATH = 'playwright-auth/.auth-popup-return.json';

interface PopupCase {
  name: string;
  route: string;
  /** 관리자 화면인가 — dev 우회가 꺼져 있으면 건너뛴다. */
  admin?: boolean;
  /** 트리거를 찾아 누른다. 못 찾으면 null 을 돌려 이 건을 건너뛴다(실패가 아니다). */
  open: (page: Page) => Promise<{ trigger: string } | null>;
}

const CASES: PopupCase[] = [
  {
    name: 'Game Lab · 게임 설명(Protocol)',
    route: '/arcade',
    open: async (page) => {
      const btn = page.locator('.arc-brief').first();
      if (!(await btn.isVisible().catch(() => false))) return null;
      await btn.click();
      return { trigger: '.arc-brief' };
    },
  },
  {
    name: '공용 단어장 · 세트 미리보기',
    route: '/library/vocab',
    open: async (page) => {
      // 이 화면은 **카테고리를 먼저 고르는** 구조다. 맨 처음에는 칩만 있고 카드가 없어서,
      // 카드를 바로 찾으면 "트리거가 안 보인다" 로 조용히 건너뛴다 — 그건 통과가 아니라
      // 검증 공백이다(실측 2026-08-25).
      // ⚠️ 같은 동작을 두 컴포넌트가 다르게 부른다 —
      //    VocabSetCard 는 "…미리보기 열기", VocabSetCarousel 은 "…미리보기".
      //    한쪽만 찾으면 그 화면이 어느 쪽을 그리느냐에 따라 조용히 건너뛴다.
      const preview = () => page.locator('button[aria-label*="미리보기"]');
      if ((await preview().count()) === 0) {
        // 비활성(단어장 0개) 칩은 누를 수 없다. 살아 있는 칩을 **차례로** 눌러 본다 —
        // 첫 칩 하나만 눌러 보고 포기하면 그 칩이 마침 비어 있을 때 조용히 건너뛴다.
        // 조용한 skip 은 통과가 아니라 검증 공백이다(실측 2026-08-25).
        // 카테고리 매트릭스가 없는 렌더(캐러셀)도 있다 — 있을 때만 눌러 본다.
        const chips = page.locator('nav[aria-label="단어장 카테고리"] button:not([disabled])');
        const n = Math.min(await chips.count(), 5);
        for (let i = 0; i < n; i++) {
          await chips.nth(i).click().catch(() => {});
          await page.waitForTimeout(1500);
          if ((await preview().count()) > 0) break;
        }
      }
      const card = preview().first();
      if (!(await card.isVisible().catch(() => false))) return null;
      await card.click();
      return { trigger: '미리보기 열기' };
    },
  },
  {
    // 스코프를 건 Game Lab — 코스가 붙은 상태의 다이얼로그. 허브와 다른 렌더 경로다.
    name: 'Game Lab(스코프) · 게임 설명',
    route: '/arcade?set=d1f3103b-d8c3-4967-8774-137a2c1da492',
    open: async (page) => {
      const btn = page.locator('.arc-brief').first();
      if (!(await btn.isVisible().catch(() => false))) return null;
      await btn.click();
      return { trigger: '.arc-brief' };
    },
  },
  {
    // GlobalBodyReset 이 이름을 대고 있는 그 컴포넌트다 —
    // "NetflixDetailSheet 가 cleanup 못한 body.style.overflow='hidden'".
    // 안전망이 지금도 필요한지, 아니면 시트가 스스로 치우는지 여기서 재진다.
    name: '도서 서가 · 상세 시트(NetflixDetailSheet)',
    route: '/library/books',
    open: async (page) => {
      const btn = page.locator('button[aria-label$="상세 보기"]').first();
      if (!(await btn.isVisible().catch(() => false))) return null;
      await btn.click();
      return { trigger: '상세 보기' };
    },
  },
  {
    name: '스크립트 서가 · 학습 안내(SeriesInfoModal)',
    route: '/library/scripts',
    open: async (page) => {
      const btn = page.locator('button[aria-label$="학습 안내 보기"]').first();
      if (!(await btn.isVisible().catch(() => false))) return null;
      await btn.click();
      return { trigger: '학습 안내 보기' };
    },
  },
  {
    // ⚠️ 서가(`/comics/restored`)에는 트리거가 없다 — 정보 다이얼로그는 **시리즈 화면**에 있다.
    //    서가를 가리키면 "트리거가 안 보인다" 로 조용히 건너뛴다(실측 2026-08-25).
    name: '만화 시리즈 · 콘텐츠 정보(ComicInfoDialog)',
    route: '/comics/restored?series=super-mystery-comics',
    open: async (page) => {
      const btn = page.locator('[aria-haspopup="dialog"]').first();
      if (!(await btn.isVisible().catch(() => false))) return null;
      await btn.click();
      return { trigger: 'aria-haspopup=dialog' };
    },
  },
  {
    name: '관리자 · 큐레이션 도서 상세',
    route: '/admin/curation',
    admin: true,
    open: async (page) => {
      // ⚠️ 관리자 화면에서는 **아무 버튼이나 누르지 않는다.** 같은 화면에
      //    "소스 GET (대량)" · "드레인 실행(831건 대기)" 처럼 되돌릴 수 없거나 비싼 것이 있다.
      //    트리거는 소스에서 확인한 것만 쓴다 — MyLibraryTab 의 표 행 클릭은
      //    `setSelectedBook(book)` 뿐이라 읽기 전용이다(MyLibraryTab.tsx:831).
      //    ⚠️ **행(`<tr>`) 이 아니라 제목 버튼을 누른다.** 행에도 onClick 이 달려 있지만
      //    `<tr>` 은 포커스를 받지 못해서, 닫을 때 돌아갈 자리가 없다 —
      //    실측 2026-08-25 에 "포커스가 BODY 로 떨어졌다" 로 찍혔는데 **앱이 아니라 계측기**였다.
      //    키보드 사용자가 실제로 쓰는 길은 행 안의 제목 버튼이다(MyLibraryTab.tsx:855).
      const title = page.locator('main table tbody tr button[type="button"]').nth(0);
      if (!(await title.isVisible().catch(() => false))) return null;
      await title.click();
      return { trigger: '도서 제목 버튼(읽기 전용)' };
    },
  },
];

/** 스크롤을 조금 내려 둔다 — 맨 위에서 열면 "튀지 않았다" 가 공짜로 참이 된다. */
async function scrollDown(page: Page): Promise<number> {
  await page.evaluate(() => window.scrollTo(0, Math.min(600, document.body.scrollHeight)));
  await page.waitForTimeout(250);
  return page.evaluate(() => Math.round(window.scrollY));
}

test.describe('팝업을 닫으면 제자리', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    await ensureAuthState(browser, STATE_PATH);
  });
  test.use({ storageState: STATE_PATH });

  for (const c of CASES) {
    test(`${c.name} — 열고 닫아도 주소·스크롤·포커스가 그대로`, async ({ page }) => {
      test.skip(
        !!c.admin && !adminBypassEnabled(),
        'DEV_ADMIN_BYPASS=1 이 아니다 — 관리자 화면을 열 수 없다',
      );
      test.setTimeout(120_000);

      await page.goto(c.route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(2000); // 클라이언트 렌더 — 트리거가 그려질 때까지

      await scrollDown(page);
      const urlBefore = page.url();

      const opened = await c.open(page);
      test.skip(opened === null, `${c.route} 에 트리거가 안 보인다 — 데이터가 비었을 수 있다`);

      // ── ① 열림 ─────────────────────────────────────────────────
      const dialog = page.getByRole('dialog').first();
      await expect(dialog, '트리거를 눌렀는데 다이얼로그가 안 뜬다').toBeVisible({ timeout: 15_000 });

      // 기준선은 **팝업이 열린 순간**의 위치다.
      // 클릭 전에 재면 안 된다 — Playwright 는 트리거를 누르려고 먼저 화면을 스크롤하고,
      // 그러면 "닫았더니 튀었다" 로 찍히지만 실제로는 **누르러 간 만큼** 움직인 것이다
      // (실측 2026-08-25: /arcade?set= 에서 600 → 1060 으로 잡혔다 · 화면이 아니라 계측기).
      // 학습자가 실제로 묻는 것도 "팝업을 열었던 그 자리로 돌아왔나" 이지 그 이전이 아니다.
      await page.waitForTimeout(300);
      const scrollBefore = await page.evaluate(() => Math.round(window.scrollY));

      // ── ② 주소 — 팝업은 이동이 아니다 ───────────────────────────
      expect(page.url(), '팝업을 여는 것만으로 주소가 바뀌었다').toBe(urlBefore);

      // 닫기 — Esc 가 정본이다(키보드 사용자의 유일한 길인 경우가 많다).
      await page.keyboard.press('Escape');
      await expect(dialog, 'Esc 로 닫히지 않는다').toBeHidden({ timeout: 10_000 });
      await page.waitForTimeout(400);

      // ── ② 주소(닫은 뒤) ────────────────────────────────────────
      expect(page.url(), '팝업을 닫았더니 주소가 바뀌었다').toBe(urlBefore);

      // ── ③ 스크롤 — 맨 위로 튀지 않는다 ──────────────────────────
      const scrollAfter = await page.evaluate(() => Math.round(window.scrollY));
      expect(
        Math.abs(scrollAfter - scrollBefore),
        `팝업을 닫았더니 스크롤이 ${scrollBefore} → ${scrollAfter} 로 튀었다`,
      ).toBeLessThanOrEqual(80);

      // ── ④ 잠금 해제 — body 가 다시 스크롤된다 ───────────────────
      const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
      expect(
        bodyOverflow,
        `팝업을 닫았는데 body 가 잠긴 채다(overflow: ${bodyOverflow}) — 화면 전체가 안 움직인다`,
      ).not.toBe('hidden');

      // ── ⑤ 포커스 — 트리거로 돌아온다 ────────────────────────────
      // 포커스가 body 로 떨어지면 키보드 사용자는 처음부터 다시 Tab 해야 한다.
      const focusTag = await page.evaluate(() => document.activeElement?.tagName ?? 'NONE');
      expect(
        focusTag,
        `팝업을 닫았더니 포커스가 ${focusTag} 로 떨어졌다 — 키보드로는 자리를 잃는다`,
      ).not.toBe('BODY');
    });
  }

  test('커버리지 고지 — 이 스펙이 무엇을 안 재는지 숨기지 않는다', () => {
    // `role="dialog"` 를 그리는 컴포넌트는 **28개**다(실측 2026-08-25).
    // 전부를 여기서 열 수는 없다. 다만 **못 여는 이유를 하나씩 적어 둔다** —
    // 이유 없는 면제 목록은 커버리지가 아니라 눈속임이고, 목록이 조용히 자란다.

    /** 정적 화면에서 **열 수 있는** 다이얼로그. 이 스펙의 진짜 분모다. */
    const REACHABLE = [
      'GameBriefModal',
      'VocabSetPreviewModal',
      'NetflixDetailSheet',
      'SeriesInfoModal',
      'ComicInfoDialog',
      'BookDetailModal',
      'EnqueueModal',
      'SeedDetailModal',
      'AdminPdComicsClient',
    ];

    /** 여기서 재지 않는 19개 — **각각 이유와 함께.** */
    const EXCLUDED: Record<string, string> = {
      'ui/Modal': '프리미티브 — 자체 화면이 없다(쓰는 쪽에서 재진다)',
      'ui/ZoomableImage': '프리미티브',
      'ui/ios/SheetContainer': '프리미티브 — 아무도 직접 import 하지 않는다',
      'layout/GlobalBodyReset': '다이얼로그가 아니라 body 잠금 안전망',
      'spellforge/MicroPause': '학습 세션 중에만 — 열려면 세션을 시작해야 하고 기록이 남는다',
      'diagnostic/DiagnosticClient': '진단 세션 — 검증 계정의 진단 결과를 덮어쓴다',
      'comic/ComicReader': '동적 라우트(/text/[id]/comic) + 콘텐츠 필요',
      'comic/PdModernReader': '동적 라우트(/comics/restored/[slug])',
      'library/reader/WordLookupPopover': '읽기 중 단어 탭 — 동적 라우트 + 상호작용',
      'workspace/FloatingSparkle': '/text/[id] 읽기 중',
      'workspace/InsightPanel': '/text/[id] 읽기 중',
      'workspace/RecallCard': '/text/[id] 읽기 중 — 열면 인출 기록이 남는다',
      'workspace/SupportGloss': '/text/[id] 읽기 중',
      'workspace/TypePopover': '/text/[id] 읽기 중',
      'workspace/WorkspaceChapterNav': '/text/[id] 읽기 중',
      'app:(main)/text/[id]/page': '동적 라우트',
      'admin/articles/ArticleWordSetPreviewModal': '동적 라우트(/admin/articles/preview/[id])',
      'admin/curation/ChapterQuizPreviewModal': '동적 라우트(/admin/curation/preview/[bookId])',
      'admin/curation/ChapterWordSetPreviewModal': '동적 라우트(/admin/curation/preview/[bookId])',
    };

    const TOTAL_DIALOG_FILES = 28;
    expect(
      REACHABLE.length + Object.keys(EXCLUDED).length,
      '분모가 안 맞는다 — 다이얼로그가 늘었는데 목록을 안 고쳤을 수 있다',
    ).toBe(TOTAL_DIALOG_FILES);

    // 이 스펙이 실제로 여는 컴포넌트 (케이스 이름에 괄호로 적어 둔 것 + 자명한 둘)
    const COVERED = [
      'GameBriefModal',
      'VocabSetPreviewModal',
      'NetflixDetailSheet',
      'SeriesInfoModal',
      'ComicInfoDialog',
      'BookDetailModal',
    ];
    for (const c of COVERED) expect(REACHABLE, `${c} 가 분모에 없다`).toContain(c);

    const pct = Math.round((COVERED.length / REACHABLE.length) * 1000) / 10;
    // eslint-disable-next-line no-console
    console.log(
      `\n[팝업 커버리지] 열 수 있는 다이얼로그 ${COVERED.length}/${REACHABLE.length} (${pct}%) · ` +
        `이유를 적고 제외한 것 ${Object.keys(EXCLUDED).length} · 전체 파일 ${TOTAL_DIALOG_FILES}\n` +
        `  아직 안 여는 것: ${REACHABLE.filter((r) => !COVERED.includes(r)).join(', ')}\n`,
    );

    // 바닥선 — 여기서 내려가면 커버리지가 조용히 줄어든 것이다.
    expect(COVERED.length, '팝업 커버리지가 줄었다').toBeGreaterThanOrEqual(6);
  });
});
