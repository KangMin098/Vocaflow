// apps/web/src/hooks/useIMEDetection.ts

'use client'

import type { IMEStatus } from '@/types/spellforge'
import { useCallback, useState } from 'react'

const KOREAN_REGEX = /[ㄱ-ㅎㅏ-ㅣ가-힣]/

export function useIMEDetection() {
  const [status, setStatus] = useState<IMEStatus>('en')

  /**
   * 입력값 검사 후 한글이면 차단
   * @returns sanitized value (한글 제거된 문자열)
   */
  const checkInput = useCallback((value: string): string => {
    if (KOREAN_REGEX.test(value)) {
      setStatus('ko-error')
      // 2.5초 후 자동 복귀
      setTimeout(() => setStatus('en'), 2500)
      return value.replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g, '')
    }
    setStatus('en')
    return value
  }, [])

  return { imeStatus: status, checkInput }
}
