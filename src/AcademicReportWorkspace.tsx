import { useState } from 'react';
import { api, CurrentUser, approveReportCardCorrection, getCurrentReportCardPublication, listReportCardCorrections, listReportCardPublicationHistory, prepareReportCardPublication, publishReportCardPublication, ReportCardCorrectionRequest, ReportCardPublication, rejectReportCardCorrection, requestReportCardCorrection, voidReportCardPublication } from './api/client';

type ReportDraft = {
  student: { id: string; admissionNumber: string | null; firstName: string; lastName: string; status: string };
  term: { id: string; code: string; name: string; startsAt: string; endsAt: string };
  placement: { enrolmentId: string; level: string; programme: string; class: { id: string; name: string; division: string | null; room: string | null } } | null;
  calculation: { overallPercentage: number | null; mode: string; weightedAssessmentCount: number; unweightedAssessmentCount: number; totalConfiguredWeight: number | null };
  subjects: Array<{ code: string; name: string; assessmentCount: number; averagePercentage: number }>;
  assessments: Array<{ id: string; score: string; maxScore: string; percentage: number; weight: number | null; assessment: { title: string; type: string; subject: { code: string; name: string } } }>;
  attendance: { totalMarkedSessions: number; present: number; absent: number; late: number; excused: number; attendanceRate: number | null };
  grading: { assigned: boolean; reason: string };
  publication: { state: string; persisted: boolean; immutableSnapshotId: string | null };
};

