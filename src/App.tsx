import { useState, useRef, useMemo } from 'react'
import Board from './Board'
import TreeView from './TreeView'
import Gallery from './Gallery'
import FolderPicker from './FolderPicker'
import { saveProblem, type SavedProblem, type Folder } from './db'
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
  const [showTree, setShowTree] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [folderPickerMode, setFolderPickerMode] = useState<'save' | 'gallery'>('save')
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null)
  const [showGallery, setShowGallery] = useState(false)
  const [isSetupPhase, setIsSetupPhase] = useState(true)
  const [setupColor, setSetupColor] = useState<'black' | 'white'>('black')
  const idRef = useRef(0)

  function newId() { return `n${++idRef.current}` }

  const currentNode = nodes[currentId]
  const { board, currentTurn, koPoint } = currentNode.state

  const canUndo = currentNode.parentId !== null
  const canRedo = currentNode.childIds.length > 0

  const effectiveColor: 'black' | 'white' =
    mode === 'black-only' ? 'black' :
    mode === 'white-only' ? 'white' :
    currentTurn

  // 풀기 모드에서 루트→현재 노드 경로의 수순 번호 표시
  const solveMarks = useMemo<PreviewMark[]>(() => {
    if (isSetupPhase) return []
    const path: string[] = []
    let id = currentId
    while (id !== ROOT_ID) {
      const parent = nodes[id]?.parentId
      if (!parent) break
      path.unshift(id)
      id = parent
    }
    return path.flatMap((nodeId, i) => {
      const m = nodes[nodeId]?.move
      return m ? [{ row: m.row, col: m.col, num: i + 1 }] : []
    })
  }, [isSetupPhase, currentId, nodes])

  function handlePlace(row: number, col: number) {
    if (isSetupPhase) {
      const color = setupColor
      setNodes(prev => {
        const root = prev[ROOT_ID]
        const newBoard = root.state.board.map(r => [...r]) as Stone[][]
        newBoard[row][col] = newBoard[row][col] === color ? null : color
        return { ...prev, [ROOT_ID]: { ...root, state: { ...root.state, board: newBoard } } }
      })
      return
    }

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

  function handleCompleteSetup() {
    setIsSetupPhase(false)
    // currentTurn을 선택된 모드에 맞게 정렬
    const firstTurn: 'black' | 'white' = mode === 'alt-white' || mode === 'white-only' ? 'white' : 'black'
    setNodes(prev => ({
      ...prev,
      [ROOT_ID]: { ...prev[ROOT_ID], state: { ...prev[ROOT_ID].state, currentTurn: firstTurn } },
    }))
  }

  function handleReset() {
    if (isSetupPhase) {
      // 초기 배치 초기화: 빈 board로
      setNodes({ [ROOT_ID]: makeRootNode(mode) })
      setCurrentId(ROOT_ID)
    } else {
      // 새 문제: 모든 것을 초기화하고 문제 만들기 모드로 돌아가기
      setNodes({ [ROOT_ID]: makeRootNode(mode) })
      setCurrentId(ROOT_ID)
      setIsSetupPhase(true)
      setSetupColor('black')
    }
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

  // 현재 board 상태를 canvas로 그려 PNG data URL 반환
  function captureThumbnail(): string {
    const THUMB_CELL = 17
    const THUMB_PAD  = 13
    const canvasSize = THUMB_CELL * (SIZE - 1) + THUMB_PAD * 2
    const canvas = document.createElement('canvas')
    canvas.width  = canvasSize
    canvas.height = canvasSize
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = '#dcb468'
    ctx.fillRect(0, 0, canvasSize, canvasSize)

    ctx.strokeStyle = '#5a3e1b'
    ctx.lineWidth   = 0.7
    for (let i = 0; i < SIZE; i++) {
      ctx.beginPath(); ctx.moveTo(THUMB_PAD + i * THUMB_CELL, THUMB_PAD)
      ctx.lineTo(THUMB_PAD + i * THUMB_CELL, THUMB_PAD + (SIZE - 1) * THUMB_CELL); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(THUMB_PAD, THUMB_PAD + i * THUMB_CELL)
      ctx.lineTo(THUMB_PAD + (SIZE - 1) * THUMB_CELL, THUMB_PAD + i * THUMB_CELL); ctx.stroke()
    }

    ctx.fillStyle = '#5a3e1b'
    for (const [r, c] of [[2,2],[2,6],[4,4],[6,2],[6,6]]) {
      ctx.beginPath()
      ctx.arc(THUMB_PAD + c * THUMB_CELL, THUMB_PAD + r * THUMB_CELL, 2, 0, Math.PI * 2)
      ctx.fill()
    }

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const stone = board[r][c]
        if (!stone) continue
        const x = THUMB_PAD + c * THUMB_CELL
        const y = THUMB_PAD + r * THUMB_CELL
        ctx.beginPath()
        ctx.arc(x, y, THUMB_CELL / 2 - 1, 0, Math.PI * 2)
        ctx.fillStyle   = stone === 'black' ? '#1a1a1a' : '#f0f0f0'
        ctx.strokeStyle = stone === 'black' ? '#000' : '#ccc'
        ctx.lineWidth   = 0.5
        ctx.fill(); ctx.stroke()
      }
    }

    return canvas.toDataURL('image/png')
  }

  async function handleSave(folder: Folder) {
    const thumbnail = captureThumbnail()
    await saveProblem({
      folderId: folder.id!,
      title: '',
      date: new Date().toLocaleDateString('ko-KR'),
      thumbnail,
      nodes: nodes as Record<string, unknown>,
      rootId: ROOT_ID,
      currentId,
      mode,
    })
  }

  function handleFolderSelect(folder: Folder) {
    setSelectedFolder(folder)
    setShowFolderPicker(false)
    if (folderPickerMode === 'save') {
      handleSave(folder)
    } else {
      setShowGallery(true)
    }
  }

  function handleLoad(problem: SavedProblem) {
    setNodes(problem.nodes as Record<string, TreeNode>)
    setCurrentId(problem.currentId)
    setMode(problem.mode as PlacementMode)
    setIsSetupPhase(false)
    const maxN = Object.keys(problem.nodes)
      .map(id => parseInt(id.replace('n', '')) || 0)
      .reduce((a, b) => Math.max(a, b), 0)
    idRef.current = maxN
    setShowGallery(false)
  }

  return (
    <div className="app">
      <header className="header">
        <h1>바둑</h1>
        {isSetupPhase ? (
          <div className="turn-indicator">
            <span className="turn-stone" style={{ background: setupColor === 'black' ? '#1a1a1a' : '#f0f0f0' }} />
            <span>초기 배치</span>
          </div>
        ) : (
          <div className="turn-indicator">
            <span className="turn-stone" style={{ background: effectiveColor === 'black' ? '#1a1a1a' : '#f0f0f0' }} />
            <span>{effectiveColor === 'black' ? '흑' : '백'} 차례</span>
            {koPoint && <span className="ko-label">패</span>}
          </div>
        )}
      </header>

      {isSetupPhase ? (
        <div className="setup-color-picker">
          <button
            className={`setup-color-btn${setupColor === 'black' ? ' active' : ''}`}
            onClick={() => setSetupColor('black')}
          >
            <span className="mode-stone black-stone" />
            <span className="setup-color-label">흑돌</span>
          </button>
          <button
            className={`setup-color-btn${setupColor === 'white' ? ' active' : ''}`}
            onClick={() => setSetupColor('white')}
          >
            <span className="mode-stone white-stone" />
            <span className="setup-color-label">백돌</span>
          </button>
        </div>
      ) : (
        <div className="mode-picker">
          {MODES.map(({ id, label, stones }) => (
            <button
              key={id}
              className={`mode-btn${mode === id ? ' active' : ''}`}
              onClick={() => handleModeChange(id)}
              title={label}
            >
              <span className="mode-stones">
                <span className={`mode-stone ${stones[0]}-stone`} />
                <span className="mode-arrow">→</span>
                <span className={`mode-stone ${stones[1]}-stone`} />
              </span>
            </button>
          ))}
        </div>
      )}

      {isSetupPhase && (
        <div className="setup-banner">문제 만들기 중 · 돌을 탭해 배치/제거</div>
      )}

      <div className="board-container">
        <Board board={board} onPlace={handlePlace} koPoint={isSetupPhase ? null : koPoint} previewMarks={solveMarks} />
      </div>

      <footer className="footer">
        {!isSetupPhase && showTree && (
          <div className="tree-wrapper">
            <TreeView
              nodes={nodes}
              rootId={ROOT_ID}
              currentId={currentId}
              onNavigate={handleNavigate}
            />
          </div>
        )}
        {isSetupPhase ? (
          <div className="setup-actions">
            <button className="complete-setup-btn" onClick={handleCompleteSetup}>문제 만들기 완료</button>
            <button className="reset-btn" onClick={() => setShowResetConfirm(true)}>초기화</button>
          </div>
        ) : (
          <>
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
            <div className="bottom-row">
              <button className="delete-btn" onClick={() => setShowDeleteConfirm(true)} disabled={currentId === ROOT_ID}>삭제</button>
              <button className="reset-btn" onClick={() => setShowResetConfirm(true)}>새 문제</button>
            </div>
            <div className="save-row">
              <button className="save-btn" onClick={() => { setFolderPickerMode('save'); setShowFolderPicker(true) }}>문제 저장</button>
              <button className="gallery-btn" onClick={() => { setFolderPickerMode('gallery'); setShowFolderPicker(true) }}>갤러리</button>
            </div>
          </>
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
            <p className="modal-msg">{isSetupPhase ? '초기 배치를 초기화하시겠습니까?' : <>현재 문제를 버리고<br />새 문제를 만드시겠습니까?</>}</p>
            <div className="modal-btns">
              <button className="modal-btn modal-yes" onClick={() => { handleReset(); setShowResetConfirm(false) }}>예</button>
              <button className="modal-btn modal-no"  onClick={() => setShowResetConfirm(false)}>아니오</button>
            </div>
          </div>
        </div>
      )}


      {showFolderPicker && (
        <FolderPicker onSelect={handleFolderSelect} onClose={() => setShowFolderPicker(false)} />
      )}

      {showGallery && selectedFolder && (
        <Gallery folder={selectedFolder} onLoad={handleLoad} onClose={() => setShowGallery(false)} />
      )}
    </div>
  )
}
