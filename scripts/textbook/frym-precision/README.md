# FYM precision round

`round-1.json`은 2026-10-04의 **관찰자 검토**다. 링크와 선택한 주장/방법 구절을 따로 평가한다. 전문가가 인증한 gold, 기사 전체의 정확성 판정, 학생 난이도 calibration이 아니다. DB importer는 제공하지 않는다.

1. DB에서 `source=frym`, `source_id=frym-full:%`, `adapted_from_id IS NULL`인 실제 UUID 범위를 읽어 고정한다. `frym-pairs-export.mjs`로 중복 없는 UUID 배치마다 최대 100편을 읽는다. 연결 없음·DOI 없음·보류도 보존한다. 출력이 이미 있으면 새 경로를 쓴다.
2. 배치를 아래 `select`로 합친다. `--expected-count`는 DB에서 직접 센 범위다. 중복·누락·연결 부족이면 실패한다. 선별은 source_id 순 명시적 연결 첫 20~50편이며 무작위·대표 표본이 아니다.
3. `prepare`는 새 ignored 디렉터리에 현재 FYM 본문·공식 HTML·Crossref·Europe PMC·연구 XML/초록을 보존한다. 전후 DB revision/hash를 대조하며 쓴 행은 0이다. `full_text/abstract_only/unavailable`을 기록한다. 네트워크 후보가 실패하면 다음 후보나 초록으로 이어가고 실패 사유를 남긴다. 연구 본문 접근·이용 권리를 자동 허가하지 않는다.
4. FYM 전문과 연구의 대응 주장/근거·방법·한계를 직접 읽고 `reviewed_spans`에 실제 읽은 범위만 적는다. 선정 이유와 모든 요청 필드를 채운다. 전문이 없으면 정렬 `held`, 확인하지 않은 필드는 `null`, confidence/age는 `unassessed`다. 추정 문장을 만들지 않는다.
5. 원본 `prepared.json`과 `origins.json`의 SHA256을 결과에 기록한다. 입력의 source/relation/research/metadata/files는 그대로 보존한다. 짧은 인용의 start/end는 추출 텍스트의 UTF-16 인덱스이며 end는 포함하지 않는다. 전문·원 HTML은 커밋하지 않는다. `verify`는 증거의 해시·정확한 인용·읽은 범위·DOI·메타데이터·선별 분모를 검사하며 DB에 쓰지 않는다.
6. 링크 verified/mismatch/held와 정렬 aligned/partial/contradicted/held를 각각 집계한다. 보류는 성공도 실패도 아니며 각 judged 분모에서 제외한다. link accuracy=verified/(verified+mismatch), strict alignment accuracy=aligned/(aligned+partial+contradicted); judged=0이면 null이다. 전문·링크 통과와 **모든 기록 정렬 aligned**인 쌍만 후속 gold 검토 후보로 센다. 반대 결과가 있는 기사에서 좋은 구절 하나로 전체 쌍을 인증하지 않는다.

```powershell
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/frym-precision-select.mjs --origins <배치1.json> --origins <배치2.json> --expected-count <DB실측> --sample-size 20 --output <새표본.json>
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/frym-precision-prepare.mjs --origins <새표본.json> --workdir .agent-logs/<새증거폴더>
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/frym-precision-verify.mjs --input scripts/textbook/frym-precision/round-1.json --evidence-dir .agent-logs/frym-precision-r2
```

재실행/복구: select/prepare는 기존 결과를 덮지 않는다. prepare 중단 시 부분 폴더도 보존하고 새 폴더로 다시 실행한다. 새로운 증거로 검토하면 새 회차와 해시를 만든다. verify는 같은 증거에 반복 실행해도 파일·DB가 변하지 않는다. 원문 변경이나 증거 분실이면 검증은 실패한다. DOI로 재취득한 현재 본문이 옛 스냅샷과 같다고 가정하지 않는다.

필드: `original_claim`, `original_evidence`, `fym_claim`, `fym_explanation`, `omitted_detail`, `simplification_type`, `lexical_shift`, `syntactic_shift`, `conceptual_shift`, `age_band`, `confidence`. `fym_evidence`도 별도로 둔다. confidence는 확률이 아닌 관찰자의 high/medium/low와 근거이며 age_band는 목표 제안이다. 원문과 실제 학생용 독자 연령을 추정해서 확정하지 않는다.

이번 회차의 전문 증거는 로컬 ignored `.agent-logs/frym-precision-r2`에 있다. 다른 체크아웃에서는 이 보존 스냅샷을 받아야 정확한 인용/해시 검증을 재현할 수 있다. 저장소 테스트는 공개된 짧은 주석 데이터의 계약을 검증한다. [검토 결과](../../../docs/reports/frym-precision-20261004.md).
