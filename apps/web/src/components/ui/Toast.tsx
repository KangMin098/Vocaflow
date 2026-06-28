// apps/web/src/components/ui/Toast.tsx
// Vocaflow Toast — Parts Kit v06 §Toast 기준
// CLAUDE.md §🆕 추가 컴포넌트 §Toast 완전 구현
// ───────────────────────────────────────────────────
// 4종: success · error · info · warning
// 위치: 화면 상단 중앙 fixed
// 자동 닫힘: 3초 (변경 가능)
// 사용: ToastProvider로 감싸고 useToast() 훅 사용

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════
export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number; // ms
}

interface ToastContextValue {
  show: (toast: Omit<ToastItem, "id">) => void;
  success: (message: string, options?: Partial<ToastItem>) => void;
  error: (message: string, options?: Partial<ToastItem>) => void;
  info: (message: string, options?: Partial<ToastItem>) => void;
  warning: (message: string, options?: Partial<ToastItem>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ══════════════════════════════════════════════════════════════
// useToast Hook
// ══════════════════════════════════════════════════════════════
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

// ══════════════════════════════════════════════════════════════
// Provider
// ══════════════════════════════════════════════════════════════
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { ...toast, id }]);

      const duration = toast.duration ?? 3000;
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const success = useCallback(
    (message: string, options?: Partial<ToastItem>) =>
      show({ type: "success", message, ...options }),
    [show],
  );
  const error = useCallback(
    (message: string, options?: Partial<ToastItem>) =>
      show({ type: "error", message, ...options }),
    [show],
  );
  const info = useCallback(
    (message: string, options?: Partial<ToastItem>) =>
      show({ type: "info", message, ...options }),
    [show],
  );
  const warning = useCallback(
    (message: string, options?: Partial<ToastItem>) =>
      show({ type: "warning", message, ...options }),
    [show],
  );

  return (
    <ToastContext.Provider
      value={{ show, success, error, info, warning, dismiss }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ══════════════════════════════════════════════════════════════
// Container (화면 상단 중앙)
// ══════════════════════════════════════════════════════════════
function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "fixed top-s-4 left-1/2 -translate-x-1/2 z-[100]",
        "flex flex-col gap-s-2 w-full max-w-md px-s-4",
        "pointer-events-none",
      )}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Item (CLAUDE.md 사양: bg-{type}-light + border-l-[3.5px] border-{type})
// ══════════════════════════════════════════════════════════════
const typeStyles: Record<
  ToastType,
  { bg: string; border: string; icon: typeof CheckCircle2; iconColor: string }
> = {
  success: {
    bg: "bg-success-light",
    border: "border-l-success",
    icon: CheckCircle2,
    iconColor: "text-success",
  },
  error: {
    bg: "bg-error-light",
    border: "border-l-error",
    icon: XCircle,
    iconColor: "text-error",
  },
  info: {
    bg: "bg-info-light",
    border: "border-l-info",
    icon: Info,
    iconColor: "text-info",
  },
  warning: {
    bg: "bg-warning-light",
    border: "border-l-warning",
    icon: AlertTriangle,
    iconColor: "text-warning",
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const styles = typeStyles[toast.type];
  const Icon = styles.icon;
  const [isLeaving, setIsLeaving] = useState(false);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  return (
    <div
      role="alert"
      className={cn(
        "pointer-events-auto",
        "flex items-start gap-s-3",
        "px-s-4 py-s-3 rounded-md shadow-lg",
        "border-l-[3.5px]",
        styles.bg,
        styles.border,
        isLeaving
          ? "animate-[toastSlideOut_200ms_ease-in_forwards]"
          : "animate-[toastSlideIn_300ms_cubic-bezier(0.34,1.56,0.64,1)]",
      )}
    >
      <Icon size={20} className={cn("shrink-0 mt-[2px]", styles.iconColor)} />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="font-display font-semibold text-sm text-t1 mb-[2px]">
            {toast.title}
          </p>
        )}
        <p className="font-body text-sm text-t1">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={handleClose}
        aria-label="알림 닫기"
        className={cn(
          "shrink-0 w-6 h-6 rounded",
          "flex items-center justify-center",
          "text-t3 hover:text-t1 hover:bg-bg3",
          "transition-colors duration-normal",
        )}
      >
        <X size={14} />
      </button>

      <style jsx>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes toastSlideOut {
          to {
            opacity: 0;
            transform: translateY(-20px);
          }
        }
      `}</style>
    </div>
  );
}
