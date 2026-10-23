# T-0117 · b9 v2.5 독립 검증

봉인 불가(수동 대조에서 E2↔E3 양쪽 해석이 계약으로 설명됨; AB 기준선 오염)

입력 @2b3f3bafb, rev4 SHA 05293147cc7e0308c352dbd791aa28fd7e305131028c820c4420412dfac686a3. T-0116 승인은 설계 승인이고 실행 독립성 승인이 아니다. 첫 task show에서 IN_PROGRESS/session t-0117-codex 일치 확인. PID 조회 없음. 입력 worktree 쓰기 없음.

검증 57개 통과. VM에서 원본 모듈을 그대로 실행하고 writeFileSync만 메모리로 수집했다. 비교 JSON 바이트 일치, 여섯 트랙 최종 검증 통과. C 최초 청크 반복 오류 및 E1 why 다섯 개 수정만 확인했다. 최초 primary·링크 판정 보존. freeze 저장 출력 3회 각각 16/16, 현재 동결 재검사도 16/16. 프롬프트 4개 틀 치환·sha, 입력 sha, snapshot manifest 및 파일 sha, 최종 sha 일치.

지표: CD/EF 주 TASK 10/12 대 8/12, 링크 71/72 대 69/72, κ .9743/.9240, 대상 외 48/48 대 46/48. 자동 조건 네 개는 모두 통과한다. AB 7/12는 오염된 보조 기준선으로 해석한다. 자동 후보 결정은 수동 조건의 통과를 뜻하지 않는다.

## 수용 기준

- AC0 **unclear** — 수치·동결·해시·C 수정 범위는 confirmed. CD/EF-final이 최초 AB snapshot보다 이른 점도 confirmed. 그러나 그 시점 AB 출력 0개였음을 직접 기록한 목록/도구 transcript는 없어 역사적 부재 자체는 unclear. (docs/research/goal-data-batches/D2-task-mapping/v2_5-prereg-run.json:37; docs/research/goal-data-batches/D2-task-mapping/v2_5-comparison.json:7; scripts/research/goal-data/prereg-compare.mjs:94)
- AC1 **confirmed** — 4사건의 증거 수준과 영향 판정 완료. 미열람은 추정하지 않고 unclear 유지. B01 오류 문구 설명은 refuted, AB 기준선 오염. (docs/research/goal-data-batches/D2-task-mapping/v2_5-prereg-run.json:130; scripts/research/goal-data/d2-run.mjs:29; scripts/research/goal-data/d2-run.mjs:59)
- AC2 **unclear** — 불일치 6건 전수·고정 표본 10 대조 완료. 확정 반박 0, primary 미결 2. §1의 양쪽 해석을 배제할 수 없어 반박 0을 수동 조건 통과로 올리지 않는다. §2 R6 두 건·§3 null 네 행은 설명 가능. 대상 외 4TASK의 일치율은 허용폭이나 실제 분류 불변은 아니다. (docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_5.md:6; docs/research/goal-data-batches/D2-task-mapping/V2_5_PREREGISTRATION.md:75; scripts/research/goal-data/local/b9t-v25/input.json:18)
- AC3 **confirmed** — 봉인 불가. 사전 등록 §6의 애매하면 봉인하지 않는 조건 적용. +2/12는 이 표본의 일치 차이이며 학생 타당도·인과 효과 근거가 아니다. 오염을 제외해도 경계 미결이 남아 결론은 같다. (docs/research/goal-data-batches/D2-task-mapping/V2_5_PREREGISTRATION.md:75; docs/research/goal-data-batches/D2-task-mapping/V2_5_PREREGISTRATION.md:79)
- AC4 **confirmed** — verdict.json + review.md 작성; unclear 명시 유지. (docs/research/goal-data-batches/review-b9/review.md:1)

## 열람 사건

