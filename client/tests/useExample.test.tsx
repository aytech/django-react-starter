import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchExample } from '../src/lib/api/exampleApi';
import { useExampleText } from '../src/lib/hooks/useExample';

vi.mock('../src/lib/api/exampleApi', () => ({
  fetchExample: vi.fn(),
}));

const mockedFetchExample = vi.mocked(fetchExample);

describe('useExampleText', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    mockedFetchExample.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('loads example data through the configured query', async () => {
    const example = {
      name: 'API name',
      title: 'API title',
    };
    mockedFetchExample.mockResolvedValue(example);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useExampleText(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(example);
    expect(mockedFetchExample).toHaveBeenCalledOnce();
    expect(mockedFetchExample).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
});
