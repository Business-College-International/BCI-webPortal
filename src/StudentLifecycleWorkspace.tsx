import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { CurrentUser, api, listStudentsDirectory } from './api/client';

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
    queryFn: async () => (await api.get<LifecycleResponse>(`/students/${studentId}/lifecycle`)).data,
    enabled: enabled && Boolean(studentId),
  });

  if (!enabled) return null;
  return (
    <section className="card">
      <div className="section-heading"><div><h2>Student lifecycle</h2><p className="muted">Review academic history and terminal student states before applying an administrative transition.</p></div></div>
      <label>Student<select value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">Select a student</option>{students.data?.map((student) => <option key={student.id} value={student.id}>{student.lastName}, {student.firstName}{student.admissionNumber ? ` · ${student.admissionNumber}` : ''}</option>)}</select></label>
      {lifecycle.data && <>
        <div className="detail-grid"><span><strong>Student</strong>{lifecycle.data.firstName} {lifecycle.data.lastName}</span><span><strong>Status</strong>{lifecycle.data.status}</span><span><strong>Admission</strong>{lifecycle.data.admissionNumber ?? '—'}</span></div>
        <div className="table-wrap"><table><thead><tr><th>Academic year</th><th>Term</th><th>Class</th><th>Level</th><th>Status</th><th>Completed</th><th>Exit reason</th></tr></thead><tbody>{lifecycle.data.enrolments.map((entry) => <tr key={entry.id}><td>{entry.academicYear.name}</td><td>{entry.term.name}</td><td>{entry.class.name}</td><td>{entry.class.level}</td><td>{entry.status}</td><td>{entry.completedAt ? new Date(entry.completedAt).toLocaleDateString() : '—'}</td><td>{entry.exitReason ?? '—'}</td></tr>)}</tbody></table></div>
      </>}
      {lifecycle.isError && <p role="alert">The student lifecycle history could not be loaded.</p>}
    </section>
  );
}
