export type CrmKind = 'company' | 'contact' | 'designer' | 'project' | 'deal' | 'activity' | 'followup' | 'event' | 'offer' | 'service' | 'rule';
export type CrmView = 'overview' | 'pipeline' | 'designers' | 'companies' | 'contacts' | 'projects' | 'tasks' | 'calendar' | 'offers' | 'service' | 'reports' | 'automations' | 'settings';
export interface Relationship { recordId: string; role: string }
export interface CrmData {
  studio?: string; specialization?: string; categoryId?: string; strategyId?: string | null; tagColors?: Record<string, string>;
  title: string; notes?: string; tags?: string[]; category?: string; nip?: string; email?: string; phone?: string;
  address?: string; city?: string; website?: string; industry?: string; source?: string; jobTitle?: string; type?: string;
  status?: string; valueCents?: number; currency?: string; area?: number; startDate?: string; dueDate?: string; systems?: string[];
  relationships?: Relationship[]; stageId?: string; expectedDate?: string; lostReason?: string; occurredAt?: string; outlookUrl?: string;
  dueAt?: string; assigneeId?: string; priority?: string; reminderMinutes?: number; startsAt?: string; endsAt?: string; location?: string;
  participants?: string; number?: string; validUntil?: string; version?: number; seriesId?: string; sentAt?: string; kanbanTaskId?: string;
  warrantyUntil?: string; nextInspectionDate?: string; resolution?: string; enabled?: boolean; trigger?: string; days?: number;
  delayDays?: number; action?: string; taskType?: string;
}
export interface CrmRecord { id: string; kind: CrmKind; parentId: string | null; ownerId: string; visibility: 'team' | 'restricted'; accessIds: string[]; revision: number; data: CrmData; createdAt: string; updatedAt: string }
export type CrmInput = Pick<CrmRecord, 'kind' | 'parentId' | 'ownerId' | 'visibility' | 'accessIds' | 'revision' | 'data'>;
export interface CrmStage { id: string; title: string; probability: number; color: string; outcome: 'open' | 'won' | 'lost' }
export interface DesignerCategory { id: string; title: string; color: string }
export interface DesignerStrategy { id: string; title: string; description?: string | null }
export interface CrmSettings { stages: CrmStage[]; sources: string[]; categories: string[]; designerCategories: DesignerCategory[]; designerStrategies: DesignerStrategy[] }
export interface CrmNotice { id: string; recordId: string; message: string; read: boolean; createdAt: string }
export interface CrmSnapshot { preview?: boolean; records: CrmRecord[]; settings: { revision: number; data: CrmSettings }; members: { id: string; name: string; role: string }[]; role: string; notifications: CrmNotice[]; serverTime: string }
export interface CrmFile { id: string; name: string; mime: string; bytes: number; createdAt: string }
export interface CrmDetails { record: CrmRecord; history: { revision: number; actorId: string; createdAt: string }[]; files: CrmFile[] }
