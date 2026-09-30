import { getJson } from './httpClient'

export interface Example {
  name: string
  title: string
}

export function fetchExample(signal?: AbortSignal): Promise<Example> {
  return getJson('/api/v1/example/', { signal })
}