// packages/library-pipeline/src/textbook/volume-document.ts
//
// **한 권의 문서(HTML 전체)를 낸다 — DB 도 파일도 안 탄다.**
//
// ⚠️ 왜 여기로 옮겼나 (2026-09-06):
//   이 조립이 `scripts/textbook/render-volume.mjs` 최상위 스코프의 템플릿 리터럴이라
//   **임포트할 수가 없었다.** 그래서 「처음부터 발행까지」를 자동으로 확인할 방법이 없었고,
//   판형·인쇄 규칙·활자 스케일·판권면이 맞는지 보려면 사람이 스크립트를 돌리는 수밖에 없었다.
//   같은 날 배럴 누락(`volumeMetricsCss`)으로 조판이 통째로 죽었을 때도 **아무 신호가 없었다** —
//   사람이 우연히 돌려 보고서야 알았다.
//
//   순수 함수가 되면 그 전부가 회귀로 잠긴다. 스크립트는 DB 에서 모아 온 값을 넘기기만 한다.
//
// 이 파일이 **안 하는 일**: 문항을 고르지 않고, 단원을 조립하지 않고, 검수하지 않는다.
// 단원 HTML은 이미 만들어진 문자열로 받는다 — 그 조립은 문항 유형마다 규칙이 달라
// 스크립트가 지문·payload 를 들고 해야 한다.

import {
  COVER_BRAND,
  coverSvg,
} from './cover'
import {
  VOLUME_FONTS,
  ladderStrip,
  volumeCssVariables,
  volumeMetricsCss,
  type Colophon,
} from './brand'

/** 선택지 번호 표시 — 정답 칸과 지문 밑줄이 **같은 글리프**를 써야 한 책으로 읽힌다. */
const CIRCLED = ['①', '②', '③', '④', '⑤']

/** HTML 이스케이프. 지문·해설은 사람이 쓴 글이라 그대로 넣으면 태그가 깨진다. */
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface VolumeAnswer {
  no: number
  answer: number
  /**
   * 해설. **없으면 null** — 빈 문자열로 채우면 "해설이 있는데 비었다" 로 읽힌다.
   * `from` 은 근거의 출처: 배치(Claude Code 드레인)인지 규칙인지.
   */
  explanation: { text: string; from: 'batch' | 'rule' } | null
}

export interface VolumeDocumentInput {
  colophon: Colophon
  /** 사다리 몇 단인가. 규격 밖 밴드는 null — 그때는 표지에 단수를 주장하지 않는다. */
  step: number | null
  schoolBand: string | null
  vLevel: number
  totalSteps: number
  unitCount: number
  itemCount: number
  totalMinutes: number
  autoPassed: number
  autoTotal: number
  passageChip: string
  /** 정답 번호 쏠림. **null 은 「지적 0건」이 아니라 「단답 위주라 못 잰다」** 이다. */
  answerBias: { chi2: number; cramersV: number; biased: boolean } | null
  proof: { passages: number; defective: number }
  /**
   * 표지에 찍는 **짧은 브랜드 이름**. 없으면 전역 기본값(독해).
   * 시리즈마다 자기 이름을 써야 세 권을 나란히 놓았을 때 서로 다른 시리즈로 읽힌다.
   */
  coverBrand?: string
  /**
   * 시리즈 액센트(hex). 없으면 단별 일곱 색으로 떨어진다.
   * 시리즈가 여럿이면 **같은 단의 세 권이 같은 색**이 되므로 이것을 줘야 갈린다.
   */
  accent?: string
  /** 스크립트가 조립해 넘기는 단원 HTML. */
  unitsHtml: string
  answers: VolumeAnswer[]
}

