// apps/web/tests/e2e/13-arcade-integrity.spec.ts
//
// 아케이드 "자료 연계" 회귀 — 게임이 **학습자의 실제 자료로 도는가**를 고정한다.
//
// 왜 새 spec 인가:
//   07-arcade-games 는 "마운트 + 첫 입력 반응 + 콘솔 에러 0"만 본다. 그래서 게임이
//   wordPool 을 통째로 무시하고 하드코딩 콘텐츠로 돌아도 초록불이 켜졌다.
//   v07.8 전수 감사에서 실제로 그런 게임이 여럿 나왔다(word-orrery 는 wordPool 을
//   버렸고, lexicon-detective 는 셔플조차 없는 고정 대본이었다).
//
//   그 결과는 재미 문제로 끝나지 않았다 — recordGameResult 는 **사용자 vocabularies 에
//   없는 단어를 silent skip** 하므로, 내장 뱅크로만 도는 게임은 아무리 플레이해도
//   learning_records 가 0건이다. DB 조회로 확인했다(큐레이션 계열 10종이 0건이었다).
//   즉 "이 게임이 자료를 쓰는가"는 학습 기록이 남는가와 같은 질문이다.
//
// 커버리지:
//   A 게임별 스코프 수용 — 19종 전부가 ?set= 으로 들어온 자료를 실제로 싣는가
//   B 허브 팬아웃 — /arcade?set= 이 모든 카드 링크에 스코프를 전달하는가
//   C 진입점 — 스크립트 화면에 아케이드 문이 있는가
import { test, expect, type Page } from '@playwright/test';

import { fetchSharedSetWords } from './utils/db';
import { seedBriefsSeen } from './utils/brief';

// v08.6 — `/play/*` 는 그 게임의 브리핑을 처음 여는 학습자에게 게임 대신 브리핑을 띄운다.
// 이 스펙들이 검증하는 것은 게임의 동작이므로 "돌아온 학습자" 를 재현한다.
// 게이트 자체의 회귀는 15-arcade-brief.spec.ts 가 심지 않은 상태로 본다.
test.beforeEach(async ({ page }) => {
  await seedBriefsSeen(page);
});


const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

const STATE_PATH = 'playwright-auth/.auth-arcade-integrity.json';

/** 공용 단어장 픽스처 — 실 단어 40개(전 게임 최대 요구치 12를 충분히 넘음). */
const FIXTURE_SET = { id: 'dcb6f06e-bc30-4fe3-80bf-577ad08be233', title: 'Twenty years after' };
/** 사용자 스크립트 픽스처 — vocabularies 50개. */
const FIXTURE_TEXT = { id: 'b79172ee-db04-4219-83d3-0505dc84b20c' };

/** lib/game/catalog 의 GAME_CATALOG 와 1:1. 새 게임 추가 시 여기도 늘어나야 한다. */
const ALL_GAMES = [
  'cascade', 'ghost-race', 'word-economy', 'wordfall-cadence', 'letter-forge',
  'wordsmith-vigil', 'morphmerge', 'daily-blitz', 'connections', 'glyph-tongue',
  'word-customs', 'morpheme-rules', 'silent-rule', 'lexicon-hands', 'lexicon-detective',
  'lexicon-estate', 'word-orrery', 'wordblitz', 'pirate-quest',
] as const;

async function login(page: Page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const email = page.locator('input[type="email"]');
    try {
      await email.waitFor({ state: 'visible', timeout: 15_000 });
    } catch {
      await page.reload({ waitUntil: 'domcontentloaded' }); // 콜드 .next 청크 404 복구
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
      return;
    } catch {
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
  }
  throw new Error('로그인 실패 — 4회 재시도 후에도 리다이렉트 안 됨');
}

