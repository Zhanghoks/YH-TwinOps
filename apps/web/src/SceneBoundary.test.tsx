import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { SceneBoundary } from './scene/SceneBoundary';

it('isolates scene failures and lets the user retry without losing adjacent tools', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  let fail = true;
  function Scene() {
    if (fail) throw new Error('WebGL context unavailable');
    return <div>Rendered scene</div>;
  }
  try {
    render(<><SceneBoundary><Scene /></SceneBoundary><aside>Operations remain available</aside></>);
    expect(screen.getByRole('alert').textContent).toContain('3D 场景暂时不可用');
    expect(screen.getByText('Operations remain available')).toBeTruthy();
    fail = false;
    await userEvent.setup().click(screen.getByRole('button', { name: '重试 3D 场景' }));
    expect(screen.getByText('Rendered scene')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  } finally { log.mockRestore(); }
});
