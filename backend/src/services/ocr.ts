import type { ImageAnalysisClient } from '@azure-rest/ai-vision-image-analysis'

let clientPromise: Promise<ImageAnalysisClient> | null = null

async function getAzureClient() {
  if (!clientPromise) {
    const endpoint = process.env.AZURE_CV_ENDPOINT
    const key = process.env.AZURE_CV_KEY
    if (!endpoint || !key) throw new Error('Configure AZURE_CV_ENDPOINT e AZURE_CV_KEY para OCR')
    const mod = await import('@azure-rest/ai-vision-image-analysis')
    const { default: createClient } = mod
    clientPromise = Promise.resolve(createClient(endpoint, { key }))
  }
  return clientPromise
}

export async function extractText(imageBuffer: Buffer): Promise<string> {
  const client = await getAzureClient()
  const result = await client.path('/imageanalysis:analyze').post({
    body: imageBuffer,
    queryParameters: { features: [ 'read' ] },
    contentType: 'application/octet-stream',
  })
  if (result.status !== '200') throw new Error('Falha no OCR Azure')
  const lines: string[] = []
  const blocks = (result.body as any)?.readResult?.blocks || []
  for (const block of blocks) {
    for (const line of block.lines || []) {
      if (line.text) lines.push(line.text)
    }
  }
  return lines.join('\n')
} 