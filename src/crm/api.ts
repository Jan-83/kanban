import { api, boardId } from '../utils/api';
import type { CrmDetails, CrmFile, CrmInput, CrmRecord, CrmSettings, CrmSnapshot } from './types';
export const crmPath = '/boards/' + boardId + '/crm';
export const crmApi = {
  load: (signal?: AbortSignal) => api<CrmSnapshot>(crmPath, { signal }),
  details: (id: string, signal?: AbortSignal) => api<CrmDetails>(crmPath + '/records/' + id, { signal }),
  save: (data: CrmInput, id?: string) => api<CrmRecord>(crmPath + '/records' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', data }),
  archive: (r: CrmRecord) => api(crmPath + '/records/' + r.id, { method: 'DELETE', data: { revision: r.revision } }),
  version: (r: CrmRecord) => api<CrmRecord>(crmPath + '/records/' + r.id + '/version', { method: 'POST', data: { revision: r.revision } }),
  linkTask: (r: CrmRecord, taskId: string | null = null) => api<CrmRecord>(crmPath + '/records/' + r.id + '/task', { method: 'POST', data: { revision: r.revision, taskId } }),
  upload: (id: string, file: File) => { const data = new FormData(); data.append('file', file); return api<CrmFile>(crmPath + '/records/' + id + '/files', { method: 'POST', data }); },
  removeFile: (id: string) => api(crmPath + '/files/' + id, { method: 'DELETE' }),
  settings: (data: CrmSettings, revision: number) => api<CrmSnapshot['settings']>(crmPath + '/settings', { method: 'PUT', data: { data, revision } }),
  read: (ids: string[]) => api(crmPath + '/notifications/read', { method: 'POST', data: { ids } }),
};
