// apps/web/src/lib/game/brief/special.ts
//
// 특수 표면 — 소리·미지 글자·증거처럼 프롬프트 자체가 다르다
//
// 계열별로 파일을 나눈 이유: 한 파일에 19종을 몰면 두 게임을 동시에 손볼 때 매번
// 충돌하고, 무엇보다 **옆 게임의 브리핑이 보이지 않아** 서로 베낀 튜토리얼이 된다.
// 같은 계열을 한 파일에 두면 "이 게임이 옆 게임과 어떻게 다른가"를 쓰면서 볼 수 있다.
//
// 이 세 게임은 "근거가 무엇인가"가 서로 다르다 — 영어 비문(glyph-tongue) · 소리 한 번
// (wordfall-cadence) · 봉인에 찍힌 품사와 글자 수(lexicon-detective). v08.4 평가에서
// 세 브리핑이 전부 `pick` + 1스텝 "뜻 고르기"로 수렴해 board 수준에서 구별되지 않았으므로,
// 손동작이 갈리는 지점까지 trial 을 밀어 넣었다:
//   · glyph-tongue     — 칩→룬 **두 탭**으로 걸고, **몇 개를 묶어 봉인할지**, 그리고 비문이
//                        사라진 **최종 봉인**에서 근거 없이 다시 인출
//   · wordfall-cadence — 박이 남은 동안 짚고, 악장 끝에 **확정이냐 종지냐**, 그리고 순서 잇기
//   · lexicon-detective— **어느 봉투를 열지**(보존도 지출) · 놓고 **확정** · 기각 표시 · 전면 재구성
// 세 trial 은 서로 바꿔 끼울 수 없다. 하나는 배수, 하나는 순서, 하나는 지출을 누른다.
//
// v08.5 교정 — 적대적 재채점이 잡아낸 거짓과 없는 계기를 걷어냈다:
//   ① glyph 묶음 실패는 **배수 0 이 아니라 ×1 폴백**이다(GlyphTongueGame.tsx:641
//      `allRight ? batch : 1`). 맞은 룬은 100×석실배수×연쇄배수를 그대로 받는다.
//   ② glyph '비문 두 줄'은 큐레이션 룬에만 참이다 — 실 어휘 경로는 룬당 1줄(:173-175, :192).
//   ③ 숫자·핍으로 찍히는 것을 pct 막대로 그리지 않는다 — glyph '석실'(gk-stat 텍스트),
//      wordfall '열기'(4칸 핍 · 숫자 없음), lexicon '보존/심증'. 없는 막대는 거짓 계기다.
//   ④ lexicon 미개봉 봉투에 인쇄되는 것은 힌트 문자열뿐이다('동 · 5글자'). '증거 N'은
//      aria-label 전용(:1200-1204). 그리고 **기각은 표시 토글**이고 판정은 «확정»에서만
//      일어난다(:1256-1273, :790-794) — 조서(진술 여러 줄)는 doc 으로 되살렸다.
//
// 스키마·작성 원칙은 ./types.ts 를 먼저 읽어라.

import { FSRS, type GameBrief } from './types'
import type { GameSlug } from '@/lib/game/catalog'

