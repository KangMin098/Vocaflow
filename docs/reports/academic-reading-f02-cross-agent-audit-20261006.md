# F02 cross-agent local audit — 2026-10-06

F02의 활성 실행 경로는 계정 로그인된 Claude Code CLI와 Codex CLI이다. API 키 기반 직접 provider 호출은 사용하지 않았다. 이 보고서의 판정은 로컬 실행기 입력·출력의 결속(E3)에 한정되며 공급자가 특정 프롬프트를 수신했다는 인증이나 실제 학년 난도 검증이 아니다.

| Gate | 결과 |
|---|---|
| Stage A | Claude 학생 → Codex blind 채점 1패킷 통과 · run `fb8fde83-2848-43d4-a571-a6f0db57232a` |
| Stage B | 양방향 2패킷 통과 · run `77d8148b-8d40-45f5-8374-559c543287e3` |
| Stage C | 실제 Stage A/B 출력 복사본에서 27종 × 3패킷 = 81건 변조 모두 거부 |
| 교차 리뷰 | `node agents/scripts/review.mjs --base 63fd0ed15` → `NO_FINDINGS` |
| 새 배치 | run `7ba3be20-317c-4964-aa8a-7912e3af2728` · frozen seal `55b46215e7bbc16f6d8ee4f81549041692b1f8476b4e7776880cb6fedeb16031` · 28/28 완료 |
| 배치 재검증 | `verify` 통과 · `evidence_level=E3` · `synthetic_validation_valid_n=28` |
| 내보내기 | `export-verified` 통과 · 응답 28건(Claude 계열 14, Codex 계열 14) · 지문별 14건 · 동일 프로필 비교쌍 14개 |

새 배치는 프로필마다 두 지문에 같은 학생 모델 계열을 배정하고 프로필 간에는 모델 계열을 교차했다. 채점자는 항상 반대 계열이며 학생 프로필·정답·채점기준은 학생 호출에 포함하지 않았다. 저장된 `responses.json`과 `analysis.json`은 Git에서 제외된 `scripts/textbook/frym-synthetic/work/cross-agent-batch-rev9-20261006/`에만 있다. 분석 상태는 `synthetic_diagnostic_unbenchmarked`이다. 이전 v1 28건, v2 실패 27/28건, 리뷰로 무효화된 중간 배치는 새 run과 합산하지 않았다.

로컬 산출물 SHA-256: `run.json` `7073549d55fdd360efd9ff555cddc161e715af14dfa686e52d2f4f8007447ae8`, `stage-c-gate.json` `8add5a9635b9f02122b48cd0b15ad0f77c233fbc7a43cdba5a3805a4451cec17`, `responses.json` `f27dda0791e75ab57e0af22703b3b72d7d7cb5a52daed46b73eb98ddb1185974`, `analysis.json` `ef8bdc13d4ce832b74dd7599f9e140fcc41e21eca3084317b6815fddbe1b8e3e`. 이 해시는 로컬 파일 동일성 확인용이며 공급자 서명이 아니다.

Codex 반환 모델과 provider 수신 프롬프트에 대한 공급자 증명은 없다. 로컬 증거는 정확한 stdin, 명령 인자·CLI 버전, 격리 작업 디렉터리, 보관된 계정 지시 파일, 세션/스레드 ID, 원출력, 최종 메시지와 파싱 결과를 연결한다. 유효 합성 N=28은 실제 학생 N으로 환산하지 않는다. 실제 학생 `N=0`, 외부 benchmark 없음, `TARGET_FIT=unopened`, `LEVEL_SEPARATION=unopened`, `Gold-S=0`, `DB seed=0`이다. 다음 교육적 게이트는 외부 기준 자료의 사전 봉인과 calibration이다.

F02 집중 회귀와 실제 산출물 Stage C 검사는 통과했다. 저장소 전체 `pnpm turbo run lint typecheck test`는 웹 테스트 **4,241 통과 / 5 실패**로 종료됐다. 확인된 실패 한 건은 F02와 별개의 실 DB 오답 지도 신선도 불일치(`802` 대 `807`)이다. 나머지 실패 원인은 이 보고서에서 분리 판정하지 않았다. 따라서 전체 CI 통과 또는 이번 변경과 무관한 실패라고 주장하지 않는다. 이 상태에서 push는 별도 승인 조건을 따른다.
