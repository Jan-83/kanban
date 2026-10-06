import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Code2, Heading2, Italic, Link, List, ListOrdered, Quote, Redo2, Underline, Undo2, X } from 'lucide-react';
import { descriptionText, MAX_DESCRIPTION_HTML, MAX_DESCRIPTION_TEXT, plainTextToHtml, sanitizeDescription } from '../utils/richDescription';

interface Props { text: string; html?: string; onClose: () => void; onApply: (text: string, html: string) => void; }
export function DescriptionEditor({ text, html, onClose, onApply }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [source, setSource] = useState(() => sanitizeDescription(html || plainTextToHtml(text)));
  const [mode, setMode] = useState<'editor' | 'html' | 'preview'>('editor');
  const [link, setLink] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [error, setError] = useState('');
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } } })],
    content: source,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: 'rich-description', 'aria-label': 'Treść opisu zadania', role: 'textbox', 'aria-multiline': 'true' },
      transformPastedHTML: html => sanitizeDescription(html),
    },
    onUpdate: ({ editor }) => { setSource(editor.getHTML()); setError(''); },
  });
  useEffect(() => { dialog.current?.showModal(); return () => { dialog.current?.close(); }; }, []);
  const changeMode = (next: typeof mode) => {
    if (mode === 'html' && next !== 'html') {
      const safe = sanitizeDescription(source);
      editor?.commands.setContent(safe);
      setSource(editor?.getHTML() ?? safe);
    }
    setMode(next); setError('');
  };
  const apply = () => {
    const safe = sanitizeDescription(mode === 'html' ? source : editor?.getHTML() ?? source);
    const plain = descriptionText(safe);
    if (safe.length > MAX_DESCRIPTION_HTML || plain.length > MAX_DESCRIPTION_TEXT) { setError('Opis jest za długi. Limit to 10 000 znaków tekstu.'); return; }
    onApply(plain, plain ? safe : '');
  };
  const toolbar = [
    { label: 'Pogrubienie', icon: Bold, active: editor?.isActive('bold'), action: () => editor?.chain().focus().toggleBold().run() },
    { label: 'Kursywa', icon: Italic, active: editor?.isActive('italic'), action: () => editor?.chain().focus().toggleItalic().run() },
    { label: 'Podkreślenie', icon: Underline, active: editor?.isActive('underline'), action: () => editor?.chain().focus().toggleUnderline().run() },
    { label: 'Nagłówek', icon: Heading2, active: editor?.isActive('heading', { level: 2 }), action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'Lista punktowana', icon: List, active: editor?.isActive('bulletList'), action: () => editor?.chain().focus().toggleBulletList().run() },
    { label: 'Lista numerowana', icon: ListOrdered, active: editor?.isActive('orderedList'), action: () => editor?.chain().focus().toggleOrderedList().run() },
    { label: 'Cytat', icon: Quote, active: editor?.isActive('blockquote'), action: () => editor?.chain().focus().toggleBlockquote().run() },
  ];
  return <dialog ref={dialog} className="description-dialog" aria-labelledby="description-editor-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="dialog-heading"><div><p className="eyebrow">SZCZEGÓŁY ZADANIA</p><h2 id="description-editor-title">Opis zadania</h2></div><button type="button" className="icon-button" aria-label="Zamknij duży opis" onClick={onClose}><X size={20} /></button></div>
    <div className="description-mode-tabs" role="tablist" aria-label="Tryb opisu">
      {([['editor', 'Edytor'], ['html', 'HTML'], ['preview', 'Podgląd']] as const).map(([id, label]) => <button type="button" key={id} role="tab" aria-selected={mode === id} onClick={() => changeMode(id)}>{id === 'html' && <Code2 size={15} />}{label}</button>)}
    </div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {mode === 'editor' && <>
      <div className="description-toolbar" role="toolbar" aria-label="Formatowanie opisu">
        {toolbar.map(item => <button type="button" className="icon-button" key={item.label} aria-label={item.label} title={item.label} aria-pressed={!!item.active} onClick={item.action}><item.icon size={17} /></button>)}
        <button type="button" className="icon-button" aria-label="Dodaj link" title="Dodaj link" aria-pressed={!!editor?.isActive('link')} onClick={() => { setLink(editor?.getAttributes('link').href ?? ''); setLinkOpen(!linkOpen); }}><Link size={17} /></button>
        <span className="toolbar-divider" />
        <button type="button" className="icon-button" aria-label="Cofnij formatowanie" title="Cofnij" disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}><Undo2 size={17} /></button>
        <button type="button" className="icon-button" aria-label="Ponów formatowanie" title="Ponów" disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}><Redo2 size={17} /></button>
      </div>
      {linkOpen && <div className="description-link-form"><input aria-label="Adres linku" value={link} onChange={event => setLink(event.target.value)} placeholder="https://…" maxLength={2000} />
        <button type="button" className="button" onClick={() => { if (!/^(https?:\/\/|mailto:|tel:)/i.test(link.trim())) { setError('Podaj adres https://, http://, mailto: lub tel:.'); return; } editor?.chain().focus().extendMarkRange('link').setLink({ href: link.trim() }).run(); setLinkOpen(false); setError(''); }}>Dodaj link</button>
        <button type="button" className="button" onClick={() => { editor?.chain().focus().extendMarkRange('link').unsetLink().run(); setLinkOpen(false); }}>Usuń link</button></div>}
    </>}
    <div className="description-editor-body">
      {mode === 'html' ? <textarea className="description-html-source" aria-label="Kod HTML opisu" value={source} onChange={event => { setSource(event.target.value); setError(''); }} maxLength={MAX_DESCRIPTION_HTML} spellCheck={false} />
        : mode === 'preview' ? <div className="rich-description description-read-preview" dangerouslySetInnerHTML={{ __html: sanitizeDescription(source) }} />
        : <EditorContent editor={editor} />}
    </div>
    <div className="description-editor-footer"><span className="muted">{descriptionText(sanitizeDescription(source)).length.toLocaleString('pl')} / 10 000 znaków</span><span className="spacer" /><button type="button" className="button" onClick={onClose}>Anuluj opis</button><button type="button" className="button primary" onClick={apply}>Zastosuj opis</button></div>
  </dialog>;
}
