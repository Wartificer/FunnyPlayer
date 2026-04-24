import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'

// Simple store so PlayerScreen can set it and ScriptLoadingIndicator can read it
export const useScriptLoadingStore = create<{
  loading: boolean
  setLoading: (v: boolean) => void
}>((set) => ({
  loading: false,
  setLoading: (v) => set({ loading: v })
}))

export function ScriptLoadingIndicator() {
  const loading = useScriptLoadingStore((s) => s.loading)
  const [showDone, setShowDone] = useState(false)
  const [visible, setVisible] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const prevLoadingRef = useRef(false)

  useEffect(() => {
    // Went from not-loading to loading
    if (loading && !prevLoadingRef.current) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      setShowDone(false)
      setVisible(true)
    }
    // Went from loading to not-loading (finished)
    if (!loading && prevLoadingRef.current) {
      setShowDone(true)
      setVisible(true)
      hideTimerRef.current = setTimeout(() => {
        setVisible(false)
        setShowDone(false)
      }, 1500)
    }
    prevLoadingRef.current = loading

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [loading])

  if (!visible) return null

  return (
    <div style={{
      position: 'absolute',
      top: 56,
      left: 12,
      zIndex: 20,
      background: 'rgba(0,0,0,0.85)',
      color: '#eee',
      fontSize: 11,
      fontWeight: 500,
      padding: '6px 12px',
      borderRadius: 6,
      boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      pointerEvents: 'none'
    }}>
      {!showDone ? (
        <>
          <span style={{
            display: 'inline-block',
            width: 12,
            height: 12,
            border: '2px solid rgba(255,255,255,0.3)',
            borderTopColor: '#fff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          Loading script...
        </>
      ) : (
        <>
          <span style={{ color: '#4caf50', fontSize: 14 }}>&#10003;</span>
          Script loaded
        </>
      )}
    </div>
  )
}
