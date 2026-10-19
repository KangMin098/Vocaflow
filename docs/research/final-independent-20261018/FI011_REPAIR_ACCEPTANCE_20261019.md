<!-- docs/research/final-independent-20261018/FI011_REPAIR_ACCEPTANCE_20261019.md -->
# FI-011 최신 변경분 수용과 다음 구현 인계

[VF-TASK FINAL-FI011-REPAIR] ACK

2026-10-19 · Codex `01a14de8-2485-7a53-b530-d5612f35e57a` / T-0045 → 기존 Claude `c513ff5b-86ef-44a3-8efd-7925a229614b`. 같은 FI-011 / #304 / PR303을 유지한다.

**판정: ACCEPT_WITH_LIMITS.** `need_confirmed`·저장 PLAN check→repair·창작 평가 자료 재사용 차단·정확한 자료 대기 안내는 **VERIFIED_FIXED(해당 범위)**다. 바로잡기 자료 공급·수행·성공→적용→새 독립 확인까지의 전체 FI-011은 **PARTIAL / 후속 구현 필요**이며, 전체 FINAL MISSION은 **REWORK**다. 빈 공급을 성공으로 세지 않는다.

## 입력과 직접 관찰

- 제품 HEAD `f0790c5cc91ad7988d14cf7605d31917d5ee5c21`; `539847fb3`의 평가 자료 제외와 f079의 클라이언트 의존 분리까지 확인했다. `09681` 이후 제품 변경8파일을 읽었다.
- [CI39201324730](https://github.com/KangMin098/Vocaflow/actions/runs/39201324730): verify(타입·lint·단위 포함), build, e2e, faultclosed 모두 SUCCESS. shared-dev는 SKIPPED이며 실제 DB 검증이 아니다.
- 다운로드한 실제 Playwright HTML/ZIP을 직접 해독: **12 expected / 0 unexpected / 0 flaky / 0 skipped**. [해독 요약과 ZIP hash](./journey-ci-f0790c.json). 첨부2개는 PNG가 아니며 새로운 화면 캡처를 눈으로 검토했다고 주장하지 않는다.
- 실제 로그: 양성 before=`not_measured,next=ind-1,blocked=null`; after=`need_confirmed,next=null,blocked=repair_material_needed`. 저장 v2=`check,available=2`, v3=`repair,available=null`. 서버 오답2·그 납품 G2 evidence=true2·동일 목표 버전·v2 불변 단언 모두 도달/성공했다.
- 정답 진행 대조는 ind-1→ind-2, `checking`, 저장 TASK 불변이다. PLAN의 가용량을 진척량처럼 줄이지 않은 정상 대조다.
- 실제 f079의 map 전체157파일 바이트를 격리 스냅샷에 복사해 영향 단위4파일 **43/43 성공**: workspace-authored5, plan-lm-g1-1 17, workspace-list11, demand-supply10. 주변 의존은 기존 스냅샷이며 전체 최신 소스 빌드로 과장하지 않는다. 전체 빌드는 위 고정 HEAD CI 증거다.
- 새 repair 단위는 authored-only, 기출 혼합 대조를 포함한다. `stageItems.repair`와 수량 모두 authored 평가 ref를 제외하며 기출 ref는 남는다. `stageNow`의 성공 근거·기존 CHECK 판정은 바뀌지 않았다.
- 양성 여정 자체는1440 기본 폭이다. 기존1280/1440 형식·공급·두 기기·FI-010 검증은 해당 고정 입력 범위로 재사용한다. **새 바로잡기 수행의 두 폭 브라우저 증거는 아직 없다.**

## 최초 실패와 수정 의미

[0b8 실제 보고서](./journey-ci-0b8f29.json)는12중11성공/양성1실패였다. 완료된 창작 평가 자료를 repair CTA로 다시 제시했으나 Runner는 완료 상태여서 새 바로잡기 수행이 불가능했다. 최초 실패·당시 해석은 [이전 검토](./FINAL_COLLAB_20261019B_REVIEW.md)와 #304에 보존한다.09681의 라벨 비교 변경만으로는 이 결함이 해결되지 않았다.

이번 제품은 **별도 교수 자료가 없다는 실제 상태에서 멈추도록** 고쳤다. 그 선택을 수용한다. 앞선 인계의 같은 ref에 assisted 재시도 문맥을 추가하는 제안은 창작 평가 자료의 교수/평가 지문 분리 계약에 맞지 않으므로 채택하지 않는다. 후속은 [별도 교수·안내 연습 자료 공급 지시](./FI011_REPAIR_SUPPLY_WORK_ORDER.md)로 대체한다. 기존 기출의 복습 정책까지 임의로 바꾸지는 않는다.

시험의 `attempted.includes(after.next)`는 현재 query 없는 observe href와 결합한 검사다. 현재 실제 after.next=null과 source 차단도 함께 확인했다. 후속 회귀에서는 null을 직접 단언하고, URL query가 붙어도 ref/delivery를 정규화해 평가 재사용을 탐지해야 한다.

## 통합·외부 경계

관찰 시 PR303 tip `3c7652fdb5d2e1ad081c5acdf54752b714d6b492`는 f079 대비 `docs/final/FINAL_LEDGER.md`만 바뀌었다. 새 tip CI39202151623은 진행 중이었다. **이 고정 제품 수용을 새 tip 필수 CI 성공이나 병합 수용으로 대체하지 않는다.**

origin/main13e15e736과 tip303 /2502549의 `git merge-tree --write-tree --name-only`는 둘 다 충돌 없이 종료했다(계산한 tree303=`af6d72c1e5f4f1628e84b5dcd2ed933622b7e4c4`,250=`3bb16e0dd269bde91880872100fba4ceb7b5f6a1`). 이것은 Git 결합 검사이며 그 결합 소스의 타입·빌드·브라우저 성공을 뜻하지 않는다. 두 PR은 BEHIND 상태다. 기존 보호 규칙상 최신 main 결합·목적 리뷰·최종 CI 후250→303 순서의 safe-merge가 남는다. 이번 패킷에서 추가 병합은 하지 않았다.

보류 SQL의 실제 git blob SHA256은 `dfb29f2dc3c3c0ecf516bdf47efa1d50f2f203ef7d399a60f3072d57c93ac229`이며 변경 없음. 실제 개발 DB는 새로 쓰거나 적용하지 않았다. 마지막 독립 읽기 측정은2026-10-18T23:16:35Z이며 새 실측으로 갱신하지 않는다. 사람 Gold·권리·실공급·실학습 효과는 이 CI로 승인되지 않는다.

## ACK와 전달 구분

- `[VF-TASK FINAL-COLLAB-20261019B] ACK`: 기존 수신·응답을 재확인한다. FI-018은 actual312d786 검증 후 병합13e15e736 완료. #314는 PROPOSED/채택 REWORK를 유지한다.
- `[VF-TASK FINAL-REWORK-20261019] ACK`: **이번 재요청에 포함된 작업 식별자와 이어진 수정 범위의 접수 확인**이다. 당시 큐 원문이 기존 세션에 전달됐다는 사실·과거 시각의 ACK·#315 라우터 수용은 여전히 NOT_VERIFIED다. 현재 자신의 transcript에서 그 태그로 시작하는 독립 user 패킷은 확인하지 못했다. 과거 전달을 소급 성공 처리하지 않는다.
- 현재 수신 `FINAL-FI011-REPAIR`는 실제 대화에 도착했고 ACK했다. 발신은 검증 브랜치·기존 GitHub 인계 영수증으로 기록하며, Claude가 새 지시를 읽고 ACK하기 전 SESSION_DELIVERED로 올리지 않는다.

## 다음 반납

Claude는 같은 실제 세션·FI·PR에서 아래 지시의 구현 가능성/충돌을 먼저 코드 근거로 회신하고, 구현 HEAD·원본 SQL hash/미적용 여부·단위/실제 PostgreSQL·1280/1440 실제 브라우저·CI·남은 영역을 함께 반납한다. 별도 사람 승인 요청은 기존 DB·콘텐츠·정책 경계를 실제로 넘을 때만 적용한다. Codex가 AI 검증으로 사람 역할을 대신하지 않는다.
