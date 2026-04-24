import { useAppStore } from '../../store/app-store'
import { ModalHeader } from '../shared/ModalHeader'

const APP_NAME = 'FunnyPlayer'
const APP_VERSION = '1.0.0'
const AUTHOR = 'Wartificer'
const REPO_URL = 'https://github.com/wartificer/FunnyPlayer'

interface Attribution {
  name: string
  license: string
  url: string
}

const ATTRIBUTIONS: Attribution[] = [
  { name: 'mpv (libmpv)', license: 'GPLv2+ / LGPLv2.1+', url: 'https://mpv.io' },
  { name: 'Electron', license: 'MIT', url: 'https://www.electronjs.org' },
  { name: 'Chromium', license: 'BSD 3-Clause', url: 'https://www.chromium.org' },
  { name: 'Node.js', license: 'MIT', url: 'https://nodejs.org' },
  { name: 'React', license: 'MIT', url: 'https://react.dev' },
  { name: 'FFmpeg', license: 'LGPLv2.1+ / GPLv2+', url: 'https://ffmpeg.org' },
  { name: 'Zustand', license: 'MIT', url: 'https://github.com/pmndrs/zustand' },
  { name: 'Lucide Icons', license: 'ISC', url: 'https://lucide.dev' },
  { name: 'electron-store', license: 'MIT', url: 'https://github.com/sindresorhus/electron-store' }
]

export function AboutModal() {
  const setShowAboutModal = useAppStore((s) => s.setShowAboutModal)
  const close = () => setShowAboutModal(false)

  const openExternal = (url: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const linkStyle: React.CSSProperties = {
    color: 'var(--accent)',
    textDecoration: 'none'
  }

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
        padding: 40, boxSizing: 'border-box'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          width: '100%',
          height: '100%',
          maxWidth: 520,
          maxHeight: 600,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <ModalHeader title={`About ${APP_NAME}`} onClose={close} />

        <div style={{ padding: 24, overflowY: 'auto', flex: 1, fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{APP_NAME}</div>
            <div style={{ color: 'var(--text-secondary)' }}>Version {APP_VERSION}</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>Author</div>
            <div>{AUTHOR}</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>License</div>
            <div>
              GNU General Public License v3.0 (
              <a href="https://www.gnu.org/licenses/gpl-3.0.html" onClick={openExternal('https://www.gnu.org/licenses/gpl-3.0.html')} style={linkStyle}>
                GPLv3
              </a>
              )
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>Repository</div>
            <a href={REPO_URL} onClick={openExternal(REPO_URL)} style={linkStyle}>
              {REPO_URL}
            </a>
          </div>

          <div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>Attributions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ATTRIBUTIONS.map((a) => (
                <div
                  key={a.name}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '4px 8px',
                    border: '1px solid var(--border)',
                    borderRadius: 4
                  }}
                >
                  <a href={a.url} onClick={openExternal(a.url)} style={linkStyle}>
                    {a.name}
                  </a>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{a.license}</span>
                </div>
              ))}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 10 }}>
              This software is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY.
              See the LICENSE file for full license terms.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
