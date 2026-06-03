const DB_NAME = 'baduk-app'
const VERSION = 2   // v2: folders 스토어 추가

export interface Folder {
  id?: number
  name: string
}

export interface SavedProblem {
  id?: number
  folderId: number
  title: string
  date: string
  thumbnail: string
  nodes: Record<string, unknown>
  rootId: string
  currentId: string
  mode: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains('problems')) {
        db.createObjectStore('problems', { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = e => resolve((e.target as IDBOpenDBRequest).result)
    req.onerror = () => reject(req.error)
  })
}

// ── 폴더 ───────────────────────────────────────────────
export async function createFolder(name: string): Promise<Folder> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const folder: Folder = { name }
    const req = db.transaction('folders', 'readwrite').objectStore('folders').add(folder)
    req.onsuccess = () => resolve({ ...folder, id: req.result as number })
    req.onerror = () => reject(req.error)
  })
}

export async function getAllFolders(): Promise<Folder[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction('folders', 'readonly').objectStore('folders').getAll()
    req.onsuccess = () => resolve(req.result as Folder[])
    req.onerror = () => reject(req.error)
  })
}

export async function deleteFolder(id: number): Promise<void> {
  const db = await openDB()
  // 폴더 내 문제도 함께 삭제
  const problems = await getProblemsByFolder(id)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['folders', 'problems'], 'readwrite')
    for (const p of problems) tx.objectStore('problems').delete(p.id!)
    tx.objectStore('folders').delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ── 문제 ───────────────────────────────────────────────
export async function saveProblem(problem: Omit<SavedProblem, 'id'>): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction('problems', 'readwrite').objectStore('problems').add(problem)
    req.onsuccess = () => resolve(req.result as number)
    req.onerror = () => reject(req.error)
  })
}

export async function getProblemsByFolder(folderId: number): Promise<SavedProblem[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction('problems', 'readonly').objectStore('problems').getAll()
    req.onsuccess = () => {
      const all = (req.result as SavedProblem[]).filter(p => p.folderId === folderId)
      resolve(all.reverse())
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteProblem(id: number): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction('problems', 'readwrite').objectStore('problems').delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
