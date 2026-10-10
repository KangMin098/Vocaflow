# FYM F02 수정본 이중검수 및 적재 예행

2026-10-05. [첫 실콘텐츠 smoke](./academic-reading-smoke-20261005.md)의 Claude Code `reject`, Codex `insufficient_evidence` 판정을 출발점으로 삼았다. 현재 DB의 FYM 원문 UUID `80b57391-d511-4134-b8aa-8a22fe3f2ebc`, revision `2026-09-25T08:00:41.071424+00:00`, SHA-256 `be013e6a1cafece83b78f84a8de7ef31a578842000cce580dccea11caccda4dd`와 중1·고1 target key가 이전 실행과 같은지 확인한 뒤 새 초안을 만들었다. 원문 전문과 실제 검수 응답은 ignored `.agent-logs/academic-reading-f02-r2/`에만 보관한다.

| 수정 층위 | 중1 | 고1 |
|---|---|---|
| `CONTENT_ANALYSIS` | 시각의 가치를 명시하고 기능 대비·절대 순위 부정에 각각 원문/지문 인용을 연결. 주목 빈도 일반화를 없애고 원문에 있는 걷기·촉각 의존으로 좁힘 | 원문에 없던 ‘한 과제의 예 → 모든 과제’ 논증을 제거. 원문의 설문과 촉각 상실 사례를 각각 보존하고 두 사례의 해석은 각색자의 해석으로 명시 |
| `ITEM_GROUNDING` | R2는 두 세부 사실, R3은 봉지·걷기 사례의 관계(난도 3), R4는 핵심 주장으로 분리. R4 답 전체에 대응하는 세 근거 연결 | R4는 중심 주장, R6은 네 문단 전개, R7은 몸과 세계의 접촉 표현, R8은 설문·촉각 사례의 공통 논증 한계를 각각 묻게 분리 |
| `DIFFICULTY_EVIDENCE` | 어휘·구문·정보 밀도·담화·추론·배경지식 각각 별도 근거. R2는 직접 이해, R3/R4는 사례 관계·근거 종합 | 같은 V3 언어 목표에서 설문·촉각 사례를 비교해 R6의 문단 전개 추적, R8의 두 주장 평가를 요구. 독립적 난도 실측은 아님 |

여섯 축은 `reading_analysis.passage_profile`에 들어가므로 아래 **완성 draft hash에 포함**된다. 검수 패킷의 `difficulty_evidence_bundle`은 그 필드에서 파생된다. 어휘는 저장소의 `extractBookLemmas`와 DB `shared_dictionary.v_level`로 고유 표제어 p75를 계산했다. 중1은 47/52개 매칭, 고1은 42/58개 매칭, 두 지문 모두 매칭 표제어 p75 **V2**였다. 각각 V3 초과 8·5개, 미매칭 5·16개다. 이는 V3 목표에 대한 독립적인 참고값이며 학생 난도 인증이나 정확한 V3 일치의 증명은 아니다. 고1은 어휘를 더 어렵게 만드는 대신 담화·추론 과제를 다르게 설계했다.

| 대상 | target key | 이전 완성 draft hash | 새 완성 draft hash | 분량 | Claude Code / Codex |
|---|---|---|---|---:|---|
| F02-middle1 | `a7f5e450d09a4eb4e12ca4bb` | `b5cc79d2846903f244a70b83b4f18013aee3da2ed7e4d082cd89b8b4fec389fe` | `26b0d895a61bd3ddfaa6d9ae2e39d1d73d8fdc2c7ff28892646ee2312bcc373b` | 200어 | `pass` / `pass` |
| F02-high1 | `b117d0a5ee0a0fc72bc711da` | `c97a53cb9f224e35e6a188efcfc174caa604489c1e24cb3ebfd32f5b96d7de61` | `e4a864a598805bed38355044977aaf46b639ee0af48a152160d69409e8391cee` | 196어 | `pass` / `pass` |

두 검수자는 같은 원문·전체 target·완성 지문/분석/모든 문항 계획·권리 근거 패킷만 독립적으로 읽었다. 이전 검수에서 중1의 주목 빈도 일반화, 고1의 중복 문항과 과장된 R8 난도를 지적해 해시를 다시 바꿨다. Claude Code의 서술형 `pass` 응답은 판정을 바꾸지 않고 같은 검수자에게 JSON으로 다시 받았다. 네 최종 검수 모두 12개 차원 true·왜곡 0개이며, gate가 원문/target/draft hash와 실제 인용을 대조했다. 남은 concerns는 중1의 처방형 문장, 고1 `Neither one alone`의 잠재적 오독, 미매칭 어휘, 문항 난도의 미실측 등이다. 학생 평가 결과는 아직 없다.

`adapt-drain-import.mjs`를 두 target에서 **`--commit` 없이** 실행했다. 각각 1행 검사, 적재 가능 0, 건너뜀 1이며 사유는 `educational validation required before DB seed`였다. `run-injections.mjs`에서는 실제 검수 `approved`를 확인하고, 소스/target/각색 hash 변경·검수 뒤 마지막 문단 절단·권리 철회를 중1·고1 모두에서 차단했다. baseline 문항 gate도 통과했다. **DB seed 0, 실제 문항 생성 0, 학생 검증 0, gold 0**이다. 따라서 현재 상태는 `pipeline-valid, content agent-reviewed, educational-validation-pending`이다.

다음 주제 후보는 같은 보존 규칙 묶음의 F06(도시농업·서식처), F14(COVID-19 관련 정신건강 집단 비교), F18(초파리 종 간 상관)이다. 각 주제는 F02와 별개로 현재 원문/hash·권리·원 연구 연결을 확인하고, 완성 item plan과 독립 이중검수를 새로 받아야 한다. F02 통과를 이 세 주제에 전이하거나 생산 준비 완료로 해석하지 않는다.
