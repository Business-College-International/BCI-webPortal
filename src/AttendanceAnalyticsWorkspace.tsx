import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CurrentUser, listAcademicYears, listSchoolClasses, api } from './api/client';

type StudentAttendanceRow = {
  student: { id: string; admissionNumber: string | null; firstName: string; lastName: string };
  counts: { PRESENT: number; ABSENT: number; LATE: number; EXCUSED: number };
  totalMarked: number;
  attendanceRate: number | null;
};

type AttendanceSummary = {
  class: { id: string; name: string; level: string; programme: string };
  term: { id: string; code: string; name: string; startsAt: string; endsAt: string };
  sessionCount: number;
  totals: { present: number; absent: number; late: number; excused: number; totalMarked: number; attendanceRate: number | null };
  students: StudentAttendanceRow[];
};

type ChronicAbsence = {
  policy: { absenceRateThreshold: number; minimumSessions: number };
  flaggedCount: number;
  flagged: Array<StudentAttendanceRow & { absenceRate: number }>;
};

export function AttendanceAnalyticsWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const enabled = currentUser.permissions.includes('attendance.read');
  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [termId, setTermId] = useState('');

  const years = useQuery({
    queryKey: ['attendance-analytics-years'],
    queryFn: listAcademicYears,
    enabled,
  });

  const selectedYear = useMemo(
    () => years.data?.find((year) => year.id === yearId),
    [years.data, yearId],
  );

  const classes = useQuery({
    queryKey: ['attendance-analytics-classes', yearId],
    queryFn: () => listSchoolClasses(yearId),
    enabled: enabled && !!yearId,
  });

  const summary = useQuery({
    queryKey: ['attendance-analytics-summary', classId, termId],
    queryFn: async () => (await api.get<AttendanceSummary>(`/attendance/analytics/classes/${encodeURIComponent(classId)}/summary`, { params: { termId } })).data,
    enabled: enabled && !!classId && !!termId,
  });

  const chronic = useQuery({
    queryKey: ['attendance-analytics-chronic', classId, termId],
    queryFn: async () => (await api.get<ChronicAbsence>(`/attendance/analytics/classes/${encodeURIComponent(classId)}/chronic-absence`, { params: { termId, absenceRateThreshold: 0.2, minimumSessions: 5 } })).data,
    enabled: enabled && !!classId && !!termId,
  });

  if (!enabled) return null;

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h2>Attendance analytics</h2>
          <p className="muted">Term-level attendance performance and chronic-absence monitoring.</p>
        </div>
      </div>
      <div className="form-grid">
        <label>
          Academic year
          <select value={yearId} onChange={(event) => { setYearId(event.target.value); setClassId(''); setTermId(''); }}>
            <option value="">Select year</option>
            {years.data?.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? ' · Current' : ''}</option>)}
          </select>
        </label>
        <label>
          Class
          <select value={classId} onChange={(event) => { setClassId(event.target.value); setTermId(''); }} disabled={!yearId}>
            <option value="">Select class</option>
            {classes.data?.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name} · {schoolClass.level}</option>)}
          </select>
        </label>
        <label>
          Term
          <select value={termId} onChange={(event) => setTermId(event.target.value)} disabled={!selectedYear}>
            <option value="">Select term</option>
            {selectedYear?.terms.map((term) => <option key={term.id} value={term.id}>{term.name} · {term.status}</option>)}
          </select>
        </label>
      </div>

      {summary.isLoading && <p>Loading attendance analytics…</p>}
      {summary.isError && <p role="alert">Attendance analytics could not be loaded for this class and term.</p>}
      {summary.data && (
        <>
          <div className="detail-grid">
            <span><strong>Sessions</strong>{summary.data.sessionCount}</span>
            <span><strong>Marked records</strong>{summary.data.totals.totalMarked}</span>
            <span><strong>Attendance rate</strong>{summary.data.totals.attendanceRate == null ? '—' : `${summary.data.totals.attendanceRate}%`}</span>
            <span><strong>Absences</strong>{summary.data.totals.absent}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>Attendance rate</th></tr></thead>
              <tbody>
                {summary.data.students.map((student) => (
                  <tr key={student.student.id}>
                    <td>{student.student.admissionNumber ? `${student.student.admissionNumber} · ` : ''}{student.student.firstName} {student.student.lastName}</td>
                    <td>{student.counts.PRESENT}</td><td>{student.counts.ABSENT}</td><td>{student.counts.LATE}</td><td>{student.counts.EXCUSED}</td>
                    <td>{student.attendanceRate == null ? '—' : `${student.attendanceRate}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {chronic.data && (
        <div className="subsection">
          <h3>Chronic absence watchlist</h3>
          <p className="muted">Flags students with at least {chronic.data.policy.minimumSessions} marked sessions and an absence rate of at least {chronic.data.policy.absenceRateThreshold}%.</p>
          {chronic.data.flaggedCount === 0 ? <p>No students currently meet the watchlist threshold.</p> : (
            <div className="table-wrap">
              <table><thead><tr><th>Student</th><th>Absences</th><th>Sessions</th><th>Absence rate</th></tr></thead>
                <tbody>{chronic.data.flagged.map((student) => <tr key={student.student.id}><td>{student.student.firstName} {student.student.lastName}</td><td>{student.counts.ABSENT}</td><td>{student.totalMarked}</td><td>{student.absenceRate}%</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
