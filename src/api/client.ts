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

let refreshInFlight: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  const existing = refreshInFlight;
  if (existing) {
    await existing;
    return;
  }

  const refreshToken = localStorage.getItem('bci_refresh_token');
  if (!refreshToken) throw new Error('No BCI refresh token is available.');

  const promise = (async () => {
    const response = await api.post<AuthTokens>('/auth/refresh', { refreshToken });
    localStorage.setItem('bci_access_token', response.data.accessToken);
    localStorage.setItem('bci_refresh_token', response.data.refreshToken);
  })();

  refreshInFlight = promise;
  try {
    await promise;
  } finally {
    if (refreshInFlight === promise) refreshInFlight = null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error)) throw error;

    const config = error.config as (typeof error.config & { _bciRetry?: boolean }) | undefined;
    const isRefreshCall = config?.url?.includes('/auth/refresh') ?? false;
    if (error.response?.status !== 401 || !config || config._bciRetry || isRefreshCall) {
      throw error;
    }

    config._bciRetry = true;
    try {
      await refreshSession();
    } catch (refreshError) {
      logoutLocal();
      throw refreshError;
    }

    const token = localStorage.getItem('bci_access_token');
    if (!token) {
      logoutLocal();
      throw error;
    }

    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
    return api.request(config);
  },
);

