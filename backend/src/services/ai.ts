import OpenAI from 'openai'

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

function buildClient() {
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT
  const azureKey = process.env.AZURE_OPENAI_API_KEY
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT
  const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-06-01'

  if (azureEndpoint && azureKey && azureDeployment) {
    const baseURL = `${azureEndpoint}/openai/deployments/${azureDeployment}`
    const client = new OpenAI({
      apiKey: azureKey,
      baseURL,
      defaultQuery: { 'api-version': azureApiVersion },
      defaultHeaders: { 'api-key': azureKey },
    })
    return { client, model: DEFAULT_MODEL }
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Defina OPENAI_API_KEY ou as variáveis do Azure OpenAI')
  const client = new OpenAI({ apiKey })
  return { client, model: DEFAULT_MODEL }
}

export async function getAnswer(prompt: string, model?: string) {
  const { client, model: fallback } = buildClient()
  const chosenModel = model || fallback
  const resp = await client.chat.completions.create({
    model: chosenModel,
    messages: [
      { role: 'system', content: 'Você é um assistente útil para perguntas sobre texto extraído de imagens.' },
      { role: 'user', content: prompt },
    ],
    temperature: Number(process.env.OPENAI_TEMPERATURE || 0.2),
    max_tokens: Number(process.env.OPENAI_MAX_TOKENS || 512),
  })
  const text = resp.choices?.[0]?.message?.content?.trim() || ''
  const usage = {
    prompt_tokens: resp.usage?.prompt_tokens ?? null,
    completion_tokens: resp.usage?.completion_tokens ?? null,
    total_tokens: resp.usage?.total_tokens ?? null,
    model: chosenModel,
  }
  return { text, usage }
} 