# F02 학생 pilot 책임자 봉인 검토표

**보존 기록:** 이 표는 사람 pilot을 재개할 경우의 미결정 항목이다. 현재 F02 운영은 [합성 교실 smoke v1](./academic-reading-f02-synthetic-smoke-20261005.md) 진단으로 전환했으며 이 표로 학생 모집을 시작하지 않는다.

**상태: 미봉인.** 이 기록은 학생 모집과 응답 열람 전에 책임자가 [사전등록 검토본](./academic-reading-f02-preregistration-20261005.md)을 검토할 때 쓴다. 작성 자체는 승인, 학생 검증, gold 또는 DB 적재가 아니다.

## 현재 결속 대상

| 산출물 | SHA-256 |
|---|---|
| 중1 본문 | `cca04eb86c621f597ebec68b823a43ed60e988f00fcd5b894173c5a9caffd915` |
| 고1 본문 | `00c5035c9ef24e240a8eabd56c8ee74ce447b8245c4d5a61c6ce381cbd49139f` |
| [문항 세트](../../scripts/textbook/frym-validation/f02-items.proposed.json) | `838e00df02d8a02a4a1a7f54855fecd2fe978cc7236113a7c781a700dd1c165f` |
| [채점 기준](../../scripts/textbook/frym-validation/f02-scoring-key.proposed.json) | `c7a3562b8438fb4df13ca4848ab413e41235a5d2022e3ed272897398fdc15f04` |
| [pilot 규칙](../../scripts/textbook/frym-validation/f02-student-pilot.proposed.json) | `9a2986c8e3d11e1fad4584a1f52c4c88c585912ace2551dae50286f2dac4734d` |
| 중1/고1 배포 도구 | `234473beca862f0c0095cd60fa45b6ac566691523300e351f3ad736ff020e45d` / `027e8a13bfad98ae32f4dd647020cf1d555a14edbbdda776c145343458e4cb7a` |

모집 전에 `node scripts/textbook/frym-validation/f02-preregistration.mjs --check`로 [manifest](../../scripts/textbook/frym-validation/f02-preregistration.proposed.json)의 본문·문항·채점·규칙·배포 도구 결속을 확인한다. 문항/채점/규칙 수정 시 새 revision과 해시를 등록하며 기존 응답과 합치지 않는다. 본문 수정 시 calibration freeze 검수부터 다시 한다.

## 책임자 결정 기록 (모두 대기)

| 검토·확정 항목 | 봉인 전에 남길 증거 | 결정 |
|---|---|---|
| 두 본문과 각 12문항 | 문항별 근거·정답 허용 범위·0/0.5/1 채점 기준, 두 버전의 공통 구성개념과 문항 차이 검토 | 대기 |
| `TARGET_FIT` | 두 학년 핵심 이해도 평균 ≥0.65 hard gate 및 다른 지표의 supporting/diagnostic 역할과 범위 승인 | 대기 |
| `LEVEL_SEPARATION` | 고1 대상 두 arm의 추론·문장 부담 중위값 차 각각 ≥0.5, 양쪽 이해도 ≥0.65; 문항/어휘 차이만으로 생긴 효과인지 검토할 방법 | 대기 |
| 표집·배정 | 중1 `middle_target`, 고1 `high_target`/`middle_anchor` 모집처·학년 확인·고1 무작위 배정 기록; arm당 유효 완료 최소 15명, 배정 최대 30명 | 대기 |
| 시행 | 한 학생에게 한 버전만 노출, 사전 노출 질문, 읽기/질문 단계, 시간·이탈 측정, 동의·철회·개인정보 처리 담당 | 대기 |
| 결측·채점 | 30초 미만 읽기, 300초 초과 확인된 이탈, 미완료·중복·교차 노출, 동일 응답 수동 검토, 독립 blind 채점 2명과 불일치 조정자 | 대기 |
| 측정도구 | 이해도·부담 문항의 해석 가능성 및 arm별 문항·응답 분포와 불확실성 보고 방법 | 대기 |

**봉인 메타데이터:** 책임자 ID `미지정` · 승인 시각 `미기록` · 등록 위치/증거 `미기록` · 운영·배정·측정 절차 `미기록`. 책임자는 위 항목과 실제 배포 도구를 검토한 뒤 [제안 protocol](../../scripts/textbook/frym-validation/f02-student-pilot.proposed.json)의 `human_lead_id`, `approved_at`, `registration_evidence`, `operations` 및 manifest 등록 정보를 근거와 함께 채운다. 이 표의 `대기`만 `승인`으로 바꿔서는 기계적 등록이 성립하지 않는다.

하나라도 미확정이거나 해시가 맞지 않으면 모집·응답 열람을 시작하지 않는다. 제외 세션은 원자료와 사유를 보존한다. arm별 유효 완료 수 부족은 `inconclusive_sample`, 배정·해시·측정 오류는 `measurement_invalid`로 기록한다. `TARGET_FIT`과 `LEVEL_SEPARATION`을 독립 판정하고 사람의 구성개념 검토를 합친 뒤에야 `educationally_validated`를 검토한다. F02 calibration만으로 gold 또는 `seed-eligible`이 되지 않으며 F06/F14/F18 확장과 DB seed는 보류한다.