export type ApplicationStatus = 'PENDING' | 'UNDER_REVIEW' | 'ADMITTED' | 'REJECTED' | 'WITHDRAWN';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface ApplicationStatusView { trackingCode: string; levelApplied: string; programmeApplied: string; status: ApplicationStatus; submittedAt: string; }
export interface ApplicationListItem { id: string; trackingCode: string; firstName: string; lastName: string; dob: string; levelApplied: string; programmeApplied: string; guardianName: string; guardianPhone: string; status: ApplicationStatus; submittedAt: string; updatedAt: string; }
export interface AcademicTerm { id: string; code: string; name: string; startsAt: string; endsAt: string; status: 'DRAFT' | 'OPEN' | 'CLOSED'; }
export interface AcademicYear { id: string; name: string; startsAt: string; endsAt: string; isCurrent: boolean; terms: AcademicTerm[]; }
export interface SchoolClass { id: string; academicYearId: string; name: string; level: string; programme: string; division: string | null; room: string | null; capacity: number | null; }
export interface AuthTokens { accessToken: string; refreshToken: string; }
export interface CurrentUser { id: string; status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED'; roles: string[]; permissions: string[]; permissionAssignments: Array<{ permissionCode: string; scopeType: string | null; scopeId: string | null }>; person: { id: string; firstName: string; middleName: string | null; lastName: string; phone: string | null; email: string | null; photoUrl: string | null } | null; guardian: { personId: string; preferredSms: boolean; preferredPush: boolean } | null; staff: { personId: string; staffIdNo: string; department: string | null; employmentStatus: string } | null; }
export interface StaffDuty { id: string; description: string; startsAt: string | null; endsAt: string | null; active: boolean; }
export interface TeachingAssignment { id: string; class: { id: string; name: string; level: string; programme: string; academicYearId: string }; subject: { id: string; code: string; name: string }; term: { id: string; code: string; name: string; startsAt: string; endsAt: string; status: string }; }
export interface StaffProfile { person: { id: string; firstName: string; middleName: string | null; lastName: string; phone: string | null; email: string | null; photoUrl: string | null }; staffIdNo: string; department: string | null; employmentStatus: string; duties: StaffDuty[]; teaching: TeachingAssignment[]; }
export interface AttendanceMark { studentId: string; status: AttendanceStatus; note?: string; }
export interface AttendanceRosterItem { student: { id: string; admissionNumber: string | null; firstName: string; lastName: string; passportPhotoUrl: string | null; status: string }; attendance: { status: AttendanceStatus; note: string | null; markedAt: string } | null; }
export interface AttendanceRoster { session: { id: string; class: { id: string; name: string }; termId: string; subjectId: string | null; sessionDate: string; periodLabel: string | null }; roster: AttendanceRosterItem[]; }
export interface AttendanceSession { id: string; termId: string; classId: string; subjectId: string | null; sessionDate: string; periodLabel: string | null; }
export interface AssessmentRosterStudent { id: string; admissionNumber: string | null; firstName: string; lastName: string; status: string; }
export interface CreatedAssessment { id: string; title: string; type: string; maxScore: string; weight: string | null; term: { code: string; name: string }; subject: { code: string; name: string }; }
export interface Announcement { id: string; title: string; body: string; audienceType: string; audienceRef: string | null; publishedAt: string | null; createdAt: string; }
export interface NotificationDelivery { id: string; channel: string; provider: string | null; status: string; createdAt: string; sentAt: string | null; deliveredAt: string | null; announcement: { id: string; title: string; body: string; audienceType: string; publishedAt: string | null } | null; }
export interface StationeryItem { id: string; sku: string; name: string; price: string | number; stockQty: number; isActive: boolean; }
export interface StationeryOrder { id: string; orderNumber: string; status: string; totalAmount: string | number; orderedAt: string; lines: Array<{ quantity: number; unitPrice: string | number; lineTotal: string | number; item: { sku: string; name: string } }>; }
export interface FinanceSummary { filters: { termId: string | null; from: string | null; to: string | null }; invoices: { count: number; open: number; partiallyPaid: number; paid: number; void: number; invoicedAmount: string; allocatedAmount: string; outstandingAmount: string }; payments: { collectedAmount: string; pendingAmount: string; totalPaymentRecords: number }; }
export interface PayrollPeriod { id: string; code: string; startsAt: string; endsAt: string; status: string; approvedAt: string | null; paidAt: string | null; staffEntryCount: number; disbursementCount: number; }
export interface PayrollPeriodEntries { period: PayrollPeriod; entries: Array<{ id: string; staffIdNo: string; staffName: string; grossPay: string; totalDeductions: string; netPay: string; status: string }>; }
export interface Expense { id: string; category: string; amount: string; currency: string; description: string | null; receiptUrl: string | null; enteredBy: string; approvedBy: string | null; status: string; createdAt: string; approvedAt: string | null; paidAt: string | null; }
export interface StudentDirectoryItem { id: string; admissionNumber: string | null; firstName: string; lastName: string; dateOfBirth: string; status: string; passportPhotoUrl: string | null; primaryGuardian: { name: string; phone: string | null; email: string | null } | null; enrolment: { academicYear: string; term: string; class: string; level: string; programme: string; status: string } | null; }
export interface StudentDetail { student: { id: string; admissionNumber: string | null; firstName: string; lastName: string; dateOfBirth: string; sex: string | null; hometown: string | null; region: string | null; passportPhotoUrl: string | null; previousSchool: string | null; status: string; admittedAt: string | null }; guardians: Array<{ relationship: string; isPrimaryContact: boolean }>; enrolments: Array<{ id: string; status: string; enrolledAt: string; completedAt: string | null; academicYear: { id: string; name: string }; term: { id: string; code: string; name: string }; class: { id: string; name: string; level: string; programme: string } }>; electives?: Array<{ id: string; termId: string; subject: { id: string; code: string; name: string; level: string; programme: string } }>; documents: Array<{ id: string; type: string; fileUrl: string; createdAt: string }>; }
export interface GuardianDirectoryItem { personId: string; name: string; phone: string | null; email: string | null; wardCount: number; }
export interface GradingBand { id?: string; code: string; lowerInclusive: string | number; upperExclusive: string | number | null; pass: boolean; descriptor: string; points: string | number | null; order: number; }
export interface GradingPolicy { id: string; version: string; name: string; academicYearId: string; level: string; programme: string | null; status: 'DRAFT' | 'ACTIVE' | 'RETIRED'; createdAt: string; publishedAt: string | null; publishedBy: string | null; bands: GradingBand[]; }
export async function listGradingPolicies(params?: { academicYearId?: string; level?: string; programme?: string }): Promise<GradingPolicy[]> { const response = await api.get<GradingPolicy[]>('/grading-policies', { params }); return response.data; }
export async function createGradingPolicy(input: { academicYearId: string; name: string; level: string; programme?: string | null; bands: Array<{ code: string; lowerInclusive: string; upperExclusive?: string; pass: boolean; descriptor: string; points?: string; order: number }> }): Promise<GradingPolicy> { const response = await api.post<GradingPolicy>('/grading-policies', input); return response.data; }
export async function updateGradingPolicy(id: string, input: { name?: string; bands?: Array<{ code: string; lowerInclusive: string; upperExclusive?: string; pass: boolean; descriptor: string; points?: string; order: number }> }): Promise<GradingPolicy> { const response = await api.patch<GradingPolicy>('/grading-policies/' + encodeURIComponent(id), input); return response.data; }
export async function publishGradingPolicy(id: string): Promise<GradingPolicy> { const response = await api.post<GradingPolicy>('/grading-policies/' + encodeURIComponent(id) + '/publish'); return response.data; }
export async function retireGradingPolicy(id: string): Promise<GradingPolicy> { const response = await api.post<GradingPolicy>('/grading-policies/' + encodeURIComponent(id) + '/retire'); return response.data; }

export interface ClassRoster { class: SchoolClass; term: AcademicTerm; count: number; students: Array<{ enrolmentId: string; student: { id: string; admissionNumber: string | null; firstName: string; lastName: string; dateOfBirth: string; sex: string | null; passportPhotoUrl: string | null; status: string }; primaryGuardian: { name: string; phone: string | null } | null }>; }

export async function login(identifier: string, password: string): Promise<AuthTokens> { const response = await api.post<AuthTokens>('/auth/login', { identifier, password }); localStorage.setItem('bci_access_token', response.data.accessToken); localStorage.setItem('bci_refresh_token', response.data.refreshToken); return response.data; }
export function logoutLocal(): void { localStorage.removeItem('bci_access_token'); localStorage.removeItem('bci_refresh_token'); }
export async function getCurrentUser(): Promise<CurrentUser> { const response = await api.get<CurrentUser>('/auth/me'); return response.data; }
export async function getMyStaffProfile(): Promise<StaffProfile> { const response = await api.get<StaffProfile>('/staff/me'); return response.data; }
export async function listNotifications(status?: string): Promise<NotificationDelivery[]> { const response = await api.get<NotificationDelivery[]>('/notifications/me', { params: status ? { status } : undefined }); return response.data; }
export async function markNotificationRead(id: string): Promise<unknown> { const response = await api.patch(`/notifications/${encodeURIComponent(id)}/read`); return response.data; }
export async function markAllNotificationsRead(): Promise<{ updatedCount: number }> { const response = await api.post<{ updatedCount: number }>('/notifications/me/read-all'); return response.data; }
export async function listStudentsDirectory(params?: { status?: string; level?: string; programme?: string; termId?: string; classId?: string; q?: string }): Promise<StudentDirectoryItem[]> { const response = await api.get<StudentDirectoryItem[]>('/students/directory', { params }); return response.data; }
export async function getStudent(id: string): Promise<StudentDetail> { const response = await api.get<StudentDetail>(`/students/${encodeURIComponent(id)}`); return response.data; }
export async function listGuardianDirectory(q?: string): Promise<GuardianDirectoryItem[]> { const response = await api.get<GuardianDirectoryItem[]>('/guardians/directory', { params: q ? { q } : undefined }); return response.data; }
export async function linkGuardian(studentId: string, input: { guardianId: string; relationship: string; isPrimaryContact?: boolean; canViewAcademic?: boolean; canPayFees?: boolean; canManageWallet?: boolean }): Promise<unknown> { const response = await api.post(`/students/${encodeURIComponent(studentId)}/guardians`, input); return response.data; }
export async function removeGuardian(studentId: string, guardianId: string): Promise<{ success: boolean }> { const response = await api.delete<{ success: boolean }>(`/students/${encodeURIComponent(studentId)}/guardians/${encodeURIComponent(guardianId)}`); return response.data; }
export async function withdrawStudent(id: string, reason: string): Promise<unknown> { const response = await api.post(`/students/${encodeURIComponent(id)}/withdraw`, { reason }); return response.data; }
export async function assignElective(studentId: string, termId: string, subjectId: string): Promise<unknown> { const response = await api.post(`/students/${encodeURIComponent(studentId)}/electives`, { termId, subjectId }); return response.data; }
export async function removeElective(studentId: string, subjectId: string, termId: string): Promise<{ success: boolean }> { const response = await api.delete<{ success: boolean }>(`/students/${encodeURIComponent(studentId)}/electives/${encodeURIComponent(subjectId)}`, { params: { termId } }); return response.data; }
export async function progressStudent(studentId: string, input: { targetTermId: string; targetClassId: string; targetLevel: string; targetProgramme: string; reason?: string }): Promise<unknown> { const response = await api.post(`/students/${encodeURIComponent(studentId)}/progress`, input); return response.data; }
export async function getClassRoster(classId: string, termId: string): Promise<ClassRoster> { const response = await api.get<ClassRoster>(`/school-classes/${encodeURIComponent(classId)}/roster`, { params: { termId } }); return response.data; }
export async function listStudentDocuments(studentId: string): Promise<StudentDetail['documents']> { const response = await api.get<StudentDetail['documents']>(`/student-records/students/${encodeURIComponent(studentId)}/documents`); return response.data; }
export async function addStudentDocument(studentId: string, input: { type: string; fileUrl: string }): Promise<unknown> { const response = await api.post(`/student-records/students/${encodeURIComponent(studentId)}/documents`, input); return response.data; }
export async function getApplicationStatus(trackingCode: string): Promise<ApplicationStatusView> { const response = await api.get<ApplicationStatusView>(`/applications/track/${encodeURIComponent(trackingCode)}`); return response.data; }
export async function listApplications(): Promise<ApplicationListItem[]> { const response = await api.get<ApplicationListItem[]>('/applications'); return response.data; }
export async function reviewApplication(id: string, status: 'UNDER_REVIEW' | 'REJECTED', reason?: string): Promise<{ id: string; trackingCode: string; status: ApplicationStatus; updatedAt: string }> { const response = await api.post(`/applications/${encodeURIComponent(id)}/review`, { status, reason }); return response.data; }
export async function listAcademicYears(): Promise<AcademicYear[]> { const response = await api.get<AcademicYear[]>('/academic-years'); return response.data; }
export async function listSchoolClasses(academicYearId: string): Promise<SchoolClass[]> { const response = await api.get<SchoolClass[]>('/school-classes', { params: { academicYearId } }); return response.data; }
export async function admitApplication(id: string, input: { academicYearId: string; termId: string; classId: string; admissionNumber?: string }): Promise<{ applicationId: string; student: { id: string; admissionNumber: string | null }; enrolment: { id: string; classId: string; termId: string } }> { const response = await api.post(`/applications/${encodeURIComponent(id)}/admit`, input); return response.data; }
export async function createAttendanceSession(input: { termId: string; classId: string; subjectId?: string; sessionDate: string; periodLabel?: string }): Promise<AttendanceSession> { const response = await api.post<AttendanceSession>('/attendance/sessions', input); return response.data; }
export async function getAttendanceRoster(sessionId: string): Promise<AttendanceRoster> { const response = await api.get<AttendanceRoster>(`/attendance/sessions/${encodeURIComponent(sessionId)}/roster`); return response.data; }
export async function markAttendance(sessionId: string, records: AttendanceMark[]): Promise<unknown[]> { const response = await api.post<unknown[]>(`/attendance/sessions/${encodeURIComponent(sessionId)}/records`, { records }); return response.data; }
export async function listAssessmentRoster(classId: string, termId: string, subjectId: string): Promise<AssessmentRosterStudent[]> { const response = await api.get<AssessmentRosterStudent[]>('/assessments/roster', { params: { classId, termId, subjectId } }); return response.data; }
export async function createAssessment(input: { termId: string; subjectId: string; title: string; type: string; maxScore: number; weight?: number }): Promise<CreatedAssessment> { const response = await api.post<CreatedAssessment>('/assessments', input); return response.data; }
export async function enterAssessmentResults(assessmentId: string, input: { results: Array<{ studentId: string; score: number; remark?: string }> }): Promise<unknown[]> { const response = await api.post<unknown[]>(`/assessments/${encodeURIComponent(assessmentId)}/results`, input); return response.data; }
export async function listAnnouncements(): Promise<Announcement[]> { const response = await api.get<Announcement[]>('/announcements'); return response.data; }
export async function createAnnouncement(input: { title: string; body: string; audienceType: string; audienceRef?: string }): Promise<Announcement> { const response = await api.post<Announcement>('/announcements', input); return response.data; }
export async function publishAnnouncement(id: string): Promise<Announcement> { const response = await api.post<Announcement>(`/announcements/${encodeURIComponent(id)}/publish`); return response.data; }
export async function listStationeryCatalog(includeInactive = false): Promise<StationeryItem[]> { const response = await api.get<StationeryItem[]>('/stationery/catalog', { params: { includeInactive } }); return response.data; }
export async function getFinanceSummary(params?: { termId?: string; from?: string; to?: string }): Promise<FinanceSummary> { const response = await api.get<FinanceSummary>('/finance/summary', { params }); return response.data; }
export async function listPayrollPeriods(): Promise<PayrollPeriod[]> { const response = await api.get<PayrollPeriod[]>('/payroll/periods'); return response.data; }
export async function getPayrollPeriodEntries(periodId: string): Promise<PayrollPeriodEntries> { const response = await api.get<PayrollPeriodEntries>(`/payroll/periods/${encodeURIComponent(periodId)}/entries`); return response.data; }
export async function calculatePayrollPeriod(periodId: string): Promise<{ periodId: string; status: string; staffCount: number }> { const response = await api.post(`/payroll/management/periods/${encodeURIComponent(periodId)}/calculate`); return response.data; }
export async function approvePayrollPeriod(periodId: string): Promise<{ periodId: string; status: string; approvedAt: string | null }> { const response = await api.post(`/payroll/management/periods/${encodeURIComponent(periodId)}/approve`); return response.data; }
export async function listExpenses(status?: string): Promise<Expense[]> { const response = await api.get<Expense[]>('/finance/expenses', { params: status ? { status } : undefined }); return response.data; }
export async function createExpense(input: { category: string; amount: number; description?: string; receiptUrl?: string }): Promise<Expense> { const response = await api.post<Expense>('/finance/expenses', input); return response.data; }
export async function submitExpense(id: string): Promise<Expense> { const response = await api.post<Expense>(`/finance/expenses/${encodeURIComponent(id)}/submit`); return response.data; }
export async function decideExpense(id: string, decision: 'APPROVED' | 'REJECTED'): Promise<Expense> { const response = await api.post<Expense>(`/finance/expenses/${encodeURIComponent(id)}/decision`, { decision }); return response.data; }