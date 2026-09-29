import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import App from '../src/sections/App';

describe('App', () => {
  afterEach(cleanup);

  it('renders the application landmark and welcome content', () => {
    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Django + React' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Your starter is ready.')).toBeInTheDocument();
  });
});
