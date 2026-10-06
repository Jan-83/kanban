import DOMPurify, { type DOMPurify as Purifier } from 'dompurify';

export const MAX_DESCRIPTION_HTML = 50000;
export const MAX_DESCRIPTION_TEXT = 10000;
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
export const plainTextToHtml = (text: string) => text.split('\n').map(line => '<p>' + escapeHtml(line) + '</p>').join('');

// Only formatting is accepted: no scripts, styles, embeds or remote image loads.
export function sanitizeDescription(html: string, purifier: Purifier = DOMPurify): string {
  const fragment = purifier.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'hr'],
    ALLOWED_ATTR: ['href', 'title', 'start'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:https?:\/\/|mailto:|tel:)/i,
    RETURN_DOM_FRAGMENT: true,
  });
  fragment.querySelectorAll('a[href]').forEach(link => { link.setAttribute('target', '_blank'); link.setAttribute('rel', 'noopener noreferrer'); });
  const container = fragment.ownerDocument.createElement('div');
  container.append(fragment);
  return container.innerHTML;
}

export function descriptionText(html: string, documentObject: Document = document): string {
  const container = documentObject.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll('br').forEach(node => node.replaceWith('\n'));
  container.querySelectorAll('p,li,h2,h3,blockquote,pre').forEach(node => node.append('\n'));
  return (container.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}
