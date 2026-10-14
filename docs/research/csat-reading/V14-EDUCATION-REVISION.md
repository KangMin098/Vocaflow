<!-- docs/research/csat-reading/V14-EDUCATION-REVISION.md -->
# 교육 패키지 독립 비판 이후 revision1

2026-10-14. 별도 AI의 최초 교육 검토는 12과제 모두에서 적어도 하나의 명세 결함을 발견했다. 48facet 중 meets 기준은 46개 지지·2개 결함이었지만, 모든 partial 기준이 같은 일반 문구여서 48개 모두 경계가 불충분했다. 이를 교수 효과 실패나 모든 의미 분석이 틀렸다는 판정으로 바꾸지 않는다. 최초 패키지·상세 질문·Gold·첫 검토의 바이트는 보존했다.

[revision1 공개 원장](./data/v14/education-revision1.json)은 과제별 변경 필드·미해결·재검토 질문과 상세 비공개 파일의 해시를 결속한다. 실제 기출의 질문·Gold·선지별 내용/fit은 ignored `scripts/research/csat-reading/local/v14/education-packages-revision1.json`에서만 볼 수 있다. 공개 Git은 답안 대신 계약과 변경 기록을 제공한다.

| 수정 대상 | revision1 변경 | 독립 재검토에서 확인할 것 |
|---|---|---|
| R5 | 중심·범위와 함께 요청한 근거·비유/부연·예시 역할을 전체 응답에 포함. 직접 확인 후보 질문에서 내용 대조 힌트를 제거 | 조건·강도·근거 역할이 실제 글에 대응하는가, 질문이 답의 내용을 공급하는가 |
| E3 | 세 과제 각각 실제 다섯 후보의 의미 명제·본문 범위·내용 판정·발문 fit 총 15행. AI 먼저 동결 후 FOV 응답 양식 공개, 그 사이 정답 피드백 없음 | 한 후보 요약을 FOV 전체 답으로 읽지 않는가, 각 근거와 같은 대상·범위가 보존되는가 |
| S5 | 조건 안/밖 실제 사례와 조건 밖 미결정 추가. 도표 과제의 연도·지표·단위·수치와 질문에 명시된 합성 동등 경계 예 추가 | 추가 예 요구와 채점 기준이 일치하는가, 파생 수치 접근을 시각 읽기 수행으로 전환하는가 |
| V2 | 전체 응답·대안에 문맥 논항·근거·배제 뜻·범위 포함. 상응 관계를 인과 결정으로 강화한 대안 제거 | 자연스러운 대안이 필요한 출력 모두를 보존하며 인과·발견 완료·전체 적합성으로 강화하지 않는가 |
| 48facet | 각 facet의 source-condition별 partial/defer 경계. 명시적 의미 변형은 결함, 미제출은 미관찰/보류 | 한 facet이 충족된 부분 응답을 모든 facet에 같은 부분 점수로 복제하지 않는가 |

FOV의 전체 참조 응답은 `gold.full` 설명과 같은 과제의 `gold.fov_rows` 다섯 실제 행을 함께 읽는다. `semantic_equivalent`는 AI 설명의 다른 말과 그 다섯 행을 보존하는 조건을 제공한다. 한 충돌 쌍만 쓴 응답은 FOV의 동등 답으로 인정하지 않는다. 본문·원래 후보는 AI 단계부터 모두 제공될 수 있으며, 나중에 제공하는 것은 FOV 응답 양식이다. 보기 자체를 처음에는 숨겼다가 나중에 공개했다는 허위 독립성을 만들지 않는다.

의미 응답의 충족과 절차 자격을 분리했다. R5 생성·지도 기록 등 절차 facet의 partial은 기록의 일부 확인이며 학습자 능력의 부분 점수가 아니다. 실제 보기/해설 노출·도움·응답 동결 로그가 없으면 절차 자격은 보류한다. Gold는 기대 의미 응답이며 실제 미노출·독립 제출 기록을 대체하지 않는다. 같은 2024#23을 쓰는 두 TASK는 학생에게 독립 미노출 본문 두 개가 아니다.

원문·각주·제시형 hash는 상속하며 이번 수정은 새로운 독립 기출 표본의 확인이 아니다. 인간 Gold 검수·채점자 신뢰도·콘텐츠 권리·공개·학생 수행·교수 효과는 확보하지 않았다. R3는 계속 차단한다. 재검토 전에 revision1을 “타당성 확보”로 보고하지 않는다.

```powershell
node scripts/research/csat-reading/v14-education-revise.mjs --check
node scripts/research/csat-reading/v14-education.mjs --check
```

