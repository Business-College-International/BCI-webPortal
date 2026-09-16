import { useState } from 'react';
import { api, CurrentUser } from './api/client';

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

  if (!canRead && !canManageStudents) return null;

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
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'The academic report could not be loaded.';
      setError(message);
      setReport(null);
    } finally {
      setLoading(false);
    }
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
          <p>{report.grading.assigned ? 'A grading policy has been assigned.' : report.grading.reason}</p>
          <p className="muted">Publication state: {report.publication.state}. Persisted snapshot: {report.publication.immutableSnapshotId ?? 'none'}.</p>
        </div>
      )}
    </section>
  );
}