- E-name **unclear** · 한계: 이름·크기 노출은 실행 기록에 보고돼 있다. 내용 열람을 증명하거나 배제할 원래 wc 출력·도구 대화 전문은 제공 경로에 없다. 이름만으로 규칙 내용 노출을 확정하지 않는다. (docs/research/goal-data-batches/D2-task-mapping/v2_5-prereg-run.json:130)
- F-grep **unclear** · 한계: 허용 목록 밖 소스 조회는 보고됐다. d2-run 앞 80줄에는 버전명·계약 경로와 검증 호출이 있으나 E1 primary 금지 규칙 본문은 없다. 실제 grep 패턴·원출력이 없어 사용법만 노출됐다는 주장은 확정할 수 없다. (scripts/research/goal-data/d2-run.mjs:29; scripts/research/goal-data/d2-run.mjs:59; docs/research/goal-data-batches/D2-task-mapping/v2_5-prereg-run.json:136)
- snapshots **confirmed** · 한계: 첫 snapshot마다 상대 트랙 전체 출력이 복사됐다. C/D 상대 파일은 각각 50,388 / 51,228 bytes, E/F는 51,747 / 52,224 bytes. 각각 12행 primary·primary_reason 및 72 링크 why, 정답 논리·오답 이유까지 포함한다. 명령 stdout은 개수·경로뿐이라 내용이 화면에 자동 출력되지는 않는다. 실제 history 열람은 unclear. (scripts/research/goal-data/d2-run.mjs:152; scripts/research/goal-data/d2-run.mjs:155; scripts/research/goal-data/local/b9t-v25/history/2026-10-23T08-34-49-342Z-prereg-D-first/manifest.json:4; scripts/research/goal-data/local/b9t-v24/history/2026-10-23T08-34-49-710Z-prereg-E-first/manifest.json:4)
- B-01 **refuted** · 기준선 오염; AB 해석 무효: v24 입력에서 금지 문구는 반환될 수 없다. 실제 최초 B01 오류는 M2406#18 오답 근거 하나뿐이다. 같은 2022#26 행을 E1 primary로 놓은 대조에서 v24 오류 없음, v25만 E1 금지 오류다. 노출 경로는 unclear지만 지시한 판정 기준에 따라 AB 기준선 오염으로 판정한다. AB는 봉인 조건 밖이므로 이 사건만으로 CD/EF 수치를 무효화하지 않는다. (scripts/research/goal-data/d2-validate.mjs:73; scripts/research/goal-data/d2-validate.mjs:74; scripts/research/goal-data/d2-run.mjs:57; docs/research/goal-data-batches/D2-task-mapping/v2_5-prereg-run.json:145)

## 불일치 전수 대조

- CD 2022#45 **unclear**: C=E3 / D=E2. 흩어진 단락 찾기와 부정 표현 대조 중 무엇이 결정인지 계약이 유일하게 정하지 못한다. (scripts/research/goal-data/local/b9t-v25/input.json:779; scripts/research/goal-data/local/b9t-v25/chunk-A-01.out.json:153; scripts/research/goal-data/local/b9t-v25/chunk-B-01.out.json:153)
- CD M2406#27 **unclear**: C=E3 / D=E2. 활동 시간표의 줄 선택과 시간 대조가 함께 필요해 양쪽 이유가 계약으로 설명된다. (scripts/research/goal-data/local/b9t-v25/input.json:1390; scripts/research/goal-data/local/b9t-v25/chunk-A-01.out.json:273; scripts/research/goal-data/local/b9t-v25/chunk-B-01.out.json:273)
- EF 2022#28 **confirmed**: E=E3 / F=E2. CD는 E2 일치. 참가비 괄호 위치 중심과 오답 제한어 대조 중심이 모두 원문에 있다. (scripts/research/goal-data/local/b9t-v25/input.json:630; scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:119; scripts/research/goal-data/local/b9t-v24/chunk-B-01.out.json:115)
- EF 2022#45 **unclear**: E=E2 / F=E3. CD도 반대 방향으로 갈린 동일 경계여서 v2.5의 해소 근거가 아니다. (scripts/research/goal-data/local/b9t-v25/input.json:779; scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:148; scripts/research/goal-data/local/b9t-v24/chunk-B-01.out.json:143)
- EF M2406#28 **confirmed**: E=E2 / F=E3. CD는 E2 일치. 수강료 괄호 찾기와 강좌·요일 혼합 오답 대조가 모두 가능하다. (scripts/research/goal-data/local/b9t-v25/input.json:1525; scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:293; scripts/research/goal-data/local/b9t-v24/chunk-B-01.out.json:283)
- EF M2406#45 **confirmed**: E=E3 / F=E2. CD는 E3 일치. 품절 대상과 구매 대상을 가르는 CD 이유는 §1에 맞지만 뒤섞인 단락 위치 중심 EF 이유도 배제되지 않는다. (scripts/research/goal-data/local/b9t-v25/input.json:1675; scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:322; scripts/research/goal-data/local/b9t-v24/chunk-B-01.out.json:311)

