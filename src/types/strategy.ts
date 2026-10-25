import type { Task } from './kanban';

export interface StrategyCard {
  task: Task;
  parentId: string | null;
  position: { x: number; y: number };
}
export interface StrategyData { version: 1; cards: StrategyCard[]; }
export interface StrategySnapshot { data: StrategyData; revision: number; }
export interface StrategyRepository {
  load: (signal?: AbortSignal) => Promise<StrategySnapshot>;
  save: (data: StrategyData, revision: number) => Promise<StrategySnapshot>;
  subscribe?: (onChange: () => void) => () => void;
}