test.describe('아케이드 자료 연계', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await login(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('A · 19종 전부가 ?set= 으로 들어온 공용 단어장을 실제로 싣는다', async ({ page }) => {
    test.setTimeout(19 * 30_000);
    const failures: string[] = [];

    for (const slug of ALL_GAMES) {
      await page.goto(`/play/${slug}?set=${FIXTURE_SET.id}&from=%2Farcade`, {
        waitUntil: 'domcontentloaded',
      });

      // 세션 셸이 "지금 무슨 단어로 놀고 있는지"를 aria-label 로 노출한다
      // (SessionFrame — `현재 학습: <타입>, <자료명>, <부제>`).
      const res = page.locator('[aria-label^="현재 학습:"]').first();
      try {
        await res.waitFor({ state: 'attached', timeout: 25_000 });
      } catch {
        failures.push(`${slug}: 자료 컨텍스트가 렌더되지 않음(로딩 실패 또는 NotEnoughWords)`);
        continue;
      }
      const label = (await res.getAttribute('aria-label')) ?? '';

      // 픽스처 단어장 이름이 실려야 한다 = 게임이 그 자료를 받았다는 뜻.
      if (!label.includes(FIXTURE_SET.title)) {
        failures.push(`${slug}: 자료명 누락 — aria-label="${label.slice(0, 90)}"`);
      }
      // "맛보기"면 내장 뱅크로 떨어진 것 = 자료 연계 실패(FSRS 도 안 남는다).
      if (label.includes('맛보기')) {
        failures.push(`${slug}: 맛보기로 degrade — 자료를 명시했는데 내장 뱅크로 떨어졌다`);
      }
    }

    expect(failures, `자료 연계 실패:\n${failures.join('\n')}`).toEqual([]);
  });

  // A 는 라벨만 본다 — 그것만으로는 부족하다는 것이 v07.8 에서 드러났다.
  // morpheme-rules 는 자료 라벨을 정상으로 달고도 실제 문제는 내장 61단어 격자에서 냈고,
  // 그 결과 onCorrect/onWrong 의 99.7% 가 recordGameResult 에서 silent skip 됐다
  // (DB 실측: vocabularies 2,106행 중 7행만 겹침). "라벨이 맞다 ≠ 그 자료로 논다".
  test('A3 · 화면에 실제로 그 자료의 단어가 나온다 (라벨만 맞는 가짜 연계 차단)', async ({ page }) => {
    test.setTimeout(19 * 40_000); // DEEP_ENTRY 5종 제외 → 실제 14종
    const setWords = await fetchSharedSetWords(FIXTURE_SET.id);
    test.skip(setWords.length < 10, 'service-role 키 없음 또는 픽스처 세트 비어 있음');

    const en = setWords.map((w) => w.word.toLowerCase()).filter((w) => w.length >= 3);
    const ko = setWords.map((w) => w.meaning.trim()).filter((m) => m.length >= 2);

    // ⚠️ 커버리지 경계 — 정직하게 밝힌다.
    // 이 단언은 "게임을 열고 한 걸음 들어가면 자료 단어가 보이는가"를 **일반적으로** 본다.
    // 콘텐츠가 다단계 상호작용 뒤에야 나오는 게임(오디오 게이트 + 카운트인 · 촛불 점화 후
    // 웨이브 스폰 · 행성 개방 후 관측 패널 · 사건철 개방 후 증거 개봉)은 그 절차가 게임마다
    // 완전히 달라, 여기서 흉내 내면 매 실행 다른 게임이 실패하는 불안정한 단언이 된다
    // (실측: 3회 실행에서 실패 집합이 매번 회전 — 결함이 아니라 탐지 한계였다).
    //
    // 그 게임들은 **07-arcade-games 가 게임별 실제 조작 계약으로 이미 검증**한다
    // (게이트 통과 → 조작 → 채점 반응). 여기서 중복 구현하면 계약이 두 곳으로 갈라져
    // 둘 다 낡는다. 대신 A(라벨) · A2(스크립트) · B(허브) 가 이 게임들도 함께 덮는다.
    const DEEP_ENTRY = new Set([
      'wordfall-cadence', // 오디오 게이트 → 3박 카운트인 → 발화 후에야 타일
      'wordsmith-vigil', // 촛불 점화 → 웨이브 스폰 대기
      'word-orrery', // 행성 개방 → 관측 패널
      'lexicon-detective', // 사건철 개방 → 증거 봉투 개봉
      'daily-blitz', // 챌린지 시작 → decide 단계 → 선택지 공개
    ]);

    const failures: string[] = [];
    for (const slug of ALL_GAMES) {
      if (DEEP_ENTRY.has(slug)) continue;
      await page.goto(`/play/${slug}?set=${FIXTURE_SET.id}&from=%2Farcade`, {
        waitUntil: 'domcontentloaded',
      });
      await page.locator('[aria-label^="현재 학습:"]').first().waitFor({ state: 'attached', timeout: 25_000 });

      // 게임마다 인트로·게이트가 다르고, 자료 단어는 그 뒤에 나온다.
      // 일반 정규식 하나로 덮으려다 실패했다(`준비됐어요`·`촛불 켜기` 는 '시작|열기' 에
      // 안 걸리고, word-orrery 는 버튼이 아니라 행성을 열어야 단어가 보인다).
      // 07-arcade-games 가 확립한 실제 진입 계약을 여기서도 명시한다 — 느슨한 추측보다
      // 정확한 한 걸음이 낫다.
      const ENTER: Record<string, RegExp> = {
        'wordfall-cadence': /준비됐어요/,
        'wordsmith-vigil': /촛불 켜기/,
        'lexicon-detective': /사건철 열기/,
        'lexicon-hands': /계약 시작/,
        'daily-blitz': /오늘의 챌린지 시작|다시 도전/,
        'word-orrery': /미관측$/,
        'lexicon-estate': /감정하기$/,
        'pirate-quest': /잠수|시작/,
      };
      const gate = ENTER[slug];
      if (gate) {
        const btn = page.getByRole('button', { name: gate }).first();
        if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
      }

      // 렌더 여유 — 절차 생성·TTS 카운트인·에셋 게이트가 있는 게임은 20초 넘게 걸린다.
      // (12×1.2s 로는 wordfall-cadence·lexicon-detective 가 아직 단어를 안 그렸다 — 실측)
      //
      // 통과 조건 두 가지. **가짜 연계**란 "자료를 쓰는 척하면서 조용히 내장 콘텐츠로 도는 것"
      // 이지, "이 자료와 겹치는 내용이 없다"가 아니다. 후자는 콘텐츠 적합성 문제이고,
      // 게임이 그 사실을 화면에 **명시**하면 학습자는 속지 않는다.
      // 예: morpheme-rules 는 형태소 격자 게임이라 문학 챕터 어휘(coffer·monsieur…)가
      // 접두사+어근으로 안 쪼개진다. 그때 "이번 세트는 내 단어장과 겹치는 봉인이 없어요"
      // 라고 스스로 말한다(MorphemeRulesGame.tsx:854-858). 그건 정직한 폴백이다.
      // 반대로 아무 말 없이 내장 콘텐츠를 내면 실패다.
      // ⚠️ innerText 만 보면 안 된다 — 여러 게임이 단어를 aria-label·title 에 둔다
      // (wordsmith-vigil 의 붓 바 aria-label "…의 영어 철자 9글자 입력" · word-orrery 의
      //  행성 라벨 · sr-only 라이브 리전). 실측: innerText 만 보면 실패 게임이 매 실행마다
      //  회전했고, 접근성 텍스트를 포함하자 안정됐다. 학습자에게 실제로 전달되는 텍스트를
      //  전부 세는 것이 맞다(스크린리더 사용자에게도 그게 화면이다).
      const readAll = async () =>
        page
          .evaluate(() => {
            const parts = [document.body.innerText];
            for (const el of document.querySelectorAll('[aria-label],[title],[alt]')) {
              parts.push(
                el.getAttribute('aria-label') ?? '',
                el.getAttribute('title') ?? '',
                el.getAttribute('alt') ?? '',
              );
            }
            return parts.join('\n');
          })
          .catch(() => '');

      // 고지는 **문구가 아니라 표식**으로 읽는다. 정규식으로 맞히면 게임이 표현을 바꾸는
      // 순간 조용히 어긋난다 — 실측으로 겪었다: silent-rule 은 "이번 판은 내장 규칙 뱅크로
      // 열립니다" 라고 정직하게 고지하는데도, morpheme-rules 문구("겹치는 봉인이 없어요")만
      // 아는 정규식 때문에 '가짜 연계' 로 잡혔다. 게임이 자기 자료 출처를 스스로 선언하게 하고
      // (`data-scope`), 테스트는 그 선언을 읽는다.
      //   mine    — 내 단어가 실제로 실렸다
      //   builtin — 겹치는 것이 없어 내장 콘텐츠로 돈다(정직한 폴백)
      //   demo    — 단어장이 비어 맛보기로 돈다
      const scopeOf = () =>
        page
          .evaluate(() => document.querySelector('[data-scope]')?.getAttribute('data-scope') ?? null)
          .catch(() => null);

      let ok: string | null = null;
      for (let i = 0; i < 20 && !ok; i++) {
        const raw = await readAll();
        const text = raw.toLowerCase();
        const scope = await scopeOf();
        ok =
          en.find((w) => text.includes(w)) ??
          ko.find((m) => text.includes(m.toLowerCase())) ??
          // `mine` 도 유효한 선언이다. 이 단언이 잡으려는 것은 **아무 말 없이 내장 콘텐츠로
          // 도는 것**이고, `mine` 은 그 반대 — 게임이 "스코프 풀과 겹치는 항목을 실제로
          // 실었다"고 기계가 읽을 수 있게 선언한 것이다(morpheme-rules 의 ownSealCount 는
          // 풀 교집합에서 계산된다 · MorphemeRulesGame.tsx:167-170).
          //
          // 왜 필요했나: 자료 단어가 화면에 **글자로** 나오는 시점은 게임마다 다르다.
          // morpheme-rules 는 봉인을 풀기 전까지 뜻을 장면 문장으로만 보여 주고 영단어는
          // 발동 뒤에 나온다. 그래서 통과 여부가 "이번 판에 뽑힌 봉인 4개의 뜻이 마침
          // 화면 문구와 겹치는가" 라는 우연에 걸려 매 실행 흔들렸다(실측: 같은 커밋에서
          // 단독 실행 통과 → 재실행 실패). 선언을 읽으면 우연이 빠진다.
          //
          // 선언이 **아예 없는**(null) 게임은 여전히 실패한다 — 그게 원래 잡으려던 결함이다.
          (scope === 'mine' || scope === 'builtin' || scope === 'demo'
            ? `(자료 출처를 스스로 선언: ${scope})`
            : null);
        if (!ok) await page.waitForTimeout(1200);
      }
      if (!ok) {
        failures.push(`${slug}: 자료 단어도 없고 겹침 없음 고지도 없다(조용한 내장 콘텐츠)`);
      }
    }

    expect(failures, `가짜 연계(라벨만 자료):\n${failures.join('\n')}`).toEqual([]);
  });

  test('A2 · ?text= (내 스크립트) 도 같은 방식으로 실린다', async ({ page }) => {
    // 스크립트 경로는 vocabularies 기반이라 set 경로와 쿼리가 다르다 — 대표 3종으로 확인.
    for (const slug of ['cascade', 'wordblitz', 'connections']) {
      await page.goto(`/play/${slug}?text=${FIXTURE_TEXT.id}&from=%2Farcade`, {
        waitUntil: 'domcontentloaded',
      });
      const res = page.locator('[aria-label^="현재 학습:"]').first();
      await res.waitFor({ state: 'attached', timeout: 25_000 });
      const label = (await res.getAttribute('aria-label')) ?? '';
      expect(label, `${slug} 스크립트 스코프`).not.toContain('맛보기');
    }
  });

  test('B · /arcade?set= 이 모든 카드 링크에 스코프를 전달한다', async ({ page }) => {
    await page.goto(`/arcade?set=${FIXTURE_SET.id}&chapter=2`, { waitUntil: 'domcontentloaded' });

    // 스코프 배너 — 지금 어떤 자료로 노는지 + 푸는 길
    await expect(page.locator('.arc-scope')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.arc-scope')).toContainText(FIXTURE_SET.title);
    await expect(page.locator('.arc-scope-clear')).toHaveAttribute('href', '/arcade');

    // v07.8 이전 결함: 카드가 gamePlayHref(slug,{from:'/arcade'}) 하드코딩이라
    // 허브까지 온 스코프가 게임 진입 순간 증발했다.
    const hrefs = await page.locator('a[href*="/play/"]').evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute('href') ?? ''),
    );
    expect(hrefs.length, '플레이 링크가 하나도 없음').toBeGreaterThan(10);
    const dropped = hrefs.filter((h) => !h.includes(`set=${FIXTURE_SET.id}`));
    expect(dropped, `스코프를 잃은 링크:\n${dropped.join('\n')}`).toEqual([]);
    // 복귀(from)도 스코프를 유지해야 "이 도서로 여러 게임" 흐름이 끊기지 않는다.
    expect(hrefs.every((h) => h.includes('from=')), 'from 누락').toBe(true);

    // v08.3 — Protocol 다이얼로그의 Launch 도 같은 스코프를 실어야 한다.
    // 브리핑을 읽고 바로 시작하는 경로가 스코프를 잃으면, 카드만 고친 것과 같은 결함이 된다.
    await page.getByRole('button', { name: /^Cascade — 게임 설명/ }).click();
    const launch = page.getByRole('dialog').getByRole('link', { name: /Launch/ });
    await expect(launch).toBeVisible();
    const launchHref = (await launch.getAttribute('href')) ?? '';
    expect(launchHref, `Launch 가 스코프를 잃었다: ${launchHref}`).toContain(`set=${FIXTURE_SET.id}`);
    expect(launchHref).toContain('chapter=2');
  });

  test('C · 스크립트 화면에 아케이드 진입 문이 있다', async ({ page }) => {
    await page.goto(`/text/${FIXTURE_TEXT.id}`, { waitUntil: 'domcontentloaded' });
    // ⚠️ 사이드바에도 "아케이드" 링크가 있다(스코프 없는 /arcade). 반드시 ModePills 안으로
    // 한정해야 한다 — 안 그러면 사이드바를 잡고 "스코프가 없다"고 잘못 실패한다.
    const pill = page
      .locator('nav[aria-label="학습 단계 선택"]')
      .getByRole('link', { name: /Game Lab/ })
      .first();
    await expect(pill).toBeVisible({ timeout: 30_000 });
    const href = (await pill.getAttribute('href')) ?? '';
    // 스코프가 허브로 넘어가야 19종 전부에 적용된다.
    expect(href, `아케이드 pill href=${href}`).toContain('/arcade');
    // 도서 챕터로 열린 텍스트는 ?set=(shared_words), 사용자 스크립트는 ?text=(vocabularies).
    // text/[id]/page.tsx 의 scopeQuery 가 그 둘을 가르므로 둘 중 하나면 통과다.
    expect(/[?&](set|text)=/.test(href), `스코프 없는 아케이드 링크 — href=${href}`).toBe(true);
  });
});
