# F02 학생 calibration 준비 (2026-10-05)

**상태: `pipeline-valid, content agent-reviewed, educational-validation-pending`.** F02 중1·고1의 본문과 target은 `f02-calibration-freeze.json`에 고정했다. 이 파일은 원천 revision/hash, 두 target/draft hash, passage SHA-256, Claude Code·Codex 검수 파일 SHA-256을 담는다. 로컬 원문과 검수 기록의 재대조 명령은 `node scripts/textbook/academic-reading-smoke/check-f02-freeze.mjs`다. 내용이 변하면 검수와 학생용 문항을 새로 만들어야 한다. 현 DB seed와 gold는 0건이다.

`f02-student-pilot.proposed.json`에 학생 결과를 보기 전 검토할 **수치 제안**을 기록했다. 각 버전에서 완전 측정 학생 최소 15명, 읽기 시간 75~360초, 이해 정확도 0.65~1, 어휘·구문 정확도 0.60~1, 추론 정확도 0.55~1, 미지어 등장 비율 0~0.20, 네 부담 점수 1~4/5를 제안한다. 정확도는 평균, 나머지는 중앙값으로 계산하고 열 항목이 모두 범위에 있어야 `TARGET_FIT`이다. 이 수치는 학년 규준이 아니라 작은 pilot의 운영상 가설이다. 자료를 보기 전에 책임자가 적합성·측정 절차·상한/하한을 검토하고 승인해야 한다. 지금 파일은 `proposed_unsealed`이며 기존 v2 protocol의 null band와 승인 gate를 우회하지 않는다.

`LEVEL_SEPARATION`은 학년 간 점수 비교와 분리한다. 별도 고1 공통 집단을 F02 두 버전에 무작위 배정하고, 한 학생은 한 버전만 읽게 한다. 각 arm 완전 측정 최소 15명, 고1판의 추론 부담 중앙값이 중1판보다 0.5점 이상 높고, 어휘 또는 문장 부담 중 적어도 하나도 0.5점 이상 높으며, 두 arm의 이해 정확도 모두 0.65 이상이면 예비 통과로 제안한다. arm 수·배정·측정이 빠지면 `INSUFFICIENT_EVIDENCE`다. 공통 구성개념을 묻는 버전별 문항과 독립 채점이 필요하다. 동일 문항을 두 본문에 기계적으로 이식하거나 학년별 서로 다른 학생의 점수를 빼서는 안 된다. 작은 표본의 예비 통과는 일반화 또는 gold 근거가 아니다.

현재 8편용 문항 revision 3은 **수정 전 F02 텍스트**를 기준으로 한다. 현재 해시의 F02에서 근거 문장을 다시 표시하고, 두 버전의 어휘·구문·추론·이해 문항과 채점 기준을 사람 검토한 뒤 새 manifest/학생 packet을 생성해야 한다. blind 전문가 2명의 별도 의미 평가도 학생 시행 전 필요하다. Agent의 두 차례 pass는 이 인간 평가를 대체하지 않는다. 책임자는 문항·순서·재열람·단계별 답 보존·모집 및 무응답 제외·무작위 배정·사전 등록 시각을 응답 접근 전에 봉인한다. 기존 `registerV2`는 승인과 manifest 일치를 요구하며, 현재 자료는 등록되지 않았다.

판정 순서는 F02 의미 평가 → 학년별 `TARGET_FIT` → 공통 집단 `LEVEL_SEPARATION`이다. 결과가 하나라도 부족하면 F06/F14/F18 확대·gold·seed를 보류한다. F02 결과는 calibration에만 쓰고, 이후 서로 다른 도메인의 독립 자료로 규칙을 재검증한다. 학생 관측 0건이며 성공률이나 separation 효과를 보고할 수 없다.
