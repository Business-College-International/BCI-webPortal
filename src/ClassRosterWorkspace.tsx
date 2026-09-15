import { useEffect, useState } from 'react';
import { CurrentUser, AcademicYear, SchoolClass, getClassRoster, listAcademicYears, listSchoolClasses } from './api/client';

export function ClassRosterWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [yearId, setYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [classId, setClassId] = useState('');
  const [roster, setRoster] = useState<Awaited<ReturnType<typeof getClassRoster>> | null>(null);
  const [error, setError] = useState('');

  const enabled = currentUser.permissions.includes('academics.read');

  useEffect(() => {
    if (!enabled) return;
    listAcademicYears().then(setYears).catch(() => setError('Academic years could not be loaded.'));
  }, [enabled]);

  useEffect(() => {
    setClasses([]);
    setClassId('');
    setRoster(null);
    if (!yearId) return;
    listSchoolClasses(yearId).then(setClasses).catch(() => setError('Classes could not be loaded.'));
  }, [yearId]);

  useEffect(() => setRoster(null), [termId, classId]);

  if (!enabled) return null;
  const selectedYear = years.find((year) => year.id === yearId);
  const openTerms = selectedYear?.terms ?? [];

  async function loadRoster() {
    if (!classId || !termId) return;
    setError('');
    try {
      setRoster(await getClassRoster(classId, termId));
    } catch {
      setError('The class roster could not be loaded. Your account may not be assigned to this class.');
    }
  }

  return (
    <section className="card">
      <div className="section-heading">
        <div><h2>Class roster</h2><p className="muted">Authoritative active enrolments for the selected class and term.</p></div>
      </div>
      <div className="filter-grid">
        <label>Academic year<select value={yearId} onChange={(event) => { setYearId(event.target.value); setTermId(''); }}><option value="">Select year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label>
        <label>Term<select value={termId} onChange={(event) => setTermId(event.target.value)} disabled={!yearId}><option value="">Select term</option>{openTerms.map((term) => <option key={term.id} value={term.id}>{term.name} ({term.code})</option>)}</select></label>
        <label>Class<select value={classId} onChange={(event) => setClassId(event.target.value)} disabled={!yearId}><option value="">Select class</option>{classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}{schoolClass.division ? ` · ${schoolClass.division}` : ''} · {schoolClass.programme}</option>)}</select></label>
      </div>
      <button disabled={!classId || !termId} onClick={loadRoster}>Load roster</button>
      {error && <p role="alert">{error}</p>}
      {roster && (
        <>
          <div className="detail-grid"><span><strong>Class</strong>{roster.class.name}</span><span><strong>Programme</strong>{roster.class.programme}</span><span><strong>Students</strong>{roster.count}</span><span><strong>Capacity</strong>{roster.class.capacity ?? '—'}</span></div>
          <div className="table-wrap"><table><thead><tr><th>Student</th><th>Admission</th><th>Status</th><th>Guardian</th><th>Phone</th></tr></thead><tbody>
            {roster.students.map((item) => <tr key={item.enrolmentId}><td>{item.student.firstName} {item.student.lastName}</td><td>{item.student.admissionNumber ?? '—'}</td><td>{item.student.status}</td><td>{item.primaryGuardian?.name ?? '—'}</td><td>{item.primaryGuardian?.phone ?? '—'}</td></tr>)}
          </tbody></table></div>
        </>
      )}
    </section>
  );
}
