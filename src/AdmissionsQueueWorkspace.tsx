import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAdmissionQueue, admitFromQueue, reviewAdmissionApplication, AdmissionQueueItem } from './api/admissions';
import { CurrentUser } from './api/client';
import { useState } from 'react';

export function AdmissionsQueueWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const canRead = currentUser.permissions.includes('applications.read');
  const canReview = currentUser.permissions.includes('applications.review');
  const canAdmit = currentUser.permissions.includes('applications.admit');
  const queryClient = useQueryClient();
  const queue = useQuery({ queryKey: ['application-admission-queue'], queryFn: getAdmissionQueue, enabled: canRead });
  const [selectedPlacement, setSelectedPlacement] = useState<Record<string, string>>({});
  const [admissionNumbers, setAdmissionNumbers] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canRead) return null;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['application-admission-queue'] });
  };

  const startReview = async (application: AdmissionQueueItem) => {
    setBusyId(application.id);
    setError(null);
    try {
      await reviewAdmissionApplication(application.id, 'UNDER_REVIEW');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start application review.');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (application: AdmissionQueueItem) => {
    const reason = window.prompt('Reason for rejection');
    if (!reason?.trim()) return;
    setBusyId(application.id);
    setError(null);
    try {
      await reviewAdmissionApplication(application.id, 'REJECTED', reason.trim());
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reject application.');
    } finally {
      setBusyId(null);
    }
  };

  const admit = async (application: AdmissionQueueItem) => {
    const placementKey = selectedPlacement[application.id];
    const placement = application.readiness.placementOptions.find((option) => `${option.termId}:${option.classId}` === placementKey);
    if (!placement || !application.readiness.currentAcademicYearId) return;

    setBusyId(application.id);
    setError(null);
    try {
      await admitFromQueue(application.id, {
        academicYearId: application.readiness.currentAcademicYearId,
        termId: placement.termId,
        classId: placement.classId,
        admissionNumber: admissionNumbers[application.id]?.trim() || undefined,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to admit applicant.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h2>Admission Queue</h2>
          <p className="muted">Applications awaiting review or placement into the current academic year.</p>
        </div>
        <button type="button" onClick={() => void queue.refetch()} disabled={queue.isFetching}>Refresh</button>
      </div>

      {error && <p role="alert">{error}</p>}
      {queue.isLoading && <p>Loading admission queue…</p>}
      {queue.isError && <p role="alert">The admission queue could not be loaded.</p>}
      {queue.data && queue.data.length === 0 && <p className="muted">No pending or under-review applications.</p>}

      {queue.data && queue.data.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Applicant</th><th>Application</th><th>Guardian</th><th>Placement</th><th>Action</th></tr></thead>
            <tbody>
              {queue.data.map((application) => {
                const selected = selectedPlacement[application.id];
                const available = application.readiness.placementOptions.filter((option) => option.available);
                return (
                  <tr key={application.id}>
                    <td>
                      <strong>{application.firstName} {application.lastName}</strong>
                      <div className="muted">{application.levelApplied} · {application.programmeApplied}</div>
                    </td>
                    <td>
                      <div>{application.trackingCode}</div>
                      <div className="muted">{application.status} · {new Date(application.submittedAt).toLocaleDateString()}</div>
                    </td>
                    <td>
                      <div>{application.guardianName}</div>
                      <div className="muted">{application.guardianPhone}</div>
                    </td>
                    <td>
                      {application.readiness.currentAcademicYearName ? (
                        <>
                          <div className="muted">{application.readiness.currentAcademicYearName}</div>
                          <select
                            value={selected ?? ''}
                            onChange={(event) => setSelectedPlacement((current) => ({ ...current, [application.id]: event.target.value }))}
                            disabled={!canAdmit || application.status !== 'UNDER_REVIEW' || available.length === 0}
                          >
                            <option value="">Select class / term</option>
                            {application.readiness.placementOptions.map((option) => (
                              <option key={`${option.termId}:${option.classId}`} value={`${option.termId}:${option.classId}`} disabled={!option.available}>
                                {option.termName} · {option.className} · {option.occupied}/{option.capacity ?? '∞'}
                              </option>
                            ))}
                          </select>
                          {available.length === 0 && <div className="muted">No matching capacity in an open term.</div>}
                          {application.status === 'UNDER_REVIEW' && canAdmit && (
                            <input
                              value={admissionNumbers[application.id] ?? ''}
                              onChange={(event) => setAdmissionNumbers((current) => ({ ...current, [application.id]: event.target.value }))}
                              placeholder="Admission number (optional)"
                              aria-label={`Admission number for ${application.firstName} ${application.lastName}`}
                            />
                          )}
                        </>
                      ) : <span className="muted">No current academic year configured.</span>}
                    </td>
                    <td>
                      {application.status === 'PENDING' && canReview && (
                        <button type="button" onClick={() => void startReview(application)} disabled={busyId === application.id}>Review</button>
                      )}
                      {application.status === 'UNDER_REVIEW' && (
                        <div className="stacked-actions">
                          {canAdmit && <button type="button" onClick={() => void admit(application)} disabled={busyId === application.id || !selected || available.length === 0}>Admit</button>}
                          {canReview && <button type="button" onClick={() => void reject(application)} disabled={busyId === application.id}>Reject</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
