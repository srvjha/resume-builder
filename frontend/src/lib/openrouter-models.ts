import { z } from 'zod'

const catalogSchema = z.object({
  data: z.array(z.object({ id: z.string(), name: z.string() })),
})

export async function fetchOpenRouterModels(signal: AbortSignal) {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    credentials: 'omit',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
  })
  if (!response.ok) throw new Error('Could not load OpenRouter models')
  return catalogSchema.parse(await response.json()).data
}

export function filterAiModels(
  modelIds: string[],
  catalog: { id: string; name: string }[],
  query: string,
) {
  const models = new Map(modelIds.map((id) => [id, { id, name: id }]))
  for (const model of catalog) models.set(model.id, model)
  const words = query.trim().toLowerCase().split(/\s+/)
  return Array.from(models.values()).filter((model) =>
    words.every((word) =>
      `${model.name} ${model.id}`.toLowerCase().includes(word),
    ),
  )
}
