import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export type ApplicationStatus = 'PENDING' | 'UNDER_REVIEW' | 'ADMITTED' | 'REJECTED';

export interface ApplicationStatusView {
  trackingCode: string;
  levelApplied: string;
  programmeApplied: string;
  status: ApplicationStatus;
  submittedAt: string;
}

export async function getApplicationStatus(trackingCode: string): Promise<ApplicationStatusView> {
  const response = await api.get<ApplicationStatusView>(
    `/applications/track/${encodeURIComponent(trackingCode)}`,
  );
  return response.data;
}
