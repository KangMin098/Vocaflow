// apps/web/tests/e2e/07-arcade-games.spec.ts
// 아케이드 게임 전수 스모크 — 19개 /play/* 라우트가 (1) 콘솔 에러 없이 마운트되고
// (2) 핵심 루프의 첫 입력에 반응하는지(작동·사용성)를 회귀로 고정한다.
//   - 계정: runtime-test-0705@vocaflow.dev (04/05 spec 과 동일 · 활동 시드)
//     ⚠️ 뜻 있는 단어 **225개**(DB 실측 2026-08-09) — 전 게임 minWords(최대 24)를 넘는다.
//     즉 비스코프 진입에서도 19종 전부 실제 내 단어로 돌고 맛보기 degrade 는 일어나지 않는다.
//   - 비스코프 진입(?set/?text 없음) → source:'mine' 게임은 사용자 due 큐로 돈다.
//     minWords 는 v07.9 스케일 다운 후 전 게임 **1~8**(도서 챕터 653세트의 1사분위가
//     11단어라 높은 minWords 는 학습자가 고른 자료를 거절한다 — connections 24 는 43% 를
//     막았다). 그보다 단어가 적은 계정에서만 맛보기(demo)로 degrade 한다.
//     NotEnoughWords 게이트는 explicit ?set/?text 진입 전용이라 19종 모두 마운트된다
//     (use-word-scope.ts:158-171).
//   - 로스터 19종 **전부** 를 개별 검증한다(허브 테스트는 19 카드 딥링크 무결성만 커버).
//   - 계약 3단: "준비 마커 가시" → "의미 있는 첫 입력" → "관측 가능한 반응".
//     * 준비 마커는 **조작 가능한 요소**로 잡는다. 그냥 뜻 h1 같은 표시용 노드를 쓰면
//       아직 입력을 받지 않는 준비/카운트인 단계도 통과해 버린다(letter-forge 의 ready 단계).
//     * 인트로·게이트가 있는 게임(wordfall-cadence · wordsmith-vigil · daily-blitz ·
//       lexicon-detective · lexicon-hands)은 ready 를 게이트 버튼으로 두고 play 안에서
//       "게이트 통과 → 실제 조작 → 반응"까지 민다.
//     * 19종 전부 매 판 랜덤(출제·보기 순서 shuffle)이라 정답을 하드코딩할 수 없다.
//       그래서 반응 단언은 "내가 맞혔다"가 아니라 **"제출이 실제로 채점됐다"** 를 본다
//       (리빌 카드 · 판정 문구 · 진행 카운터). 정오 분기 양쪽을 허용하되, 조작하지 않으면
//       절대 나타나지 않는 마커만 쓴다.
//   - 콘솔 에러/4xx·5xx/pageerror 0 을 게임별로 단언(silent 붕괴 감지)
//   - pirate-quest 만 three.js/R3F — 캔버스 안 마커(.pq-mk)는 헤드리스에서 못 잡으므로
//     window keydown 경로로 조작한다(WebGL 콘솔 노이즈만 제외, 앱 에러는 그대로 실패)
import { test, expect, type Page, type Locator } from '@playwright/test';

import { fetchUserVocabWords, userIdByEmail } from './utils/db';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

const STATE_PATH = 'test-results/.auth-arcade.json';

