import { api } from './client';

export type AdmissionQueueItem = {
  id: string;
  trackingCode: string;
  firstName: string;
  lastName: string;
  dob: string;
  levelApplied: string;
  programmeApplied: string;
  guardianName: string;
  guardianPhone: string;
  status: 'PENDING' | 'UNDER_REVIEW';
  submittedAt: string;
  updatedAt: string;
  readiness: {
    currentAcademicYearId: string | null;
    currentAcademicYearName: string | null;
    openTermCount: number;
    placementOptions: Array<{
      termId: string;
      termCode: string;
      termName: string;
      termStartsAt: string;
      termEndsAt: string;
      classId: string;
      className: string;
      level: string;
      programme: string;
      division: string | null;
      room: string | null;
      capacity: number | null;
      occupied: number;
      remaining: number | null;
      available: boolean;
    }>;
    availablePlacementCount: number;
    readyForPlacement: boolean;
  };
};

export async function getAdmissionQueue(): Promise<AdmissionQueueItem[]> {
  const response = await api.get<AdmissionQueueItem[]>('/applications/queue');
  return response.data;
}

export async function reviewAdmissionApplication(
  id: string,
  status: 'UNDER_REVIEW' | 'REJECTED',
  reason?: string,
): Promise<{ id: string; trackingCode: string; status: string; updatedAt: string }> {
  const response = await api.post(`/applications/${encodeURIComponent(id)}/review`, { status, reason });
  return response.data;
}

export async function admitFromQueue(
  id: string,
  input: { academicYearId: string; termId: string; classId: string; admissionNumber?: string },
) {
  const response = await api.post(`/applications/${encodeURIComponent(id)}/admit`, input);
  return response.data as { applicationId: string; student: { id: string; admissionNumber: string | null }; enrolment: { id: string } };
}
