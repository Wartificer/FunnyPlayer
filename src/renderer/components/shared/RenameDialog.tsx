import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface Props {
  videoPath: string
  currentName: string
  onDone: () => void
  onCancel: () => void
}

export function RenameDialog({ videoPath, currentName, onDone, onCancel }: Props) {
  const [name, setName] = useState(currentName)
  const [relatedFiles, setRelatedFiles] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
    window.api.getRelatedFiles(videoPath).then(setRelatedFiles)
  }, [videoPath])

  const previewFiles = relatedFiles.map((f) => {
    const oldBase = currentName
    if (f.startsWith(oldBase)) {
      return name + f.slice(oldBase.length)
    }
    return f
  })

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === currentName) { onCancel(); return }
    setSubmitting(true)
    setError(null)
    try {
      await window.api.renameFile(videoPath, trimmed)
      onDone()
    } catch (err: any) {
      setError(err.message || 'Failed to rename')
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onCancel() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 24,
          minWidth: 380,
          maxWidth: 500,
          position: 'relative'
        }}
      >
        <button
          onClick={onCancel}
          style={{
            position: 'absolute', top: 10, right: 10,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', padding: 4, display: 'flex', alignItems: 'center'
          }}
        >
          <X size={16} />
        </button>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Rename</div>

        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: 13,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            color: 'var(--text-primary)',
            boxSizing: 'border-box'
          }}
        />

        {relatedFiles.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Files that will be renamed:
            </div>
            <div style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              background: 'var(--bg-primary)',
              borderRadius: 4,
              padding: '6px 10px',
              maxHeight: 150,
              overflow: 'auto',
              lineHeight: 1.8
            }}>
              {previewFiles.map((f, i) => (
                <div key={i} style={{
                  color: f !== relatedFiles[i] ? 'var(--text-primary)' : 'var(--text-secondary)'
                }}>
                  {f !== relatedFiles[i] ? (
                    <>{relatedFiles[i]} <span style={{ color: 'var(--text-secondary)' }}>&rarr;</span> <span style={{ color: 'var(--accent)' }}>{f}</span></>
                  ) : f}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ color: '#c44', fontSize: 12, marginTop: 8 }}>{error}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} style={{ padding: '6px 16px' }}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim() || name.trim() === currentName}
            style={{
              padding: '6px 16px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: submitting ? 'wait' : 'pointer',
              opacity: (!name.trim() || name.trim() === currentName) ? 0.5 : 1
            }}
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  )
}
