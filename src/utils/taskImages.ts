import type { TaskImage } from '../types/kanban';
import { api, boardId } from './api';
import { copiedTaskImage, validateImageContent } from './taskImageValidation';
export interface TaskImageRepository {
  upload: (taskId: string, file: File) => Promise<TaskImage>;
  copy: (image: TaskImage, taskId: string) => Promise<TaskImage>;
  urls: (images: TaskImage[]) => Promise<Record<string, string>>;
}
export const taskImageRepository: TaskImageRepository = {
  async copy(image, taskId) {
    const copied = copiedTaskImage(image, taskId);
    return api<TaskImage>('/boards/' + boardId + '/images/copy', { method: 'POST', data: { source: image.path, target: copied.path, name: image.name } });
  },
  async upload(taskId, file) {
    await validateImageContent(file);
    const data = new FormData(); data.append('file', file); data.append('taskId', taskId);
    return api<TaskImage>('/boards/' + boardId + '/images', { method: 'POST', data });
  },
  async urls(images) {
    if (images.some(image => !image.path.startsWith(boardId + '/'))) throw new Error('Brak dostępu do zdjęć tego projektu.');
    return Object.fromEntries(images.map(image => [image.id, '/api/boards/' + boardId + '/images/content?path=' + encodeURIComponent(image.path)]));
  },
};
