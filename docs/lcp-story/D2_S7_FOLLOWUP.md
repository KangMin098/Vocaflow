# D2 수용 연계 · S7 최소 후속 — T-0187

> 2026-10-26. 기존 S4~S7·D2·대표 R2 발행을 보존했다. **U1 코드·격리 회귀 완료 / 승인 v2 DB 적용 완료 / 실제 새 안내 화면 검증은 별도 원장 / C06·관찰 준비 완료 / 사람 적합성·교육 효과 미검증**.

## 기준·소유권·실행

요청 기준 `00dd941db` 이후 다른 작업의 CSAT 통합이 들어와 실제 시작 main은 `b602b9c3f920074a69d252fbb291db7f1d14150f`였다. 변경을 보존하고 기존 `D:/workspace/Vocaflow-lcp-story`, `feat/lcp-story-20261025`, T-0187과 Claude 세션 `25e83007-cf44-4c42-9750-16d5a98a9764`를 사용했다. 기존 완료 T-0165·T-0169·T-0174·T-0176은 재생성하지 않았다. Master 조정이 필요한 공통 코드 충돌은 발견하지 않았다.

Claude가 안내·로더·RPC 제안·격리 검사를 구현했다. 실제 두 실행 PID20748·24436은 각각 exit0으로 종료했다. Codex는 비제작 SQL/코드 검토, 공개 원천 조사, 관찰표, 승인 SQL 적용·전후 검사·로컬 통합을 맡았다. AI 검토를 사람 콘텐츠 검수로 기록하지 않았다. 최종 통합 SHA·실행 파일·실제 화면 결과는 [실행 원장](D:/workspace/Vocaflow-AI-Control/runtime/lcp-story-20261025/d2-followup-20261026/final-closeout.json)에 기록한다.

## D2 일곱 단위 인수

