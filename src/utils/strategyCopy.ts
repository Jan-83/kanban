import type { TaskImage } from '../types/kanban';
import type { StrategyCard, StrategyData } from '../types/strategy';
import type { TaskImageRepository } from './taskImages';
import { copiedTaskImage, validTaskImage } from './taskImageValidation';
import { descendantIds, parseStrategy } from './strategy';

export interface StrategyCopyPlan {
  rootId: string;
  cards: StrategyCard[];
  images: { source: TaskImage; cardId: string; index: number; copied: boolean }[];
}

export function createStrategyCopyPlan(data: StrategyData, sourceId: string, options: { descendants: boolean; keepParents: boolean }, newId: () => string = () => crypto.randomUUID()): StrategyCopyPlan {
  const source = data.cards.find(c => c.task.id === sourceId);
  if (!source) throw new Error('Karta została usunięta. Wybierz inną kartę do skopiowania.');
  const selected = new Set([sourceId, ...(options.descendants ? descendantIds(data, sourceId) : [])]);
  const originals = data.cards.filter(c => selected.has(c.task.id));
  const ids = new Map(originals.map(c => [c.task.id, newId()]));
  const stamp = new Date().toISOString();
  // Put the whole copy in free space to the right and retain relative positions.
  const dx = Math.max(...data.cards.map(c => c.position.x)) + 360 - Math.min(...originals.map(c => c.position.x));
  const images: StrategyCopyPlan['images'] = [];
  const cards = originals.map(original => {
    const card = structuredClone(original), oldId = card.task.id, id = ids.get(oldId)!;
    card.task.id = id;
    if (oldId === sourceId) card.task.title = card.task.title.slice(0, 292).trimEnd() + ' — kopia';
    card.task.createdAt = stamp; card.task.updatedAt = stamp;
    delete card.task.githubIssueNumber;
    card.task.subtasks = card.task.subtasks.map(step => ({ ...step, id: newId() }));
    card.task.statusComments = card.task.statusComments?.map(comment => ({ ...comment, id: newId() }));
    card.task.images = card.task.images?.map((image, index) => {
      images.push({ source: image, cardId: id, index, copied: false });
      return copiedTaskImage(image, id, newId(), stamp);
    });
    // Shared descendants are copied once; they link only to copied parents.
    card.parentIds = oldId === sourceId ? options.keepParents ? [...card.parentIds] : [] : card.parentIds.flatMap(parent => ids.has(parent) ? [ids.get(parent)!] : []);
    card.position = { x: card.position.x + dx, y: card.position.y + 40 };
    return card;
  });
  // Check limits and graph validity before creating any storage objects.
  parseStrategy({ ...data, cards: [...data.cards, ...cards] });
  return { rootId: ids.get(sourceId)!, cards, images };
}

export async function copyStrategyImages(plan: StrategyCopyPlan, repository: Pick<TaskImageRepository, 'copy'>, progress: (done: number, total: number) => void = () => {}) {
  let done = plan.images.filter(job => job.copied).length;
  progress(done, plan.images.length);
  for (const job of plan.images) {
    if (job.copied) continue;
    const image = await repository.copy(job.source, job.cardId);
    if (!validTaskImage(image, job.cardId) || image.path === job.source.path || image.path.split('/')[0] !== job.source.path.split('/')[0]) throw new Error('Nie potwierdzono niezależnej kopii zdjęcia.');
    plan.cards.find(c => c.task.id === job.cardId)!.task.images![job.index] = image;
    job.copied = true;
    progress(++done, plan.images.length);
  }
}

export function appendStrategyCopy(data: StrategyData, plan: StrategyCopyPlan): StrategyData {
  if (plan.images.some(job => !job.copied)) throw new Error('Poczekaj na zakończenie kopiowania zdjęć.');
  const present = plan.cards.filter(c => data.cards.some(existing => existing.task.id === c.task.id));
  // Stable IDs make retrying an uncertain save safe: never create a second copy.
  if (present.length === plan.cards.length) return data;
  if (present.length) throw new Error('Część kopii jest już na tablicy. Odśwież widok przed kolejną próbą.');
  return parseStrategy({ ...data, cards: [...data.cards, ...structuredClone(plan.cards)] });
}
