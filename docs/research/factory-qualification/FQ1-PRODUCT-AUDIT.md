# FQ1 최신 제품·입력 감사

2026-10-14. 제품 워크트리 `D:/workspace/Vocaflow-map-v62`는 읽기만 했다. 초기 관측 HEAD는 `f76f3898e547d680cd2244d56011405eb3d419da`, 브랜치는 `feat/map-v62-persist-contract`다. 당시 12개 계약/설계/파일럿 파일 해시는 `data/product-audit.json`에 고정했다. 작업 중 제품 변경은 이 관측을 소급 수정하지 않는다.

WorkspaceDemand는 역할·TASK·원문/Gold/무도움·미노출 요구를 갖는 순수 계약이다. SupplyResult의 자격은 `boolean|null`이며 공장 재고는 `factory_candidate`로 제한한다. FactoryOrder는 SHA-256 정규 수요와 상태 기계의 순수 코드가 존재한다. ContentArtifact·WorkspaceDelivery의 영속화는 P-F4b 설계에 있으며 그 문서의 SQL을 적용 사실로 간주하지 않는다. P-F5 production-pilot·v15 importer는 관측 당시 untracked 작업 파일이며 실제 생산·적재·공개를 수행하지 않는 dry-run 명세다. 활동 단위 생산은 `activityUnitSupported:false`, 연구 공개/평가/학생 수는 0, release는 hold다.

`CSAT_BACKING`의 실제 연결은 `vocab_choice → R-VOCAB/X-VOCAB`, `grammar_choice → R-GRAMMAR`다. 이 연결은 창고 검색 기준이며 V2/S5 직접 수행 자격이 아니다. 제품이 보고한 약 51,060개 어휘 재고 추정과 아래 DB 실측의 분모·시점은 다르며 동일 수치로 덮지 않는다.

DB `to_regclass`로 `csat_dcp_items`, `library_articles` 존재를 확인했다. information_schema 직접 조회 결과 DCP에는 id/kind/ref_id/type/item_role/payload/answer_key/paragraph_idx/v_level/created_at이 있다. 별도의 생성 revision·변경 시각·본문 hash 열은 없다. `created_at`은 생성 시각이지 독립 revision 증명이 아니다. 원천에는 content/content_hash/license/license_class/copyright_safe_in_kr/display_only/adapted_from_id/updated_at이 있다. `csat_source_eligibility`에는 policy_version/source_updated_at/result 등이 있다.

전체 대상 실측은 어휘 49,484행·15,982 ref_id, 어법 15,258행·9,452 ref_id이며 모두 kind=article다. 어휘 적격 캐시 grade는 usable 16,267행, unjudged 25,913행, blocked 5,642행, missing 1,662행이다. 어법은 usable 6,581행, unjudged 5,819행, blocked 2,185행, missing 673행이다. 존재하는 캐시는 모두 policy_version=4였다. 정책 캐시 usable은 법률/출시/평가 승인으로 자동 전환하지 않는다.

본문 확인 전 metadata 전체 후보를 순서 고정해 수집한다. 제한 목적 표집은 유형별 usable 2·unjudged 2·blocked 1·캐시 missing 1의 6개, 합계 12개를 목표로 한다. main은 usable 1·unjudged 2·missing 1, 별도 반증은 usable 1·blocked 1이다. 서로 다른 유형에도 source/ref·content_hash·adapted_from root를 공유하지 않도록 seed `FQ1-20261014` SHA-256 순위로 순차 선정한다. 부족 층을 다른 층으로 채우지 않는다. 권리 missing은 별도 교차 기록한다. metadata 수집과 선정 파일/hash를 고정한 뒤 선택된 본문·정답·해설만 ignored local로 export한다. 본문 확인 뒤 드러나는 중복·원천 결함은 교체하지 않고 보류한다. 이 표집의 확률이나 비율을 전체 창고 품질 추정으로 쓰지 않는다.

선정은 12개(main 8·counter 4)로 층 부족 없이 고정됐다. 등록 SHA-256은 `9a2478a0e331ff3ccc8a3e0158882d7a12751e8e37484737d6ba27ea88b137ad`다. 저장된 metadata 64,742행을 5,000행씩 13페이지로 조회하고 각각 ignored local 및 등록 chunk 해시로 보존했다. 이는 단일 트랜잭션 snapshot이 아닌 페이지 관측이다. SQL aggregate 행 수와 일치했고 id 중복은 없었다. 선택 본문 재조회 시 source updated_at 변경도 없었다.

선정 뒤 선택된 12개만 원천 전문·DCP payload·정답·해설·적격 캐시를 private 입력으로 export했다. 원천 content는 12/12 존재하고 adapted_from ancestry는 0/12였다. payload는 12/12 `sentences:string[] + underlines`다. 최초 export의 일반 passage 필드 해시 null은 미측정이었다. 그 최초 파일을 보존하고 `sample-structure-v2.json`에서 실제 sentences를 결합한 정규화 hash를 12/12 계산했다. source 및 생성 passage 중복은 각각 0이며 metadata source/hash와 다른 정규화 중복 검사의 분모를 구분했다. 생성 revision 전용 필드 부재는 여전히 미확정이다. 실제 의미·TASK/Gold 판정은 이 감사자가 수행하지 않았다.

후속 `to_regclass` 직접 조회에서 `workspace_content_demand`, `factory_order`, `factory_order_event`, `workspace_content_delivery`, `content_qualification`은 모두 null, `learner_workspace`와 `csat_item_reviews`는 존재했다. 64,742행의 license_class/copyright_safe_in_kr/display_only SQL null은 0이었다. 채워진 값과 법률·배포 승인 여부는 별개다. 결과는 `data/product-db-audit.json`에 보존했다. 선택 12개의 캐시 source_updated_at와 현재 article updated_at를 대조하면 fresh 5·stale 5·cache missing 2다. `data/source-binding-audit.json`의 이 분모를 현재 원천 적격성 승인으로 바꾸지 않는다.

후속 git show 읽기에서 origin/main은 `8ed086aaae3df3008d861530929cc985ce7ca851`이었다. 이는 최초 기준으로 전달받은 `ebc8030f2`와 다른 후속 ref 관측이다. 대상 12파일 중 7개가 이 main에 있으며 persist-contract/P-F4b/production-pilot/P-F5/import-v15 다섯 파일은 없다. `data/product-main-audit.json`에 exact HEAD·파일별 hash를 별도 보존했다. Claude 작업 브랜치의 변경을 main 병합 완료로 읽지 않는다.

본 감사는 DB 쓰기, 제품 파일 변경, 생산 실행, 출시 승인, 인간 검수, 학생 관찰을 수행하지 않았다.
