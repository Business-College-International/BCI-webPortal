import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bci_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type ApplicationStatus = 'PENDING' | 'UNDER_REVIEW' | 'ADMITTED' | 'REJECTED' | 'WITHDRAWN';

export interface ApplicationStatusView {
  trackingCode: string;
  levelApplied: string;
  programmeApplied: string;
  status: ApplicationStatus;
  submittedAt: string;
}

export interface ApplicationListItem {
  id: string;
  trackingCode: string;
  firstName: string;
  lastName: string;
  dob: string;
  levelApplied: string;
  programmeApplied: string;
  guardianName: string;
  guardianPhone: string;
  status: ApplicationStatus;
  submittedAt: string;
  updatedAt: string;
}

export interface AcademicTerm {
  id: string;
  code: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
}

export interface AcademicYear {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  isCurrent: boolean;
  terms: AcademicTerm[];
}

export interface SchoolClass {
  id: string;
  academicYearId: string;
  name: string;
  level: string;
  programme: string;
  division: string | null;
  room: string | null;
  capacity: number | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface CurrentUser {
  id: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  roles: string[];
  permissions: string[];
  permissionAssignments: Array<{ permissionCode: string; scopeType: string | null; scopeId: string | null }>;
  person: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    phone: string | null;
    email: string | null;
    photoUrl: string | null;
  } | null;
  guardian: { personId: string; preferredSms: boolean; preferredPush: boolean } | null;
  staff: {
    personId: string;
    staffIdNo: string;
    department: string | null;
    employmentStatus: string;
  } | null;
}

export async function login(identifier: string, password: string): Promise<AuthTokens> {
  const response = await api.post<AuthTokens>('/auth/login', { identifier, password });
  localStorage.setItem('bci_access_token', response.data.accessToken);
  localStorage.setItem('bci_refresh_token', response.data.refreshToken);
  return response.data;
}

export function logoutLocal(): void {
  localStorage.removeItem('bci_access_token');
  localStorage.removeItem('bci_refresh_token');
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const response = await api.get<CurrentUser>('/auth/me');
  return response.data;
}

export async function getApplicationStatus(trackingCode: string): Promise<ApplicationStatusView> {
  const response = await api.get<ApplicationStatusView>(
    `/applications/track/${encodeURIComponent(trackingCode)}`,
  );
  return response.data;
}

export async function listApplications(): Promise<ApplicationListItem[]> {
  const response = await api.get<ApplicationListItem[]>('/applications');
  return response.data;
}

export async function reviewApplication(
  id: string,
  status: 'UNDER_REVIEW' | 'REJECTED',
  reason?: string,
): Promise<{ id: string; trackingCode: string; status: ApplicationStatus; updatedAt: string }> {
  const response = await api.post(`/applications/${encodeURIComponent(id)}/review`, { status, reason });
  return response.data;
}

export async function listAcademicYears(): Promise<AcademicYear[]> {
  const response = await api.get<AcademicYear[]>('/academic-years');
  return response.data;
}

export async function listSchoolClasses(academicYearId: string): Promise<SchoolClass[]> {
  const response = await api.get<SchoolClass[]>('/school-classes', { params: { academicYearId } });
  return response.data;
}

export async function admitApplication(
  id: string,
  input: { academicYearId: string; termId: string; classId: string; admissionNumber?: string },
): Promise<{ applicationId: string; student: { id: string; admissionNumber: string | null }; enrolment: { id: string; classId: string; termId: string } }> {
  const response = await api.post(`/applications/${encodeURIComponent(id)}/admit`, input);
  return response.data;
}
