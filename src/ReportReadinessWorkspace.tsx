import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, CurrentUser } from './api/client';

type Year = { id: string; name: string; startsAt: string; endsAt: string; isCurrent: boolean; terms: Array<{ id: string; code: string; name: string; startsAt: string; endsAt: string; status: 'DRAFT' | 'OPEN' | 'CLOSED' }> };
type SchoolClass = { id: string; name: string; level: string; programme: string; division: string | null; room: string | null };
type Readiness = {
  class: { id: string; name: string; level: string; programme: string };
  term: { id: string; name: string; status: string };
  policy: { gradingConfigured: boolean; reason: string };
  totals: { activeStudents: number; expectedAssessments: number; readyStudents: number; blockedStudents: number };
  students: Array<{ student: { id: string; admissionNumber: string | null; firstName: string; lastName: string }; ready: boolean; reasons: string[]; missingAssessments: Array<{ assessmentId: string; title: string; type: string; subject: { code: string; name: string } }> }>;
};

async function listYears(): Promise<Year[]> { const response = await api.get<Year[]>('/academic-years'); return response.data; }
async function listClasses(yearId: string): Promise<SchoolClass[]> { const response = await api.get<SchoolClass[]>('/school-classes', { params: { academicYearId: yearId } }); return response.data; }
async function getReadiness(classId: string, termId: string): Promise<Readiness> { const response = await api.get<Readiness>(`/academic-reports/readiness/classes/${encodeURIComponent(classId)}/terms/${encodeURIComponent(termId)}`); return response.data; }

export function ReportReadinessWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const enabled = currentUser.permissions.includes('assessments.read');
  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [termId, setTermId] = useState('');

  const years = useQuery({ queryKey: ['report-readiness-years'], queryFn: listYears, enabled });
  const classes = useQuery({ queryKey: ['report-readiness-classes', yearId], queryFn: () => listClasses(yearId), enabled: enabled && Boolean(yearId) });
  const selectedYear = useMemo(() => years.data?.find((year) => year.id === yearId) ?? null, [years.data, yearId]);
  const readiness = useQuery({ queryKey: ['report-readiness', classId, termId], queryFn: () => getReadiness(classId, termId), enabled: enabled && Boolean(classId && termId) });

  if (!enabled) return null;

  const selectYear = (value: string) => { setYearId(value); setClassId(''); setTermId(''); };
  const selectClass = (value: string) => { setClassId(value); setTermId(''); };

  return (
    <section className="card">
      <div className="section-heading"><div><p className="eyebrow">Academic reports</p><h2>Report publication readiness</h2><p className="muted">Identify students blocked from report publication before the official immutable snapshot workflow is enabled.</p></div></div>
      <div className="detail-grid">
        <label>Academic year<select value={yearId} onChange={(event) => selectYear(event.target.value)}><option value="">Select a year</option>{years.data?.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? ' · current' : ''}</option>)}</select></label>
        <label>Class<select value={classId} onChange={(event) => selectClass(event.target.value)} disabled={!yearId}><option value="">Select a class</option>{classes.data?.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name} · {schoolClass.level}</option>)}</select></label>
        <label>Term<select value={termId} onChange={(event) => setTermId(event.target.value)} disabled={!classId}>{selectedYear?.terms.map((term) => <option key={term.id} value={term.id}>{term.name} · {term.status}</option>)}</select></label>
      </div>
      {readiness.isFetching && <p>Calculating report readiness…</p>}
      {readiness.isError && <p role="alert">Report readiness could not be calculated for this class and term.</p>}
      {readiness.data && (
        <>
          <div className="detail-grid"><span><strong>Term state</strong>{readiness.data.term.status}</span><span><strong>Active students</strong>{readiness.data.totals.activeStudents}</span><span><strong>Ready</strong>{readiness.data.totals.readyStudents}</span><span><strong>Blocked</strong>{readiness.data.totals.blockedStudents}</span></div>
          <div className="card nested-card"><h3>Grading policy</h3><p>{readiness.data.policy.reason}</p></div>
          <div className="table-wrap"><table><thead><tr><th>Student</th><th>Status</th><th>Blockers</th><th>Missing assessments</th></tr></thead><tbody>
            {readiness.data.students.map((item) => <tr key={item.student.id}><td>{item.student.firstName} {item.student.lastName}{item.student.admissionNumber ? ` · ${item.student.admissionNumber}` : ''}</td><td>{item.ready ? 'READY' : 'BLOCKED'}</td><td>{item.reasons.length ? item.reasons.join(', ') : '—'}</td><td>{item.missingAssessments.length ? item.missingAssessments.map((assessment) => `${assessment.subject.code}: ${assessment.title}`).join('; ') : '—'}</td></tr>)}
          </tbody></table></div>
        </>
      )}
    </section>
  );
}
