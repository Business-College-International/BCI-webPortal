import { api } from './client';

export interface SubjectConfig { id: string; code: string; name: string; level: string; isElective: boolean; programme: string; isActive: boolean; }
export interface FeeSchedule { id: string; termId: string; level: string; programme: string; itemCode: string; itemName: string; amount: string; isOptional: boolean; isActive: boolean; }

export async function listSubjects(params?: { level?: string; programme?: string; isElective?: boolean; isActive?: boolean }): Promise<SubjectConfig[]> {
  const response = await api.get<SubjectConfig[]>('/configuration/subjects', { params });
  return response.data;
}

export async function createSubject(input: { code: string; name: string; level: string; isElective: boolean; programme: string }): Promise<SubjectConfig> {
  const response = await api.post<SubjectConfig>('/configuration/subjects', input);
  return response.data;
}

export async function updateSubject(id: string, input: Partial<{ name: string; level: string; isElective: boolean; programme: string; isActive: boolean }>): Promise<SubjectConfig> {
  const response = await api.patch<SubjectConfig>(`/configuration/subjects/${encodeURIComponent(id)}`, input);
  return response.data;
}

export async function listFeeSchedules(termId: string): Promise<FeeSchedule[]> {
  const response = await api.get<FeeSchedule[]>('/configuration/fee-schedules', { params: { termId } });
  return response.data;
}

export async function createFeeSchedule(input: { termId: string; level: string; programme: string; itemCode: string; itemName: string; amount: number; isOptional?: boolean }): Promise<FeeSchedule> {
  const response = await api.post<FeeSchedule>('/configuration/fee-schedules', input);
  return response.data;
}
