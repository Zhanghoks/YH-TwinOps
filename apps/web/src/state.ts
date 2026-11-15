/** 工作台状态：图层、选中、信号流（zustand）。快照是派生值，在 App 里用 useMemo 计算。 */
import { create } from 'zustand';
import type { TwinSignal } from '@yh/contracts';
import { baselineSignals, injectSignals } from './synthetic';

export type ViewLayer = 'none' | 'traffic' | 'queue' | 'coverage';
export type Selection = { kind: 'zone' | 'fixture'; id: string } | null;

interface WorkbenchState {
  layer: ViewLayer;
  selection: Selection;
  signals: TwinSignal[];
  injectCount: number;
  setLayer: (layer: ViewLayer) => void;
  select: (selection: Selection) => void;
  inject: (kind: 'produce-traffic' | 'checkout-arrivals') => void;
}

export const useWorkbench = create<WorkbenchState>((set) => ({
  layer: 'queue',
  selection: null,
  signals: baselineSignals(),
  injectCount: 0,
  setLayer: (layer) => set({ layer }),
  select: (selection) => set({ selection }),
  inject: (kind) =>
    set((s) => ({
      signals: [...s.signals, ...injectSignals(kind, s.injectCount + 1)],
      injectCount: s.injectCount + 1,
    })),
}));
