import { useState } from 'react'
import Board from './Board'
import './App.css'

export type Stone = 'black' | 'white' | null

export interface Position {
  row: number
  col: number
}

export interface PreviewMark {
  row: number
  col: number
  num: number
}

interface GameState {
  board: Stone[][]
  currentTurn: 'black' | 'white'
  koPoint: Position | null
  preview?: { row: number; col: number; num: number }
}

type PlacementMode = 'alt-black' | 'alt-white' | 'black-only' | 'white-only'

const SIZE = 9

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
      if (!visited.has(`${adj.row},${adj.col}`) && board[adj.row][adj.col] === color) {
        queue.push(adj)
      }
    }
  }
  return group
}

function getLiberties(board: Stone[][], group: Position[]): number {
  const libs = new Set<string>()
  for (const pos of group) {
    for (const adj of getAdjacent(pos.row, pos.col)) {
      if (board[adj.row][adj.col] === null) libs.add(`${adj.row},${adj.col}`)
    }
  }
  return libs.size
}

function makeInitial(mode: PlacementMode): GameState {
  const firstTurn: 'black' | 'white' =
    mode === 'alt-white' || mode === 'white-only' ? 'white' : 'black'
  return {
    board: Array.from({ length: SIZE }, () => Array(SIZE).fill(null)),
    currentTurn: firstTurn,
    koPoint: null,
  }
}

const MODES: { id: PlacementMode; label: string; stones: ('black' | 'white')[] }[] = [
  { id: 'alt-black',  label: '흑먼저 번갈아', stones: ['black', 'white'] },
  { id: 'alt-white',  label: '백먼저 번갈아', stones: ['white', 'black'] },
  { id: 'black-only', label: '흑돌만',        stones: ['black', 'black'] },
  { id: 'white-only', label: '백돌만',        stones: ['white', 'white'] },
]

function App() {
  const [mode, setMode] = useState<PlacementMode>('alt-black')
  const [history, setHistory] = useState<GameState[]>([makeInitial('alt-black')])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [previewMode, setPreviewMode] = useState(false)
  const [previewStartIndex, setPreviewStartIndex] = useState(0)

  const { board, currentTurn, koPoint } = history[historyIndex]

  // 놓아보기 모드에선 preview 시작점까지만 되돌리기 허용
  const canUndo = previewMode ? historyIndex > previewStartIndex : historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  const effectiveColor: 'black' | 'white' =
    mode === 'black-only' ? 'black' :
    mode === 'white-only' ? 'white' :
    currentTurn

  // 현재 보이는 preview 돌의 수순 목록
  const previewMarks: PreviewMark[] = previewMode
    ? history
        .slice(previewStartIndex + 1, historyIndex + 1)
        .flatMap(s => s.preview ? [s.preview] : [])
    : []

  function pushState(state: GameState) {
    const next = history.slice(0, historyIndex + 1)
    setHistory([...next, state])
    setHistoryIndex(historyIndex + 1)
  }

  function handlePlace(row: number, col: number) {
    if (board[row][col] !== null) return
    if (koPoint && koPoint.row === row && koPoint.col === col) return

    const color = effectiveColor
    const opponent: 'black' | 'white' = color === 'black' ? 'white' : 'black'

    const next = board.map(r => [...r]) as Stone[][]
    next[row][col] = color

    const captured: Position[] = []
    for (const adj of getAdjacent(row, col)) {
      if (next[adj.row][adj.col] === opponent) {
        const group = getGroup(next, adj.row, adj.col)
        if (getLiberties(next, group) === 0) {
          for (const pos of group) {
            next[pos.row][pos.col] = null
            captured.push(pos)
          }
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

    // 놓아보기 모드: 수순 번호 기록
    const previewNum = previewMode ? historyIndex - previewStartIndex + 1 : undefined

    pushState({
      board: next,
      currentTurn: nextTurn,
      koPoint: newKo,
      preview: previewNum !== undefined ? { row, col, num: previewNum } : undefined,
    })
  }

  function handleModeChange(newMode: PlacementMode) {
    setMode(newMode)
    if (newMode === 'alt-black' || newMode === 'alt-white') {
      const firstTurn = newMode === 'alt-black' ? 'black' : 'white'
      setHistory(history.map((entry, i) =>
        i === historyIndex ? { ...entry, currentTurn: firstTurn } : entry
      ))
    }
  }

  function handleUndo() {
    if (canUndo) setHistoryIndex(historyIndex - 1)
  }

  function handleRedo() {
    if (canRedo) setHistoryIndex(historyIndex + 1)
  }

  function handleReset() {
    setHistory([makeInitial(mode)])
    setHistoryIndex(0)
    setPreviewMode(false)
  }

  function handleEnterPreview() {
    setPreviewMode(true)
    setPreviewStartIndex(historyIndex)
  }

  function handleExitPreview() {
    // preview 이전 상태로 되돌리고 preview 히스토리 제거
    setHistory(history.slice(0, previewStartIndex + 1))
    setHistoryIndex(previewStartIndex)
    setPreviewMode(false)
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

      <footer className="footer">
        <div className="nav-row">
          <button className="nav-btn" onClick={handleUndo} disabled={!canUndo}>
            ◀ 되돌리기
          </button>
          <button className="nav-btn" onClick={handleRedo} disabled={!canRedo}>
            앞으로 ▶
          </button>
        </div>
        {previewMode ? (
          <button className="exit-preview-btn" onClick={handleExitPreview}>
            돌아가기
          </button>
        ) : (
          <div className="bottom-row">
            <button className="preview-btn" onClick={handleEnterPreview}>놓아보기</button>
            <button className="reset-btn" onClick={handleReset}>초기화</button>
          </div>
        )}
      </footer>
    </div>
  )
}

export default App
