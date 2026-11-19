import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useOperatingClock } from './useOperatingClock';

afterEach(() => vi.useRealTimers());
describe('minute wall clock', () => {
  it('aligns ticks to minute boundaries and crosses Beijing midnight', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-13T15:59:42Z'));
    const { result, unmount } = renderHook(useOperatingClock);
    expect(result.current.toISOString()).toBe('2026-11-13T15:59:00.000Z');
    act(() => vi.advanceTimersByTime(18_000));
    expect(result.current.toISOString()).toBe('2026-11-13T16:00:00.000Z');
    unmount(); expect(vi.getTimerCount()).toBe(0);
  });
  it('resynchronizes after suspended tab focus and visible events', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-13T01:00:00Z'));
    const { result } = renderHook(useOperatingClock);
    act(() => { vi.setSystemTime(new Date('2026-11-14T06:23:40Z')); window.dispatchEvent(new Event('focus')); });
    expect(result.current.toISOString()).toBe('2026-11-14T06:23:00.000Z');
    act(() => { vi.setSystemTime(new Date('2026-11-14T07:15:40Z')); document.dispatchEvent(new Event('visibilitychange')); });
    expect(result.current.toISOString()).toBe('2026-11-14T07:15:00.000Z');
  });
});
