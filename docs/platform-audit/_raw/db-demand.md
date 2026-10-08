# 수요 측 DB 실측 (2026-10-09, execute_sql SELECT)
- auth.users 5 (마지막 가입 2026-10-07) · learning_records 672 (마지막 2026-10-03) · 최근 30일 학습 사용자 2
- classes 1 · class_members 0 · class_assignments 0
- funnel_events 21,081 · 사용자 4 · 마지막 2026-10-08 · 상위: screen_viewed 16,035 · csat_dx_viewed 1,099 · catalog_viewed 1,036 · csat_session_explained 386 · csat_home_viewed 356 · csat_map_viewed 332 · fit_viewed 270 · csat_ec_capture_opened 205 · landing_viewed 181
- learning_records 모듈별(건수·마지막): dictation 166 (08-16) · ghost-race 132 · cascade 97 · flashcard 59 (09-19) · word-economy 45 · wordblitz 29 (10-03) · connections 20 · wordfall-cadence 16 · word-customs 12 · daily-blitz 11 · wordsmith-vigil 11 · lexicon-estate 11 · pirate-quest 10 · pairflip 9 (07-10) · morphmerge 9 · lexicon-hands 9 · glyph-tongue 8 · letter-forge 6 · silent-rule 5 · wordvault 4 (06-28) · morpheme-rules 3
- 해석: 21종 모듈 기록 — 문서의 "9 모듈"보다 실제 표면이 많다. CSAT 활동은 learning_records 가 아니라 별도 CSAT 테이블·이벤트에 쌓인다(기록 모델 이원화 후보).

## Codex 리뷰 후 재측정 (2026-10-09)
- texts.status: extracted 61 · not_started 207 · in_progress 10 · **completed 0** (읽기 완료의 정본은 texts — lib/library/complete-chapter.ts:58)
- reading_sessions.status: pending 287 (완료값은 'done', 0건)
- csat_session_attempts 1
- funnel_events 익명(user_id null) 2,847 · 그중 landing_viewed 181 — 익명이라 외부/검증 출처 판별 불가
- comic_read_progress 2
- learning_records spellforge/echo 0
- pg_cron 15개 중 13개는 마이그레이션에 정의 있음. 마이그레이션에 없는 것: purge-cron-history-7d · vrl-auto-promote-daily. library-pipeline-worker 만 비활성.
- GitHub Actions run 37800695492(deploy.yml, 2026-10-08): 「배포 건너뜀 — VERCEL_TOKEN / VERCEL_PROJECT_ID 미설정」 확인
- 같은 날 ci.yml e2e job: 「e2e 건너뜀 — 저장소 시크릿 미설정」 확인 → e2e·공개 스모크 통과는 미검증
