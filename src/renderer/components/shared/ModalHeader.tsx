import { X } from 'lucide-react'

interface ModalHeaderProps {
  title: string
  onClose: () => void
}

export function ModalHeader({ title, onClose }: ModalHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0
      }}
    >
      <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
          borderRadius: 4
        }}
      >
        <X size={18} />
      </button>
    </div>
  )
}