검사는 최초 해시와 수정본의 source 결속·12과제·48개별 partial/defer·15 FOV행의 재현을 확인한다. 독립 비판·실제 채점 신뢰도·학습 효과를 대신하지 않는다. 별도 AI의 revision1 검토 결과는 최초 검토를 수정하지 않는 새 원장에 보존해야 한다.

## revision1 비판과 revision2

revision1의 별도 AI 검토는 12과제 중 4개를 지지하고 8개에 결함을 남겼다. 48facet 중 34개 지지·14개 결함, 실제 후보 정규화 15행 중 3개에서 본문의 추가 세부가 후보 명제에 섞이는 문제가 확인됐다. 숫자는 그 첫 검토의 결과로 유지하며 수정 후 통과 수로 대체하지 않는다.

[revision2 변경 원장](./data/v14/education-revision2.json)은 그 14facet과 3행에 대한 수정, 상세 비공개 파일·revision1·검토 해시를 기록한다. 본문에서만 나온 세부는 source evidence에 두고 원래 후보에 추가하지 않는다. 원래 틀린 후보도 정규화에서는 그 주장을 충실히 재현해야 한다. 그런 재현의 충족과 본문 지지의 모순 판정은 공존한다. E3의 AI 선택 후보 target와 FOV 다섯 target의 완전성을 각각 평가하며 하나의 상태로 합치지 않는다.

각 facet은 필요한 입력 또는 해석 가능한 응답이 없으면 보류, 명시적 의미 변형·잘못된 지지 근거가 있으면 결함, 그 facet의 모든 요구가 맞으면 충족, 일부 정확한 요구만 있고 나머지는 생략되었으면 부분으로 판정한다. 명시적 변형을 부분으로 낮추거나 다른 facet의 누락으로 이미 충족된 facet을 부분 처리하지 않는다. 질문이 요구한 비유·전체 결합·배제 뜻·전체 후보 검수의 범위와 meets 조건을 맞췄다. 도표 단위 구별과 수치 응답의 완전성은 서로 다른 기록이다.

완전한 본문 아래 학습자가 제목/주제 후보만을 의미 근거로 쓰면 결함이며, 연구 입력에 본문이 없거나 근거 응답 자체가 없으면 보류다. 내용의 수행 범위와 학생 노출·도움·첫 제출 기록은 별도의 `procedural_eligibility`로 분리했다. 노출 로그가 없다고 올바른 의미 범위 설명을 부분 오답으로 바꾸지 않는다. 절차 기록 상태를 학습자 능력의 부분 점수로 사용하지 않는다.

상세 파일은 ignored `scripts/research/csat-reading/local/v14/education-packages-revision2.json`이다. 실제 질문·Gold·정답 판정은 공개하지 않았다. revision2는 새 독립 검토 전 수정 후보이며 최초·revision1의 바이트를 보존한다. 인간 검수·학습자 자료·효과 검증 0, R3 차단을 유지한다.

```powershell
node scripts/research/csat-reading/v14-education-revise2.mjs --check
node scripts/research/csat-reading/v14-education-revise.mjs --check
```

## revision2 인코딩 실패와 revision3 복원

독립 검토에서 revision2의 새 한국어 조항이 실제 `?` 문자로 손상된 사실을 확인했다. revision2의 바이트 재계산 통과는 그 의미 텍스트의 유효성을 검사하지 못했다. revision2는 실패 산출물로 보존하고 타당한 수정본으로 사용할 수 없다.

[revision3 원장](./data/v14/education-revision3.json)은 손상되지 않은 revision1을 기준으로 의도한 42개 변경 조항을 `apply_patch`의 UTF-8 텍스트로 다시 입력했다. 실패한 revision2의 내용은 복원 입력으로 재사용하지 않았으며 그 파일의 해시는 별도로 결속했다. 세 후보 정규화·14facet 경계·새 질문·참조 응답의 변경을 다시 적용했다. 실제 상세 파일은 ignored `scripts/research/csat-reading/local/v14/education-packages-revision3.json`이다.

새 조항마다 실제 한글 코드포인트가 존재하는지 확인하고, 전체 활동 문자열에 연속 물음표나 대체 문자가 없는지 검사했다. 대상 후보의 한글 어구를 고정 검사로 확인했으며 UTF-8 읽기에서도 실제 한국어가 보존됨을 대조했다. 이전 첫 패키지·revision1·손상된 revision2를 수정하지 않았다. 이 검사로 논리 타당성이 확보되는 것은 아니므로 새 독립 의미 검토가 필요하다. 학생·인간 검수·효과 검증 0, R3 차단을 유지한다.

```powershell
node scripts/research/csat-reading/v14-education-revise3.mjs --check
```
