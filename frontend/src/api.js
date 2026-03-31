import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || '/api'

const client = axios.create({ baseURL: BASE, timeout: 120_000 })

export async function uploadDocument(file) {
  const fd = new FormData()
  fd.append('file', file)
  const { data } = await client.post('/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function analyzeDocument(sessionId) {
  const { data } = await client.post(`/analyze/${sessionId}`)
  return data
}

export function getAnnotatedImageUrl(sessionId) {
  return `${BASE}/result/image/${sessionId}`
}
