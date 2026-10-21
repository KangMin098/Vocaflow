// docs/research/v2-f2-r1-review-20261017/verify-r1.cjs
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = 'D:/workspace/Vocaflow-private-reviews/v2-f2-review-inputs-20261017';
const inputPath = root + '/r1/R1-input.json';
const submissionPath = root + '/r1/submission/R1-Codex-G-20261017-r1-review.json';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const bytes = fs.readFileSync(submissionPath);
const submission = JSON.parse(bytes);
const inputBytes = fs.readFileSync(inputPath);
const input = JSON.parse(inputBytes);
assert.equal(sha256(bytes), '2c86c19f96fa1eb1d9005870dec9b66a4bc8f600196f7c4df68f7f2f227181dc');
assert.equal(sha256(inputBytes), submission.inputSha256);
assert.equal(submission.stage, 'R1');
assert.equal(input.units.length, 8);
assert.equal(submission.units.length, 8);
assert.equal(new Set(submission.units.map(unit => unit.code)).size, 8);
let evidenceExpressions = 0;
let sentenceRanges = 0;
const markerOmittedEvidence = [];
const normalizeMarker = text => text.replace(/[①-⑳]/g, '').replace(/\s+/g, ' ').trim();
for (const unit of submission.units) {
  const source = input.units.find(row => row.code === unit.code);
  assert.ok(source, unit.code);
  assert.deepEqual(unit.target, source.target);
  assert.equal(unit.passageSha256, sha256(Buffer.from(source.passage, 'utf8')));
  assert.equal(unit.sourceRevision, null);
  assert.equal(unit.inputRevision, input.revision);
  for (let index = 0; index < source.sentenceRanges.length; index++) {
    const range = source.sentenceRanges[index];
    assert.ok(range[0] >= 0 && range[1] > range[0] && range[1] <= source.passage.length);
    if (index > 0) assert.equal(source.passage.slice(source.sentenceRanges[index - 1][1], range[0]), ' ');
    sentenceRanges++;
  }
  const targetRange = source.sentenceRanges[source.target.sentenceIndex0];
  assert.equal(source.passage.slice(...targetRange), source.target.sentenceText);
  assert.ok(source.target.sentenceText.includes(source.target.expression));
  assert.deepEqual(unit.optionDispositions.map(row => row.label).sort(), source.options.map(row => row.label).sort());
  for (const option of unit.optionDispositions) {
    assert.ok(['fits', 'contradicted', 'possible'].includes(option.status));
    assert.ok(option.reason.length > 10);
  }
  assert.ok(unit.choice === null || source.options.some(row => row.label === unit.choice));
  if (unit.clarity !== 'clear') assert.equal(unit.choice, null);
  for (const index of unit.evidenceSentences0) assert.ok(source.sentenceRanges[index]);
  for (const evidence of unit.evidence) {
    assert.ok(unit.evidenceSentences0.includes(evidence.sentenceIndex0));
    const sentence = source.passage.slice(...source.sentenceRanges[evidence.sentenceIndex0]);
    for (const expression of evidence.expressions) {
      if (!sentence.includes(expression)) {
        assert.ok(normalizeMarker(sentence).includes(normalizeMarker(expression)), unit.code + ': ' + expression);
        markerOmittedEvidence.push({ code: unit.code, sentenceIndex0: evidence.sentenceIndex0, expression, reason: '봉인 제출의 근거 발췌가 원문 중간의 동그라미 자리 표식을 생략했다. 원문/제출을 수정하지 않고 표시한다.' });
      }
      evidenceExpressions++;
    }
  }
  assert.ok(['v2_centered', 'v2_s5_boundary'].includes(unit.construct));
  assert.equal(typeof unit.phraseOnlyDecidable, 'boolean');
}
const counts = key => submission.units.reduce((result, unit) => {
  result[String(unit[key])] = (result[String(unit[key])] || 0) + 1;
  return result;
}, {});
const output = {
  verification: 'PASS', verifiedAt: new Date().toISOString(),
  scope: '입력·제출 해시, 8코드, 선택지 완비, 문장 범위, 근거 표현의 원문 일치(아래 3건은 자리 표식 생략 후 일치), target 동일성. 의미 판단의 정확성을 기계 인증하지 않는다.',
  inputSha256: sha256(inputBytes), r1Sha256: sha256(bytes),
  sourceRevisionAvailable: false,
  units: input.units.length, sentenceRangesChecked: sentenceRanges, evidenceExpressionsChecked: evidenceExpressions,
  markerOmittedEvidence,
  clarity: counts('clarity'), construct: counts('construct'), phraseOnlyDecidable: counts('phraseOnlyDecidable'), firstVerdict: counts('firstVerdict'),
  r2Status: 'NOT_OPENED_AWAITING_OWNER_RELEASE',
  blindEligibility: 'DEFER_EXPECTATION_EXPOSURE_DISCLOSED',
  note: '읽기 전용 속성은 PowerShell로 별도 실측한다.'
};
console.log(JSON.stringify(output, null, 2));
