import type { StrategyRepository, StrategySnapshot } from '../types/strategy';
import { api, boardId } from './api';
import { parseStrategy } from './strategy';
export const strategyRepository: StrategyRepository = {
  async load(signal) {
    const value = await api<StrategySnapshot>('/boards/' + boardId + '/strategy', { signal });
    return { data: parseStrategy(value.data), revision: value.revision };
  },
  async save(data, revision) {
    const value = await api<StrategySnapshot>('/boards/' + boardId + '/strategy', { method: 'PUT', data: { data: parseStrategy(data), revision } });
    return { data: parseStrategy(value.data), revision: value.revision };
  },
  // The owning hook polls every ten seconds and refreshes on focus.
  subscribe() { return () => {}; },
};
