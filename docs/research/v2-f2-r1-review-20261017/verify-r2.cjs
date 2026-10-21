// docs/research/v2-f2-r1-review-20261017/verify-r2.cjs
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = 'D:/workspace/Vocaflow-private-reviews/v2-f2-review-inputs-20261017';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readBound = (path, expected) => {
  const bytes = fs.readFileSync(path);
  assert.equal(sha256(bytes), expected, path);
  return JSON.parse(bytes);
};
const firstSha = '2c86c19f96fa1eb1d9005870dec9b66a4bc8f600196f7c4df68f7f2f227181dc';
const r2InputSha = 'd988ca5331e1ad1584e20be55515c5234f6acbd03b44c41981f3e6e36198e99b';
const r2SubmissionSha = '9c86d88f6562ad11e722fad42a5ae119a618f6e26679b2e3ef5709c24754dfb2';
const first = readBound(root + '/r1/submission/R1-Codex-G-20261017-r1-review.json', firstSha);
const source = readBound(root + '/r2-held/R2-input.json', r2InputSha);
const submission = readBound(root + '/r1/submission/R2-Codex-G-20261017-r1-review.json', r2SubmissionSha);
const original = readBound(root + '/r1/R1-input.json', first.inputSha256);
const otherR1Hash = sha256(fs.readFileSync(root + '/r1/submission/R1-01a14958-cdf7-7ff1-b271-3a880c157d90.json'));
assert.equal(otherR1Hash, 'b7905aacb95b56eb90d6c721d3ede7a563f8cbd0d406b569cf9ff6e784c84470');
assert.notEqual(firstSha, otherR1Hash);
assert.equal(submission.stage, 'R2');
assert.equal(submission.session, first.session);
assert.equal(submission.revision, source.revision);
assert.equal(submission.inputSha256, r2InputSha);
assert.equal(submission.r1SubmissionSha256, firstSha);
assert.equal(submission.release.ownerClaimedVerifiedR1Sha256, otherR1Hash);
assert.equal(submission.release.ownerClaimMatchesThisSessionsR1, false);
assert.deepEqual(submission.units.map(unit => unit.code).sort(), source.units.map(unit => unit.code).sort());
assert.equal(new Set(submission.units.map(unit => unit.code)).size, 8);
let swaps = 0;
let rejectedSwaps = 0;
let rejectReasons = 0;
const counts = { designAgreement: {}, verdict: {} };
for (const unit of submission.units) {
  const r1 = first.units.find(row => row.code === unit.code);
  const design = source.units.find(row => row.code === unit.code);
  const passage = original.units.find(row => row.code === unit.code);
  assert.deepEqual(unit.r1Snapshot, {
    choice: r1.choice, bestCandidate: r1.bestCandidate, clarity: r1.clarity,
    construct: r1.construct, phraseOnlyDecidable: r1.phraseOnlyDecidable,
    firstVerdict: r1.firstVerdict, passageSha256: r1.passageSha256
  });
  assert.equal(r1.passageSha256, sha256(Buffer.from(passage.passage, 'utf8')));
  assert.equal(unit.designedAnswer, design.designedAnswer);
  assert.equal(unit.designerConstruct, design.construct);
  assert.equal(unit.answerChoiceMatches, r1.choice === null ? null : r1.choice === design.designedAnswer);
  if (r1.choice === null) assert.equal(unit.designAgreement, 'ambiguous');
  assert.ok(['agree', 'disagree', 'ambiguous'].includes(unit.designAgreement));
  assert.ok(['PASS', 'REWORK', 'DEFER'].includes(unit.verdict));
  assert.deepEqual(unit.contextSwapValid.map(row => row.label).sort(), Object.keys(design.contextSwap).sort());
  assert.equal(unit.contextSwapCoverage, Object.keys(design.contextSwap).length ? 'complete' : 'not_provided');
  for (const check of unit.contextSwapValid) {
    assert.equal(check.sentence, design.contextSwap[check.label]);
    assert.equal(typeof check.valid, 'boolean');
    assert.ok(check.reason.length > 20);
    swaps++;
    if (!check.valid) rejectedSwaps++;
  }
  assert.deepEqual(unit.rejectionReview.map(row => row.label).sort(), Object.keys(design.designerRejectWhy).sort());
  rejectReasons += unit.rejectionReview.length;
  for (const index of [...design.cueSentences0.sentences, ...design.cueSentences0.accepted]) {
    assert.ok(passage.sentenceRanges[index]);
  }
  for (const key of Object.keys(counts)) counts[key][unit[key]] = (counts[key][unit[key]] || 0) + 1;
}
assert.equal(swaps, 12);
assert.equal(rejectedSwaps, 2);
assert.equal(rejectReasons, 12);
assert.deepEqual(counts.designAgreement, submission.summary.designAgreement);
assert.deepEqual(counts.verdict, submission.summary.verdict);
assert.equal(submission.summary.providedContextSwaps, swaps);
assert.equal(submission.summary.invalidContextSwaps, rejectedSwaps);
assert.equal(submission.summary.validContextSwaps, swaps - rejectedSwaps);
assert.deepEqual(submission.summary.unitsWithoutContextSwaps, ['Q02', 'Q03', 'Q05', 'Q08']);
const output = {
  verification: 'PASS', verifiedAt: new Date().toISOString(),
  scope: '해시 결속·불변 R1 스냅샷·8개 코드·제공 대조 문장/배제 이유 전수 포함·문장 원문 일치·집계 일치. 의미 정확성/독립성 자격의 기계 인증이 아니다.',
  r1Sha256: firstSha, r2InputSha256: r2InputSha, r2SubmissionSha256: r2SubmissionSha,
  ownerNamedOtherR1Sha256: otherR1Hash, ownerNamedR1MatchesActualBaseline: false,
  r1Preserved: true, units: 8, contextSwapsChecked: swaps, rejectedSwaps, designerRejectReasonsChecked: rejectReasons,
  judgments: counts, missingContextSwaps: submission.summary.unitsWithoutContextSwaps,
  overallVerdict: 'DEFER',
  readOnlyStatus: 'PowerShell 별도 실측. 두 R1 및 R2 파일 모두 읽기 전용.',
  productOrDatabaseChanges: false
};
if (process.argv.includes('--record')) {
  fs.writeFileSync('docs/research/v2-f2-r1-review-20261017/R2_VERIFICATION.json', JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
}
console.log(JSON.stringify(output, null, 2));
