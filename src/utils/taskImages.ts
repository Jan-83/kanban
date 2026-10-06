import type { TaskImage } from '../types/kanban';
import { boardId, supabase } from './supabase';
import { validateImageContent } from './taskImageValidation';

export const TASK_IMAGE_BUCKET = 'kanban-task-images';
export interface TaskImageRepository {
  upload: (taskId: string, file: File) => Promise<TaskImage>;
  urls: (images: TaskImage[]) => Promise<Record<string, string>>;
}

export const taskImageRepository: TaskImageRepository = {
  async upload(taskId, file) {
    if (!supabase) throw new Error('Brak dostępu do magazynu zdjęć.');
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(taskId)) throw new Error('Nieprawidłowe zadanie.');
    await validateImageContent(file);
    const id = crypto.randomUUID();
    const mimeType = file.type as TaskImage['mimeType'];
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mimeType];
    const path = `${boardId}/${taskId}/${id}.${extension}`;
    const { error } = await supabase.storage.from(TASK_IMAGE_BUCKET).upload(path, file, { contentType: mimeType, upsert: false });
    if (error) throw new Error('Nie udało się przesłać zdjęcia „' + file.name + '”. Sprawdź połączenie i spróbuj ponownie.');
    return { id, name: file.name.slice(0, 200), path, size: file.size, mimeType, uploadedAt: new Date().toISOString() };
  },
  async urls(images) {
    if (!images.length) return {};
    if (!supabase || images.some(image => !image.path.startsWith(boardId + '/'))) throw new Error('Brak dostępu do zdjęć tego projektu.');
    const { data, error } = await supabase.storage.from(TASK_IMAGE_BUCKET).createSignedUrls(images.map(image => image.path), 3600);
    if (error || !data) throw new Error('Nie udało się wczytać zdjęć.');
    const result: Record<string, string> = {};
    for (const image of images) {
      const item = data.find(item => item.path === image.path);
      if (!item?.signedUrl || item.error) throw new Error('Nie udało się wczytać zdjęcia „' + image.name + '”.');
      result[image.id] = item.signedUrl;
    }
    return result;
  },
};
