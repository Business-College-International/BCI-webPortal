import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, CurrentUser, listStudentsDirectory, StudentDirectoryItem } from './api/client';

type Finding = { code: string; message: string; severity: 'BLOCKING' | 'WARNING' | 'INFO' };
type Completeness = {
  student: { id: string; admissionNumber: string | null; name: string; status: string };
  currentPlacement: { level: string; programme: string; class: { name: string }; term: { name: string; status: string } } | null;
  linkedGuardians: Array<{ name: string; phone: string | null; email: string | null; relationship: string; primary: boolean; canViewAcademic: boolean; canPayFees: boolean; canManageWallet: boolean }>;
  documents: Array<{ id: string; type: string; createdAt: string }>;
  score: number;
  readyForCompleteRecord: boolean;
  findings: Finding[];
};

async function getCompleteness(studentId: string): Promise<Completeness> {
  const response = await api.get<Completeness>(`/student-records/completeness/students/${encodeURIComponent(studentId)}`);
  return response.data;
}

export function StudentRecordCompletenessWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const enabled = currentUser.permissions.includes('students.read');
  const [studentId, setStudentId] = useState('');
  const students = useQuery<StudentDirectoryItem[]>({
    queryKey: ['record-completeness-students'],
    queryFn: () => listStudentsDirectory({ status: 'ACTIVE' }),
    enabled,
  });
  const completeness = useQuery({
    queryKey: ['record-completeness', studentId],
    queryFn: () => getCompleteness(studentId),
    enabled: enabled && Boolean(studentId),
  });

  if (!enabled) return null;

  return (
    <section className="card">
      <div className="section-heading"><div><h2>Student record completeness</h2><p className="muted">Read-only safeguarding and record-readiness audit.</p></div></div>
      <label>Student<select value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">Select a student</option>{students.data?.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName} · {student.admissionNumber ?? 'No admission no.'}</option>)}</select></label>
      {students.isError && <p role="alert">Student list could not be loaded.</p>}
      {completeness.isFetching && <p>Checking record completeness…</p>}
      {completeness.data && <>
        <div className="detail-grid">
          <span><strong>Student</strong>{completeness.data.student.name}</span>
          <span><strong>Admission</strong>{completeness.data.student.admissionNumber ?? 'Missing'}</span>
          <span><strong>Completeness score</strong>{completeness.data.score}%</span>
          <span><strong>Record ready</strong>{completeness.data.readyForCompleteRecord ? 'YES' : 'NO'}</span>
        </div>
        {completeness.data.currentPlacement && <p className="muted">{completeness.data.currentPlacement.class.name} · {completeness.data.currentPlacement.programme} · {completeness.data.currentPlacement.level} · {completeness.data.currentPlacement.term.name}</p>}
        {completeness.data.findings.length > 0 && <div><h3>Findings</h3><div className="table-wrap"><table><thead><tr><th>Severity</th><th>Code</th><th>Finding</th></tr></thead><tbody>{completeness.data.findings.map((finding) => <tr key={finding.code}><td>{finding.severity}</td><td>{finding.code}</td><td>{finding.message}</td></tr>)}</tbody></table></div></div>}
        <div><h3>Guardians</h3><div className="table-wrap"><table><thead><tr><th>Name</th><th>Relationship</th><th>Primary</th><th>Phone</th><th>Academic</th><th>Fees</th><th>Wallet</th></tr></thead><tbody>{completeness.data.linkedGuardians.map((guardian) => <tr key={`${guardian.name}-${guardian.relationship}`}><td>{guardian.name}</td><td>{guardian.relationship}</td><td>{guardian.primary ? 'Yes' : 'No'}</td><td>{guardian.phone ?? guardian.email ?? '—'}</td><td>{guardian.canViewAcademic ? 'Yes' : 'No'}</td><td>{guardian.canPayFees ? 'Yes' : 'No'}</td><td>{guardian.canManageWallet ? 'Yes' : 'No'}</td></tr>)}</tbody></table></div></div>
        <div><h3>Documents</h3><p>{completeness.data.documents.length} document(s) on file.</p></div>
      </>}
    </section>
  );
}
