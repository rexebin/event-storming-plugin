import { useRef, useCallback } from 'react'

export function useDebounce(setter: React.Dispatch<React.SetStateAction<string>>, delayMs: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  return useCallback(
    (value: string) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setter(value), delayMs)
    },
    [delayMs, setter],
  )
}
