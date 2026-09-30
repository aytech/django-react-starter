import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useExampleText } from '../src/lib/hooks/useExample';
import App from '../src/sections/App';

vi.mock('../src/lib/hooks/useExample', () => ({
  useExampleText: vi.fn(),
}));

const mockedUseExampleText = vi.mocked(useExampleText);
type ExampleQueryResult = ReturnType<typeof useExampleText>;

function setQueryResult(
  overrides: Partial<ExampleQueryResult> = {},
) {
  mockedUseExampleText.mockReturnValue({
    data: undefined,
    error: null,
    isPending: false,
    isFetching: false,
    isRefetching: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as ExampleQueryResult);
}

describe('App', () => {
  afterEach(cleanup);

  beforeEach(() => {
    mockedUseExampleText.mockReset();
    setQueryResult();
  });

  it('renders content returned by the API', () => {
    setQueryResult({
      data: {
        name: 'API name',
        title: 'API title',
      },
    });

    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'API name' }),
    ).toBeInTheDocument();
    expect(screen.getByText('API title')).toBeInTheDocument();
  });

  it('shows the initial loading notification', () => {
    setQueryResult({
      isPending: true,
      isFetching: true,
    });

    render(<App />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading data from API...',
    );
  });

  it('changes the loading notification while refetching', () => {
    setQueryResult({
      data: {
        name: 'Cached name',
        title: 'Cached title',
      },
      isFetching: true,
      isRefetching: true,
    });

    render(<App />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Refreshing data from API...',
    );
    expect(screen.getByText('Cached title')).toBeInTheDocument();
  });

  it('shows an API error notification', async () => {
    setQueryResult({
      error: new Error('API unavailable'),
      isError: true,
    });

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'API unavailable',
    );
  });
});
