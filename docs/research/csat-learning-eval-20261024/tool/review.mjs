// docs/research/csat-learning-eval-20261024/tool/review.mjs
// 불일치 사례 검토용 단일 정적 HTML. 서버 없음 · 외부 자원 없음 · 모든 내용은 이스케이프 · 판정은 JSON 내려받기.

import { LEVELS } from './schema.mjs';

export function escapeHtml(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** <script> 안에 넣을 JSON. '<' 를 이스케이프해 </script> 탈출을 막는다. */
export function safeJson(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

const e = escapeHtml;

function list(items) {
  if (!items || items.length === 0) return '<span class="muted">없음</span>';
  return `<ul>${items.map((x) => `<li>${e(x)}</li>`).join('')}</ul>`;
}

function renderCase(c, i) {
  const id = `c${i}`;
  const toggles = Object.entries(c.response.condition_toggles).map(([k, v]) => `${k} = ${JSON.stringify(v)}`);
  const judges = c.judgments.map((j) => `
      <section class="rater" aria-label="평가자 ${e(j.rater_id)}">
        <h4>${e(j.rater_id)} <span class="tag">${e(j.rater_kind)}</span></h4>
        <p>수준: <strong>${e(j.level)}</strong> · 자격: ${e(j.eligibility || '기재 없음')}</p>
        <table><caption>근거 코드 추적</caption><thead><tr><th scope="col">코드</th><th scope="col">ref</th><th scope="col">응답 요소</th></tr></thead><tbody>
        ${j.evidence_trace.map((t) => `<tr class="${t.ok ? '' : 'bad'}"><td>${e(t.code)}</td><td>${e(t.ref || '-')}</td><td>${t.ok ? e(t.element) : `추적 불가(${e(t.reason)})`}</td></tr>`).join('') || '<tr><td colspan="3">근거 없음</td></tr>'}
        </tbody></table>
        <p class="note">메모: ${e(j.note || '-')}</p>
      </section>`).join('');
  const events = c.exposure.events.map((ev) => `${ev.event_type || ev.type || '?'} → ${ev.mapped_level} (${ev.timing})`);
  const radios = [...LEVELS, 'NOT_EVALUATED', 'UNKNOWN'].map((l) => `<label class="opt"><input type="radio" name="${id}-level" value="${e(l)}"> ${e(l)}</label>`).join('');
  return `
  <article class="case" id="${id}" data-record="${e(c.record_id)}">
    <h3>${i + 1}. ${e(c.record_id)}</h3>
    <p class="meta">학습자 ${e(c.learner_pseudo_id)} · 문항 ${e(c.item_id)} (${e(c.item_version)}) · ${e(c.phase)} · ${e(c.path)} · ${e(c.task_format)} · <span class="tag">${e(c.data_origin)}</span></p>
    <p>불일치: ${e(c.reasons.map((r) => r.kind + (r.diff ? `(차 ${r.diff})` : '')).join(', '))}</p>
    <div class="grid">
      <section aria-label="응답"><h4>응답</h4>
        <p>선택지: ${e(c.response.selected_option)}</p>
        <p>근거 구간:</p>${list(c.response.evidence_span_ids)}
        <p>오답 원인 코드:</p>${list(c.response.failure_codes)}
        <p>조건 토글:</p>${list(toggles)}
      </section>
      <section aria-label="노출"><h4>노출</h4>
        <p>시도 전 최대: <strong>${e(c.exposure.pre_attempt_max)}</strong> · 자격: <strong>${e(c.exposure.eligibility)}</strong> (${e(c.exposure.reason)})</p>${list(events)}
      </section>
    </div>
    <div class="grid">${judges}</div>
    <fieldset><legend>조정 판정 수준</legend>${radios}</fieldset>
    <p><label for="${id}-elig">조정 자격</label>
      <select id="${id}-elig"><option value="">선택 안 함</option><option>INDEPENDENT_ELIGIBLE</option><option>ASSISTED_ONLY</option><option>UNKNOWN</option></select></p>
    <p><label for="${id}-note">조정 근거 메모</label><br><textarea id="${id}-note" rows="2" cols="60"></textarea></p>
  </article>`;
}

/**
 * @param report listDisagreements() 결과
 * @param opts {title, generatedAt(주입 문자열, 선택)}
 */
export function renderReviewHtml(report, { title = '판정 불일치 검토', generatedAt = null } = {}) {
  const synthetic = report.cases.some((c) => c.data_origin === 'SYNTHETIC');
  const meta = { generated_at: generatedAt, n_cases: report.n_cases, record_ids: report.cases.map((c) => c.record_id) };
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
<style>
:root{--bg:#fff;--fg:#1d1d1f;--muted:#666;--line:#ccc;--bad:#fbe9e7;--focus:#0b57d0;--warn:#9c3a30}
@media (prefers-color-scheme: dark){:root{--bg:#161616;--fg:#eee;--muted:#aaa;--line:#444;--bad:#3a2220;--focus:#8ab4f8;--warn:#f28b82}}
body{background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;margin:0 auto;max-width:1100px;padding:16px;word-break:keep-all}
.banner{border:2px solid var(--warn);color:var(--warn);padding:8px 12px;font-weight:700}
.case{border-top:1px solid var(--line);padding:12px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.meta,.muted,.note{color:var(--muted)}.tag{border:1px solid var(--line);padding:0 6px;font-size:12px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid var(--line);padding:4px 6px;text-align:left}tr.bad td{background:var(--bad)}
.opt{display:inline-flex;align-items:center;min-height:44px;margin-right:12px}
button,select,textarea,input{font:inherit;min-height:44px}
:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
</style></head><body>
<h1>${e(title)}</h1>
${synthetic ? '<p class="banner" role="note">SYNTHETIC — 학습 효과 근거 아님</p>' : ''}
<p>사례 ${e(report.n_cases)}건 / 기록 ${e(report.n_records)}건${generatedAt ? ` · 생성 ${e(generatedAt)}` : ''}. 조정 결과는 아래 버튼으로 JSON 파일로 내려받는다(서버 전송 없음).</p>
<main>${report.cases.map(renderCase).join('')}</main>
<p><label for="adjudicator">조정자 가명 ID</label> <input id="adjudicator" autocomplete="off"></p>
<button type="button" id="export">조정 결과 JSON 내려받기</button>
<p id="status" role="status" aria-live="polite"></p>
<script id="meta" type="application/json">${safeJson(meta)}</script>
<script>
(function(){
  var meta = JSON.parse(document.getElementById('meta').textContent);
  document.getElementById('export').addEventListener('click', function(){
    var out = { kind: 'adjudications', generated_at: meta.generated_at, adjudicator: document.getElementById('adjudicator').value, items: [] };
    meta.record_ids.forEach(function(rid, i){
      var id = 'c' + i;
      var sel = document.querySelector('input[name="' + id + '-level"]:checked');
      out.items.push({ record_id: rid, level: sel ? sel.value : null, eligibility: document.getElementById(id + '-elig').value || null, note: document.getElementById(id + '-note').value });
    });
    var blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'adjudications.json';
    document.body.appendChild(a); a.click(); a.remove();
    document.getElementById('status').textContent = out.items.filter(function(x){ return x.level; }).length + '/' + out.items.length + '건 판정을 내보냈다.';
  });
})();
</script>
</body></html>
`;
}
