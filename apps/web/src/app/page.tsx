// apps/web/src/app/page.tsx
// 임시 루트 페이지 — Phase 1.5 진입 메뉴
"use client";

import Link from "next/link";
import {
  Sparkles,
  LogIn,
  UserPlus,
  Home as HomeIcon,
  FlaskConical,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function TempRootPage() {
  return (
    <main className="min-h-screen bg-bg text-t1">
      <div className="max-w-page mx-auto px-s-6 py-s-16">
        {/* ── Hero ── */}
        <div className="text-center mb-s-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-p-light mb-s-6">
            <Sparkles size={32} className="text-p" />
          </div>
          <h1 className="font-display text-4xl font-extrabold text-t1 mb-s-3">
            Vocaflow
          </h1>
          <p className="font-body text-lg text-t2 mb-s-4">
            영어 원문 기반 종합 학습 플랫폼
          </p>
          <Badge variant="yellow" size="md">
            🚧 Phase 1.5 — 화면 설계 단계
          </Badge>
        </div>

        {/* ── 작업 메뉴 ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-s-4 max-w-4xl mx-auto">
          {/* 회원가입 */}
          <Link href="/signup">
            <Card variant="interactive" className="h-full">
              <CardHeader>
                <div className="w-10 h-10 rounded-md bg-success-light flex items-center justify-center mb-s-2">
                  <UserPlus size={20} className="text-success" />
                </div>
                <CardTitle>회원가입</CardTitle>
                <CardDescription>이메일·소셜 가입 화면</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          {/* 로그인 */}
          <Link href="/login">
            <Card variant="interactive" className="h-full">
              <CardHeader>
                <div className="w-10 h-10 rounded-md bg-p-light flex items-center justify-center mb-s-2">
                  <LogIn size={20} className="text-p" />
                </div>
                <CardTitle>로그인</CardTitle>
                <CardDescription>이메일·소셜 로그인 화면</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          {/* Home */}
          <Link href="/main">
            <Card variant="interactive" className="h-full">
              <CardHeader>
                <div className="w-10 h-10 rounded-md bg-warning-light flex items-center justify-center mb-s-2">
                  <HomeIcon size={20} className="text-warning" />
                </div>
                <CardTitle>Home / 대시보드</CardTitle>
                <CardDescription>로그인 후 첫 화면</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          {/* 검증 페이지 */}
          <Link href="/dev/components">
            <Card variant="interactive" className="h-full">
              <CardHeader>
                <div className="w-10 h-10 rounded-md bg-bg3 flex items-center justify-center mb-s-2">
                  <FlaskConical size={20} className="text-t2" />
                </div>
                <CardTitle>UI 검증 페이지</CardTitle>
                <CardDescription>
                  14개 컴포넌트 카탈로그 (개발용)
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        {/* ── 진행 상황 ── */}
        <Card variant="default" className="mt-s-12 max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>현재 진행 상황</CardTitle>
            <CardDescription>v06.2 · 2026년 4월</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-s-2 font-mono text-sm">
              <div className="flex items-center gap-s-3">
                <Badge variant="green" size="sm">
                  완료
                </Badge>
                <span className="text-t1">
                  Phase 1: UI 디자인 시스템 (14 컴포넌트)
                </span>
              </div>
              <div className="flex items-center gap-s-3">
                <Badge variant="yellow" size="sm">
                  진행
                </Badge>
                <span className="text-t1">
                  Phase 1.5: 화면 설계 (1순위 진입 경로)
                </span>
              </div>
              <div className="flex items-center gap-s-3">
                <Badge variant="gray" size="sm">
                  대기
                </Badge>
                <span className="text-t2">
                  Phase 2: 비즈니스 로직 (Supabase + OpenAI)
                </span>
              </div>
              <div className="flex items-center gap-s-3">
                <Badge variant="gray" size="sm">
                  대기
                </Badge>
                <span className="text-t2">Phase 3: 모듈 페이지 구현</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center font-mono text-xs text-t3 mt-s-12">
          이 페이지는 개발 단계 임시 진입점입니다.
          <br />
          마케팅 랜딩 페이지는 Phase 1.5 후반에 작성됩니다.
        </p>
      </div>
    </main>
  );
}
