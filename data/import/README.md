# data/import

외부 데이터셋 import용 임시 저장 폴더.

## 규칙
- `.apkg`, `.anki21`, `.zip`, `.csv` 등 대용량 원본 파일은 git 제외 (`.gitignore`)
- `README.md`만 git 포함

## 현재 import 대상

| 파일 | 출처 | 라이선스 | 용도 |
|------|------|----------|------|
| Oxford_Dictionary_A1-C2_American_English_Categorized.apkg | Anki 공유 데크 | 회색 (단어/CEFR/Topic만 사용) | shared_dictionary 시드 |

## Import 스크립트
- `scripts/import-anki-dictionary.mjs` — Step 2에서 작성

## 주의사항
- service_role 키 필요 (`.env.local`)
- 한 번 실행 후 데이터 검증 + 백업
- 한국어 뜻은 별도 (Phase 4-4에서 Claude API)
