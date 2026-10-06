import type { TaskImage } from '../types/kanban';

export const MAX_TASK_IMAGES = 12;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const pathPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\/([a-zA-Z0-9_-]{1,120})\/([a-zA-Z0-9_-]{1,120})\.(jpg|png|webp)$/i;

export function validTaskImage(image: unknown, taskId: string): image is TaskImage {
  if (!image || typeof image !== 'object') return false;
  const i = image as TaskImage;
  const match = typeof i.path === 'string' ? i.path.match(pathPattern) : null;
  return typeof i.id === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(i.id)
    && typeof i.name === 'string' && i.name.length > 0 && i.name.length <= 200
    && !!match && match[1] === taskId && match[2] === i.id
    && IMAGE_MIME_TYPES.includes(i.mimeType)
    && match[3].toLowerCase() === ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[i.mimeType])
    && Number.isSafeInteger(i.size) && i.size > 0 && i.size <= MAX_IMAGE_BYTES
    && typeof i.uploadedAt === 'string' && i.uploadedAt.length <= 50 && Number.isFinite(Date.parse(i.uploadedAt));
}

export function validateImageFile(file: Pick<File, 'type' | 'size' | 'name'>): void {
  if (!IMAGE_MIME_TYPES.includes(file.type as TaskImage['mimeType'])) throw new Error('Wybierz zdjęcie JPG, PNG lub WebP.');
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES) throw new Error('Zdjęcie „' + file.name + '” przekracza limit 5 MB lub jest puste.');
}

export async function validateImageContent(file: File): Promise<void> {
  validateImageFile(file);
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const matches = file.type === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : file.type === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    : String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!matches) throw new Error('Plik „' + file.name + '” nie zawiera prawidłowego zdjęcia.');
}
