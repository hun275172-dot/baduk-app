import { useState, useRef, useMemo } from 'react'
import Board from './Board'
import TreeView from './TreeView'
import './App.css'

export type Stone = 'black' | 'white' | null
export interface Position { row: number; col: number }
export interface PreviewMark { row: number; col: number; num: number }

interface GameState {
  board: Stone[][]
  currentTurn: 'black' | 'white'
  koPoint: Position | null
}

export interface TreeNode {
  id: string
  state: GameState
  parentId: string | null
  childIds: string[]
  moveNumber: number
  move?: { row: number; col: number; color: 'black' | 'white' }
}

type PlacementMode = 'alt-black' | 'alt-white' | 'black-only' | 'white-only'

const SIZE = 9
const ROOT_ID = 'root'

const MODES: { id: PlacementMode; label: string; stones: ('black' | 'white')[] }[] = [
  { id: 'alt-black',  label: '흑먼저 번갈아', stones: ['black', 'white'] },
  { id: 'alt-white',  label: '백먼저 번갈아', stones: ['white', 'black'] },
  { id: 'black-only', label: '흑돌만',        stones: ['black', 'black'] },
  { id: 'white-only', label: '백돌만',        stones: ['white', 'white'] },
]

function getAdjacent(row: number, col: number): Position[] {
  const adj: Position[] = []
  if (row > 0)        adj.push({ row: row - 1, col })
  if (row < SIZE - 1) adj.push({ row: row + 1, col })
  if (col > 0)        adj.push({ row, col: col - 1 })
  if (col < SIZE - 1) adj.push({ row, col: col + 1 })
  return adj
}

function getGroup(board: Stone[][], row: number, col: number): Position[] {
  const color = board[row][col]
  if (!color) return []
  const visited = new Set<string>()
  const group: Position[] = []
  const queue: Position[] = [{ row, col }]
  while (queue.length > 0) {
    const pos = queue.shift()!
    const key = `${pos.row},${pos.col}`
    if (visited.has(key)) continue
    visited.add(key)
    group.push(pos)
    for (const adj of getAdjacent(pos.row, pos.col)) {
      if (!visited.has(`${adj.row},${adj.col}`) && board[adj.row][adj.col] === color)
        queue.push(adj)
    }
  }
  return group
}

function getLiberties(board: Stone[][], group: Position[]): number {
  const libs = new Set<string>()
  for (const pos of group)
    for (const adj of getAdjacent(pos.row, pos.col))
      if (board[adj.row][adj.col] === null) libs.add(`${adj.row},${adj.col}`)
  return libs.size
}

function makeRootNode(mode: PlacementMode): TreeNode {
  const firstTurn: 'black' | 'white' =
    mode === 'alt-white' || mode === 'white-only' ? 'white' : 'black'
  return {
    id: ROOT_ID,
    state: {
      board: Array.from({ length: SIZE }, () => Array(SIZE).fill(null)),
      currentTurn: firstTurn,
      koPoint: null,
    },
    parentId: null,
    childIds: [],
    moveNumber: 0,
  }
}

