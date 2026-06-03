import { useEffect, useState } from 'react'
import { getProblemsByFolder, deleteProblem, type SavedProblem, type Folder } from './db'
import './Gallery.css'

interface Props {
  folder: Folder
  onLoad: (problem: SavedProblem) => void
  onClose: () => void
}

export default function Gallery({ folder, onLoad, onClose }: Props) {
  const [problems, setProblems] = useState<SavedProblem[]>([])
  const [deleteTarget, setDeleteTarget] = useState<SavedProblem | null>(null)

  useEffect(() => {
    getProblemsByFolder(folder.id!).then(setProblems)
  }, [folder.id])

  async function handleDelete(p: SavedProblem) {
    await deleteProblem(p.id!)
    setProblems(prev => prev.filter(x => x.id !== p.id))
    setDeleteTarget(null)
  }

  return (
    <div className="gallery-screen">
      <header className="gallery-header">
        <div className="gallery-title-row">
          <span className="gallery-folder-icon">📁</span>
          <h2>{folder.name}</h2>
        </div>
        <button className="gallery-close" onClick={onClose}>✕</button>
      </header>

      {problems.length === 0 ? (
        <div className="gallery-empty">저장된 문제가 없습니다</div>
      ) : (
        <div className="gallery-grid">
          {problems.map(p => (
            <div key={p.id} className="gallery-item">
              <div className="gallery-thumb" onClick={() => onLoad(p)}>
                <img src={p.thumbnail} alt={p.title} />
              </div>
              <div className="gallery-info">
                <span className="gallery-title">{p.title}</span>
                <button className="gallery-delete" onClick={() => setDeleteTarget(p)}>✕</button>
              </div>
              <span className="gallery-date">{p.date}</span>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-msg">"{deleteTarget.title}"을<br />삭제하시겠습니까?</p>
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
