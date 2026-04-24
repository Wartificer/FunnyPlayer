import { useEffect, useState } from 'react'
import { useAppStore, refreshVideos } from '../../store/app-store'
import { X, ChevronRight, ChevronDown, Clock, Star, EyeOff } from 'lucide-react'

interface TreeNode {
  path: string
  name: string
  children: TreeNode[]
}

function TreeItem({ node, depth, onRemove }: {
  node: TreeNode
  depth: number
  onRemove?: (path: string, e: React.MouseEvent) => void
}) {
  const selectedFolder = useAppStore((s) => s.selectedFolder)
  const setSelectedFolder = useAppStore((s) => s.setSelectedFolder)
  const clearSelection = useAppStore((s) => s.clearSelection)
  const [expanded, setExpanded] = useState(depth === 0)
  const [dragOver, setDragOver] = useState(false)
  const hasChildren = node.children.length > 0
  const isSelected = selectedFolder === node.path
  const isRoot = depth === 0

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-funnyplayer-videos') || e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDragOver(true)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    let paths: string[] = []
    if (e.dataTransfer.types.includes('application/x-funnyplayer-videos')) {
      paths = JSON.parse(e.dataTransfer.getData('application/x-funnyplayer-videos'))
    } else if (e.dataTransfer.files.length > 0) {
      const { webUtils } = require('electron')
      paths = Array.from(e.dataTransfer.files).map((f) => webUtils.getPathForFile(f)).filter(Boolean)
    }
    if (paths.length === 0) return
    try {
      await window.api.moveFiles(paths, node.path)
      clearSelection()
      await refreshVideos()
    } catch (err) {
      console.error('[Tree Drop] ERROR:', err)
    }
  }

  return (
    <div>
      <div
        onClick={() => setSelectedFolder(node.path)}
        onDragOver={handleDragOver}
        onDragEnter={() => {}}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          padding: '6px 12px',
          paddingLeft: 12 + depth * 16,
          cursor: 'pointer',
          background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
          borderRadius: 4,
          fontSize: 13,
          lineHeight: '20px',
          minHeight: 32,
          display: 'flex',
          alignItems: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          gap: 4,
          border: dragOver ? '2px dashed var(--accent)' : '2px solid transparent'
        }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}

        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
          {node.name}
        </span>

        {isRoot && onRemove && (
          <span
            onClick={(e) => onRemove(node.path, e)}
            style={{ color: 'var(--text-secondary)', fontSize: 11, padding: '0 4px', flexShrink: 0, cursor: 'pointer' }}
          >
            <X size={11} />
          </span>
        )}
      </div>

      {expanded && hasChildren && node.children.map((child) => (
        <TreeItem key={child.path} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

const categoryStyle = (isSelected: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  cursor: 'pointer',
  background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
  borderRadius: 4,
  fontSize: 13,
  lineHeight: '20px',
  minHeight: 32,
  display: 'flex',
  alignItems: 'center',
  gap: 8
})

export function FolderTree() {
  const folders = useAppStore((s) => s.folders)
  const selectedFolder = useAppStore((s) => s.selectedFolder)
  const setSelectedFolder = useAppStore((s) => s.setSelectedFolder)
  const setFolders = useAppStore((s) => s.setFolders)
  const showHidden = useAppStore((s) => s.showHidden)
  const [trees, setTrees] = useState<TreeNode[]>([])

  useEffect(() => {
    Promise.all(folders.map((f) => window.api.getFolderTree(f))).then(setTrees)
  }, [folders])

  const handleRemoveFolder = async (folder: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await window.api.removeFolder(folder)
    const updated = await window.api.getFolders()
    setFolders(updated)
    if (selectedFolder === folder) setSelectedFolder(null)
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '8px 0'
    }}>
      {/* Fixed top: Recent + Favorites */}
      <div style={{ flexShrink: 0 }}>
        <div
          style={categoryStyle(selectedFolder === '__recent__')}
          onClick={() => setSelectedFolder('__recent__')}
        >
          <Clock size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
          Recent
        </div>
        <div
          style={categoryStyle(selectedFolder === '__favorites__')}
          onClick={() => setSelectedFolder('__favorites__')}
        >
          <Star size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
          Favorites
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
      </div>

      {/* Scrollable folder tree */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {trees.map((tree) => (
          <TreeItem key={tree.path} node={tree} depth={0} onRemove={handleRemoveFolder} />
        ))}

        {folders.length === 0 && (
          <div style={{ padding: '20px 12px', color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center' }}>
            No folders added yet.<br />Use File &rarr; Add Folder
          </div>
        )}
      </div>

      {/* Fixed bottom: Hidden */}
      {showHidden && (
        <div style={{ flexShrink: 0 }}>
          <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
          <div
            style={categoryStyle(selectedFolder === '__hidden__')}
            onClick={() => setSelectedFolder('__hidden__')}
          >
            <EyeOff size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
            Hidden
          </div>
        </div>
      )}
    </div>
  )
}
