import { getJson } from './httpClient'

export interface Example {
  id: number
  text: string
}

interface ExampleResponse {
  text: Example
}

export function fetchExample(signal?: AbortSignal): Promise<ExampleResponse> {
  return getJson('/api/v1/example/', { signal })
}