정확한 담당·의존성·수용 기준 정본은 [D2 §7](./LCP_D2_CURATION.md#7-최소-구현-단위와-담당의존성)이며 이번 작업은 이를 교체하지 않는다.

| ID·기존 이름 | 담당·주요 의존성 | 이번 상태·수용 범위 |
|---|---|---|
| U1 사전 선택 정보 전달 | Claude 구현·비제작 Codex 검토; 기존 target/발행·권리 결속 | 저장된 주의·편집 판단 부담·실제 도움 안내 구현. SQL v2 승인 적용. 실제 양성 화면은 실행 원장의 결과로 구분 |
| U2 비교 후보 하나 준비 | Claude 제작·비제작 Codex 원문 대조; 고정 원천/권리 선행 | [C06 원천 준비](./C06_SOURCE_PREPARATION.md)까지 완료. production snapshot/policy·각색·독립 판본 검수·발행은 미실행, U2 전체 완료 아님 |
| U3 소수 후보 선택 메타·편성 | Claude·Codex 적합성; 실제 발행 작품 둘 이상 | 후속. 실제 서가1편으로 다른 작품 선택 양성 검증을 주장하지 않음 |
| U4 관찰 프로토콜·콘텐츠별 근거 | Codex 설계·필요 계측 Claude; 참가자/동의·분리된 근거 | [관찰표](./LEARNER_OBSERVATION.md) 준비 완료. 새 계측 없음. 실제 관찰 NOT_RUN |
| U5 동일 본문 재발행 진도 | Claude·Codex L3; 내용/철회/본인 정책 | 후속. release별 기존 진도 분리·R1/R2 이력 유지, 자동 이전 없음 |
| U6 인기 단위·추정 난도·메타 완결성 | Claude·Codex; 실제 영향별 작은 변경 | 이번 범위 밖. 기존 감사·제안 유지, Books/백필 변경 없음 |
| U7 권리 의미 표시·계약 보정안 | Codex 조사·Claude 승인된 수정; 소스 라이선스와 §14 구분 | 기존 제안 유지. boolean/RPC/RLS/발행 계약 보정·대량 철회 없음 |

## U1 구현·정보 공개 경계

기존 `StoryCatalog`, 로그인 전 판본 화면과 `StoryReader` 입구에 같은 `StoryGuidance`를 연결했다. 안내는 본문 화면에 붙이지 않고 필수 확인·모달·새 이벤트를 만들지 않았다. 저장된 주의는 기본으로 접힌 native details 안에서 순서를 유지해 표시한다. 요약에는 장면 대신 개수와 스포일러 가능성을 쓴다. 빈 배열에는 경고를 만들지 않으며 조회 실패·누락·불일치를 주의 없음으로 바꾸지 않는다. 네이티브 키보드 동작·focus와 최소44px를 확인했다.

부담 등급은 편집 판단이며 B2도 기존 편집 목표다. 시작 전 도움 설명은 현재 작동하는 요청형 단어 뜻과 원문 인용이 연결된 단위의 원문 대응에 한정한다. `background_knowledge.supports`는 편집 의도이므로 기능처럼 공개하지 않았다.

새 RPC `public.story_release_guidance(p_release_key text default null)`는 실제 공개·권리 확인 발행본과 불변 slot/policy/version/source·production 재해시를 대조한다. 반환은 release_key·target_cefr·cognitive_demand·background_load·cautions의 다섯 필드뿐이다. 정답·본문·검수 원문·내부 UUID·개인 기록은 없다. 기존 서버 사용자 확인·계정 전환·지연 응답 폐기·저장·완료·이어하기 코드를 바꾸지 않았다.

## SQL 승인·적용과 보존

최신 사용자 명시 지시에 따라 **v2 SHA `8648c24cd4e58237be8fdf736a2cf7aee8fcd22f2b01407dab1d90fc17f22eac`** 원문22,635바이트를 적용했다. 실제 원장 `20261026110732`, 이름 `lcp_story_u1_guidance`, statements1개 SHA가 승인본과 같다. 저장소 원본은 `supabase/migrations/20261026110732_lcp_story_u1_guidance.sql`이며 머리말의 pending은 승인 당시 역사적 문구다. 재적용하지 않는다.

첫 v2 설명에 있던3초/60초 설정은 실제 v2에는 없었다. 설명을 정정하고 두 SET LOCAL만 추가한 v3을 별도로 검증·제시했으나, 이후 사용자가 **v2 정확한 해시만** 명시했으므로 v2를 적용했다. v3·추가 timeout SQL·복구는 적용하지 않았다. 첫 적용 요청은 과거 S5 `.agent-goal.md` 승인 경로 때문에 보호 훅에서 차단됐고 DB에 도달하지 않았다. 과거 목표를 보존하고 현재 실제 승인 경로/SHA를 정렬한 뒤 같은 보호 경로로 적용했다. 훅·보안 정책은 변경하지 않았다.

적용 후 SECURITY DEFINER·STABLE·고정 search_path, anon/authenticated EXECUTE true, PUBLIC/service_role false를 확인했다. Story12표 RLS는 모두 유지됐고 anon/authenticated 직접 SELECT는 false다. 기존12표 전체 행 지문·기존 Story 함수 지문·개발 계정 역할/활성 상태가 적용 전과 같다. 현재 이용 가능한 발행1개와 활성 발행이 없는 판1개를 구분한다. [원본 전후 응답](D:/workspace/Vocaflow-AI-Control/runtime/lcp-story-20261025/d2-followup-20261026/db-apply-v2-raw.json).

복구 SHA `bfab397aab0f0635e9212d9e92d14ca026480e572ffa343899c8fd0c3b72898b`는 새 함수 실행 권한만 회수하는 별도 미실행안이다. 새 테이블·콘텐츠·권리 결정·발행·계정 권한·진도·완료·이벤트 데이터는 변경하지 않았다.

## 검사와 실제 증거의 구분

| 층위 | 결과·한계 |
|---|---|
| 실제 실행 | Claude 첫/수정 실행 모두exit0. 종료 파일과 산출물로 판정 |
| 코드 회귀 | 최종340단위 통과, web typecheck·변경 web lint exit0. root scripts lint는 설정 부재로 NOT_RUN |
| 격리 SQL v2 | PG17.10에서24PASS·0FAIL·2NOT_RUN, 실제harness exit3. PostgREST·공유 원장은 당시 미실행이며 적용 후 증거로 별도 확인 |
| 변이 검증 | 재해시 제거·민감 note 노출·권리 게이트 제거·20/500 제한 재도입·NOTIFY 제거가 각각 실패. v3 timeout 제거 검사는 역사적 배포 정정 자료이며 v2 적용 증거와 구분 |
| 격리 PC 브라우저 | 합성 fixture1440/1280의 안내·빈 주의·오류·Tab/Enter/Space·focus·axe·쓰기 없음/시작 동작. 전체 S5 회귀36통과. 입구summary44px, 좁은 서가열65.375px |
| 실제 dev 변경 전 | 기존 main 화면의 익명/정상 학습자A·1440/1280 관찰. 주의 요소0은 변경 전 기준선이며 U1 성공 아님. 진도 불변·Auth 외 POST 차단 |
| 실제 dev 적용 후 | anon/authenticated RPC·공개/미발행/철회 경계·실제1440/1280 화면·로그아웃/재조회는 실행 원장의 실제 결과에 따른다. 과거 S7 인증 독서·완료·계정 격리 증거는 보존·재사용 |

최초 브라우저 실패2건(합성 EP CEFR 변경과 기존 단언 충돌)·초기 잘못된 길이 제한·SQL 설명 정정·보호 훅 차단을 성공 결과로 덮지 않았다. 최종 코드/SQL 바이트는 각각의 검증 해시에 결속한다.

## 콘텐츠·관찰·D3 인계

C06은 Saki The Open Window, PG269의1914 John Lane 전사를 확보했다. exact TXT7,195바이트와 출처/판본·권리 주장/미충족·대상/언어/서사·반전 보존 조건을 기록했다. 미국 PD 표시는 세계 권리 확인이 아니며 특정 source 권리 사용자 결정·production snapshot/앵커·새 각색·발행은 미실행이다. B1~B2/B2는 편집 가설이고 학습자 수준 실측이 아니다.

관찰 준비는 기존 D2 §8·S7 §6의 여섯 행동을 외부 관찰표로 구체화한다. 작품 선택·실제 읽기·도움 성공/실패·이해/흥미 직접 응답·복귀·자발 다음 독서를 구분하고 개발/사람·지시/자발·결측을 기록한다. 기존 이벤트에는 작품 식별·도움 성공·직접 이해가 없고 개발 traffic 자동 제외도 없으므로 AI 계정 데이터를 사람 실증으로 합산하지 않는다. 새 이벤트·테이블·대시보드·참가자 모집/평가는 없다.

다음 우선순위는 D3의 C06 고정 snapshot·필요한 판본 하나·의미/반전 보존·스포일러 없는 안내·독립 검수·특정 원천 권리 결정이다. 실제 복수 발행 작품이 생긴 뒤 U3 선택과 자발 다음 작품 양성 검증을 한다. 참가자/동의·독립 미노출 지문 평가는 U4/D6의 별도 조건이다. 전면 추천·TTS·교재공장·대량 각색은 추가하지 않는다.

**판정:** 기존 S4/S5 기술 수용 유지. U1 구현·권한/DB 검증과 실제 새 화면의 결과는 각각 구분한다. 기존 R2의 AI 콘텐츠 검수는 유지되지만 실제 사람의 수준 적합성·흥미·독서 지속·독립 독해 성장은 `PILOT_NOT_RUN / EDUCATION_EFFECT_UNVERIFIED`다. 실제 작품 선택 폭은1편이므로 최상위 LCP 목표가 모두 달성됐다고 하지 않는다.
