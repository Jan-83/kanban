import type { Task } from './kanban';

export interface StrategyCard {
  task: Task;
  parentIds: string[];
  position: { x: number; y: number };
}
export interface StrategyData { version: 2; cards: StrategyCard[]; }
export interface StrategySnapshot { data: StrategyData; revision: number; }
export interface StrategyRepository {
  load: (signal?: AbortSignal) => Promise<StrategySnapshot>;
  save: (data: StrategyData, revision: number) => Promise<StrategySnapshot>;
  subscribe?: (onChange: () => void) => () => void;
}