export function AcademicReportWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const canRead = currentUser.permissions.includes('assessments.read');
  const canManageStudents = currentUser.permissions.includes('students.manage');
  const [studentId, setStudentId] = useState('');
  const [termId, setTermId] = useState('');
  const [report, setReport] = useState<ReportDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [publication, setPublication] = useState<ReportCardPublicationView | null>(null);
  const [publicationHistory, setPublicationHistory] = useState<ReportCardPublication[]>([]);
  const [corrections, setCorrections] = useState<ReportCardCorrectionRequest[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [correctionsLoading, setCorrectionsLoading] = useState(false);
  const [publicationBusy, setPublicationBusy] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [correctionBusyId, setCorrectionBusyId] = useState<string | null>(null);

  if (!canRead && !canManageStudents) return null;

  type ReportCardPublicationView = {
    id: string;
    publicationVersion: number;
    status: string;
    snapshotHash: string;
    gradingPolicyVersionId: string | null;
    publishedAt: string | null;
    publishedBy: string | null;
    voidedAt: string | null;
    voidedBy: string | null;
    voidReason: string | null;
    createdAt: string;
  };

  async function loadPublication(nextStudentId = studentId, nextTermId = termId) {
    if (!nextStudentId || !nextTermId) return;
    try {
      const current = await getCurrentReportCardPublication(nextStudentId, nextTermId);
      setPublication({ id: current.id, publicationVersion: current.publicationVersion, status: current.status, snapshotHash: current.snapshotHash, gradingPolicyVersionId: current.gradingPolicyVersionId, publishedAt: current.publishedAt, publishedBy: current.publishedBy, voidedAt: current.voidedAt, voidedBy: current.voidedBy, voidReason: current.voidReason, createdAt: current.createdAt });
    } catch {
      setPublication(null);
    }
  }

  async function loadPublicationHistory(nextStudentId = studentId, nextTermId = termId) {
    if (!nextStudentId || !nextTermId || !currentUser.permissions.includes('reports.publish')) return;
    setHistoryLoading(true);
    try {
      setPublicationHistory(await listReportCardPublicationHistory(nextStudentId, nextTermId));
    } catch (requestError) {
      setPublicationHistory([]);
      setError(requestError instanceof Error ? requestError.message : 'Publication history could not be loaded.');
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadCorrections(nextStudentId = studentId, nextTermId = termId) {
    if (!nextStudentId || !nextTermId) return;
    if (!currentUser.permissions.includes('reports.correction.request') && !currentUser.permissions.includes('reports.correction.review')) return;
    setCorrectionsLoading(true);
    try {
      setCorrections(await listReportCardCorrections(nextStudentId, nextTermId));
    } catch (requestError) {
      setCorrections([]);
      setError(requestError instanceof Error ? requestError.message : 'Correction requests could not be loaded.');
    } finally {
      setCorrectionsLoading(false);
    }
  }

  async function handleRequestCorrection() {
    if (!correctionReason.trim()) {
      setError('A correction reason is required.');
      return;
    }
    setCorrectionBusyId('request');
    setError('');
    try {
      await requestReportCardCorrection(studentId, termId, correctionReason.trim());
      setCorrectionReason('');
      await loadCorrections();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The correction request could not be submitted.');
    } finally {
      setCorrectionBusyId(null);
    }
  }

  async function handleCorrectionDecision(request: ReportCardCorrectionRequest, decision: 'approve' | 'reject') {
    const note = decisionNotes[request.id]?.trim() ?? '';
    if (!note) {
      setError('A decision note is required.');
      return;
    }
    setCorrectionBusyId(request.id);
    setError('');
    try {
      if (decision === 'approve') await approveReportCardCorrection(request.id, note);
      else await rejectReportCardCorrection(request.id, note);
      setDecisionNotes((current) => ({ ...current, [request.id]: '' }));
      await Promise.all([loadPublication(), loadPublicationHistory(), loadCorrections()]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The correction decision could not be saved.');
    } finally {
      setCorrectionBusyId(null);
    }
  }

  async function loadReport() {
    if (!studentId || !termId) {
      setError('Enter both a student ID and term ID.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ReportDraft>(`/academic-reports/students/${encodeURIComponent(studentId)}/terms/${encodeURIComponent(termId)}`);
      setReport(response.data);
      await loadPublication();
      await loadPublicationHistory();
      await loadCorrections();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'The academic report could not be loaded.';
      setError(message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  async function handlePrepare() {
    setPublicationBusy(true); setError('');
    try { const created = await prepareReportCardPublication(studentId, termId); setPublication({ id: created.id, publicationVersion: created.publicationVersion, status: created.status, snapshotHash: created.snapshotHash, gradingPolicyVersionId: created.gradingPolicyVersionId, publishedAt: created.publishedAt, publishedBy: created.publishedBy, voidedAt: created.voidedAt, voidedBy: created.voidedBy, voidReason: created.voidReason, createdAt: created.createdAt }); await loadPublicationHistory(); await loadCorrections(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'The report snapshot could not be prepared.'); }
    finally { setPublicationBusy(false); }
  }

  async function handlePublish() {
    if (!publication) return;
    setPublicationBusy(true); setError('');
    try { const updated = await publishReportCardPublication(publication.id); setPublication({ ...publication, status: updated.status, publishedAt: updated.publishedAt, publishedBy: updated.publishedBy }); await loadPublicationHistory(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'The report snapshot could not be published.'); }
    finally { setPublicationBusy(false); }
  }

  async function handleVoid() {
    if (!publication || !voidReason.trim()) { setError('A reason is required to void a published report card.'); return; }
    setPublicationBusy(true); setError('');
    try { const updated = await voidReportCardPublication(publication.id, voidReason.trim()); setPublication({ ...publication, status: updated.status, voidedAt: updated.voidedAt, voidedBy: updated.voidedBy, voidReason: updated.voidReason }); setVoidReason(''); await loadPublicationHistory(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'The report card could not be voided.'); }
    finally { setPublicationBusy(false); }
  }

  return (
    <section className="card">
      <h2>Academic report draft</h2>
      <p className="muted">Read-only draft view. It is not an official published report card.</p>
      <div className="form-grid">
        <label>
          Student ID
          <input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="Student UUID" />
        </label>
        <label>
          Term ID
          <input value={termId} onChange={(event) => setTermId(event.target.value)} placeholder="Term UUID" />
        </label>
      </div>
      <button type="button" onClick={loadReport} disabled={loading}>{loading ? 'Loading…' : 'Load draft report'}</button>
      {error && <p role="alert">{error}</p>}

      {report && (
        <div>
          <div className="detail-grid">
            <span><strong>Student</strong>{report.student.firstName} {report.student.lastName}</span>
            <span><strong>Admission</strong>{report.student.admissionNumber ?? '—'}</span>
            <span><strong>Term</strong>{report.term.code} · {report.term.name}</span>
            <span><strong>Placement</strong>{report.placement ? `${report.placement.class.name} · ${report.placement.level}` : 'No active enrolment'}</span>
          </div>

          <div className="detail-grid">
            <span><strong>Assessment overall</strong>{report.calculation.overallPercentage == null ? '—' : `${report.calculation.overallPercentage}%`}</span>
            <span><strong>Calculation mode</strong>{report.calculation.mode}</span>
            <span><strong>Attendance</strong>{report.attendance.attendanceRate == null ? '—' : `${report.attendance.attendanceRate}%`}</span>
            <span><strong>Publication</strong>{report.publication.state}</span>
          </div>

          <h3>Attendance</h3>
          <div className="table-wrap"><table><thead><tr><th>Total marked</th><th>Present</th><th>Late</th><th>Absent</th><th>Excused</th></tr></thead><tbody><tr><td>{report.attendance.totalMarkedSessions}</td><td>{report.attendance.present}</td><td>{report.attendance.late}</td><td>{report.attendance.absent}</td><td>{report.attendance.excused}</td></tr></tbody></table></div>

          <h3>Subject summary</h3>
          <div className="table-wrap"><table><thead><tr><th>Subject</th><th>Assessments</th><th>Average</th></tr></thead><tbody>{report.subjects.map((subject) => <tr key={subject.code}><td>{subject.code} · {subject.name}</td><td>{subject.assessmentCount}</td><td>{subject.averagePercentage}%</td></tr>)}</tbody></table></div>

          <h3>Assessment detail</h3>
          <div className="table-wrap"><table><thead><tr><th>Subject</th><th>Assessment</th><th>Score</th><th>Percent</th><th>Weight</th></tr></thead><tbody>{report.assessments.map((assessment) => <tr key={assessment.id}><td>{assessment.assessment.subject.code}</td><td>{assessment.assessment.title}</td><td>{assessment.score} / {assessment.maxScore}</td><td>{assessment.percentage}%</td><td>{assessment.weight == null ? '—' : `${assessment.weight}%`}</td></tr>)}</tbody></table></div>

          <h3>Grading and publication</h3>
          <p>{report.grading.assigned ? `Grade ${report.grading.gradeCode ?? 'assigned'} · ${report.grading.policyVersion ?? 'policy version unavailable'}.` : report.grading.reason}</p>
          <p className="muted">Live report publication state: {report.publication.state}. Persisted snapshot: {report.publication.immutableSnapshotId ?? 'none'}.</p>
          {currentUser.permissions.includes('reports.publish') && (
            <div className="card nested-card">
              <h4>Official report-card publication</h4>
              {publication && <p>Version {publication.publicationVersion} · {publication.status}{publication.publishedAt ? ` · published ${new Date(publication.publishedAt).toLocaleString()}` : ''}</p>}
              {!publication && <button type="button" onClick={handlePrepare} disabled={publicationBusy}>Prepare immutable snapshot</button>}
              {publication?.status === 'READY_FOR_PUBLICATION' && <button type="button" onClick={handlePublish} disabled={publicationBusy}>{publicationBusy ? 'Publishing…' : 'Publish report card'}</button>}
              {publication?.status === 'PUBLISHED' && <><label>Void reason<input value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Reason for voiding this published report" disabled={publicationBusy} /></label><button className="danger" type="button" onClick={handleVoid} disabled={publicationBusy || !voidReason.trim()}>Void published report</button></>}
              {publication && <p className="muted">Snapshot hash: {publication.snapshotHash}. Grading policy version: {publication.gradingPolicyVersionId ?? 'none'}.</p>}
              <div className="subsection">
                <div className="section-heading">
                  <div>
                    <h4>Publication history</h4>
                    <p className="muted">Append-only publication versions. Voided snapshots remain visible and are never reused.</p>
                  </div>
                  <button type="button" onClick={() => loadPublicationHistory()} disabled={historyLoading}>
                    {historyLoading ? 'Refreshing…' : 'Refresh history'}
                  </button>
                </div>
                {historyLoading && publicationHistory.length === 0 && <p>Loading publication history…</p>}
                {!historyLoading && publicationHistory.length === 0 && <p className="muted">No publication versions have been recorded for this student and term.</p>}
                {publicationHistory.length > 0 && (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Version</th><th>Status</th><th>Published</th><th>Voided</th><th>Policy version</th><th>Snapshot hash</th></tr></thead>
                      <tbody>
                        {publicationHistory.map((item) => (
                          <tr key={item.id}>
                            <td>{item.publicationVersion}</td>
                            <td>{item.status}</td>
                            <td>{item.publishedAt ? new Date(item.publishedAt).toLocaleString() : '—'}</td>
                            <td>{item.voidedAt ? new Date(item.voidedAt).toLocaleString() : '—'}</td>
                            <td>{item.gradingPolicyVersionId ?? '—'}</td>
                            <td><code>{item.snapshotHash}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
          {(currentUser.permissions.includes('reports.correction.request') || currentUser.permissions.includes('reports.correction.review')) && (
            <div className="card nested-card">
              <div className="section-heading">
                <div>
                  <h4>Correction requests</h4>
                  <p className="muted">Corrections never overwrite a published snapshot. Approved corrections create the next immutable publication version.</p>
                </div>
                <button type="button" onClick={() => loadCorrections()} disabled={correctionsLoading}>
                  {correctionsLoading ? 'Refreshing…' : 'Refresh requests'}
                </button>
              </div>
              {currentUser.permissions.includes('reports.correction.request') && publication?.status === 'PUBLISHED' && !corrections.some((item) => item.decision === 'PENDING') && (
                <div className="form-grid">
                  <label>
                    Correction reason
                    <input value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Explain what needs correction" disabled={correctionBusyId === 'request'} />
                  </label>
                  <button type="button" onClick={handleRequestCorrection} disabled={correctionBusyId === 'request' || !correctionReason.trim()}>
                    {correctionBusyId === 'request' ? 'Submitting…' : 'Request correction'}
                  </button>
                </div>
              )}
              {corrections.length === 0 && !correctionsLoading && <p className="muted">No correction requests have been recorded for this student and term.</p>}
              {corrections.length > 0 && (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Requested</th><th>Status</th><th>Reason</th><th>Decision note</th><th>Action</th></tr></thead>
                    <tbody>
                      {corrections.map((request) => (
                        <tr key={request.id}>
                          <td>{new Date(request.requestedAt).toLocaleString()}</td>
                          <td>{request.decision}</td>
                          <td>{request.reason}</td>
                          <td>
                            {request.decisionNote ?? '—'}
                            {currentUser.permissions.includes('reports.correction.review') && request.decision === 'PENDING' && (
                              <textarea value={decisionNotes[request.id] ?? ''} onChange={(event) => setDecisionNotes((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Decision note" disabled={correctionBusyId === request.id} />
                            )}
                          </td>
                          <td>
                            {currentUser.permissions.includes('reports.correction.review') && request.decision === 'PENDING' ? (
                              <div>
                                <button type="button" onClick={() => handleCorrectionDecision(request, 'approve')} disabled={correctionBusyId === request.id || !(decisionNotes[request.id] ?? '').trim()}>Approve & republish</button>
                                <button className="danger" type="button" onClick={() => handleCorrectionDecision(request, 'reject')} disabled={correctionBusyId === request.id || !(decisionNotes[request.id] ?? '').trim()}>Reject</button>
                              </div>
                            ) : request.approvedPublicationId ? (
                              <span>New publication: {request.approvedPublicationId}</span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}