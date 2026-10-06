import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { taskImageRepository, type TaskImageRepository } from '../utils/taskImages';

const ImageContext = createContext<TaskImageRepository>(taskImageRepository);
export const useTaskImages = () => useContext(ImageContext);

// Cache is scoped to the mounted workspace, and disappears on logout.
export function TaskImageProvider({ repository, children }: { repository: TaskImageRepository; children: ReactNode }) {
  const cached = useMemo<TaskImageRepository>(() => {
    const cache = new Map<string, { url: string; expires: number }>();
    return {
      upload: repository.upload,
      async urls(images) {
        const missing = images.filter(image => !cache.has(image.path) || cache.get(image.path)!.expires < Date.now());
        if (missing.length) {
          const urls = await repository.urls(missing);
          missing.forEach(image => { if (urls[image.id]) cache.set(image.path, { url: urls[image.id], expires: Date.now() + 20 * 60000 }); });
        }
        return Object.fromEntries(images.map(image => [image.id, cache.get(image.path)?.url ?? '']));
      },
    };
  }, [repository]);
  return <ImageContext.Provider value={cached}>{children}</ImageContext.Provider>;
}