## 고정 표본 10

- 2022#19 **confirmed**: 명시된 기대와 실패·한탄을 감정 어휘로 대응시키는 primary null은 §3과 양립한다. R4 indirect의 역방향 선지 ⑤도 실제 존재한다. EF의 R6 direct와의 차이는 적용 범위 밖 변화로 별도 보류한다. (scripts/research/goal-data/local/b9t-v25/input.json:18; scripts/research/goal-data/local/b9t-v25/chunk-A-01.out.json:3; scripts/research/goal-data/local/b9t-v25/chunk-B-01.out.json:3)
- 2022#21 **confirmed**: 전문가 신뢰가 없으면 일상 판단도 멈춘다는 비유를 풀면 ①로 닫힌다. R6 primary와 일반인 재사용 ④의 E3 indirect가 원문으로 설명된다. E2 indirect/무관 갈림은 primary 반박이 아니다. (scripts/research/goal-data/local/b9t-v25/input.json:166; scripts/research/goal-data/local/b9t-v25/chunk-A-01.out.json:33; scripts/research/goal-data/local/b9t-v25/chunk-B-01.out.json:33)
- 2022#26 **confirmed**: 그림을 포기했다는 ③과 실제 부정 서술의 대조가 결정이다. 연대순 위치가 바로 찾혀 E3 선택은 §1로 설명된다. (scripts/research/goal-data/local/b9t-v25/input.json:338; scripts/research/goal-data/local/b9t-v25/chunk-A-01.out.json:63; scripts/research/goal-data/local/b9t-v25/chunk-B-01.out.json:63)
- 2022#27 **confirmed**: 추가 정보 첫 줄의 기간을 찾은 뒤 주와 달을 대조해야 한다. CD의 E3는 §1로 설명되지만 EF의 위치 중심 E2도 가능한 해석이라 개선의 정답성은 입증되지 않는다. (scripts/research/goal-data/local/b9t-v25/input.json:494; scripts/research/goal-data/local/b9t-v25/chunk-A-01.out.json:93; scripts/research/goal-data/local/b9t-v25/chunk-B-01.out.json:93)
- 2022#28 **confirmed**: 식사 포함 정보가 참가비 괄호에 있어 CD의 E2는 §1의 위치 중심 해석으로 설명된다. E3 direct는 오답의 요일·장소·제한 대조에 남는다. (scripts/research/goal-data/local/b9t-v25/input.json:630; scripts/research/goal-data/local/b9t-v25/chunk-A-01.out.json:123; scripts/research/goal-data/local/b9t-v25/chunk-B-01.out.json:123)
- 2022#45 **unclear**: C는 반응의 극성 대조, D는 뒤섞인 단락에서 반응 문장 찾기를 결정으로 삼는다. §1의 양쪽 문구가 모두 적용될 수 있어 단일 primary를 확정하지 못한다. (scripts/research/goal-data/local/b9t-v25/input.json:779; scripts/research/goal-data/local/b9t-v25/chunk-A-01.out.json:153; scripts/research/goal-data/local/b9t-v25/chunk-B-01.out.json:153)
- M2406#19 **confirmed**: 걱정과 안도가 직접 명시돼 R6를 두지 않는 판단, primary null 및 빈 secondary가 §3과 양립한다. (scripts/research/goal-data/local/b9t-v25/input.json:933; scripts/research/goal-data/local/b9t-v25/chunk-A-01.out.json:183; scripts/research/goal-data/local/b9t-v25/chunk-B-01.out.json:183)
- M2406#21 **confirmed**: 권리 묶음 정의와 분리된 권리 예시를 결합하면 ③만 남는다. R6 primary는 §2로 설명된다. E2 direct도 오답을 유도하는 토지·세입자 문장 후보를 제시한다. (scripts/research/goal-data/local/b9t-v25/input.json:1082; scripts/research/goal-data/local/b9t-v25/chunk-A-01.out.json:213; scripts/research/goal-data/local/b9t-v25/chunk-B-01.out.json:213)
- M2406#26 **confirmed**: 전쟁 기간 내내 머물렀다는 ④를 실제 이주와 대조하므로 E3는 §1로 설명된다. (scripts/research/goal-data/local/b9t-v25/input.json:1253; scripts/research/goal-data/local/b9t-v25/chunk-A-01.out.json:243; scripts/research/goal-data/local/b9t-v25/chunk-B-01.out.json:243)
- M2406#27 **unclear**: C는 활동과 시각의 잘못된 짝 대조, D는 비슷한 시간표 줄 중 올바른 줄 찾기를 결정으로 삼는다. §1의 기호 목록 예시와 시각 대조 예시가 동시에 성립한다. (scripts/research/goal-data/local/b9t-v25/input.json:1390; scripts/research/goal-data/local/b9t-v25/chunk-A-01.out.json:273; scripts/research/goal-data/local/b9t-v25/chunk-B-01.out.json:273)

