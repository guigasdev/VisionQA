import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { randomUUID } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import { readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import 'dotenv/config'
import { getAnswer } from './services/ai.js'
import { extractText } from './services/ocr.js'

const app = Fastify({ logger: true })
await app.register(cors, { origin: true })
await app.register(multipart)

app.get('/healthz', async () => ({ status: 'ok' }))

app.post('/ask/', async (req, reply) => {
  const parts = req.parts()
  let question: string | undefined
  let model: string | undefined
  let filePath: string | undefined

  const start = Date.now()

  try {
    for await (const part of parts) {
      if (part.type === 'file') {
        const id = randomUUID()
        const tmpPath = path.join(tmpdir(), `visionqa_${id}_${part.filename}`)
        const ws = createWriteStream(tmpPath)
        await pipeline(part.file, ws)
        filePath = tmpPath
      } else if (part.type === 'field') {
        if (part.fieldname === 'question') question = part.value
        if (part.fieldname === 'model') model = part.value
      }
    }
  } catch (err) {
    req.log.error({ err }, 'Falha ao processar multipart')
    return reply.status(400).send({ detail: 'Multipart inválido' })
  }

  if (!filePath && !question) {
    return reply.status(400).send({ detail: "Envie uma imagem ou um texto em 'question'." })
  }

  try {
    let prompt = ''
    if (filePath) {
      const imgBuffer = await readFile(filePath)
      const ocr = await extractText(imgBuffer)
      prompt = ocr.trim()
    }
    if (question) {
      prompt = prompt
        ? `Texto extraído da imagem:\n${prompt}\n\nPergunta do usuário:\n${question}`
        : question
    }

    const { text, usage } = await getAnswer(prompt, model)
    const elapsed_ms = Date.now() - start

    reply.send({ question, prompt, answer: text, usage, elapsed_ms })
  } catch (e: any) {
    req.log.error(e)
    reply.status(500).send({ detail: `Falha: ${e?.message || 'erro'}` })
  } finally {
    if (filePath) {
      try { await unlink(filePath) } catch {}
    }
  }
})

const port = Number(process.env.APP_PORT || 8000)
app.listen({ host: '0.0.0.0', port }).then(() => {
  app.log.info(`VisionQA API on :${port}`)
}) 