'use client'

import { useRef, useState, useEffect } from 'react'
import clsx from 'clsx'

interface Message { role: 'user' | 'assistant'; content: string; meta?: string }

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB

type Theme = 'light' | 'dark' | 'system'

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [fileInfo, setFileInfo] = useState<{ name: string; sizeKB: number } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [invalidDrag, setInvalidDrag] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>('system')
  const fileInput = useRef<HTMLInputElement | null>(null)

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

  // Inicializa tema do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('visionqa_theme') as Theme | null
      if (saved) setTheme(saved)
    } catch {}
  }, [])

  // Aplica tema no html
  useEffect(() => {
    const root = document.documentElement
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
    root.classList.toggle('dark', isDark)
    try { localStorage.setItem('visionqa_theme', theme) } catch {}
  }, [theme])

  // Carregar histórico do localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('visionqa_history')
      if (raw) setMessages(JSON.parse(raw))
    } catch {}
  }, [])

  // Salvar histórico a cada mudança
  useEffect(() => {
    try {
      localStorage.setItem('visionqa_history', JSON.stringify(messages))
    } catch {}
  }, [messages])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      try {
        const items = e.clipboardData?.items
        if (!items || items.length === 0) return
        for (const item of items) {
          if (item.kind === 'file') {
            const file = item.getAsFile()
            if (file) {
              e.preventDefault()
              await selectFile(file)
              break
            }
          }
        }
      } catch {}
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  const clearFile = () => {
    if (fileInput.current) fileInput.current.value = ''
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setFileInfo(null)
    setInvalidDrag(false)
  }

  const clearHistory = () => {
    setMessages([])
    try { localStorage.removeItem('visionqa_history') } catch {}
  }

  const compressForPreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        const maxSize = 1600
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { URL.revokeObjectURL(url); return reject(new Error('Canvas não suportado')) }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url)
          if (!blob) return reject(new Error('Falha ao gerar preview'))
          const preview = URL.createObjectURL(blob)
          resolve(preview)
        }, 'image/jpeg', 0.8)
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível carregar a imagem')) }
      img.src = url
    })
  }

  const selectFile = async (file: File) => {
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('Apenas arquivos de imagem são permitidos (PNG, JPG, JPEG).')
      setInvalidDrag(true)
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('Arquivo maior que 10MB. Selecione uma imagem menor.')
      return
    }
    setInvalidDrag(false)
    setFileInfo({ name: file.name, sizeKB: Math.max(1, Math.round(file.size / 1024)) })
    try {
      const preview = await compressForPreview(file)
      setPreviewUrl(preview)
    } catch (e: any) {
      setPreviewUrl(null)
      setError(e?.message || 'Falha ao gerar preview da imagem')
    }
  }

  const openFileDialog = () => {
    setError(null)
    fileInput.current?.click()
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void selectFile(f)
  }

  const onDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setDragOver(true)
    try {
      const item = e.dataTransfer?.items?.[0]
      if (item && item.kind === 'file') {
        const isImage = item.type.startsWith('image/')
        setInvalidDrag(!isImage)
      }
    } catch {
      setInvalidDrag(false)
    }
  }

  const onDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setDragOver(false)
    setError(null)
    const f = e.dataTransfer.files?.[0]
    if (f) void selectFile(f)
  }

  const onDragLeave = () => {
    setDragOver(false)
    setInvalidDrag(false)
  }

  const exportTxt = () => {
    const lines: string[] = []
    messages.forEach((m) => {
      const who = m.role === 'user' ? 'Você' : 'Assistente'
      const meta = m.meta ? ` (${m.meta})` : ''
      lines.push(`${who}${meta}:`)
      lines.push(m.content)
      lines.push('')
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `visionqa_conversa_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const copyLastAnswer = async () => {
    const last = [...messages].reverse().find(m => m.role === 'assistant')
    if (!last) return
    try { await navigator.clipboard.writeText(last.content) } catch {}
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const start = performance.now()
    try {
      const form = new FormData()
      const f = fileInput.current?.files?.[0]
      if (f) form.append('file', f)
      if (question.trim()) form.append('question', question.trim())

      const res = await fetch(`${backendUrl}/ask/`, { method: 'POST', body: form })
      const elapsedMs = Math.max(0, Math.round(performance.now() - start))
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const userMsg: Message = { role: 'user', content: question || (f?.name ?? 'Imagem') }
      const estTokens = Math.ceil((question.length + (data.answer?.length || 0)) / 4)
      const assistantMsg: Message = { role: 'assistant', content: data.answer, meta: `≈${estTokens} tokens • ${elapsedMs} ms` }
      setMessages(prev => [...prev, userMsg, assistantMsg])
      setQuestion('')
      clearFile()
    } catch (err: any) {
      setError(err?.message || 'Falha ao enviar. Tente novamente.')
      setMessages(prev => [...prev, { role: 'assistant', content: `Erro: ${err?.message || 'Falha ao enviar'}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl">
        <header className="flex items-center justify-between mb-8">
          <div className="text-center sm:text-left">
            <h1 className="text-4xl font-semibold tracking-tight text-brand-800 dark:text-brand-300">VisionQA</h1>
            <p className="mt-2 text-base text-gray-600 dark:text-gray-300">OCR + IA para responder perguntas a partir de imagens ou texto.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copyLastAnswer} type="button" className="rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-gray-800 text-sm px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100" title="Copiar última resposta">
              Copiar resposta
            </button>
            <button onClick={exportTxt} type="button" className="rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-gray-800 text-sm px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100" title="Baixar TXT">
              Baixar .txt
            </button>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
              className="rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100"
              title="Tema"
            >
              <option value="system">Sistema</option>
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </select>
            <button onClick={clearHistory} type="button" className="rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-gray-800 text-sm px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100">
              Limpar histórico
            </button>
          </div>
        </header>

        <section className="bg-white/90 dark:bg-white/5 backdrop-blur rounded-2xl shadow-xl border border-gray-100 dark:border-white/10 p-6 md:p-8">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            <div className="lg:col-span-3 space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1 text-center lg:text-left">Pergunta</label>
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  rows={6}
                  placeholder="Escreva sua pergunta de forma clara e objetiva..."
                  className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-gray-100 p-4 text-base shadow-sm focus:outline-none focus:ring-4 focus:ring-brand-200 dark:focus:ring-brand-900/40 focus:border-brand-500"
                />
              </div>
              {error && (
                <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>
              )}
              <div className="text-center lg:text-left text-sm text-gray-500 dark:text-gray-400">
                Você pode anexar uma imagem e complementar com uma pergunta opcional. Também é possível colar uma imagem (Ctrl+V).
              </div>
            </div>

            <div className="lg:col-span-1 space-y-4">
              <input ref={fileInput} onChange={onFileChange} type="file" accept="image/*" className="hidden" />
              <button
                type="button"
                onClick={openFileDialog}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={clsx(
                  'relative w-full h-48 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition overflow-hidden',
                  invalidDrag
                    ? 'border-red-400 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                    : 'text-brand-800 dark:text-brand-200',
                  dragOver && !invalidDrag
                    ? 'border-brand-400 bg-brand-100 dark:bg-white/10 dark:border-brand-500'
                    : 'border-brand-200 bg-brand-50 hover:bg-brand-100 dark:bg-white/5 dark:border-white/10'
                )}
              >
                {previewUrl ? (
                  <>
                    <img src={previewUrl} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute top-2 right-2">
                      <button type="button" onClick={clearFile} className="inline-flex items-center rounded-full bg-white/90 dark:bg-black/50 text-gray-700 dark:text-gray-200 hover:bg-white px-2 py-1 text-xs shadow">
                        Remover
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5l4.5-4.5 3 3 6-6L21 12M3 6h4a2 2 0 012 2v0M3 10h2m4 8h10a2 2 0 002-2V6a2 2 0 00-2-2h-7l-2-2H7a2 2 0 00-2 2v2" />
                    </svg>
                    <span className="text-sm font-medium">Selecionar ou colar imagem</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG até 10MB</span>
                  </>
                )}
              </button>

              {fileInfo && (
                <div className="rounded-lg border border-gray-100 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3 text-sm">
                  <div className="font-medium truncate" title={fileInfo.name}>{fileInfo.name}</div>
                  <div className="text-gray-500 dark:text-gray-400">{fileInfo.sizeKB} KB</div>
                </div>
              )}

              <button
                disabled={loading}
                type="submit"
                className={clsx(
                  'w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 text-white px-5 py-3 text-base font-medium shadow hover:bg-brand-800 transition dark:bg-brand-600 dark:hover:bg-brand-500',
                  loading && 'opacity-60 cursor-not-allowed'
                )}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    Enviando...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 12l7-7v4h7v6h-7v4l-7-7z" />
                    </svg>
                    Enviar
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        <section className="mt-8">
          <div className="mx-auto max-h-[60vh] overflow-y-auto w-full rounded-2xl bg-white/80 dark:bg-white/5 border border-gray-100 dark:border-white/10 shadow p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 text-sm">As mensagens aparecerão aqui</div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={clsx('rounded-xl p-4', m.role === 'user' ? 'bg-brand-50 border border-brand-100 dark:bg-white/5 dark:border-white/10' : 'bg-gray-50 border border-gray-200 dark:bg-white/5 dark:border-white/10')}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{m.role === 'user' ? 'Você' : 'Assistente'}</div>
                  {m.meta && (
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">{m.meta}</div>
                  )}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-10 text-center text-[11px] text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} Guilherme
        </footer>
      </div>
    </main>
  )
} 