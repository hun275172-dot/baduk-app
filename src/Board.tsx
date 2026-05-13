import type { Stone, Position, PreviewMark } from './App'
import './Board.css'

const SIZE = 9
const CELL = 52
const PADDING = 40
const STAR_POINTS = [
  [2, 2], [2, 6], [4, 4], [6, 2], [6, 6],
]

interface Props {
  board: Stone[][]
  onPlace: (row: number, col: number) => void
  koPoint: Position | null
  previewMarks: PreviewMark[]
}

export default function Board({ board, onPlace, koPoint, previewMarks }: Props) {
  const svgSize = CELL * (SIZE - 1) + PADDING * 2

  const previewMap = new Map(previewMarks.map(m => [`${m.row},${m.col}`, m.num]))

  return (
    <svg
      className="board"
      viewBox={`0 0 ${svgSize} ${svgSize}`}
      style={{ touchAction: 'none', display: 'block', width: '100%' }}
    >
      {/* 바둑판 배경 */}
      <rect width={svgSize} height={svgSize} fill="#dcb468" />

      {/* 격자선 */}
      {Array.from({ length: SIZE }, (_, i) => (
        <g key={i}>
          <line
            x1={PADDING}
            y1={PADDING + i * CELL}
            x2={PADDING + (SIZE - 1) * CELL}
            y2={PADDING + i * CELL}
            stroke="#5a3e1b"
            strokeWidth={1}
          />
          <line
            x1={PADDING + i * CELL}
            y1={PADDING}
            x2={PADDING + i * CELL}
            y2={PADDING + (SIZE - 1) * CELL}
            stroke="#5a3e1b"
            strokeWidth={1}
          />
        </g>
      ))}

      {/* 화점(별점) */}
      {STAR_POINTS.map(([r, c]) => (
        <circle
          key={`star-${r}-${c}`}
          cx={PADDING + c * CELL}
          cy={PADDING + r * CELL}
          r={4}
          fill="#5a3e1b"
        />
      ))}

      {/* 클릭 영역 + 돌 */}
      {Array.from({ length: SIZE }, (_, row) =>
        Array.from({ length: SIZE }, (_, col) => {
          const stone = board[row][col]
          const cx = PADDING + col * CELL
          const cy = PADDING + row * CELL
          const previewNum = previewMap.get(`${row},${col}`)
          return (
            <g key={`${row}-${col}`} onClick={() => onPlace(row, col)} className="cell">
              <rect
                x={cx - CELL / 2}
                y={cy - CELL / 2}
                width={CELL}
                height={CELL}
                fill="transparent"
              />
              {stone && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={CELL / 2 - 4}
                  fill={stone === 'black' ? '#1a1a1a' : '#f0f0f0'}
                  stroke={stone === 'black' ? '#000' : '#ccc'}
                  strokeWidth={1.5}
                />
              )}
              {stone && previewNum !== undefined && (
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={stone === 'black' ? '#fff' : '#222'}
                  fontSize={16}
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {previewNum}
                </text>
              )}
              {!stone && koPoint?.row === row && koPoint?.col === col && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={8}
                  fill="rgba(220, 50, 50, 0.55)"
                  pointerEvents="none"
                />
              )}
            </g>
          )
        })
      )}
    </svg>
  )
}
