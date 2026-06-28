// apps/web/src/app/page.tsx
// Vocaflow 디자인 시스템 검증 페이지 (v4 — Final UI Catalog)
// 전체 15개 섹션: 토큰 9 + Buttons + Selectors + FormFields + Visual + Feedback + Misc
// ─────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState } from "react";
import {
  Heart,
  Plus,
  Trash2,
  Settings,
  Search,
  ArrowRight,
  Mail,
  Lock,
  User,
  Grid3x3,
  List,
  LayoutGrid,
  AlignLeft,
  AlignCenter,
  AlignRight,
  CheckCircle2,
  AlertTriangle,
  Inbox,
  BookOpen,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Checkbox, CheckboxGroup } from "@/components/ui/Checkbox";
import { RadioGroup } from "@/components/ui/Radio";
import { Toggle } from "@/components/ui/Toggle";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { SkeletonCard, SkeletonRow } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

export default function TokenTestPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const toast = useToast();

  // Buttons
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Selectors
  const [singleCheck, setSingleCheck] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [errorCheck, setErrorCheck] = useState(false);
  const [hobbies, setHobbies] = useState<string[]>(["reading"]);
  const [difficulty, setDifficulty] = useState("medium");
  const [voiceType, setVoiceType] = useState("alloy");
  const [autoplay, setAutoplay] = useState(true);
  const [darkPref, setDarkPref] = useState(false);
  const [notifications, setNotifications] = useState(false);

  // Form Fields
  const [emailValue, setEmailValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [searchValue, setSearchValue] = useState("hello");
  const [scriptText, setScriptText] = useState(
    "The quick brown fox jumps over the lazy dog.",
  );
  const [bioText, setBioText] = useState("");
  const [selectedLang, setSelectedLang] = useState("en");

  // Button Group
  const [viewMode, setViewMode] = useState("grid");
  const [textAlign, setTextAlign] = useState("left");

  // Progress
  const [progress, setProgress] = useState(35);

  // Modal & Loading
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [loadingOpen, setLoadingOpen] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("vocaflow-theme", theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    const stored =
      (localStorage.getItem("vocaflow-theme") as "light" | "dark") || "light";
    setTheme(stored);
  }, []);

  const triggerLoad = (id: string) => {
    setLoadingId(id);
    setTimeout(() => setLoadingId(null), 2000);
  };

  // Confirm Modal 데모
  const handleConfirmDelete = () => {
    setConfirmLoading(true);
    setTimeout(() => {
      setConfirmLoading(false);
      setConfirmOpen(false);
      toast.success("삭제되었습니다.");
    }, 1500);
  };

  // LoadingOverlay 데모 (진행률 시뮬레이션)
  const startLoadingDemo = () => {
    setLoadingOpen(true);
    setLoadingProgress(0);
    let p = 0;
    const interval = setInterval(() => {
      p += 10;
      setLoadingProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setLoadingOpen(false);
          toast.success("AI 분석 완료!");
        }, 400);
      }
    }, 200);
  };

  return (
    <main className="min-h-screen bg-bg text-t1 transition-colors duration-normal">
      {/* ── Header ── */}
      <header className="border-b border-bd bg-bg2 sticky top-0 z-40 backdrop-blur-sm bg-bg2/80">
        <div className="max-w-page mx-auto px-s-6 py-s-4 flex items-center justify-between">
          <h1 className="font-display text-2xl font-extrabold text-t1">
            Vocaflow
          </h1>
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="px-s-4 py-s-2 rounded-md bg-p text-ti font-display font-semibold text-sm shadow-sm hover:bg-p-hover transition-colors duration-normal tap-target"
          >
            {theme === "light" ? "🌙 다크" : "☀️ 라이트"}
          </button>
        </div>
      </header>

      <div className="max-w-page mx-auto px-s-6 py-s-12 space-y-s-12">
        {/* ────────────────────────────────────────
             §1~9 디자인 토큰 (이전 단계 유지)
             ──────────────────────────────────────── */}
        <section>
          <SectionTitle>1. Typography (4종 폰트)</SectionTitle>
          <div className="space-y-s-3 bg-bg2 p-s-6 rounded-lg border border-bd">
            <p className="font-display text-3xl font-extrabold">Plus Jakarta Sans — Display / Heading</p>
            <p className="font-body text-base">DM Sans — Body 텍스트입니다. 영어 학습 플랫폼 Vocaflow.</p>
            <p className="font-serif text-lg italic">Lora — The quick brown fox jumps over the lazy dog. (영어 스크립트 전용)</p>
            <p className="font-mono text-sm">JetBrains Mono — const greeting = &quot;Hello, Vocaflow&quot;;</p>
          </div>
        </section>

        <section>
          <SectionTitle>2. Brand Colors</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-s-3">
            <ColorSwatch name="--p" className="bg-p text-ti" />
            <ColorSwatch name="--p-hover" className="bg-p-hover text-ti" />
            <ColorSwatch name="--p-light" className="bg-p-light text-p-dark" />
            <ColorSwatch name="--p-dark" className="bg-p-dark text-ti" />
          </div>
        </section>

        <section>
          <SectionTitle>3. Semantic Colors</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-s-3">
            <ColorSwatch name="--success" className="bg-success text-ti" />
            <ColorSwatch name="--error" className="bg-error text-ti" />
            <ColorSwatch name="--warning" className="bg-warning text-ti" />
            <ColorSwatch name="--info" className="bg-info text-ti" />
          </div>
        </section>

        <section>
          <SectionTitle>4. Surface & Text</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-s-3">
            <div className="p-s-4 rounded-md bg-bg border border-bd">
              <p className="text-xs font-mono text-t3 mb-s-2">--bg</p>
              <p className="text-t1 font-semibold">기본 텍스트 (--t1)</p>
              <p className="text-t2 text-sm">보조 텍스트 (--t2)</p>
              <p className="text-t3 text-sm">비활성 (--t3)</p>
            </div>
            <div className="p-s-4 rounded-md bg-bg2 border border-bd">
              <p className="text-xs font-mono text-t3 mb-s-2">--bg2</p>
              <p className="text-t1">카드/섹션 배경</p>
            </div>
            <div className="p-s-4 rounded-md bg-bg3 border border-bd">
              <p className="text-xs font-mono text-t3 mb-s-2">--bg3</p>
              <p className="text-t1">입력 필드 배경</p>
            </div>
          </div>
        </section>

        <section>
          <SectionTitle>5. Border Radius</SectionTitle>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-s-3">
            {(["sm", "md", "lg", "xl", "2xl", "full"] as const).map((r) => (
              <div key={r} className="aspect-square bg-p flex items-center justify-center text-ti font-mono text-xs" style={{ borderRadius: `var(--r-${r})` }}>
                --r-{r}
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle>6. Shadow (Elevation)</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-s-6 p-s-6 bg-bg2 rounded-lg">
            {(["xs", "sm", "md", "lg", "xl"] as const).map((sh) => (
              <div key={sh} className={`bg-bg p-s-4 rounded-md text-center font-mono text-xs text-t2 shadow-${sh}`}>
                shadow-{sh}
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle>7. Spacing Scale (4px 기반)</SectionTitle>
          <div className="space-y-s-2">
            {([
              ["s-1", "4px"], ["s-2", "8px"], ["s-3", "12px"],
              ["s-4", "16px ★"], ["s-6", "24px ★"], ["s-8", "32px"],
              ["s-12", "48px"], ["s-16", "64px"],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center gap-s-3">
                <code className="font-mono text-xs text-t3 w-16">--{key}</code>
                <div className="bg-p h-3 rounded-sm" style={{ width: `var(--${key})` }} />
                <span className="font-mono text-xs text-t2">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle>8. Motion (Hover로 확인)</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-s-3">
            <MotionBox label="duration-fast" duration="fast" />
            <MotionBox label="duration-normal" duration="normal" />
            <MotionBox label="duration-slow" duration="slow" />
            <MotionBox label="duration-slower" duration="slower" />
          </div>
        </section>

        <section>
          <SectionTitle>9. Game Colors (변경 금지)</SectionTitle>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-s-3">
            <ColorSwatch name="--gold" className="bg-gold text-t1" />
            <ColorSwatch name="--silver" className="bg-silver text-ti" />
            <ColorSwatch name="--bronze" className="bg-bronze text-ti" />
            <ColorSwatch name="--combo" className="bg-combo text-ti" />
            <ColorSwatch name="--streak" className="bg-streak text-ti" />
          </div>
        </section>

        {/* ────────────────────────────────────────
             §10 Buttons (이전 단계 유지)
             ──────────────────────────────────────── */}
        <section>
          <SectionTitle>10. Buttons — 8 variants × 3 sizes</SectionTitle>

          <SubTitle>10-1. Primary</SubTitle>
          <Row>
            <Button variant="primary" size="sm">Small</Button>
            <Button variant="primary" size="md">Medium (Default)</Button>
            <Button variant="primary" size="lg">Large</Button>
            <Button variant="primary" disabled>Disabled</Button>
            <Button variant="primary" loading={loadingId === "p1"} onClick={() => triggerLoad("p1")}>
              Click for Loading
            </Button>
          </Row>

          <SubTitle>10-2. Secondary</SubTitle>
          <Row>
            <Button variant="secondary" size="sm">Small</Button>
            <Button variant="secondary" size="md">Medium</Button>
            <Button variant="secondary" size="lg">Large</Button>
            <Button variant="secondary" disabled>Disabled</Button>
          </Row>

          <SubTitle>10-3. Danger</SubTitle>
          <Row>
            <Button variant="danger" size="sm" leftIcon={<Trash2 size={14} />}>Delete</Button>
            <Button variant="danger" size="md" leftIcon={<Trash2 size={16} />}>Delete Forever</Button>
            <Button variant="danger" size="lg">Confirm Delete</Button>
          </Row>

          <SubTitle>10-4. Ghost</SubTitle>
          <Row>
            <Button variant="ghost" size="sm">Cancel</Button>
            <Button variant="ghost" size="md">Skip</Button>
            <Button variant="ghost" size="lg">More Options</Button>
          </Row>

          <SubTitle>10-5. Icon Button</SubTitle>
          <Row>
            <Button variant="icon" size="sm" ariaLabel="Add"><Plus size={16} /></Button>
            <Button variant="icon" size="md" ariaLabel="Heart"><Heart size={20} /></Button>
            <Button variant="icon" size="lg" ariaLabel="Settings"><Settings size={24} /></Button>
            <Button variant="icon" size="md" ariaLabel="Search" disabled><Search size={20} /></Button>
          </Row>

          <SubTitle>10-6. Link Button</SubTitle>
          <Row>
            <Button variant="link" size="sm">Learn More</Button>
            <Button variant="link" size="md" rightIcon={<ArrowRight size={16} />}>Continue</Button>
          </Row>

          <SubTitle>10-7. Social Button</SubTitle>
          <div className="space-y-s-3 max-w-md">
            <Button variant="social" size="md" fullWidth leftIcon={<Mail size={18} />}>
              Continue with Email
            </Button>
          </div>
        </section>

        {/* ────────────────────────────────────────
             §11 Selectors (이전 단계 유지)
             ──────────────────────────────────────── */}
        <section>
          <SectionTitle>11. Selectors</SectionTitle>

          <SubTitle>11-1. Checkbox</SubTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-s-4 bg-bg2 p-s-6 rounded-lg border border-bd">
            <Checkbox label="기본 체크박스" checked={singleCheck} onChange={(e) => setSingleCheck(e.target.checked)} />
            <Checkbox label="이용약관에 동의" description="개인정보 처리방침 적용" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <Checkbox label="비활성 (체크됨)" checked disabled onChange={() => {}} />
            <Checkbox label="에러 상태" error checked={errorCheck} onChange={(e) => setErrorCheck(e.target.checked)} />
            <Checkbox label="Indeterminate" indeterminate onChange={() => {}} />
          </div>

          <SubTitle>11-2. CheckboxGroup</SubTitle>
          <div className="bg-bg2 p-s-6 rounded-lg border border-bd">
            <CheckboxGroup
              label="관심 학습 모듈"
              options={[
                { value: "reading", label: "📖 스크립트 독해" },
                { value: "vocabulary", label: "📚 단어장" },
                { value: "spelling", label: "⚡ 스펠링" },
                { value: "speed", label: "🌴 타임어택" },
              ]}
              value={hobbies}
              onChange={setHobbies}
            />
          </div>

          <SubTitle>11-3. Radio</SubTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-s-6">
            <div className="bg-bg2 p-s-6 rounded-lg border border-bd">
              <RadioGroup
                label="학습 난이도"
                name="difficulty"
                options={[
                  { value: "easy", label: "쉬움" },
                  { value: "medium", label: "보통" },
                  { value: "hard", label: "어려움" },
                ]}
                value={difficulty}
                onChange={setDifficulty}
              />
            </div>
            <div className="bg-bg2 p-s-6 rounded-lg border border-bd">
              <RadioGroup
                label="TTS 음성"
                name="voice"
                orientation="horizontal"
                options={[
                  { value: "alloy", label: "Alloy" },
                  { value: "echo", label: "Echo" },
                  { value: "nova", label: "Nova" },
                  { value: "onyx", label: "Onyx", disabled: true },
                ]}
                value={voiceType}
                onChange={setVoiceType}
              />
            </div>
          </div>

          <SubTitle>11-4. Toggle</SubTitle>
          <div className="bg-bg2 p-s-6 rounded-lg border border-bd space-y-s-4 max-w-md">
            <Toggle label="자동 재생" description="단어 카드 자동 발음" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
            <Toggle label="다크 모드 선호" checked={darkPref} onChange={(e) => setDarkPref(e.target.checked)} />
            <Toggle label="알림 받기" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} />
            <Toggle label="비활성 토글" checked disabled onChange={() => {}} />
            <Toggle label="작은 크기" size="sm" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
             §12 Form Fields (★ 신규)
             Input · Textarea · Select · FormField
             ════════════════════════════════════════════════════════ */}
        <section>
          <SectionTitle>12. Form Fields — Input · Textarea · Select</SectionTitle>

          <SubTitle>12-1. Input — 기본 상태</SubTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-s-4 bg-bg2 p-s-6 rounded-lg border border-bd">
            <Input placeholder="기본 입력" />
            <Input placeholder="비활성" disabled />
            <Input placeholder="에러 상태" state="error" defaultValue="invalid@" />
            <Input placeholder="성공 상태" state="success" defaultValue="user@vocaflow.com" />
          </div>

          <SubTitle>12-2. Input — Prefix · Suffix · Clearable · Password</SubTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-s-4 bg-bg2 p-s-6 rounded-lg border border-bd">
            <Input
              type="email"
              placeholder="이메일"
              prefix={<Mail size={16} />}
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
            />
            <Input
              placeholder="검색어 입력"
              prefix={<Search size={16} />}
              clearable
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onClear={() => setSearchValue("")}
            />
            <Input
              type="password"
              placeholder="비밀번호"
              prefix={<Lock size={16} />}
              showPasswordToggle
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
            />
            <Input
              type="number"
              placeholder="키 입력"
              suffix={<span className="font-body text-sm">cm</span>}
              defaultValue="170"
            />
          </div>

          <SubTitle>12-3. Input — 크기 변형</SubTitle>
          <div className="space-y-s-3 bg-bg2 p-s-6 rounded-lg border border-bd max-w-md">
            <Input size="sm" placeholder="Small (sm)" prefix={<User size={14} />} />
            <Input size="md" placeholder="Medium (md) — 기본" prefix={<User size={16} />} />
            <Input size="lg" placeholder="Large (lg)" prefix={<User size={18} />} />
          </div>

          <SubTitle>12-4. FormField — 통합 래퍼 (label + helper + error)</SubTitle>
          <div className="space-y-s-4 bg-bg2 p-s-6 rounded-lg border border-bd max-w-md">
            <FormField
              label="이메일 주소"
              required
              helper="로그인에 사용됩니다."
            >
              {(props) => (
                <Input type="email" placeholder="user@vocaflow.com" prefix={<Mail size={16} />} {...props} />
              )}
            </FormField>

            <FormField
              label="비밀번호"
              required
              hint="8자 이상"
              error="비밀번호는 8자 이상이어야 합니다."
            >
              {(props) => (
                <Input
                  type="password"
                  state="error"
                  placeholder="비밀번호"
                  prefix={<Lock size={16} />}
                  showPasswordToggle
                  {...props}
                />
              )}
            </FormField>

            <FormField
              label="사용자 이름"
              success="사용 가능한 이름입니다."
            >
              {(props) => (
                <Input
                  state="success"
                  defaultValue="vocaflow_user"
                  prefix={<User size={16} />}
                  {...props}
                />
              )}
            </FormField>
          </div>

          <SubTitle>12-5. Textarea — auto-resize + 글자수 카운터</SubTitle>
          <div className="bg-bg2 p-s-6 rounded-lg border border-bd space-y-s-4">
            <FormField
              label="영어 스크립트"
              hint="최대 5000자"
              helper="AI가 분석할 영어 본문을 붙여넣으세요."
            >
              {(props) => (
                <Textarea
                  placeholder="Paste your English script here..."
                  autoResize
                  showCount
                  maxLength={5000}
                  minRows={4}
                  maxRows={12}
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  {...props}
                />
              )}
            </FormField>

            <FormField label="자기소개 (선택)" hint="200자 이내">
              {(props) => (
                <Textarea
                  placeholder="간단한 자기소개..."
                  showCount
                  maxLength={200}
                  minRows={3}
                  value={bioText}
                  onChange={(e) => setBioText(e.target.value)}
                  {...props}
                />
              )}
            </FormField>
          </div>

          <SubTitle>12-6. Select — 5 상태</SubTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-s-4 bg-bg2 p-s-6 rounded-lg border border-bd">
            <Select
              placeholder="언어 선택"
              options={[
                { value: "en", label: "English" },
                { value: "ko", label: "한국어" },
                { value: "ja", label: "日本語" },
                { value: "zh", label: "中文" },
              ]}
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
            />
            <Select
              placeholder="비활성"
              disabled
              options={[
                { value: "1", label: "Option 1" },
              ]}
            />
            <Select
              state="error"
              options={[
                { value: "", label: "필수 선택", disabled: true },
                { value: "1", label: "옵션 1" },
              ]}
            />
            <Select
              state="success"
              defaultValue="1"
              options={[{ value: "1", label: "선택 완료" }]}
            />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
             §13 Visual Components (★ 신규)
             Badge · Card · ProgressBar · ButtonGroup
             ════════════════════════════════════════════════════════ */}
        <section>
          <SectionTitle>13. Visual — Badge · Card · ProgressBar · ButtonGroup</SectionTitle>

          <SubTitle>13-1. Badge — 6 colors × 3 sizes</SubTitle>
          <div className="bg-bg2 p-s-6 rounded-lg border border-bd space-y-s-4">
            <Row>
              <Badge variant="blue">Blue (기본)</Badge>
              <Badge variant="green">Green</Badge>
              <Badge variant="gray">Gray</Badge>
              <Badge variant="yellow">Yellow</Badge>
              <Badge variant="red">Red</Badge>
              <Badge variant="purple">Purple</Badge>
            </Row>
            <Row>
              <Badge size="sm" variant="green" leftIcon={<CheckCircle2 size={10} />}>완료</Badge>
              <Badge size="md" variant="blue" leftIcon={<BookOpen size={11} />}>학습 중</Badge>
              <Badge size="lg" variant="yellow" leftIcon={<AlertTriangle size={12} />}>주의</Badge>
            </Row>
          </div>

          <SubTitle>13-2. Card — 4 variants</SubTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-s-4">
            <Card variant="default">
              <CardHeader>
                <CardTitle>Default Card</CardTitle>
                <CardDescription>기본 카드 — bg2 + border</CardDescription>
              </CardHeader>
              <CardContent>WordVault에 100개 단어가 저장되어 있습니다.</CardContent>
            </Card>

            <Card variant="bordered">
              <CardHeader>
                <CardTitle>Bordered Card</CardTitle>
                <CardDescription>강한 테두리</CardDescription>
              </CardHeader>
              <CardContent>중요한 콘텐츠를 강조할 때 사용합니다.</CardContent>
            </Card>

            <Card variant="elevated">
              <CardHeader>
                <CardTitle>Elevated Card</CardTitle>
                <CardDescription>그림자 (shadow-md)</CardDescription>
              </CardHeader>
              <CardContent>부유하는 느낌의 카드.</CardContent>
              <CardFooter>
                <Button variant="primary" size="sm">시작하기</Button>
                <Button variant="ghost" size="sm">자세히</Button>
              </CardFooter>
            </Card>

            <Card variant="interactive" onClick={() => toast.info("카드 클릭됨!")}>
              <CardHeader>
                <CardTitle>Interactive Card</CardTitle>
                <CardDescription>호버하면 떠오름 + 클릭 가능</CardDescription>
              </CardHeader>
              <CardContent>마우스 올려보세요. 클릭도 됩니다.</CardContent>
            </Card>
          </div>

          <SubTitle>13-3. ProgressBar — 색상 + 크기</SubTitle>
          <div className="space-y-s-4 bg-bg2 p-s-6 rounded-lg border border-bd">
            <ProgressBar value={progress} max={100} showLabel showPercent label="학습 진행률" />
            <ProgressBar value={45} max={100} color="success" size="md" showLabel label="단어 익히기" />
            <ProgressBar value={70} max={100} color="warning" size="md" />
            <ProgressBar value={20} max={100} color="error" size="lg" />

            <Row>
              <Button size="sm" onClick={() => setProgress(Math.max(0, progress - 10))}>-10</Button>
              <Button size="sm" onClick={() => setProgress(Math.min(100, progress + 10))}>+10</Button>
              <span className="font-mono text-sm text-t2">value: {progress}</span>
            </Row>
          </div>

          <SubTitle>13-4. ButtonGroup — 분할 버튼</SubTitle>
          <div className="bg-bg2 p-s-6 rounded-lg border border-bd space-y-s-4">
            <ButtonGroup
              label="VIEW"
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: "grid", label: "Grid", icon: <Grid3x3 size={14} /> },
                { value: "list", label: "List", icon: <List size={14} /> },
                { value: "card", label: "Card", icon: <LayoutGrid size={14} /> },
              ]}
            />
            <ButtonGroup
              label="ALIGN"
              size="sm"
              value={textAlign}
              onChange={setTextAlign}
              options={[
                { value: "left", label: "", icon: <AlignLeft size={14} /> },
                { value: "center", label: "", icon: <AlignCenter size={14} /> },
                { value: "right", label: "", icon: <AlignRight size={14} /> },
              ]}
            />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
             §14 Feedback (★ 신규)
             Tooltip · Toast · Modal · LoadingOverlay
             ════════════════════════════════════════════════════════ */}
        <section>
          <SectionTitle>14. Feedback — Tooltip · Toast · Modal · Loading</SectionTitle>

          <SubTitle>14-1. Tooltip — 4방향 × 4색</SubTitle>
          <div className="bg-bg2 p-s-12 rounded-lg border border-bd flex flex-wrap items-center justify-center gap-s-12">
            <Tooltip content="Top tooltip (default)" position="top">
              <Button variant="ghost">Top</Button>
            </Tooltip>
            <Tooltip content="Bottom" position="bottom">
              <Button variant="ghost">Bottom</Button>
            </Tooltip>
            <Tooltip content="Left side" position="left">
              <Button variant="ghost">Left</Button>
            </Tooltip>
            <Tooltip content="Right side" position="right">
              <Button variant="ghost">Right</Button>
            </Tooltip>
            <Tooltip content="정보 색상" color="info">
              <Button variant="ghost">Info</Button>
            </Tooltip>
            <Tooltip content="경고 색상" color="warning">
              <Button variant="ghost">Warning</Button>
            </Tooltip>
            <Tooltip content="에러 색상" color="error">
              <Button variant="ghost">Error</Button>
            </Tooltip>
          </div>

          <SubTitle>14-2. Toast — 4종 (자동 사라짐 3초)</SubTitle>
          <div className="bg-bg2 p-s-6 rounded-lg border border-bd">
            <Row>
              <Button onClick={() => toast.success("저장되었습니다!")}>Success</Button>
              <Button variant="danger" onClick={() => toast.error("오류가 발생했습니다.")}>Error</Button>
              <Button variant="secondary" onClick={() => toast.info("새 알림이 있습니다.")}>Info</Button>
              <Button variant="ghost" onClick={() => toast.warning("저장하지 않은 변경사항이 있습니다.")}>
                Warning
              </Button>
              <Button onClick={() => toast.success("학습 완료!", { title: "축하합니다 🎉" })}>
                Title 포함
              </Button>
            </Row>
          </div>

          <SubTitle>14-3. Modal — 기본 + Confirm</SubTitle>
          <div className="bg-bg2 p-s-6 rounded-lg border border-bd">
            <Row>
              <Button onClick={() => setModalOpen(true)}>모달 열기</Button>
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>삭제 확인 모달</Button>
            </Row>
          </div>

          <SubTitle>14-4. LoadingOverlay — 진행률 표시</SubTitle>
          <div className="bg-bg2 p-s-6 rounded-lg border border-bd">
            <Row>
              <Button onClick={startLoadingDemo}>AI 분석 시뮬레이션</Button>
            </Row>
            <p className="font-mono text-xs text-t3 mt-s-3">
              클릭하면 2초간 진행률 0→100% 진행 후 토스트 표시
            </p>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
             §15 Misc (★ 신규)
             Skeleton · EmptyState
             ════════════════════════════════════════════════════════ */}
        <section>
          <SectionTitle>15. Misc — Skeleton · EmptyState</SectionTitle>

          <SubTitle>15-1. Skeleton — 로딩 플레이스홀더</SubTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-s-4">
            <SkeletonCard />
            <Card>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </Card>
          </div>

          <SubTitle>15-2. EmptyState — 빈 상태</SubTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-s-4">
            <Card padding="none">
              <EmptyState
                icon={<Inbox size={32} />}
                title="아직 단어장이 없어요"
                description="영어 스크립트를 붙여넣어 첫 단어장을 만들어보세요."
                action={
                  <>
                    <Button variant="primary">스크립트 붙여넣기</Button>
                    <Button variant="ghost">샘플 보기</Button>
                  </>
                }
              />
            </Card>
            <Card padding="none">
              <EmptyState
                icon={<Search size={32} />}
                title="검색 결과 없음"
                description="다른 키워드로 검색해보세요."
              />
            </Card>
          </div>
        </section>

        <footer className="border-t border-bd pt-s-6 mt-s-16">
          <p className="text-t3 text-sm font-mono text-center">
            CLAUDE.md v06.2 · Vocaflow UI Component Catalog · 14 Components Complete
          </p>
        </footer>
      </div>

      {/* ── Modals (page 최상단에 항상 렌더 가능) ── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="단어장 만들기"
        description="영어 스크립트로 새 단어장을 만듭니다."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setModalOpen(false);
                toast.success("단어장이 생성되었습니다!");
              }}
            >
              만들기
            </Button>
          </>
        }
      >
        <div className="space-y-s-4">
          <FormField label="단어장 이름" required>
            {(props) => <Input placeholder="예: Day 1 — 일상 회화" {...props} />}
          </FormField>
          <FormField label="설명 (선택)">
            {(props) => (
              <Textarea placeholder="간단한 설명..." minRows={3} {...props} />
            )}
          </FormField>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="단어장을 삭제하시겠습니까?"
        description="이 작업은 되돌릴 수 없습니다. 모든 학습 기록도 함께 삭제됩니다."
        confirmText="삭제"
        cancelText="취소"
        variant="danger"
        loading={confirmLoading}
      />

      <LoadingOverlay
        isOpen={loadingOpen}
        message="AI가 단어를 분석 중입니다"
        description="영어 스크립트에서 핵심 단어를 추출하고 있습니다..."
        progress={loadingProgress}
      />
    </main>
  );
}

// ══════════════════════════════════════════════════════════════
// Helper Components
// ══════════════════════════════════════════════════════════════
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-xl font-bold text-t1 mb-s-4 pb-s-2 border-b border-bd">
      {children}
    </h2>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display text-sm font-semibold text-t2 mt-s-6 mb-s-3 uppercase tracking-wider">
      {children}
    </h3>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-s-3">{children}</div>;
}

function ColorSwatch({ name, className }: { name: string; className: string }) {
  return (
    <div className={`p-s-4 rounded-md font-mono text-xs h-20 flex items-end shadow-sm ${className}`}>
      {name}
    </div>
  );
}

function MotionBox({
  label,
  duration,
}: {
  label: string;
  duration: "fast" | "normal" | "slow" | "slower";
}) {
  const durationClass = {
    fast: "duration-fast",
    normal: "duration-normal",
    slow: "duration-slow",
    slower: "duration-slower",
  }[duration];

  return (
    <div
      className={`p-s-6 rounded-md bg-bg2 border border-bd text-center font-mono text-xs text-t2 cursor-pointer transition-all ${durationClass} hover:bg-p hover:text-ti hover:scale-105 hover:shadow-lg`}
    >
      {label}
    </div>
  );
}
