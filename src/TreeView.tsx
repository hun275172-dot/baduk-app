import type { TreeNode } from './App'

const COL_W = 28
const ROW_H = 24
const R = 7
const MARGIN = 14

function computeLayout(nodes: Record<string, TreeNode>, rootId: string) {
  const pos: Record<string, { x: number; y: number }> = {}
  let rowAlloc = 0

  function maxUsedRow(id: string): number {
    if (!pos[id]) return 0
    return Math.max(pos[id].y, ...(nodes[id]?.childIds ?? []).map(maxUsedRow))
  }

  function dfs(id: string, x: number, y: number) {
    pos[id] = { x, y }
    const kids = nodes[id]?.childIds ?? []
    for (let i = 0; i < kids.length; i++) {
      if (i === 0) {
        dfs(kids[i], x + 1, y)
      } else {
        rowAlloc = Math.max(rowAlloc, maxUsedRow(kids[i - 1])) + 1
        dfs(kids[i], x + 1, rowAlloc)
      }
    }
  }

  dfs(rootId, 0, 0)
  return pos
}

function buildCurrentPath(nodes: Record<string, TreeNode>, currentId: string): Set<string> {
  const path = new Set<string>()
  let id: string | null = currentId
  while (id) {
    path.add(id)
    id = nodes[id]?.parentId ?? null
  }
  return path
}

interface Props {
  nodes: Record<string, TreeNode>
  rootId: string
  currentId: string
  onNavigate: (id: string) => void
}

export default function TreeView({ nodes, rootId, currentId, onNavigate }: Props) {
  const rootKids = nodes[rootId]?.childIds ?? []

  if (rootKids.length === 0) {
    return <div className="tree-empty-msg">아직 수순이 없습니다</div>
  }

  const pos = computeLayout(nodes, rootId)

  // 루트는 레이아웃에서 x=0이지만 렌더링에서 제외하고, 자식(x=1~)을 -1 시프트해서 표시
  const allIds = Object.keys(pos).filter(id => id !== rootId)

  const maxX = allIds.reduce((m, id) => Math.max(m, pos[id].x), 0)
  const maxY = allIds.reduce((m, id) => Math.max(m, pos[id].y), 0)

  const svgW = maxX * COL_W + MARGIN * 2
  const svgH = (maxY + 1) * ROW_H + MARGIN * 2

  // x를 -1 시프트: 루트의 자식(x=1)이 시각적 x=0에 오도록
  const ncx = (id: string) => MARGIN + (pos[id].x - 1) * COL_W
  const ncy = (id: string) => MARGIN + pos[id].y * ROW_H

  const currentPath = buildCurrentPath(nodes, currentId)

  return (
    <svg width={svgW} height={svgH} style={{ display: 'block' }}>
      {/* 연결선 (루트→자식 연결은 루트가 렌더링되지 않으므로 자동으로 제외) */}
      {allIds.flatMap(id =>
        (nodes[id]?.childIds ?? []).map(childId => {
          const px = ncx(id), py = ncy(id)
          const cx = ncx(childId), cy = ncy(childId)
          const onPath = currentPath.has(id) && currentPath.has(childId)
          const midX = (px + cx) / 2
          const d = py === cy
            ? `M${px + R},${py} H${cx - R}`
            : `M${px + R},${py} H${midX} V${cy} H${cx - R}`
          return (
            <path
              key={`${id}-${childId}`}
              d={d}
              fill="none"
              stroke={onPath ? '#dcb468' : '#444'}
              strokeWidth={onPath ? 1.5 : 1}
            />
          )
        })
      )}

      {/* 노드 (루트 제외) */}
      {allIds.map(id => {
        const node = nodes[id]
        const x = ncx(id), y = ncy(id)
        const isCurrent = id === currentId
        const onPath = currentPath.has(id)

        const fill = !node.move
          ? '#3a3a3a'
          : node.move.color === 'black' ? '#1a1a1a' : '#efefef'

        const stroke = isCurrent ? '#dcb468' : onPath ? '#888' : '#444'
        const strokeW = isCurrent ? 2.5 : 1

        return (
          <g key={id} onClick={() => onNavigate(id)} style={{ cursor: 'pointer' }}>
            <circle cx={x} cy={y} r={R + 8} fill="transparent" />
            <circle cx={x} cy={y} r={R} fill={fill} stroke={stroke} strokeWidth={strokeW} />
          </g>
        )
      })}
    </svg>
  )
}
