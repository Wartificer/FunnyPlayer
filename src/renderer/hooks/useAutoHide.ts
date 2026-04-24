import { useEffect, useRef, useState, useCallback } from 'react'

export function useAutoHide(timeoutMs = 3000) {
  const [visible, setVisible] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const resetTimer = useCallback(() => {
    setVisible(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(false), timeoutMs)
  }, [timeoutMs])

  useEffect(() => {
    const handleMouseMove = () => resetTimer()
    window.addEventListener('mousemove', handleMouseMove)
    resetTimer()
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [resetTimer])

  return visible
}
