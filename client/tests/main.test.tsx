import { beforeEach, describe, expect, it, vi } from 'vitest';

const rootMocks = vi.hoisted(() => ({
  createRoot: vi.fn(),
  render: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
  createRoot: rootMocks.createRoot,
}));

describe('client entry point', () => {
  beforeEach(() => {
    vi.resetModules();
    rootMocks.createRoot.mockReturnValue({ render: rootMocks.render });
    document.body.replaceChildren();
  });

  it('mounts the application into the root element', async () => {
    const rootElement = document.createElement('div');
    rootElement.id = 'root';
    document.body.append(rootElement);

    await import('../src/main');

    expect(rootMocks.createRoot).toHaveBeenCalledWith(rootElement);
    expect(rootMocks.render).toHaveBeenCalledOnce();
  });

  it('fails clearly when the root element is missing', async () => {
    await expect(import('../src/main')).rejects.toThrow('Root element not found');
    expect(rootMocks.createRoot).not.toHaveBeenCalled();
  });
});
