import { useQuery } from '@tanstack/react-query'
import { fetchExample } from '../api/exampleApi'

export function useExampleText() {
  return useQuery({
    queryKey: ['example-text'],
    queryFn: ({ signal }) => fetchExample(signal),
  })
}