import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CurrentUser, listStudentsDirectory } from './api/client';
import { StudentProfilePanel } from './StudentProfilePanel';

const levels = ['', 'KG1', 'KG2', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'JHS1', 'JHS2', 'JHS3', 'SHS1', 'SHS2', 'SHS3'];
const programmes = ['', 'NONE', 'AGRIC', 'GENERAL_ARTS', 'BUSINESS', 'HOME_ECONOMICS'];
const statuses = ['', 'ACTIVE', 'GRADUATED', 'WITHDRAWN', 'TRANSFERRED'];

export function StudentDirectory({ currentUser }: { currentUser: CurrentUser }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [level, setLevel] = useState('');
  const [programme, setProgramme] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const queryParams = useMemo(() => ({
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(status ? { status } : {}),
    ...(level ? { level } : {}),
    ...(programme ? { programme } : {}),
  }), [q, status, level, programme]);

  const enabled = currentUser.permissions.includes('students.read');
  const students = useQuery({
    queryKey: ['students-directory', queryParams],
    queryFn: () => listStudentsDirectory(queryParams),
    enabled,
  });

  if (!enabled) return null;

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h2>Student directory</h2>
          <p className="muted">The server applies your staff scope before returning the roster. Teachers only see assigned classes.</p>
        </div>
        {students.isFetching && <span className="muted">Refreshing…</span>}
      </div>

      <div className="filter-grid">
        <label>Search<input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Name or admission number" /></label>
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((value) => <option key={value} value={value}>{value || 'All statuses'}</option>)}</select></label>
        <label>Level<select value={level} onChange={(event) => setLevel(event.target.value)}>{levels.map((value) => <option key={value} value={value}>{value || 'All levels'}</option>)}</select></label>
        <label>Programme<select value={programme} onChange={(event) => setProgramme(event.target.value)}>{programmes.map((value) => <option key={value} value={value}>{value || 'All programmes'}</option>)}</select></label>
      </div>

      {students.isError && <p role="alert">The student directory could not be loaded.</p>}
      {students.data && students.data.length === 0 && <p>No students match the selected filters.</p>}
      {students.data && students.data.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Admission no.</th><th>Class</th><th>Programme</th><th>Status</th><th>Primary guardian</th><th>Contact</th><th /></tr></thead>
            <tbody>
              {students.data.map((student) => (
                <tr key={student.id}>
                  <td>{student.firstName} {student.lastName}</td>
                  <td>{student.admissionNumber ?? '—'}</td>
                  <td>{student.enrolment?.class ?? '—'}</td>
                  <td>{student.enrolment?.programme ?? '—'}</td>
                  <td>{student.status}</td>
                  <td>{student.primaryGuardian?.name ?? '—'}</td>
                  <td>{student.primaryGuardian?.phone ?? student.primaryGuardian?.email ?? '—'}</td>
                  <td><button className="secondary" onClick={() => setSelectedStudentId(student.id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedStudentId && currentUser.permissions.includes('students.read') && (
        <StudentProfilePanel studentId={selectedStudentId} currentUser={currentUser} onClose={() => setSelectedStudentId(null)} />
      )}
    </section>
  );
}