export const SPECIAL_BRIEFS = {
  // 근거: GlyphTongueGame.tsx — TOTAL_MS 150s · GAIN_MS 4s · LOSS_MS 8s · CLEAR_MS 15s ·
  // RUB_MS 12s · RUB_FLOOR_MS 15s · RECALL_MS 26s · RECALL_SCORE 240 ·
  // RECALL_PERFECT_BONUS 600 · CHAMBER_SIZES [4,5,5] · CHAMBER_MULT [1,1.4,2] ·
  // CHAMBER_DECOYS [1,2,3] · BATCH_MULT [1,1,1.6,2.2,3,4] · MISREAD_MS 700 ·
  // 최종 봉인 = shuffle(탁본 아닌 해독분).slice(0,6) (:587) · 3개 미만이면 생략(:586).
  // 화면 문자열: TimerBar label '등불' · '석실 {i}/{n}'(gk-stat 텍스트) · '탁본 −12초' ·
  // '{n}개 묶어 봉인 ×{mult}' · 1개일 때는 그냥 '봉인'(:1099) · 룬 카드 슬롯 '뜻?'(:379) ·
  // '탁본 · 먼저 룬을 고르세요'(:1091) · '뱅크에는 이 석실의 것이 아닌 뜻도 섞여 있다'(:1036).
  'glyph-tongue': {
    slug: 'glyph-tongue',
    objective:
      '뜻을 알려주지 않는다. 같은 룬이 박힌 영어 비문의 쓰임만으로 뜻을 추론해 룬 카드의 «뜻?» 슬롯에 걸고, 몇 개를 한 번에 걸지 정해 봉인한다. 뜻 뱅크에는 이 석실의 답이 아닌 미끼가 상주해 끝까지 사라지지 않으므로 마지막 룬도 소거로 공짜가 되지 않는다. 등불 하나가 세션 전체를 관통한다 — 읽어내면 늘고 어긋나면 줄어든다.',
    board: {
      kind: 'group',
      cols: 2,
      prompt: {
        label: '룬 가 — 근거는 비문의 쓰임뿐',
        value: '⌇',
        kind: 'glyph',
        note: 'The ⌇ log made a deep, drum-like sound. / Owls often build a nest inside a ⌇ tree. — 큐레이션 룬은 비문 2줄, 예문이 붙은 내 단어 룬은 1줄이다. 벽에는 이 석실 모든 룬의 비문이 섞여 있다.',
      },
      hud: [
        { label: '등불', pct: 0.55, value: '82초' },
        { label: '석실', pips: { total: 3, left: 1 }, value: '1/3' },
      ],
      tokens: [
        { id: 'rune-ga', text: '⌇', sub: '룬 가 · 뜻?', ok: true },
        { id: 'rune-na', text: '⋔', sub: '룬 나 · 뜻?' },
        { id: 'ko-hollow', text: '속이 빈', ok: true },
        { id: 'ko-fragile', text: '깨지기 쉬운' },
        { id: 'ko-stubborn', text: '고집 센' },
        { id: 'ko-ancient', text: '고대의' },
        {
          id: 'rub',
          text: '탁본',
          sub: '룬을 먼저 고른 뒤에만 · 등불이 15초를 넘게 남았을 때만 · 산 룬은 점수·연쇄·기록에서 빠진다',
          tone: 'quiet',
          effect: { gauge: 0, delta: -0.08, badge: '−12초' },
        },
        { id: 'rune-da', text: '⟒', sub: '룬 다 · 뜻?', ok: true, from: 2 },
        { id: 'ko-swift', text: '재빠른', ok: true, from: 2 },
      ],
      choices: [
        {
          id: 'seal2',
          label: '2개 묶어 봉인 ×1.6',
          lines: [
            '전부 맞아야 묶음 배수 — 2개 ×1.6 · 3개 ×2.2 · 5개 ×4',
            '룬 하나 = 100 × 석실 배수(1 / 1.4 / 2) × 연쇄 배수 × 묶음 배수',
            '어긋나면 묶음 배수만 ×1 로 내려간다 · 어긋난 룬은 ✕ 로 짚어 주고 등불 −8초씩',
          ],
          ok: true,
          from: 1,
        },
        {
          id: 'seal1',
          label: '봉인',
          lines: [
            '걸어 둔 룬이 하나면 버튼 문자열이 그냥 «봉인» 이다 — 묶음 배수 ×1',
            '어긋나도 등불 −8초 한 번 (셋을 묶었다가 셋 다 어긋나면 −24초)',
            '나머지 룬은 걸어 둔 채 다음 봉인으로 미룬다',
          ],
          tone: 'quiet',
          from: 1,
        },
      ],
    },
    figures: [
      {
        caption:
          '뜻은 주어지지 않는다. 근거는 같은 룬이 박힌 비문뿐이고, 룬 형태는 판마다 새로 뽑혀 외울 수 없다. 뜻 뱅크에는 이 석실의 답이 아닌 미끼가 섞여 있다(석실별 1·2·3개, 끝까지 사라지지 않는다).',
        state: 'idle',
      },
      {
        caption:
          '칩을 든 다음 룬 카드를 눌러 «뜻?» 슬롯에 건다 — 두 탭이 한 번의 걸기다. 걸어 둔 것을 한꺼번에 봉인: 둘 다 맞으면 ×1.6 · 룬마다 등불 +4초 · 석실을 다 열면 +15초.',
        focus: ['ko-hollow', 'rune-ga', 'seal2'],
        state: 'good',
        hud: [{ pct: 0.6, value: '90초' }, null],
      },
      {
        caption:
          '어긋난 룬은 0.7초 동안 ✕ 로 표시된 뒤 비워지고 등불 −8초씩, 묶음 배수는 ×1 로 내려간다. 막히면 탁본이 유료 출구 — 룬을 먼저 고른 뒤, 등불이 15초 넘게 남았을 때만 눌린다.',
        focus: ['rub'],
        state: 'bad',
        hud: [{ pct: 0.25, value: '37초' }, { left: 2, value: '2/3' }],
      },
    ],
    trial: {
      steps: [
        {
          say: '거는 데는 두 탭이 듭니다 — 뜻 칩을 먼저 들고, 그 뜻을 걸 룬 카드를 누르세요.',
          want: ['ko-hollow', 'rune-ga'],
          ordered: true,
          hint: '두드리면 북처럼 울리는 통나무, 그 안에 올빼미가 둥지를 튼다 — 룬 가의 비문이에요.',
        },
        {
          prompt: {
            label: '룬 가 · 룬 나 — 둘 다 걸렸다',
            value: '⌇ ⋔',
            note: '룬 나에는 이미 「깨지기 쉬운」을 걸어 두었다. 봉인 버튼이 «2개 묶어 봉인 ×1.6» 으로 바뀐다.',
          },
          say: '봉인은 걸어 둔 것을 한꺼번에 채점합니다. 묶어서 배수를 걸까요, 하나로 줄일까요?',
          want: ['seal2'],
          hint: '묶을수록 배수는 커지지만, 하나라도 어긋나면 묶음 배수가 ×1 로 내려가고 어긋난 룬마다 등불 −8초예요.',
        },
        {
          prompt: {
            label: '최종 봉인 · 26초',
            value: '⟒',
            note: '석실을 다 열면 비문 벽이 사라진다 — 이번 판에 스스로 읽어낸 룬 최대 6개를 근거 없이 다시 잇는다(탁본으로 산 룬은 빠지고, 읽어낸 룬이 3개 미만이면 이 국면 자체가 없다).',
          },
          hud: [{ pct: 0.85, value: '22초' }, { left: 3, value: '3/3' }],
          say: '근거가 사라졌습니다. 기억만으로 이 룬에 뜻을 다시 거세요 — 룬당 240점, 전부 맞으면 +600.',
          want: ['ko-swift', 'rune-da'],
          ordered: true,
          hint: '해가 지기 전에 소식을 나른 기수, 그리고 순식간에 방향을 튼 여우 — 「재빠른」이에요.',
        },
      ],
      done: '봉인은 걸어 둔 룬 전부를 동시에 채점해요 — 묶을수록 배수가 커지고, 어긋나면 묶음 배수만 ×1 로 내려갑니다. 마지막엔 비문 없이 한 번 더 인출합니다.',
    },
    facts: {
      input:
        '뜻 칩 탭 → 룬 카드 탭 = 걸기 · 손이 빈 채 룬 카드 탭 = 되돌리기 · 봉인 = 걸어 둔 것 일괄 채점 · 탁본은 룬을 고른 뒤 등불 15초 초과일 때만(−12초)',
      run:
        '석실 3개(룬 4·5·5 · 점수 배수 1·1.4·2) · 뜻 뱅크에 이 석실의 답이 아닌 미끼 상주(석실별 1·2·3개) · 등불 150초 하나가 세션을 관통(해독 +4초 · 어긋남 −8초 · 석실 개방 +15초) · 마지막에 최종 봉인 26초(룬당 240 · 전부 맞으면 +600)',
      record: FSRS,
    },
  },

  // 근거: WordfallCadenceGame.tsx — MOVEMENTS 3 × PER_MOVEMENT 5 · START_HP/MAX_HP 3 ·
  // BEATS [12..8] · TILES [4,4,5,5,5] · LADDER ×3(≥0.66)/×2(≥0.36)/×1 · HEAT_FLOOR_EVERY 4 ·
  // ECHO_BEAT_COST [2,3] · ECHO_MULT [1,.5,.25] · MAX_ECHO 2 · ECHO_LOCK_HEAT 4 ·
  // CHAIN_LEN 3 · CHAIN_BOARD 6 · CHAIN_BEATS 18 · CHAIN_REPLAY_COST 4 ·
  // CHAIN_HIT 80 + CHAIN_PERFECT 200(=440) − CHAIN_NEAR_PENALTY 40(2/3 → 120) ·
  // gain = max(0, raw) × multFor(combo) — 3/3 과 2/3 이 **같은 배수**를 곱한다(:876-880) ·
  // ♪ 회복은 Math.min(MAX_HP, hp+1)(:889) 이라 3 이면 회복 없음 ·
  // SAFE_BASE 60 + SAFE_PER_HEAT 40 + SAFE_PER_LOST_HP 30, 전체 ×연쇄 배수(:1094-1098).
  // 화면 문자열: '남은 박'(막대) · '{n}박 ×{m}' · '♪ 남은 기회'(핍) · '열기'(4칸 핍 · 숫자 없음) ·
  // '다시 듣기 −{n}박' · '한 번에 들어야 해요' · '종지 걸기' · '그냥 이어 가기 +{n}점' · '종지 잇기'.
  'wordfall-cadence': {
    slug: 'wordfall-cadence',
    objective:
      '철자는 한 글자도 보이지 않는다. 발음 한 번만 듣고 남은 박 안에 뜻을 짚는다 — 빨리 짚으면 배수가 크고, 다시 듣기는 박과 배수를 태운다. 악장이 끝날 때마다 확정 점수와 종지 도박 중 하나를 고른다.',
    board: {
      kind: 'pick',
      cols: 2,
      prompt: {
        label: '지금 들린 소리 (1회)',
        value: '♪',
        kind: 'audio',
        note: '실제 화면에는 철자도 발음기호도 없다 — 짚은 뒤에야 철자·발음기호·뜻이 펼쳐진다. 여기서는 소리 대신 /ˈdʒenjuɪn/ 으로 대신한다.',
      },
      hud: [
        { label: '남은 박', pct: 0.75, value: '9박 ×3' },
        { label: '♪ 남은 기회', pips: { total: 3, left: 3 } },
        { label: '열기', pips: { total: 4, left: 0 } },
      ],
      tokens: [
        { id: 'ko-genuine', text: '진짜의', ok: true },
        { id: 'ko-generous', text: '관대한' },
        { id: 'ko-judgment', text: '판단' },
        { id: 'ko-courage', text: '용기' },
        {
          id: 'echo',
          text: '다시 듣기',
          sub: '1회차 −2박 ×½ → 2회차 −3박 ×¼ → 소진 · 열기 4단계에서는 «한 번에 들어야 해요»',
          tone: 'quiet',
          effect: { gauge: 0, delta: -0.17, badge: '−2박 ×½' },
        },
      ],
      choices: [
        {
          id: 'chain',
          label: '종지 걸기',
          lines: [
            '소리 3개를 이어 듣고 들은 순서대로 잇는다 · 18박 · 후보가 6칸으로 늘어난다',
            '3/3 → 440점 ×연쇄 배수 · ♪ 가 3 미만이면 하나 회복',
            '2/3 → 120점 ×연쇄 배수 · 1개 이하면 ♪ 하나를 잃는다',
          ],
          ok: true,
          from: 1,
        },
        {
          id: 'safe',
          label: '그냥 이어 가기',
          lines: [
            '(60 + 열기 단계당 40 + 잃은 ♪ 하나당 30) ×연쇄 배수 — 손실 없음',
            '♪ 도 연쇄도 그대로 다음 악장으로',
          ],
          tone: 'quiet',
          from: 1,
        },
      ],
    },
    figures: [
      {
        caption: '3박 카운트인 뒤 발음이 한 번 나간다. 화면에 철자는 없고, 어긋나면 ♪ 하나 — 3개를 다 쓰면 판이 끝난다.',
        state: 'idle',
      },
      {
        caption: '남은 박이 66% 이상이면 ×3, 36% 이상 ×2, 그 아래 ×1. 짚은 뒤에야 철자·발음기호·뜻이 펼쳐진다.',
        focus: ['ko-genuine'],
        state: 'good',
        hud: [{ pct: 0.68, value: '8박 ×3' }, null, null],
      },
      {
        caption: '다시 듣기는 −2박 ×½ → −3박 ×¼ → 소진. 열기가 오르면 박이 짧아지고 타일이 4→5개, 오답 후보의 소리가 더 닮아진다 — 4단계에서는 다시 듣기가 잠긴다.',
        focus: ['echo'],
        state: 'bad',
        hud: [{ pct: 0.25, value: '3박 ×0.5' }, { left: 2 }, { left: 3 }],
      },
    ],
    trial: {
      steps: [
        {
          say: '발음이 한 번 나갔습니다 — /ˈdʒenjuɪn/. 박이 66% 넘게 남은 지금 짚으면 ×3 입니다.',
          want: ['ko-genuine'],
          hint: '베낀 것이 아니라 진품이라는 뜻이에요.',
        },
        {
          prompt: {
            label: '악장 1 끝 — 박도 열기도 잠시 멈춘다',
            value: '종지를 걸까요?',
            kind: 'text',
            note: '단어 3개가 이어서 흐릅니다 — 대부분 이번 악장에 나오지 않은 소리예요.',
          },
          hud: [null, { left: 2 }, null],
          say: '악장 5문제가 끝났습니다. ♪ 는 둘 남았습니다 — 확정 점수를 굳힐까요, 종지를 걸어 ♪ 하나를 되찾으러 갈까요?',
          want: ['chain'],
          hint: '이어 가기는 손실이 없고, 종지는 3개를 다 맞혀야 ♪ 가 돌아옵니다.',
        },
        {
          prompt: {
            label: '종지 · 소리 3개가 흘렀다',
            value: '♪ ♪ ♪',
            kind: 'audio',
            note: '여기서는 손이 바뀐다 — 하나 고르는 판이 아니라 후보 6칸에서 3개를 순서대로 쌓는 판이다(여기 그림은 4칸으로 줄였다). 되돌리기 가능 · 다시 듣기 −4박 1회 · 3개를 다 이은 뒤에야 채점된다.',
          },
          hud: [{ pct: 0.9, value: '16박' }, null, null],
          say: '세 소리가 흐른 순서대로 이으세요 — 되돌리기는 되지만 부분 정답은 알려주지 않습니다.',
          want: ['ko-generous', 'ko-judgment', 'ko-courage'],
          ordered: true,
          hint: '/ˈdʒenərəs/ → /ˈdʒʌdʒmənt/ → /ˈkɜːrɪdʒ/ 순서로 흘렀어요.',
        },
      ],
      done: '종지는 후보 6칸에서 3개를 순서대로 잇는 국면이에요 — 3/3 이면 ♪ 가 3 미만일 때 하나 돌아오고, 1개 이하면 ♪ 하나를 잃습니다.',
    },
    facts: {
      input: '탭 또는 숫자키 1–5 · R 다시 듣기(1회차 −2박) · 소리 필수(헤드폰 권장)',
      run: '악장 3개 × 5문제 = 15문제 · 4문제마다 열기 바닥이 한 단계 오른다(0→3, 4단계는 성과로만) · 악장 끝마다 종지 도박 · ♪ 3 소진 시 조기 종료',
      record: FSRS,
    },
  },

  // 근거: LexiconDetectiveGame.tsx — SPECS lives 3·3·2 · 봉투 E=clamp(round(풀×0.75),4,8)
  // (세 사건 모두 같은 수) · 진술 3~6줄 · PT_MATCH 100 · PT_REJECT 120 · PT_PRESERVE 60 ·
  // PT_LIFE 100 · ALL_IN_MULT 2 · COLD_FORFEIT 0.5 · 전면 재구성은 pending ≥ 2 ∧ 전 줄 판단
  // ∧ 사건당 1회(:604) · 종결 보너스 = 보존×60×연쇄배수 + 남은 심증×100(:722-723).
  // 화면 문자열: '사건 {i}/{n}'·'보존 {n}/{E}'(gk-stat 텍스트) · '심증'(Hud 핍) ·
  // 미개봉 봉투에 인쇄되는 것은 힌트뿐 — '동 · 5글자'(:1210, envHint :434) ·
  // '단어 놓기' · '기각'(토글, aria-pressed) · '확정'(판정) · '전면 재구성 ×2 · {n}줄' ·
  // '사건 조서 · 진술 {n}줄'(:1220). 단어·사건명은 DEMO_POOL/FLAVORS 실물.
  'lexicon-detective': {
    slug: 'lexicon-detective',
    objective:
      '국문 뜻으로만 적힌 조서 여러 줄이 한 화면에 동시에 놓이고, 그 앞에 봉인된 영문 증거 봉투가 깔린다. 봉인에는 품사와 글자 수만 있어 무엇을 열지가 되돌릴 수 없는 지출이고, 어느 봉투와도 맞물리지 않는 줄은 기각해야 한다 — 위증이 몇 줄인지는 끝까지 공개되지 않는다.',
    board: {
      kind: 'group',
      cols: 2,
      prompt: {
        label: '사건 1/3 · 한밤의 서재',
        value: '사건 조서 · 진술 5줄',
        note: '금고가 열렸고, 책상 위엔 봉인된 증거 봉투만 남았다. 진술은 국문 뜻만 적히고 전부 한 화면에 놓인다 — 줄마다 «단어 놓기 / 기각 / 확정» 세 버튼이 붙는다.',
      },
      doc: [
        { label: '진술 1', value: '배신하다 — betray 확정' },
        { label: '진술 2', value: '뇌물을 주다' },
        { label: '진술 3', value: '상속받다' },
        { label: '진술 4', value: '증언' },
        { label: '진술 5', value: '질투하는' },
      ],
      hud: [
        { label: '보존', pips: { total: 8, left: 8 }, value: '8/8' },
        { label: '심증', pips: { total: 3, left: 3 } },
      ],
      tokens: [
        { id: 'env-v', text: '동 · 5글자', sub: '봉인 — 열면 보존 −1, 되돌릴 수 없다', ok: true },
        {
          id: 'env-n',
          text: '명 · 9글자',
          sub: '봉인',
          effect: { gauge: 0, delta: -1, badge: '보존 −1' },
        },
        {
          id: 'env-a',
          text: '형 · 7글자',
          sub: '봉인',
          effect: { gauge: 0, delta: -1, badge: '보존 −1' },
        },
        { id: 'bribe', text: 'bribe', sub: '개봉 · 손에 들렸다 — 누를 줄을 고른다', ok: true, from: 1 },
        { id: 'confirm', text: '확정', sub: '이 줄만 즉시 판정 — 판정은 여기서만 일어난다', ok: true },
        { id: 'reject', text: '기각', sub: '맞물리는 증거가 없다는 표시 토글 — 아직 판정이 아니다', tone: 'danger', ok: true },
      ],
      choices: [
        {
          id: 'allin',
          label: '전면 재구성 ×2 · 3줄',
          lines: [
            '남은 3줄을 한 번에 판정 — 사건당 한 번뿐, 남은 줄이 2개 이상이고 전부 판단이 서야 열린다',
            '전부 맞으면 줄마다 ×2 (확정 100 · 기각 120, 각각 ×연쇄 배수)',
            '하나라도 어긋나면 심증 1 · 연쇄 소멸 · 어느 줄인지 알려주지 않는다',
          ],
          ok: true,
          from: 3,
        },
        {
          id: 'onebyone',
          label: '한 줄씩 확정',
          lines: [
            '줄마다 즉시 판정되어 어긋난 줄이 그 자리에서 드러난다',
            '배수는 연쇄로만 오른다 (×2 없음)',
            '전면 재구성 한 번을 이 사건에 남겨 둔다 (다음 사건으로 이월되지는 않는다)',
          ],
          tone: 'quiet',
          from: 3,
        },
      ],
    },
    figures: [
      {
        caption: '봉인에 인쇄되는 것은 품사와 글자 수뿐이다. 무엇을 열지가 곧 지출 — 열 때마다 보존이 1 줄고 되돌릴 수 없다.',
        focus: ['env-v'],
        state: 'idle',
      },
      {
        caption:
          '연 단어를 맞물리는 줄에 놓고 «확정»을 눌러야 판정된다 — 확정 100 · 기각 성공 120, 둘 다 ×연쇄 배수. 종결 시 남은 보존 하나당 60 ×연쇄 배수, 남은 심증 하나당 100 이 더 붙는다.',
        focus: ['bribe', 'confirm'],
        state: 'good',
        hud: [{ left: 7, value: '7/8' }, null],
      },
      {
        caption:
          '전면 재구성이 어긋나면 심증 1 · 연쇄 소멸, 어느 줄이 틀렸는지는 조서에 적히지 않는다. 심증 0 이면 미제 — 진상은 전부 공개되지만 그 사건 확정 점수의 절반을 잃는다.',
        focus: ['allin'],
        state: 'bad',
        hud: [{ left: 7, value: '7/8' }, { left: 2 }],
      },
    ],
    trial: {
      steps: [
        {
          say: '진술 2 는 「뇌물을 주다」 — 동사입니다. 봉인에 찍힌 것은 품사와 글자 수뿐이고, 여는 순간 보존이 1 줄어 되돌릴 수 없습니다.',
          want: ['env-v'],
          hint: '동사 봉인은 하나뿐이에요. 다른 봉투를 눌러도 오답은 아니지만 보존이 나갑니다.',
        },
        {
          doc: [
            { label: '진술 1', value: '배신하다 — betray 확정' },
            { label: '진술 2', value: '뇌물을 주다 · 슬롯 비어 있음' },
            { label: '진술 3', value: '상속받다' },
            { label: '진술 4', value: '증언' },
            { label: '진술 5', value: '질투하는' },
          ],
          hud: [{ left: 7, value: '7/8' }, null],
          say: '봉투가 열려 bribe 가 손에 들렸습니다. 진술 2 에 놓고, 그 줄을 «확정» 하세요 — 놓기만 해서는 판정되지 않습니다.',
          want: ['bribe', 'confirm'],
          ordered: true,
          hint: '개봉 봉투를 누르면 손에 들리고, 진술 슬롯을 누르면 그 줄에 놓입니다. 판정은 그 다음 «확정» 에서 일어나요.',
        },
        {
          doc: [
            { label: '진술 1', value: '배신하다 — betray 확정' },
            { label: '진술 2', value: '뇌물을 주다 — bribe 확정 +100' },
            { label: '진술 3', value: '상속받다 · 남은 봉인 중 동사가 없다' },
            { label: '진술 4', value: '증언' },
            { label: '진술 5', value: '질투하는' },
          ],
          hud: [{ left: 7, value: '7/8' }, null],
          say: '진술 3 「상속받다」와 맞물릴 봉인이 현장에 없습니다. 이 줄에 무엇을 걸까요?',
          want: ['reject'],
          hint: '기각은 켜 두는 표시일 뿐이라 이것만으로는 점수도 손실도 없어요 — 판정은 확정이나 전면 재구성에서 일어납니다.',
        },
        {
          doc: [
            { label: '진술 1', value: '배신하다 — betray 확정' },
            { label: '진술 2', value: '뇌물을 주다 — bribe 확정 +100' },
            { label: '진술 3', value: '상속받다 — 기각 표시' },
            { label: '진술 4', value: '증언 — testimony 놓임' },
            { label: '진술 5', value: '질투하는 — jealous 놓임' },
          ],
          hud: [{ left: 5, value: '5/8' }, { left: 2 }],
          say: '남은 두 봉투도 열어 각 줄에 놓았습니다 — 남은 3줄 전부에 판단이 섰고 심증은 둘입니다. 사건당 한 번뿐인 전면 재구성으로 ×2 를 걸까요?',
          want: ['allin'],
          hint: '세 줄이 전부 맞아야 성립하고, 어긋나면 어느 줄이 틀렸는지는 조서에 적히지 않아요.',
        },
      ],
      done: '기각은 표시, 판정은 «확정» 또는 «전면 재구성» — 두 버튼이 이 게임의 유일한 채점 시점이에요. 위증이 몇 줄인지는 끝까지 공개되지 않아 남은 줄을 세어 역산할 수 없습니다.',
    },
    facts: {
      input:
        '미개봉 봉투 탭 = 개봉(보존 −1 · 그대로 손에 들린다) · 개봉 봉투 탭 = 들기/내려놓기 · 진술 슬롯 탭 = 배치 · 기각은 표시 토글 · 판정은 줄마다의 «확정» 또는 «전면 재구성» 에서만',
      run:
        '사건 3건 · 봉투 4~8개(내 단어장 크기의 함수 · 세 사건 모두 같은 수) · 진술 3~6줄 · 심증 3·3·2 · 시계 없음 · 종결 시 남은 보존 하나당 60 ×연쇄 배수 + 남은 심증 하나당 100 · 미제면 그 사건 확정 점수 절반 몰수',
      record: FSRS,
    },
  },
} satisfies Partial<Record<GameSlug, GameBrief>>
