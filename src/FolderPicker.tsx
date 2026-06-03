import { useEffect, useRef, useState } from 'react'
import { getAllFolders, createFolder, deleteFolder, type Folder } from './db'
import './FolderPicker.css'

interface Props {
  onSelect: (folder: Folder) => void
  onClose: () => void
}

export default function FolderPicker({ onSelect, onClose }: Props) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Folder | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getAllFolders().then(setFolders)
  }, [])

  useEffect(() => {
    if (creating) inputRef.current?.focus()
  }, [creating])

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    const folder = await createFolder(name)
    setFolders(prev => [...prev, folder])
    setNewName('')
    setCreating(false)
    onSelect(folder)
  }

  async function handleDelete(f: Folder) {
    await deleteFolder(f.id!)
    setFolders(prev => prev.filter(x => x.id !== f.id))
    setDeleteTarget(null)
  }

  return (
    <div className="fp-screen">
      <header className="fp-header">
        <h2>폴더 선택</h2>
        <button className="fp-close" onClick={onClose}>✕</button>
      </header>

      <div className="fp-list">
        {folders.length === 0 && !creating && (
          <p className="fp-empty">폴더가 없습니다.<br />아래에서 새 폴더를 만드세요.</p>
        )}
        {folders.map(f => (
          <div key={f.id} className="fp-item">
            <button className="fp-item-btn" onClick={() => onSelect(f)}>
              <span className="fp-icon">📁</span>
              <span className="fp-name">{f.name}</span>
            </button>
            <button className="fp-item-delete" onClick={() => setDeleteTarget(f)}>✕</button>
          </div>
        ))}
      </div>

      <div className="fp-footer">
        {creating ? (
          <div className="fp-create-row">
            <input
              ref={inputRef}
              className="fp-input"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="폴더 이름"
            />
            <button className="fp-create-confirm" onClick={handleCreate}>만들기</button>
            <button className="fp-create-cancel" onClick={() => { setCreating(false); setNewName('') }}>취소</button>
          </div>
        ) : (
          <button className="fp-new-btn" onClick={() => setCreating(true)}>
            + 새 폴더 만들기
          </button>
        )}
      </div>

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-msg">"{deleteTarget.name}" 폴더와<br />내부 문제를 삭제하시겠습니까?</p>
            <div className="modal-btns">
              <button className="modal-btn modal-yes modal-danger" onClick={() => handleDelete(deleteTarget)}>예</button>
              <button className="modal-btn modal-no" onClick={() => setDeleteTarget(null)}>아니오</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
