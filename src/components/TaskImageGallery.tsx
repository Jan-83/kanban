import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageIcon, RefreshCw, X } from 'lucide-react';
import type { TaskImage } from '../types/kanban';
import { useTaskImages } from './TaskImageContext';

export interface LocalImagePreview { id: string; name: string; url: string; }
interface Props {
  images?: TaskImage[];
  localImages?: LocalImagePreview[];
  compact?: boolean;
  disabled?: boolean;
  onRemove?: (id: string) => void;
}

export function TaskImageGallery({ images = [], localImages = [], compact = false, disabled = false, onRemove }: Props) {
  const repository = useTaskImages();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [viewer, setViewer] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const key = images.map(image => image.id + ':' + image.path).join('|');
  useEffect(() => {
    let alive = true;
    setError('');
    const load = () => { void repository.urls(images).then(next => { if (alive) { setUrls(next); setError(''); } }).catch(() => { if (alive) setError('Nie udało się wczytać zdjęć.'); }); };
    load();
    const refresh = setInterval(load, 20 * 60000);
    return () => { alive = false; clearInterval(refresh); };
  }, [repository, key, retry]);
  useEffect(() => {
    if (viewer) dialog.current?.showModal();
    else dialog.current?.close();
  }, [viewer]);

  const photos = [...images.map(image => ({ id: image.id, name: image.name, url: urls[image.id] ?? '' })), ...localImages];
  const index = photos.findIndex(image => image.id === viewer);
  const selected = photos[index];
  if (!photos.length) return null;
  const visible = compact ? photos.slice(0, 4) : photos;
  const navigate = (direction: number) => setViewer(photos[(index + direction + photos.length) % photos.length].id);
  return <div className={'task-photo-gallery' + (compact ? ' compact' : '')} onClick={event => event.stopPropagation()}>
    <div className="task-photo-strip" aria-label="Zdjęcia zadania">
      {visible.map(image => <div className="task-photo-item" key={image.id}>
        <button type="button" className="task-photo-thumb" disabled={disabled || !image.url} aria-label={'Powiększ zdjęcie: ' + image.name} title={image.name} onClick={() => setViewer(image.id)}>
          {image.url ? <img src={image.url} alt={image.name} loading="lazy" /> : <ImageIcon size={18} />}
        </button>
        {onRemove && <button type="button" className="photo-remove" disabled={disabled} onClick={() => onRemove(image.id)} aria-label={'Odłącz zdjęcie: ' + image.name} title="Odłącz zdjęcie od zadania"><X size={12} /></button>}
      </div>)}
      {compact && photos.length > visible.length && <button type="button" className="photo-overflow" disabled={disabled || !photos[4].url} onClick={() => setViewer(photos[4].id)} aria-label={'Pokaż wszystkie zdjęcia: ' + photos.length}>+{photos.length - visible.length}</button>}
      {error && <button type="button" className="photo-retry" onClick={() => setRetry(retry + 1)} title={error} aria-label="Ponów wczytywanie zdjęć"><RefreshCw size={13} /></button>}
    </div>
    <dialog ref={dialog} className="image-viewer" aria-label="Podgląd zdjęcia zadania" onCancel={event => { event.preventDefault(); event.stopPropagation(); setViewer(null); }} onKeyDown={event => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); navigate(1); }
    }}>
      {selected && <>
        <div className="image-viewer-heading"><span>{selected.name}</span><span className="muted">{index + 1} / {photos.length}</span><button type="button" className="icon-button" onClick={() => setViewer(null)} aria-label="Zamknij podgląd zdjęcia"><X size={20} /></button></div>
        <div className="image-viewer-content"><img src={selected.url} alt={selected.name} />
          {photos.length > 1 && <><button type="button" className="photo-nav previous" onClick={() => navigate(-1)} aria-label="Poprzednie zdjęcie"><ChevronLeft /></button><button type="button" className="photo-nav next" onClick={() => navigate(1)} aria-label="Następne zdjęcie"><ChevronRight /></button></>}
        </div>
      </>}
    </dialog>
  </div>;
}
