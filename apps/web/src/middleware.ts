// apps/web/src/middleware.ts
// Next.js 미들웨어 — Supabase 세션 갱신 + 인증 보호 라우트 가드.
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // TODO: Supabase 세션 갱신 — lib/supabase/middleware.ts 의 updateSession(request) 호출.
  void request;
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