확정 내용 반박 0건, 미결 2건이다. 미결을 통과로 세지 않는다. 특히 2022#45와 M2406#27은 위치를 찾는 즉시 간단히 확인된다는 이유와, 부정·시각 대조가 결정이라는 이유가 동시에 성립한다. rev4 §6의 양쪽 모두 계약으로 설명되면 봉인하지 않는 규칙(:75)을 적용한다.

## 적용 범위·한계·결론

§1은 R-FACT/R-NOTICE/X-FACT의 primary 선택, §2는 R-IMPLY의 R6/E3 primary, §3은 direct 없는 행의 secondary만 바꾼다. §1은 E1 direct를 지우지 않는다. null 네 행은 secondary=indirect 검증 통과. 대상 외 일치율 차이 2/48은 .05 이내다. 다만 2022#19의 R6가 CD 양쪽 무관, EF 양쪽 direct로 달라도 각 쌍 일치율에는 나타나지 않는다. 이를 §3의 허용 변화나 v2.5의 효과로 주장할 수 없다. 분석자 차인지 계약 노출 효과인지 unclear다. 유형별 n=2–4 결론을 내리지 않는다.

새 P0 0, P1 2: §1 경계 미결과 AB 기준선 오염. AB를 제외해도 수동 봉인 조건이 미충족이므로 오염 사건이 봉인 불가 결론을 바꾸지 않는다. snapshot 복사는 이유 내용의 접근 가능성을 확인하지만 실제 열람을 확인하지 않는다. 원본 도구 대화·파일 접근 감사가 없어 E/F 자진 보고 및 순서·미열람의 독립 입증은 unclear다.

동결 집합 변경은 관측되지 않아 rev4 §2의 자동 폐기·재등록을 발동하지 않는다. 규칙을 수정해 새 봉인 비교를 하려면 새 rev와 미관측 표본이 필요하며 b9를 다시 미관측 근거로 쓰지 않는다. +2문항/n=12는 학생 측정 타당도나 일반화 가능한 효과를 증명하지 않는다. relevance=unknown, NeedRank 금지 유지.

원문·명령 실행 결과는 두 지정 폴더의 *.local.json에만 보존하고 .gitignore로 제외했다. DB·새 판정·봉인·제품/학생 검증·main/원격 통합은 미실행이며 통과가 아니다. skip_count=0은 요청된 독립 검증 항목을 모두 수행했다는 뜻이다. Git 커밋 시도와 task evidence/submit 결과는 finish.local.json에 보존한다.
