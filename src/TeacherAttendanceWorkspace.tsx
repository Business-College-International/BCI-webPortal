import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AttendanceMark,
  AttendanceStatus,
  TeachingAssignment,
  createAttendanceSession,
  getAttendanceRoster,
  markAttendance,
} from './api/client';

export function TeacherAttendanceWorkspace({ assignments }: { assignments: TeachingAssignment[] }) {
  const teacherAssignments = assignments.filter((assignment) => assignment.term.status !== 'CLOSED');
  const [assignmentId, setAssignmentId] = useState(teacherAssignments[0]?.id ?? '');
  const [sessionId, setSessionId] = useState('');
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodLabel, setPeriodLabel] = useState('');
  const queryClient = useQueryClient();

  const selected = teacherAssignments.find((item) => item.id === assignmentId);
  const roster = useQuery({
    queryKey: ['attendance-roster', sessionId],
    queryFn: () => getAttendanceRoster(sessionId),
    enabled: Boolean(sessionId),
  });

  const createSession = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select a teaching assignment first.');
      return createAttendanceSession({
        termId: selected.term.id,
        classId: selected.class.id,
        subjectId: selected.subject.id,
        sessionDate: date,
        periodLabel: periodLabel.trim() || undefined,
      });
    },
    onSuccess: (session) => {
      setSessionId(session.id);
      queryClient.invalidateQueries({ queryKey: ['attendance-roster', session.id] });
    },
  });

  const saveAttendance = useMutation({
    mutationFn: async () => {
      if (!sessionId || !roster.data) throw new Error('Open an attendance session first.');
      const records: AttendanceMark[] = roster.data.roster.map(({ student, attendance }) => ({
        studentId: student.id,
        status: statuses[student.id] ?? attendance?.status ?? 'PRESENT',
      }));
      return markAttendance(sessionId, records);
    },
    onSuccess: () => roster.refetch(),
  });

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of roster.data?.roster ?? []) {
      const status = statuses[item.student.id] ?? item.attendance?.status ?? 'PRESENT';
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }, [roster.data, statuses]);

  if (teacherAssignments.length === 0) {
    return <section className="card"><h2>Attendance</h2><p>No open-term teaching assignments are available for attendance.</p></section>;
  }

  return (
    <section className="card">
      <h2>Take attendance</h2>
      <p className="muted">The roster comes from active enrolments. The server re-checks teacher assignment and student membership when you save.</p>

      <div className="detail-grid">
        <label>
          Class / subject
          <select value={assignmentId} onChange={(event) => { setAssignmentId(event.target.value); setSessionId(''); setStatuses({}); }}>
            {teacherAssignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.class.name} · {assignment.subject.code} · {assignment.term.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Session date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label>
          Period label
          <input value={periodLabel} onChange={(event) => setPeriodLabel(event.target.value)} maxLength={80} placeholder="e.g. Period 1" />
        </label>
      </div>

      {!sessionId && (
        <button disabled={createSession.isPending || !selected} onClick={() => createSession.mutate()}>
          {createSession.isPending ? 'Opening session…' : 'Open attendance session'}
        </button>
      )}
      {createSession.isError && <p role="alert">The session could not be opened. Confirm the term is open and the assignment is still valid.</p>}

      {sessionId && (
        <>
          {roster.isFetching && <p>Loading authoritative class roster…</p>}
          {roster.isError && <p role="alert">The roster could not be loaded.</p>}
          {roster.data && (
            <>
              <div className="detail-grid">
                <span><strong>Present</strong>{statusCounts.PRESENT ?? 0}</span>
                <span><strong>Absent</strong>{statusCounts.ABSENT ?? 0}</span>
                <span><strong>Late</strong>{statusCounts.LATE ?? 0}</span>
                <span><strong>Excused</strong>{statusCounts.EXCUSED ?? 0}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Student</th><th>Admission no.</th><th>Status</th></tr></thead>
                  <tbody>
                    {roster.data.roster.map(({ student, attendance }) => {
                      const status = statuses[student.id] ?? attendance?.status ?? 'PRESENT';
                      return (
                        <tr key={student.id}>
                          <td>{student.firstName} {student.lastName}</td>
                          <td>{student.admissionNumber ?? '—'}</td>
                          <td>
                            <select
                              value={status}
                              onChange={(event) => setStatuses((current) => ({ ...current, [student.id]: event.target.value as AttendanceStatus }))}
                            >
                              <option value="PRESENT">Present</option>
                              <option value="ABSENT">Absent</option>
                              <option value="LATE">Late</option>
                              <option value="EXCUSED">Excused</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="actions">
                <button disabled={saveAttendance.isPending} onClick={() => saveAttendance.mutate()}>
                  {saveAttendance.isPending ? 'Saving attendance…' : 'Save attendance'}
                </button>
                {saveAttendance.isSuccess && <span>Saved to the authoritative school record.</span>}
              </div>
              {saveAttendance.isError && <p role="alert">Attendance could not be saved. The server may have rejected a changed assignment or roster.</p>}
            </>
          )}
        </>
      )}
    </section>
  );
}
