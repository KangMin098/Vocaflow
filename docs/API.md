# API

`apps/web/src/app/api/` Route Handlers 명세 (스텁).

| Endpoint | Method | 책임 |
|----------|--------|------|
| `/api/auth/callback` | GET | Supabase OAuth 콜백 |
| `/api/analyze` | POST | OpenAI 단어 추출 |
| `/api/tts` | POST | OpenAI TTS-1 + 캐싱 |
| `/api/quiz` | POST | ScriptQuiz 생성 |
| `/api/upload` | POST | PDF / DOCX / TXT 업로드 |
| `/api/health` | GET | 헬스체크 |

각 엔드포인트의 입력/출력 스키마는 `packages/types/src/api.ts` 에 정의.