// 콜드 .next 에서 첫 브라우저 히트는 클라이언트 청크가 404(하이드레이션 실패) → 리로드로 복구되는
// 알려진 dev 경합(04-ui-smoke 계승). 07 을 단독 실행하면 로그인이 첫 히트라 이 경합에 노출되므로
// goto→submit 사이클을 리로드와 함께 재시도한다.
async function loginRuntimeUser(page: Page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const email = page.locator('input[type="email"]');
    try {
      await email.waitFor({ state: 'visible', timeout: 15_000 });
    } catch {
      await page.reload({ waitUntil: 'domcontentloaded' }); // 청크 404 복구
      continue;
    }
    await page.waitForTimeout(1000); // 하이드레이션 — controlled input 리셋 방지
    for (let i = 0; i < 3; i++) {
      await email.fill(RUNTIME_USER.email);
      await page.fill('input[type="password"]', RUNTIME_USER.password);
      if ((await email.inputValue()) === RUNTIME_USER.email) break;
      await page.waitForTimeout(500);
    }
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
      return; // 성공
    } catch {
      // 하이드레이션 미완(콜드 청크) → 리로드 후 재시도
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
  }
  throw new Error('로그인 실패 — 4회 재시도 후에도 리다이렉트 안 됨');
}

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${String(e).slice(0, 200)}`));
  page.on('response', (r) => {
    if (r.status() >= 400 && r.status() !== 404) errors.push(`HTTP ${r.status()} ${r.url().slice(0, 160)}`);
  });
  return errors;
}

/** 환경 노이즈 필터(04-ui-smoke 계승) + WebGL 게임 전용 추가 필터. */
function fatalErrors(errors: string[], webgl = false): string[] {
  let out = errors.filter(
    (e) => !/favicon|404 \(Not Found\)|auth-js|auth\/v1\/token|Failed to fetch|ChunkLoadError/.test(e),
  );
  if (webgl) {
    // 헤드리스 크로미움엔 GPU 가 없어 three/r3f 가 WebGL 컨텍스트·GLTF 로드 에러를 뱉음(환경 노이즈).
    out = out.filter((e) => !/WebGL|THREE|GLTF|glTF|\.glb|fiber|drei|shader|context lost|swiftshader|GPU/i.test(e));
  }
  return out;
}

interface GameSpec {
  slug: string;
  /** true = 내장 캔버스(3D) — 렌더만 검증 */
  webgl?: boolean;
  /** true = localStorage 상태 의존(완료/기록) — 진입 후 초기화·리로드 */
  fresh?: boolean;
  /** 마운트·상호작용 준비 마커(가시 = ready) */
  ready: (p: Page) => Locator;
  /** 첫 입력 + 반응 단언(작동·사용성). 없으면 렌더만. */
  play?: (p: Page) => Promise<void>;
}

const GAMES: GameSpec[] = [
  // ── Cascade: 위 카드의 한국어 뜻에 해당하는 영단어 타일을 짚는다(탭 1회 = 제출) ──
  {
    slug: 'cascade',
    // 보드 타일은 button[data-i] 뿐이다. role=gridcell 만 쓰면 돌 칸/빈 칸(div)을 집어
    // 클릭해도 아무 반응이 없다(CascadeGame.tsx:201-243 · 1234, handleTap 944-947).
    ready: (p) => p.getByRole('grid', { name: '단어 보드' }).locator('button[data-i]').first(),
    play: async (p) => {
      // 정답은 매 판 랜덤(pickTarget 의 Math.random)이라 하드코딩 불가. 게임 wordPool 의
      // en/ko 는 vocabularies.word/meaning 그대로이므로(due-words.ts:67-77) DB 로 역산한다.
      const grid = p.getByRole('grid', { name: '단어 보드' });
      const uid = await userIdByEmail(RUNTIME_USER.email);
      const koToEn = new Map<string, string>(
        (uid ? await fetchUserVocabWords(uid, 40) : []).map(
          (r) => [r.meaning.replace(/\s+/g, ''), r.word] as [string, string],
        ),
      );
      // 프롬프트 ko 뒤에 품사 스팬이 붙을 수 있다(CascadeGame.tsx:1178) → 가장 긴 접두 일치.
      const promptKo = (await p.locator('.cs-prompt-ko').innerText()).replace(/\s+/g, '');
      let want: string | null = null;
      let bestLen = 0;
      for (const [ko, en] of koToEn) {
        if (ko && promptKo.startsWith(ko) && ko.length > bestLen) {
          want = en;
          bestLen = ko.length;
        }
      }
      if (want) {
        // 타일 title 은 정확히 en 하나(CascadeGame.tsx:237) — 정답을 짚는다.
        await grid.locator(`button[data-i][title="${want}"]`).first().click();
        // handleHit 이 clears 를 올린다(823) → HUD 인출 카운터 0/N → 1/N. 단조 증가라 레이스 없음.
        await expect(p.locator('.cs-count-val')).toHaveText(/^1\//);
      } else {
        // SERVICE_ROLE_KEY 가 없어 역산이 불가한 환경. 조작은 동일하게 코어 루프(타일 탭)이고,
        // 그 결과는 '인출 카운터 증가'(정답) 또는 '정답 공개 카드'(오답) 둘 중 하나뿐이다.
        await grid.locator('button[data-i]').first().click();
        await expect
          .poll(
            async () =>
              /^[1-9]/.test((await p.locator('.cs-count-val').innerText()).trim()) ||
              (await p.locator('.cs-answer-en').count()) > 0,
            { timeout: 5_000, message: '타일을 짚었는데 채점이 일어나지 않음' },
          )
          .toBe(true);
      }
    },
  },
  // ── Ghost Race: 한국어 뜻을 보고 영어 철자 타일을 골라 구간을 전진한다 ──
  {
    slug: 'ghost-race',
    fresh: true, // localStorage 누적 랩승·랩타임이 유령 페이스/티어를 바꾼다(vf_ghostrace_v3)
    // grid(카운트다운 1.44초) 이후 racing 에서만 뜬다 — 조작 가능 시점의 마커.
    ready: (p) => p.locator('button.gr-tile').first(),
    play: async (p) => {
      const q = p.locator('h1.gr-meaning');
      const firstKo = (await q.innerText()).trim();
      await p.locator('button.gr-tile').first().click();
      // 제출 전에는 절대 data-open="1" 이 아니다(GhostRaceGame.tsx:1252)
      await expect(p.locator('.gr-reveal[data-open="1"]')).toBeVisible();
      await expect(p.locator('.gr-reveal .gr-reveal-en')).not.toBeEmpty();
      await expect(p.locator('.gr-tile.gk-tile--correct')).toHaveCount(1);
      // 리빌(정답 480ms / 오답 1250ms) 뒤 다음 문항으로 회전 — 풀 6개 이상이면 직전 단어는 재출제 안 됨
      await expect(q).not.toHaveText(firstKo, { timeout: 5_000 });
    },
  },
  // ── Word Economy: 뜻을 보고 종목(영단어)을 체결한다 ──
  {
    slug: 'word-economy',
    ready: (p) => p.getByRole('button', { name: /관망/ }),
    play: async (p) => {
      const tiles = p.locator('.we-tiles button.we-tile');
      await expect(tiles).toHaveCount(4); // min(4, max(2, pool)) — 계정 vocab 10
      await tiles.first().click();
      // 리빌 수명이 1.4~2.6초라 클릭 직후에 바로 단언한다(대기 금지)
      await expect(p.locator('.we-settle')).toBeVisible();
      await expect(p.locator('.we-tiles .gk-tile--correct')).toHaveCount(1);
      await expect(p.locator('.we-delta')).toBeVisible(); // ▲ 정답 체결 / ▼ 오답 운영비
    },
  },
  // ── Wordfall Cadence: 발음(TTS)을 듣고 뜻 타일을 짚는다 ── (오디오 게이트 + 카운트인)
  {
    slug: 'wordfall-cadence',
    ready: (p) => p.getByRole('button', { name: '준비됐어요' }),
    play: async (p) => {
      // 게이트 클릭 전에는 TTS 도 타이머도 돌지 않는다(WordfallCadenceGame.tsx:537, 1192).
      await p.getByRole('button', { name: '준비됐어요' }).click();
      const tiles = p.locator('.wf-tiles .wf-tile');
      // 3박 카운트인(3 × BEAT_MS[0] 640ms ≈ 1.9초) 뒤에야 보드가 뜬다.
      await expect(tiles.first()).toBeVisible({ timeout: 15_000 });
      await expect(tiles).toHaveCount(4); // 열기 0 → TILES[0]=4
      await tiles.first().click();
      // 제출 전에는 화면에 영어 철자가 한 글자도 없다(설계 원칙) → 리빌 자체가 채점의 증거
      await expect(p.locator('.wf-reveal')).toBeVisible();
      await expect(p.locator('.wf-reveal-en')).not.toBeEmpty();
      // 악장 진행 점 1개 점등 — 다음 답까지 유지되는 영속 마커
      await expect(p.locator('.wf-caption .wf-dots i[data-on="1"]')).toHaveCount(1);
    },
  },
  // ── Letter Forge: 트레이의 글자를 집어 가장 왼쪽 빈 슬롯에 꽂는다 ──
  {
    slug: 'letter-forge',
    // .lf-meaning 은 조작 불가한 'ready(벼림 방식 결정)' 단계에도 있다 — 트레이 글자로 잡아야
    // 실제로 배치 가능한 playing 단계를 기다린다(LetterForgeGame.tsx:335 · 514-517).
    ready: (p) => p.getByRole('button', { name: /^글자 [a-z]$/ }).first(),
    play: async (p) => {
      await p.getByRole('button', { name: /^글자 [a-z]$/ }).first().click();
      // 슬롯 라벨이 `1번째 빈칸` → `1번째 글자 x — 눌러서 빼기` 로 바뀐다(:295-296)
      await expect(p.getByRole('button', { name: /^1번째 글자 [a-z]/ })).toBeVisible();
      await expect(p.locator('.lf-key--used').first()).toBeVisible();
    },
  },
  // ── Wordsmith Vigil: 뜻만 보고 영어 철자를 떠올려 붓으로 친다 ── (인트로 게이트)
  {
    slug: 'wordsmith-vigil',
    ready: (p) => p.getByRole('button', { name: '촛불 켜기' }),
    play: async (p) => {
      await p.getByRole('button', { name: '촛불 켜기' }).click();
      // 첫 정령 스폰 + 자동 조준이 끝나야 기름이 enabled 가 된다(:1352)
      const oil = p.getByRole('button', { name: /^기름 \d+병/ });
      await expect(oil).toBeEnabled({ timeout: 10_000 });
      await expect(p.locator('.wv-wisp--on')).toBeVisible();
      // 철자는 화면 어디에도 없다(칸 수만). 유일한 in-DOM 오라클 = 게임 내 힌트 '기름'(:747).
      const sr = p.locator('.gk-sr'); // clip 처리 sr-only → textContent 로 읽는다
      await oil.click();
      await expect(sr).toHaveText(/^기름 · /);
      const en = ((await sr.textContent()) ?? '')
        .replace(/^기름\s*·\s*/, '')
        .toLowerCase()
        .replace(/[^a-z]/g, '');
      expect(en.length, '기름 힌트에서 철자를 못 읽음').toBeGreaterThan(1);
      // 조준된 정령의 철자를 붓 바에 그대로 쓰고 Enter 로 확정(한글 IME 는 통째로 무시된다)
      const quill = p.locator('input.wv-quill');
      // 붓 바가 포커스를 잃으면 게임이 '탭하여 계속 쓰기' 오버레이를 덮어 입력을 막는다
      // (v07.8 에서 모바일 IME 이탈 대응으로 추가된 의도된 동작). 오일 힌트 버튼을 누른
      // 직후가 정확히 그 상태라, 오버레이를 먼저 걷어내지 않으면 클릭이 가로채인다.
      const refocus = p.locator('button.wv-refocus');
      if (await refocus.isVisible().catch(() => false)) await refocus.click();
      await quill.click();
      await quill.pressSequentially(en, { delay: 20 });
      await quill.press('Enter');
      await expect(sr).toHaveText(/^격파 ·/); // dispel() :558
      await expect(p.locator('.wv-score')).not.toHaveText('0'); // gain = max(10, …) :526-529
    },
  },
  // ── Morphmerge: 뜻을 보고 그 낱말의 형태 타일을 골라 용광로에 합친다 ──
  {
    slug: 'morphmerge',
    ready: (p) => p.getByRole('group', { name: '형태 타일' }).getByRole('button').first(),
    play: async (p) => {
      const board = p.getByRole('group', { name: '형태 타일' });
      const merge = p.getByRole('button', { name: /합치기/ });
      await expect(merge).toBeDisabled(); // 선택 전에는 제출 불가
      await board.getByRole('button').first().click();
      await expect(merge).toHaveText(/합치기 1\/\d/); // '부분 합치기 1/N' 도 포함
      await merge.click();
      // idle 판정줄에는 <em> 이 없다(941-947) → em 등장 = 제출이 실제로 채점됐다는 확증
      await expect(p.locator('.mm-verdict-forms em')).toBeVisible();
    },
  },
  // ── Daily Blitz: 뜻을 떠올린 뒤 선택지를 열어 4~6지선다를 제출한다 ── (인트로 게이트)
  {
    slug: 'daily-blitz',
    fresh: true, // 오늘 기록이 남아 있으면 시작 버튼 라벨이 '다시 도전'으로 바뀐다
    ready: (p) => p.getByRole('button', { name: /오늘의 챌린지 시작|다시 도전/ }),
    play: async (p) => {
      await p.getByRole('button', { name: /오늘의 챌린지 시작|다시 도전/ }).click();
      await expect(p.locator('.db-meaning')).toBeVisible();
      // ★ 시작 직후에는 .db-tile 이 없다 — stage='decide' 를 먼저 통과해야 한다(:326-333).
      //   버튼 접근 이름에 Kbd 텍스트가 섞이므로 부분 매치가 필요하다.
      await p.getByRole('button', { name: /선택지 보기/ }).click();
      const tiles = p.locator('.db-tile');
      await expect(tiles.first()).toBeVisible();
      await tiles.first().click();
      // 950~1600ms 뒤 자동으로 다음 문항 — 리빌 단언을 지연시키지 말 것
      await expect(p.locator('.gk-tile--correct').first()).toBeVisible();
      await expect(p.locator('.db-reveal-en')).toBeVisible();
      // 영속 마커 — 리빌이 사라져도 남는 진행 카운터(:987-989)
      await expect(p.locator('p.gk-sr').filter({ hasText: '문항 완료' })).toContainText('1문항 완료');
    },
  },
  // ── Connections: 뜻 타일 4칸을 묶어 숨은 규칙을 제출한다 ──
  {
    slug: 'connections',
    ready: (p) => p.getByRole('button', { name: /확인 \(\d\/4\)/ }),
    play: async (p) => {
      const tiles = p.locator('.cn-grid button.cn-tile');
      await expect(tiles.nth(3)).toBeVisible(); // 보드는 풀 크기의 함수(최소 8칸)
      for (let i = 0; i < 4; i++) await tiles.nth(i).click();
      await expect(tiles.nth(0)).toHaveAttribute('aria-pressed', 'true');
      const submit = p.getByRole('button', { name: /확인 \(4\/4\)/ });
      await expect(submit).toBeEnabled();
      await submit.click(); // 기회 4개 — 제출은 1회만 한다
      // msg 는 마운트 시 '' 였다가 submit 의 3분기에서만 채워진다(:570-574 / :601 / :605)
      await expect(p.locator('.gk-sr')).toHaveText(/규칙 확정|세 개는 같은 규칙이에요|이 조합은 아니에요/);
    },
  },
  // ── Glyph Tongue: 뜻 칩을 손에 들고 룬 카드에 이어 붙인 뒤 봉인한다(2-탭) ──
  {
    slug: 'glyph-tongue',
    ready: (p) => p.getByRole('group', { name: '코덱스' }).getByRole('button').first(),
    play: async (p) => {
      const card = p.getByRole('group', { name: '코덱스' }).getByRole('button').first();
      await p.getByRole('group', { name: '뜻 후보' }).getByRole('button').first().click();
      await card.click();
      // 카드 라벨 '· 뜻 미지정' → '· 가설 <뜻>'(:365-369), 그리고 봉인이 열린다(:1096)
      await expect(card).toHaveAttribute('aria-label', /가설/);
      const seal = p.getByRole('button', { name: /봉인/ });
      await expect(seal).toBeEnabled();
      await seal.click();
      // sealMsg 는 초기값 '' — 문구 등장 자체가 채점의 증거(정오 양쪽 허용, :694-701)
      await expect(p.locator('.gt-sealmsg')).toHaveText(/문맥과 맞았어요|어긋나요/);
    },
  },
  // ── Word Customs: 입국 서류를 규칙서와 대조해 승인/거부 도장을 찍는다 ──
  {
    slug: 'word-customs',
    ready: (p) => p.getByRole('button', { name: /승인/ }),
    play: async (p) => {
      const approve = p.getByRole('button', { name: /승인/ });
      const serial = p.locator('.wc-doc-serial');
      const before = (await serial.innerText()).trim();
      // ARM_DELAY_MS=250 무장 지연 — 그 전 클릭은 조용히 무시된다(:102, armed() :765)
      await p.waitForTimeout(400);
      await approve.click();
      // '정확'은 1.05초 뒤 자동 진행, '오심/항목 오인'은 판정이 남는다 → 두 분기 모두에서
      // 영속적인 신호는 processed 증가(HUD 진행바가 0 을 벗어남)와 '판정 또는 다음 서류'.
      await expect(p.locator('.gk-progress-fill')).not.toHaveCSS('width', '0px');
      await expect
        .poll(
          async () =>
            (await p.locator('.wc-verdict').count()) > 0 ||
            (await serial.innerText()).trim() !== before,
          { timeout: 5_000, message: '도장을 찍었는데 판정도 서류 교체도 없음' },
        )
        .toBe(true);
    },
  },
  // ── Morpheme Rules: 접두사 + 어근을 조립대에 놓고 '발동'으로 판정을 받는다 ──
  {
    slug: 'morpheme-rules',
    ready: (p) => p.getByRole('group', { name: '이 회랑의 봉인' }),
    play: async (p) => {
      // '확신 발동' 은 aria-label 이 달라 ^발동 정규식에서 빠진다
      const cast = p.getByRole('button', { name: /^발동/ });
      await expect(cast).toBeDisabled(); // 두 슬롯이 비어 있으므로
      await p.getByRole('button', { name: /^접두사 / }).first().click();
      await p.getByRole('button', { name: /^어근 / }).first().click();
      await expect(p.locator('.mr-slot[data-kind="pre"][data-on="1"]')).toBeVisible();
      await expect(p.locator('.mr-out[data-on="1"]')).toHaveText(/^[a-z]+$/);
      await expect(cast).toBeEnabled();
      await cast.click();
      // 정답을 DOM 에서 알 수 없으므로(설계 의도) 판정 '종류'가 아니라 판정이 났음을 본다.
      // .mr-flash 는 부모가 aria-hidden 이라 getByRole 로는 안 잡힌다 → CSS 로케이터.
      await expect(p.locator('.mr-flash')).toHaveAttribute('data-kind', /correct|near|wrong/);
      // 원장 칩은 세 분기 모두에서 1개 추가된다(addLedger :412 / :439 / :484) — 영속 마커
      await expect(p.getByRole('group', { name: '이 회랑에서 판명된 조합' })).toBeVisible();
      await expect(p.locator('.mr-chip')).toHaveCount(1);
    },
  },
  // ── The Silent Rule: 규칙에 맞는 칸을 밝히고 문당 단 한 번 '판정 확정' 한다 ──
  {
    slug: 'silent-rule',
    ready: (p) => p.getByRole('button', { name: '판정 확정' }),
    play: async (p) => {
      const tiles = p.locator('.sr-grid button.sr-panel');
      await expect(tiles.first()).toBeVisible();
      // 첫 타일 클릭이 120초 시계를 시작시킨다(:314-322) — 그 전에는 무한 대기해도 안전
      await tiles.first().click();
      await expect(p.locator('.sr-count')).toHaveText('1칸 선택');
      await expect(tiles.first()).toHaveAttribute('aria-pressed', 'true');
      await p.getByRole('button', { name: '판정 확정' }).click();
      // verdict 화면 — kind 무관하게 항상 나온다(:671, :688-691)
      await expect(p.locator('.sr-verdict-head')).toBeVisible();
      await expect(p.getByRole('button', { name: /넘어간다/ })).toBeVisible();
    },
  },
  // ── Lexicon Hands: 한국어 뜻 주문 슬롯 위에 손패의 영단어 카드를 올린다 ── (인라인 인트로)
  {
    slug: 'lexicon-hands',
    ready: (p) => p.getByRole('button', { name: /계약 시작/ }),
    play: async (p) => {
      // 인트로를 닫는 순간부터 150초 납기가 돈다(:505)
      await p.getByRole('button', { name: /계약 시작/ }).click();
      await expect(p.getByRole('button', { name: /계약 시작/ })).toHaveCount(0);
      // 손패 카드 aria-label = `${en}, 칩 ${chips}` (:1291-1296) — 단어는 매판 셔플
      const card = p.getByRole('button', { name: /, 칩 \d+$/ }).first();
      const en = ((await card.getAttribute('aria-label')) ?? '').split(',')[0];
      await card.click();
      // 슬롯 라벨이 '비어 있음' → '올린 카드 <en>' 으로 바뀐다(:1205)
      await expect(p.getByRole('button', { name: new RegExp(`올린 카드 ${en}\\.`) })).toBeVisible();
      await expect(p.getByRole('button', { name: /주문에 올림/ })).toHaveAttribute('aria-pressed', 'true');
      await expect(p.locator('.lh-prev')).toContainText('단품'); // BUNDLE_LABEL[1]
      await expect(p.getByRole('button', { name: /^납품 1장/ })).toBeEnabled();
      // 여기서 실제 '납품'까지 밀지 않는 이유: 오답 묶음은 검수(lives)를 깎고 3회면 판이 끝난다.
      // 정답을 알 수 없는 스모크에서 카드를 슬롯에 올리는 것이 이 게임의 핵심 조작이다.
    },
  },
  // ── Lexicon Detective: 증거 봉투를 열어 단어를 확인하고 조서 진술에 끼운다 ── (브리핑 게이트)
  {
    slug: 'lexicon-detective',
    ready: (p) => p.getByRole('button', { name: '사건철 열기' }),
    play: async (p) => {
      await p.getByRole('button', { name: '사건철 열기' }).click();
      const hud = p.locator('.ld-hud-v');
      const preserveBefore = (await hud.innerText()).trim(); // '보존 8/8' (봉투 수는 풀에 따라 변동)
      const env = p.getByRole('group', { name: '증거 봉투' }).getByRole('button').first();
      await env.click(); // openEnvelope() — 단어 공개 + 보존도 1 소모 + 손에 듦
      await expect(env).toHaveAttribute('aria-pressed', 'true');
      await expect(hud).not.toHaveText(preserveBefore);
      // 손에 든 단어를 1번 진술에 끼운다 → 그 전까지 disabled 였던 '확정'이 열린다
      await expect(p.getByRole('button', { name: '진술 1 확정' })).toBeDisabled();
      await p.getByRole('button', { name: /^진술 1 — 비어 있음/ }).click();
      await expect(p.getByRole('button', { name: /^진술 1 — .+ 배치됨/ })).toBeVisible();
      await expect(p.getByRole('button', { name: '진술 1 확정' })).toBeEnabled();
    },
  },
  // ── Lexicon Estate: 방 카드를 감정(4지선다 인출)하고 도면 빈 터에 짓는다 ──
  {
    slug: 'lexicon-estate',
    ready: (p) => p.getByRole('button', { name: /감정하기$/ }).first(),
    play: async (p) => {
      await expect(p.getByRole('group', { name: /도면$/ })).toBeVisible();
      await p.getByRole('button', { name: /감정하기$/ }).first().click();
      // 카드가 인출 화면으로 바뀐다(holdCard → .le-appraise, 1110-1123)
      await expect(p.getByText('의 뜻은?')).toBeVisible();
      await expect(p.locator('.le-opt')).toHaveCount(4);
      // 정답/오답 무관하게 배치 단계가 열린다(setPending 3분기 :701 / :719 / :734)
      await p.locator('.le-opt').first().click();
      await expect(p.locator('.le-place')).toBeVisible();
      // 도면 셀은 disabled 가 아니라 aria-disabled 라 '아무 버튼이나 눌러 통과'가 되는 지점이다
      // — 감정 → 배치 순서를 지켜야만 방이 실제로 지어진다(place() 조기 return :794).
      await p.getByRole('button', { name: /^빈 터 \d/ }).first().click();
      await expect(p.locator('.le-cell--room')).toHaveCount(1);
    },
  },
  // ── Word Orrery: 행성을 열어 영어 신호를 받고 의미 후보에서 뜻을 고른다 ──
  {
    slug: 'word-orrery',
    ready: (p) => p.getByRole('group', { name: '항성계 지도' }).getByRole('button', { name: /미관측$/ }).first(),
    play: async (p) => {
      const map = p.getByRole('group', { name: '항성계 지도' });
      // 태양(.wo-sun)은 절대 누르지 않는다 — 핵에 들어가면 즉시 카운트다운이 시작된다.
      await map.getByRole('button', { name: /미관측$/ }).first().click();
      const choices = p.getByRole('group', { name: '의미 후보' });
      await expect(choices).toBeVisible();
      await choices.getByRole('button').first().click();
      // 판정 리빌 — 정합/흐림 어느 쪽이든 반드시 나온다(1008-1019)
      await expect(p.locator('.wo-verdict')).toHaveText(/정합|흐림/);
      await expect(p.locator('.wo-obs-en')).toBeVisible();
      await expect(p.getByRole('button', { name: '성계로 돌아가기' })).toBeVisible();
      // HUD 관측 카운터 0/N → 1/N (영속 마커)
      await expect(p.locator('.wo-hud-v')).toHaveText(/^1\//);
    },
  },
  // ── WordBlitz: 뜻 → 단어 인출 1발을 타일로 제출한다 ──
  {
    slug: 'wordblitz',
    ready: (p) => p.getByRole('group', { name: /단어 선택|뜻 선택/ }),
    play: async (p) => {
      const board = p.getByRole('group', { name: /단어 선택|뜻 선택/ });
      const tiles = board.getByRole('button');
      await expect(tiles).toHaveCount(4); // 0단계 기본 4지선다
      await expect(p.getByRole('progressbar', { name: '이번 발 남은 시간' })).toBeVisible();
      // 세션 셸도 h1(게임명)을 그린다 — level:1 만으로는 strict mode 위반(2개 매치).
      const prompt = p.locator('h1.wbz-prompt-text');
      const before = (await prompt.innerText()).trim();
      await tiles.first().click();
      // 제출 즉시 리빌 — 정답 타일이 정확히 하나 표시된다(내가 맞혔는지와 무관하게 결정적)
      await expect(p.locator('.wbz-tile--correct')).toHaveCount(1);
      await expect(p.locator('.wbz-tile--correct').getByRole('img', { name: '정답' })).toBeVisible();
      await expect(p.getByRole('status')).toContainText(/정답|오답|시간 초과/);
      // 리빌(정답 620ms / 오답 1700ms) 뒤 다음 발 — 루프가 한 바퀴 돈다
      await expect(p.locator('.wbz-tile--correct')).toHaveCount(0, { timeout: 5_000 });
      await expect(p.locator('h1.wbz-prompt-text')).not.toHaveText(before, { timeout: 5_000 });
    },
  },
  // ── Pirate's Bounty: 자리를 외운 뒤 불린 뜻의 보물을 그 자리에서 회수한다 ── (R3F 3D)
  {
    slug: 'pirate-quest',
    webgl: true,
    // 에셋 게이트(.pq-gate.pq-intro)는 클릭이 아니라 로더/12초 안전망으로 스스로 열린다
    // (PirateQuestGame.tsx:297-309) → scan 2.64초 → haul. haul 이 곧 '조작 가능' 시점이다.
    ready: (p) => p.locator('.pq-deck[data-phase="haul"]'),
    play: async (p) => {
      const deck = p.locator('.pq-deck');
      await expect(p.locator('.pq-ask')).not.toBeEmpty(); // 한국어 뜻이 실제로 불렸다
      // 마커 버튼(.pq-mk)은 캔버스 안 drei <Html> 이라 헤드리스에서 못 잡는다 → window keydown.
      await p.keyboard.press('1');
      // 정답이면 choice("회수 성공"), 오답이면 recall("자리는 빗나갔어요") — 어느 쪽이든 채점됐다.
      await expect(p.getByText(/회수 성공|자리는 빗나갔어요/)).toBeVisible({ timeout: 3_000 });
      await expect(deck).not.toHaveAttribute('data-phase', 'haul', { timeout: 5_000 });
    },
  },
];

test.describe('아케이드 게임 전수 스모크', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000); // 콜드 서버에서 로그인 리로드 재시도 여유
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('Game Lab 허브 — 3구역 + 오늘의 실험 + 전 카드 딥링크 무결성', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    // v08.3 — "아케이드" → Game Lab(연구소 은유 + 영문 구조 라벨).
    await expect(page.getByRole('heading', { name: 'Game Lab', exact: true })).toBeVisible({ timeout: 30_000 });

    // IA v07.8 축(학습 동사) 유지 · v08.3 에서 구역(Bay) 으로 명명.
    // 이전 축(내 단어 / 큐레이션 세계)은 죽었다: 19종 전부가 학습자 단어를 쓰게 되면서
    // 한쪽 섹션이 비었고, pickDailyGame 이 빈 후보로 크래시하는 경로까지 생겼다.
    await expect(page.locator('.arc-daily-card')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Recall Bay/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Synthesis Bay/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Inference Bay/ })).toBeVisible();
    // 빈 트랙이 생기면 죽은 헤딩이 남는다 — 섹션마다 카드가 최소 1장.
    for (const id of ['recall', 'produce', 'reason']) {
      const sec = page.locator(`section[aria-labelledby="arc-sec-${id}"]`);
      expect(await sec.locator('a[href^="/play/"]').count(), `${id} 트랙이 비었다`).toBeGreaterThan(0);
    }

    // 계열 접기(v07.4) 이후 카드 수 ≠ 게임 수 — 도달 가능한 플레이 링크로 센다.
    // (단독 게임은 카드 자체가 링크, 계열은 카드 안 모드 칩이 링크)
    const links = page.locator('.arc-grid a[href^="/play/"]');
    await expect(links.first()).toBeVisible({ timeout: 10_000 });
    expect(await links.count()).toBeGreaterThanOrEqual(19);
    // 각 링크가 /play/<slug> 로 연결되는지. from 은 URLSearchParams 인코딩(%2F) — 양쪽 허용.
    for (const href of await links.evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute('href')))) {
      expect(href).toMatch(/^\/play\/[a-z-]+\?from=(\/|%2F)arcade$/);
    }
    // 오늘의 추천도 실제 게임으로 연결돼야 한다(빈 CTA 방지)
    const dailyHref = await page.locator('.arc-daily-card').getAttribute('href');
    expect(dailyHref).toMatch(/^\/play\/[a-z-]+\?from=(\/|%2F)arcade$/);

    const fatal = fatalErrors(errors);
    expect(fatal, `[arcade] console: ${fatal.join(' | ')}`).toHaveLength(0);
  });

  for (const g of GAMES) {
    test(`${g.slug} — 마운트 + ${g.play ? '첫 입력 반응' : '렌더'} · 콘솔 에러 0`, async ({ page }) => {
      // dev 콜드 컴파일이 라우트마다 수초 소요 가능. pirate-quest 는 R3F 청크 + 에셋
      // 게이트(로더 실패 시 12초 안전망) + scan 2.6초가 더 붙는다.
      test.setTimeout(g.webgl ? 120_000 : 60_000);
      const errors = collectConsoleErrors(page);

      await page.goto(`/play/${g.slug}?from=/arcade`, { waitUntil: 'domcontentloaded' });

      if (g.fresh) {
        // 완료/최고기록 localStorage 를 비워 결정론적 초기 상태로 리로드.
        // (daily-blitz STORE_KEY 'vf_dailyblitz_v2' + LEGACY 'v1' — 오늘 기록이 있으면
        //  시작 버튼이 '다시 도전'으로 바뀐다. ghost-race STORE_KEY 는 v07 재설계에서
        //  'vf_ghostrace_v3' 로 바뀌었고 누적 랩타임이 유령 페이스·티어를 흔든다.
        //  usePersonalBest 는 별도 'vocaflow-best-<key>' 네임스페이스를 쓴다.)
        await page.evaluate(() => {
          try {
            for (const k of [
              'vf_dailyblitz_v1',
              'vf_dailyblitz_v2',
              'vf_ghostrace_v1',
              'vf_ghostrace_v3',
              'vocaflow-best-daily-blitz-score',
              'vocaflow-best-ghost-race-lap',
            ]) {
              localStorage.removeItem(k);
            }
          } catch {
            /* SecurityError 등 무시 */
          }
        });
        await page.reload({ waitUntil: 'domcontentloaded' });
      }

      // 마운트/준비(로딩 스피너 해소 포함 — Playwright auto-wait).
      // 콜드 청크 404(하이드레이션 실패)면 준비 마커가 안 뜨므로 1회 리로드로 복구.
      try {
        await expect(g.ready(page)).toBeVisible({ timeout: 30_000 });
      } catch {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(g.ready(page)).toBeVisible({ timeout: 30_000 });
      }
      // 에러 바운더리/404 감지
      await expect(page.getByText(/문제가 발생했어요|problem occurred|페이지를 찾을 수 없어요/)).toHaveCount(0);

      // 배경음악 컨트롤 — 존재 + 좌하단 fixed 배치.
      //   BGM 14곡을 붙여놓고도 아무도 못 들은 이유가 여기 있었다: .gk-root/.wbz-root 의
      //   `> :not(...)` 규칙(명시도 우위)이 .gk-music-btn 의 position:fixed 를 덮어써
      //   버튼이 게임 상단 흐름에 전체 너비로 박혀 있었고, 음악 컨트롤로 보이지 않았다.
      const music = page.locator('.gk-music-btn');
      await expect(music, `[${g.slug}] 배경음악 버튼 없음`).toBeVisible({ timeout: 15_000 });
      const mBox = await music.boundingBox();
      const vh = page.viewportSize()?.height ?? 720;
      expect(await music.evaluate((el) => getComputedStyle(el).position), `[${g.slug}] 음악 버튼 position`).toBe('fixed');
      expect(vh - (mBox!.y + mBox!.height), `[${g.slug}] 음악 버튼이 좌하단이 아님`).toBeLessThanOrEqual(24);
      expect(mBox!.width, `[${g.slug}] 음악 버튼이 전체 너비로 퍼짐(레이아웃 붕괴)`).toBeLessThan(240);

      // 첫 입력 → 반응(작동·사용성)
      if (g.play) await g.play(page);

      const fatal = fatalErrors(errors, g.webgl);
      if (g.webgl) {
        // WebGL 환경 노이즈만 제외하고 그 외 앱 에러는 여전히 실패로 처리
        expect(fatal, `[${g.slug}] console: ${fatal.join(' | ')}`).toHaveLength(0);
      } else {
        expect(fatal, `[${g.slug}] console: ${fatal.join(' | ')}`).toHaveLength(0);
      }
    });
  }

  // v07.4 회귀 — 아케이드에서 스코프 없이 연 mine 게임이 하드코딩 DEFAULT_POOL 로 조용히
  // 돌아가던 결함(내 단어 미사용 → recordGameResult silent skip → FSRS 무반영)의 재발 차단.
  // 브레드크럼 라벨 + 실제 제시된 뜻이 내 단어장 소속인지 2중으로 단언한다.
  test('비스코프 진입 — mine 게임이 내 복습 단어를 쓴다 (FSRS 연동 회귀)', async ({ page }) => {
    test.setTimeout(60_000);
    const userId = await userIdByEmail(RUNTIME_USER.email);
    test.skip(!userId, 'SERVICE_ROLE_KEY 없음 — DB 단언 불가');
    const mine = await fetchUserVocabWords(userId as string);
    test.skip(mine.length < 4, `due 단어 ${mine.length}개 — ghost-race minWords 4 미달`);

    await page.goto('/play/ghost-race?from=/arcade', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      try {
        localStorage.removeItem('vf_ghostrace_v1');
        localStorage.removeItem('vf_ghostrace_v3'); // v07 재설계에서 바뀐 현행 키
      } catch {
        /* SecurityError 무시 */
      }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });

    // ① 세션 셸 브레드크럼 — mine 스코프가 실제로 해석됐다(맛보기 폴백 아님)
    await expect(page.getByText('내 복습 단어')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('맛보기 단어')).toHaveCount(0);

    // ② 제시된 뜻이 내 단어장 소속 — 내장 DEFAULT_POOL 이면 여기서 실패한다
    await expect(page.locator('.gr-meaning')).toBeVisible({ timeout: 15_000 });
    const shown = (await page.locator('.gr-meaning').first().innerText()).trim();
    expect(
      mine.map((w) => w.meaning),
      `제시된 뜻 "${shown}" 이 사용자 단어장에 없음 — DEFAULT_POOL 회귀 의심`,
    ).toContain(shown);
  });
});