export default function App() {
  const [mode, setMode] = useState<PlacementMode>('alt-black')
  const [nodes, setNodes] = useState<Record<string, TreeNode>>({
    [ROOT_ID]: makeRootNode('alt-black'),
  })
  const [currentId, setCurrentId] = useState(ROOT_ID)
  const [previewMode, setPreviewMode] = useState(false)
  const [previewStartId, setPreviewStartId] = useState(ROOT_ID)
  const [previewOriginalChildIds, setPreviewOriginalChildIds] = useState<string[]>([])
  const [showTree, setShowTree] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const idRef = useRef(0)

  function newId() { return `n${++idRef.current}` }

  const currentNode = nodes[currentId]
  const { board, currentTurn, koPoint } = currentNode.state

  const canUndo = previewMode ? currentId !== previewStartId : currentNode.parentId !== null
  const canRedo = currentNode.childIds.length > 0

  const effectiveColor: 'black' | 'white' =
    mode === 'black-only' ? 'black' :
    mode === 'white-only' ? 'white' :
    currentTurn

  const previewMarks = useMemo<PreviewMark[]>(() => {
    if (!previewMode) return []
    const path: string[] = []
    let id = currentId
    // 현재 노드에서 previewStartId까지 올라가며 경로 수집
    while (id !== previewStartId) {
      const parent = nodes[id]?.parentId
      if (!parent) return []  // previewStartId까지 닿지 못한 경우
      path.unshift(id)
      id = parent
    }
    return path.flatMap((nodeId, i) => {
      const m = nodes[nodeId]?.move
      return m ? [{ row: m.row, col: m.col, num: i + 1 }] : []
    })
  }, [previewMode, previewStartId, currentId, nodes])

  function handlePlace(row: number, col: number) {
    if (board[row][col] !== null) return
    if (koPoint && koPoint.row === row && koPoint.col === col) return

    const color = effectiveColor
    const opponent: 'black' | 'white' = color === 'black' ? 'white' : 'black'

    // 같은 수가 이미 자식으로 존재하면 그 노드로 이동
    const existing = currentNode.childIds.find(cid => {
      const m = nodes[cid].move
      return m && m.row === row && m.col === col && m.color === color
    })
    if (existing) { setCurrentId(existing); return }

    const next = board.map(r => [...r]) as Stone[][]
    next[row][col] = color

    const captured: Position[] = []
    for (const adj of getAdjacent(row, col)) {
      if (next[adj.row][adj.col] === opponent) {
        const group = getGroup(next, adj.row, adj.col)
        if (getLiberties(next, group) === 0) {
          for (const pos of group) { next[pos.row][pos.col] = null; captured.push(pos) }
        }
      }
    }
    const placedGroup = getGroup(next, row, col)
    if (getLiberties(next, placedGroup) === 0) return

    let newKo: Position | null = null
    if (captured.length === 1 && placedGroup.length === 1) newKo = captured[0]

    const nextTurn: 'black' | 'white' =
      mode === 'black-only' ? 'black' :
      mode === 'white-only' ? 'white' :
      opponent

    const id = newId()
    const newNode: TreeNode = {
      id,
      state: { board: next, currentTurn: nextTurn, koPoint: newKo },
      parentId: currentId,
      childIds: [],
      moveNumber: currentNode.moveNumber + 1,
      move: { row, col, color },
    }

    setNodes(prev => ({
      ...prev,
      [id]: newNode,
      [currentId]: { ...prev[currentId], childIds: [...prev[currentId].childIds, id] },
    }))
    setCurrentId(id)
  }

  function handleModeChange(newMode: PlacementMode) {
    setMode(newMode)
    if (newMode === 'alt-black' || newMode === 'alt-white') {
      const firstTurn = newMode === 'alt-black' ? 'black' : 'white'
      setNodes(prev => ({
        ...prev,
        [currentId]: {
          ...prev[currentId],
          state: { ...prev[currentId].state, currentTurn: firstTurn },
        },
      }))
    }
  }

  function handleUndo() {
    if (!canUndo) return
    setCurrentId(currentNode.parentId!)
  }

  function handleRedo() {
    if (!canRedo) return
    setCurrentId(currentNode.childIds[0])
  }

  function handleReset() {
    setNodes({ [ROOT_ID]: makeRootNode(mode) })
    setCurrentId(ROOT_ID)
    setPreviewMode(false)
    setPreviewStartId(ROOT_ID)
    setPreviewOriginalChildIds([])
  }

  function handleEnterPreview() {
    setPreviewMode(true)
    setPreviewStartId(currentId)
    setPreviewOriginalChildIds(currentNode.childIds)
  }

  function handleExitPreview() {
    // previewStartId의 새 자식들(놓아보기 중 추가된 것)과 그 하위를 모두 제거
    const toRemove = new Set<string>()
    function collectDescendants(id: string) {
      toRemove.add(id)
      for (const cid of nodes[id]?.childIds ?? []) collectDescendants(cid)
    }
    const newChildren = nodes[previewStartId].childIds.filter(
      cid => !previewOriginalChildIds.includes(cid)
    )
    newChildren.forEach(collectDescendants)

    setNodes(prev => {
      const updated = { ...prev }
      for (const id of toRemove) delete updated[id]
      updated[previewStartId] = {
        ...updated[previewStartId],
        childIds: previewOriginalChildIds,
      }
      return updated
    })
    setCurrentId(previewStartId)
    setPreviewMode(false)
  }

  function handleDelete() {
    if (currentId === ROOT_ID) return
    const parentId = currentNode.parentId!

    const toRemove = new Set<string>()
    function collect(id: string) {
      toRemove.add(id)
      for (const cid of nodes[id]?.childIds ?? []) collect(cid)
    }
    collect(currentId)

    if (previewMode && toRemove.has(previewStartId)) setPreviewMode(false)

    setNodes(prev => {
      const updated = { ...prev }
      for (const id of toRemove) delete updated[id]
      updated[parentId] = {
        ...updated[parentId],
        childIds: updated[parentId].childIds.filter(cid => cid !== currentId),
      }
      return updated
    })
    setCurrentId(parentId)
  }

  function handleNavigate(id: string) {
    setCurrentId(id)
  }

  return (
    <div className="app">
      <header className="header">
        <h1>바둑</h1>
        <div className="turn-indicator">
          <span
            className="turn-stone"
            style={{ background: effectiveColor === 'black' ? '#1a1a1a' : '#f0f0f0' }}
          />
          <span>{effectiveColor === 'black' ? '흑' : '백'} 차례</span>
          {koPoint && <span className="ko-label">패</span>}
        </div>
      </header>

      <div className="mode-picker">
        {MODES.map(({ id, label, stones }) => (
          <button
            key={id}
            className={`mode-btn${mode === id ? ' active' : ''}`}
            onClick={() => handleModeChange(id)}
          >
            <span className="mode-stones">
              <span className={`mode-stone ${stones[0]}-stone`} />
              <span className="mode-arrow">→</span>
              <span className={`mode-stone ${stones[1]}-stone`} />
            </span>
            <span className="mode-label">{label}</span>
          </button>
        ))}
      </div>

      {previewMode && (
        <div className="preview-banner">
          놓아보기 중 · {previewMarks.length}수
        </div>
      )}

      <div className="board-container">
        <Board board={board} onPlace={handlePlace} koPoint={koPoint} previewMarks={previewMarks} />
      </div>

      {showTree && (
        <div className="tree-wrapper">
          <TreeView
            nodes={nodes}
            rootId={ROOT_ID}
            currentId={currentId}
            previewStartId={previewMode ? previewStartId : undefined}
            onNavigate={handleNavigate}
          />
        </div>
      )}

      <footer className="footer">
        <div className="nav-row">
          <button className="nav-btn" onClick={handleUndo} disabled={!canUndo}>◀ 되돌리기</button>
          <button className="nav-btn" onClick={handleRedo} disabled={!canRedo}>앞으로 ▶</button>
          <button
            className={`nav-btn tree-toggle-btn${showTree ? ' active' : ''}`}
            onClick={() => setShowTree(v => !v)}
          >
            트리
          </button>
        </div>
        {previewMode ? (
          <button className="exit-preview-btn" onClick={handleExitPreview}>돌아가기</button>
        ) : (
          <div className="bottom-row">
            <button className="preview-btn" onClick={handleEnterPreview}>놓아보기</button>
            <button className="delete-btn" onClick={() => setShowDeleteConfirm(true)} disabled={currentId === ROOT_ID}>삭제</button>
            <button className="reset-btn" onClick={() => setShowResetConfirm(true)}>초기화</button>
          </div>
        )}
      </footer>

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-msg">현재 수순과 이후 변화를<br />모두 삭제하시겠습니까?</p>
            <div className="modal-btns">
              <button className="modal-btn modal-yes modal-danger" onClick={() => { handleDelete(); setShowDeleteConfirm(false) }}>예</button>
              <button className="modal-btn modal-no" onClick={() => setShowDeleteConfirm(false)}>아니오</button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-msg">초기화하시겠습니까?</p>
            <div className="modal-btns">
              <button className="modal-btn modal-yes" onClick={() => { handleReset(); setShowResetConfirm(false) }}>예</button>
              <button className="modal-btn modal-no"  onClick={() => setShowResetConfirm(false)}>아니오</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
