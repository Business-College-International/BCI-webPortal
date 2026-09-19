import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { CurrentUser, api, listAcademicYears, listSchoolClasses, listStudentsDirectory, progressStudent } from './api/client';

interface LifecycleRecord {
  id: string;
  status: string;
  completedAt: string | null;
  enrolledAt: string;
  academicYear: { name: string };
  term: { name: string; status: string };
  class: { name: string; level: string; programme: string };
  exitReason?: string | null;
}

interface LifecycleResponse {
  id: string;
  admissionNumber: string | null;
  firstName: string;
  lastName: string;
  status: string;
  enrolments: LifecycleRecord[];
}

export function StudentLifecycleWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const enabled = currentUser.permissions.includes('students.manage');
  const [studentId, setStudentId] = useState('');
  const students = useQuery({
    queryKey: ['student-lifecycle-directory'],
    queryFn: () => listStudentsDirectory({ status: 'ACTIVE' }),
    enabled,
  });
  const lifecycle = useQuery({
    queryKey: ['student-lifecycle', studentId],
    queryFn: async () => (await api.get<LifecycleResponse>(`/students/${encodeURIComponent(studentId)}/lifecycle`)).data,
    enabled: enabled && Boolean(studentId),
  });
  const academicYears = useQuery({ queryKey: ['academic-years-for-progression'], queryFn: listAcademicYears, enabled });
  const [targetAcademicYearId, setTargetAcademicYearId] = useState('');
  const [targetTermId, setTargetTermId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [progressReason, setProgressReason] = useState('');
  const [progressing, setProgressing] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const classes = useQuery({
    queryKey: ['progression-classes', targetAcademicYearId],
    queryFn: () => listSchoolClasses(targetAcademicYearId),
    enabled: enabled && Boolean(targetAcademicYearId),
  });
  const selectedYear = academicYears.data?.find((year) => year.id === targetAcademicYearId);
  const selectedClass = classes.data?.find((item) => item.id === targetClassId);

  if (!enabled) return null;
  const handleProgress = async () => {
    if (!studentId || !targetTermId || !selectedClass) {
      setProgressMessage('Select a target term and class before progressing the student.');
      return;
    }
    setProgressing(true);
    setProgressMessage(null);
    try {
      await progressStudent(studentId, {
        targetTermId,
        targetClassId: selectedClass.id,
        targetLevel: selectedClass.level,
        targetProgramme: selectedClass.programme,
        reason: progressReason.trim() || undefined,
      });
      setProgressMessage('Student progressed successfully.');
      await lifecycle.refetch();
      setTargetTermId('');
      setTargetClassId('');
      setProgressReason('');
    } catch (error) {
      setProgressMessage(error instanceof Error ? error.message : 'The progression could not be completed.');
    } finally {
      setProgressing(false);
    }
  };

  return (
    <section className="card">
      <div className="section-heading"><div><h2>Student lifecycle</h2><p className="muted">Review academic history and terminal student states before applying an administrative transition.</p></div></div>
      <label>Student<select value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">Select a student</option>{students.data?.map((student) => <option key={student.id} value={student.id}>{student.lastName}, {student.firstName}{student.admissionNumber ? ` · ${student.admissionNumber}` : ''}</option>)}</select></label>
      {lifecycle.data && <>
        {lifecycle.data.status === 'ACTIVE' && (
          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="section-heading"><div><h3>Progress student</h3><p className="muted">Select the destination term and class. The backend rechecks term order, year consistency and capacity transactionally.</p></div></div>
            <div className="detail-grid">
              <label>Academic year<select value={targetAcademicYearId} onChange={(event) => { setTargetAcademicYearId(event.target.value); setTargetTermId(''); setTargetClassId(''); }} disabled={progressing}><option value="">Select academic year</option>{academicYears.data?.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? ' · current' : ''}</option>)}</select></label>
              <label>Target term<select value={targetTermId} onChange={(event) => setTargetTermId(event.target.value)} disabled={progressing || !selectedYear}><option value="">Select target term</option>{selectedYear?.terms.filter((term) => term.status !== 'CLOSED').map((term) => <option key={term.id} value={term.id}>{term.code} · {term.name}</option>)}</select></label>
              <label>Target class<select value={targetClassId} onChange={(event) => setTargetClassId(event.target.value)} disabled={progressing || !targetAcademicYearId}><option value="">Select target class</option>{classes.data?.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name} · {schoolClass.level}{schoolClass.programme !== 'NONE' ? ` · ${schoolClass.programme}` : ''}</option>)}</select></label>
              <label>Reason / note<input value={progressReason} onChange={(event) => setProgressReason(event.target.value)} disabled={progressing} placeholder="Optional administrative note" /></label>
            </div>
            {classes.isFetching && <p className="muted">Loading destination classes…</p>}
            {classes.isError && <p role="alert">Destination classes could not be loaded.</p>}
            {selectedClass && <p className="muted">Destination: {selectedClass.name} · {selectedClass.level} · {selectedClass.programme}</p>}
            <button type="button" onClick={handleProgress} disabled={progressing || !targetTermId || !selectedClass}>{progressing ? 'Progressing…' : 'Progress student'}</button>
            {progressMessage && <p role="status">{progressMessage}</p>}
          </div>
        )}
        <div className="detail-grid"><span><strong>Student</strong>{lifecycle.data.firstName} {lifecycle.data.lastName}</span><span><strong>Status</strong>{lifecycle.data.status}</span><span><strong>Admission</strong>{lifecycle.data.admissionNumber ?? '—'}</span></div>
        <div className="table-wrap"><table><thead><tr><th>Academic year</th><th>Term</th><th>Class</th><th>Level</th><th>Status</th><th>Completed</th><th>Exit reason</th></tr></thead><tbody>{lifecycle.data.enrolments.map((entry) => <tr key={entry.id}><td>{entry.academicYear.name}</td><td>{entry.term.name}</td><td>{entry.class.name}</td><td>{entry.class.level}</td><td>{entry.status}</td><td>{entry.completedAt ? new Date(entry.completedAt).toLocaleDateString() : '—'}</td><td>{entry.exitReason ?? '—'}</td></tr>)}</tbody></table></div>
      </>}
      {lifecycle.isError && <p role="alert">The student lifecycle history could not be loaded.</p>}
    </section>
  );
}