/** 한 권의 완성 HTML. 같은 입력이면 같은 출력이다 — 시각도 난수도 안 쓴다. */
export function renderVolumeDocument(input: VolumeDocumentInput): string {
  const {
    colophon,
    step,
    schoolBand,
    vLevel,
    totalSteps,
    unitCount,
    itemCount,
    totalMinutes,
    autoPassed,
    autoTotal,
    passageChip,
    answerBias,
    proof,
    unitsHtml,
    answers,
    coverBrand,
    accent,
  } = input
  return `<title>${esc(colophon.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@400;500&family=JetBrains+Mono:wght@400&display=swap">
<style>
${volumeCssVariables()}
${volumeMetricsCss()}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:${VOLUME_FONTS.english};line-height:var(--leading)}
.wrap{max-width:var(--measure);margin:0 auto;padding:3rem 1.25rem 5rem}
.cover{border-bottom:3px double var(--line);padding-bottom:2rem;margin-bottom:2.5rem}
.coverart{float:right;width:168px;margin:0 0 1rem 1.5rem}
.coverart svg{display:block}
@media print{.coverart{float:none;margin:0 auto 1.5rem}}
.brand{font-size:var(--fs-caption);letter-spacing:.22em;text-transform:uppercase;color:var(--accent);font-weight:700}
h1{font-size:var(--fs-display);margin:.6rem 0 .3rem;letter-spacing:-.01em;text-wrap:balance}
.meta{color:var(--sub);font-size:var(--fs-body)}
.scorebar{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:1.2rem}
.chip{border:1px solid var(--line);border-radius:2px;padding:.2rem .5rem;font-size:var(--fs-caption);color:var(--sub)}
.chip.ok{border-color:var(--accent);color:var(--accent)}
.unit{margin:0 0 3rem;padding-top:1.5rem;border-top:1px solid var(--line)}
.unit h2{display:flex;align-items:baseline;justify-content:space-between;font-size:var(--fs-body);letter-spacing:.14em;color:var(--accent);margin:0 0 1.2rem;font-weight:700}
.umin{color:var(--sub);font-weight:400;letter-spacing:0}
.q{margin:0 0 2rem}
.stem{font-size:var(--fs-stem);margin:0 0 .8rem}
.passage{margin:0 0 .7rem;text-align:justify;hyphens:auto}
.intro{padding-left:.9rem;border-left:3px solid var(--line)}
.block .lbl{font-weight:700;color:var(--accent)}
.given{border:1px solid var(--line);padding:.7rem .9rem;margin:0 0 .9rem;background:transparent}
.slot{color:var(--slot);font-weight:700}
.choices{margin:.9rem 0 0;padding-left:1.4rem}
.choices li{margin:.15rem 0;font-variant-numeric:tabular-nums}
.vocab{margin-top:1.4rem;border-top:1px dotted var(--line);padding-top:.8rem}
.vocab h3{font-size:var(--fs-caption);letter-spacing:.16em;text-transform:uppercase;color:var(--sub);margin:0 0 .4rem}
.vocab table{width:100%;border-collapse:collapse;font-size:var(--fs-body)}
.vocab td{padding:.16rem .5rem .16rem 0;vertical-align:top}
.vocab td:first-child{width:11rem;color:var(--accent)}
.src{margin:.9rem 0 0;font-size:var(--fs-caption);color:var(--sub)}
.answers{margin-top:4rem;border-top:3px double var(--line);padding-top:2rem}
.answers h2{font-size:var(--fs-title);margin:0 0 1.2rem}
.arow{border-bottom:1px dotted var(--line);padding:.7rem 0}
.ano{font-weight:700;color:var(--accent)}
.expl{margin:.35rem 0 0;font-size:var(--fs-body);color:var(--sub);white-space:pre-wrap}
.noexpl{font-size:var(--fs-small);color:var(--sub);font-style:italic}
.efrom{margin:.25rem 0 0;font-size:var(--fs-micro);letter-spacing:.1em;text-transform:uppercase;color:var(--sub);opacity:.7}
.tablewrap{overflow-x:auto}
/* 한국어 해설·라벨은 본문 서체로 — Lora 는 영문 지문 전용이다. */
.meta,.chip,.expl,.noexpl,.vocab h3,.src{font-family:${VOLUME_FONTS.body}}
.ladder{display:flex;gap:.34rem;margin:.9rem 0 0;font-family:${VOLUME_FONTS.mono};font-size:var(--fs-caption);color:var(--sub)}
.ladder span{min-width:1.5rem;text-align:center}
.ladder span.here{color:var(--accent);font-weight:700}
.colophon{margin-top:4rem;border-top:1px solid var(--line);padding-top:1.4rem;font-family:${VOLUME_FONTS.body};font-size:var(--fs-small);color:var(--sub);line-height:var(--leading-ko)}
.colophon dl{display:grid;grid-template-columns:auto 1fr;gap:.3rem 1.2rem;margin:0}
.colophon dt{color:var(--accent);letter-spacing:.1em;text-transform:uppercase;font-size:var(--fs-micro);padding-top:.1rem}
.colophon dd{margin:0}
/* ── 인쇄 조판 ────────────────────────────────────────────────────────
   ⚠️ **여기 있던 것은 한 줄이었다** — \`@media print{body{background:#fff}.wrap{max-width:none}}\`.
   색만 희게 하고 쪽 나눔이 없었다. 실측 2026-09-01: \`@page\` 0 · \`page-break\` 0 ·
   \`break-inside\` 0. 그대로 인쇄하면 **지문과 발문이 쪽 경계에서 잘리고** 선택지만 다음 쪽에
   남는다. 시중 교재에서는 일어나지 않는 일이라, 내용이 아무리 좋아도 교재로 안 보인다.

   ── 판형 (2026-09-06 실측) ────────────────────────────────────────────
   **215 × 290 mm.** 시중 교재 코퍼스 70종 중 56종을 재서 나온 최빈값이고, 독해 교재만
   따로 봐도 같다(19/48종. 2위는 210×275 로 18종 — 둘 다 A4 계열이다).
   근거: \`node scripts/textbook-corpus/trim-size.mjs\` → \`docs/reports/textbook-trim-size.json\`.

   ⚠️ **여기 있던 값은 188×257(4×6배판)이었고, 그 주석은 "업계 표준값이지 실측이 아니다 —
      PDF 가 이 기계에 없다" 고 적고 있었다.** 없던 게 아니라 **옮겨졌다**: 같은 날
      \`Documents/시중교재\` → \`Documents/영어/시중교재\` 로 이동했고 매니페스트가 그 사실을
      \`sources[0].$note\` 에 남겨 두었다. 재 보니 **시중이 면적으로 29% 크다** — 매대에서
      우리 책이 먼저 작아 보이는 차이다. 벤치마크 7축은 전부 내용 축이라 이것을 한 번도 안 봤다.

   재는 규칙: TrimBox > CropBox > MediaBox. MediaBox 는 재단여백을 포함해 완성 판형보다 크다.
   객체 스트림이 압축된 14종은 **분모에서 뺐다**(0 으로 채우면 최빈값이 조용히 틀어진다).

   ⚠️ **여백과 단수는 아직 안 쟀다.** 아래 margin 은 옛 판형의 비(0.096/0.066/0.078)를 그대로
      새 판형에 곱한 값이지 시중 실측이 아니다. 판면(text block)을 재려면 쪽 안의 글자 좌표를
      뽑아야 하고 그건 별도 작업이다 — 그때까지 이 값은 **짐작**이라고 적어 둔다.

   ── 쪽 구성 근거 (79종 실측 · market-spec.json) ────────────────────────
   \`unitsPerBook\` 중앙값 10 · \`pagesPerUnit\` 중앙값 17. 단원이 쪽의 단위라는 뜻이라
   **단원마다 새 쪽에서 시작**한다.

   ⚠️ 쪽 번호와 running head 는 여기서 못 만든다. \`@page\` 의 margin box(\`@bottom-center\`)는
   **Chrome 이 지원하지 않는다** — 브라우저 인쇄로 뽑으면 무시된다. 진짜 쪽 번호가 필요하면
   Paged.js 같은 조판 엔진을 얹어야 하고, 그건 별도 작업이다. 지금 여기서 얻는 것은
   **쪽 크기 · 여백 · 잘리지 않는 덩어리**다. */
@page{size:215mm 290mm;margin:21mm 19mm 23mm}
@media print{
  body{background:#fff;color:#000;line-height:1.6}
  .wrap{max-width:none;margin:0;padding:0}
  /* 표지·정답해설·판권면은 각자 쪽을 차지한다 — 상업 교재의 기본 구성이다. */
  .cover{break-after:page;border-bottom:none;margin-bottom:0;padding-bottom:0}
  .answers{break-before:page;margin-top:0;border-top:none;padding-top:0}
  .colophon{break-before:page;margin-top:0;border-top:none;padding-top:0}
  /* 단원마다 새 쪽. 첫 단원은 표지가 이미 쪽을 넘겼으므로 빼야 빈 쪽이 안 생긴다. */
  .unit{break-before:page;margin:0;padding-top:0;border-top:none}
  .unit:first-of-type{break-before:auto}
  /* **한 덩어리는 쪼개지 않는다** — 이게 이 블록의 핵심이다. */
  .q{break-inside:avoid;margin:0 0 1.4rem}
  .arow{break-inside:avoid}
  .vocab{break-inside:avoid}
  .given{break-inside:avoid}
  .choices{break-inside:avoid}
  /* 지문은 길어서 쪼개질 수 있다 — 대신 한 줄만 넘어가는 것을 막는다. */
  .passage{orphans:2;widows:2}
  h1,h2,h3{break-after:avoid}
  /* 화면용 가로 스크롤 상자는 인쇄에서 내용을 잘라 먹는다. */
  .tablewrap{overflow-x:visible}
  /* 표지의 검수 칩은 **내부 QA 다** — 상업 교재 표지에 "자동 검수 9/9 통과" 는 없다.
     지우는 게 아니라 인쇄에서만 감춘다: 화면(검수용)에서는 그대로 보이고, 같은 사실이
     판권면에 남는다('검수 … · 교정 초교·재교·삼교'). 그래서 정보는 안 잃는다. */
  .scorebar{display:none}
  /* 링크 밑줄은 지면에서 읽기를 방해한다. */
  a{text-decoration:none;color:inherit}
}
</style>
<div class="wrap">
<header class="cover">
  <div class="coverart">${coverSvg({ brand: coverBrand ?? COVER_BRAND, step: step ?? vLevel, totalSteps, schoolBand: schoolBand ?? `V${vLevel}`, accent }, 168)}</div>
  <p class="brand">${esc(colophon.ladder)}</p>
  <h1>${esc(colophon.title)}</h1>
  <p class="meta">${unitCount}단원 · ${itemCount}문항 · 총 ${totalMinutes}분 · 레벨 V${vLevel}</p>
  <div class="scorebar">
    <span class="chip ok">자동 검수 ${autoPassed}/${autoTotal} 통과</span>
    <span class="chip">지문 ${passageChip}</span>
    <span class="chip${answerBias && answerBias.biased ? '' : ' ok'}">정답 번호 ${answerBias ? `${answerBias.biased ? '쏠림' : '균등'} (χ²=${answerBias.chi2.toFixed(1)} · V=${answerBias.cramersV.toFixed(2)})` : '단답 위주'}</span>
    <span class="chip">출처 표기</span>
    <span class="chip${proof.defective ? '' : ' ok'}">교정 3회 · 지적 ${proof.defective}/${proof.passages}</span>
  </div>
  <div class="ladder" aria-label="시리즈 일곱 단 중 이 권의 자리">
    ${ladderStrip(step)
      .map((s) => `<span class="${s.startsWith('[') ? 'here' : ''}">${esc(s)}</span>`)
      .join('')}
  </div>
</header>
${unitsHtml}
<section class="answers">
  <h2>정답 및 해설</h2>
  ${answers
    .map(
      (a) => `<div class="arow">
    <span class="ano">${a.no}.</span> ${CIRCLED[a.answer - 1] ?? a.answer}
    ${
      a.explanation
        ? `<div class="expl">${esc(a.explanation.text)}</div>` +
          `<p class="efrom">${a.explanation.from === 'batch' ? '해설' : '규칙 근거'}</p>`
        : '<div class="noexpl">근거를 지문에서 확정하지 못해 해설을 싣지 않았다.</div>'
    }
  </div>`,
    )
    .join('')}
</section>
<footer class="colophon">
  <dl>
    <dt>제목</dt><dd>${esc(colophon.title)}</dd>
    <dt>사다리</dt><dd>${esc(colophon.ladder)} — 일곱 단 중 ${step ?? '—'}단</dd>
    <dt>판차</dt><dd>${esc(colophon.edition)}</dd>
    <dt>발행</dt><dd>${esc(colophon.issued)}</dd>
    <dt>검수</dt><dd>${esc(colophon.review)} · 교정 초교·재교·삼교</dd>
    <dt>출처</dt><dd>${esc(colophon.sourcePolicy)}</dd>
  </dl>
</footer>
</div>`
}
