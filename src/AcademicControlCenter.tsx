import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { CurrentUser, AcademicYear, SchoolClass, api } from './api/client';

type Term = AcademicYear['terms'][number];
type ClosureReadiness = {
  term: { id: string; code: string; name: string; startsAt: string; endsAt: string; status: string };
  readiness: {
    activeEnrolments: number;
    assessmentCount: number;
    assessmentResultCount: number;
    studentsWithMissingAssessmentResults: number;
    attendanceSessionCount: number;
    publishedAttendanceSessionCount: number;
    termEndReached: boolean;
  };
  blockers: string[];
};

async function listYears(): Promise<AcademicYear[]> {
  const response = await api.get<AcademicYear[]>('/academic-years');
  return response.data;
}

async function listClasses(yearId: string): Promise<SchoolClass[]> {
  const response = await api.get<SchoolClass[]>('/school-classes', { params: { academicYearId: yearId } });
  return response.data;
}

async function getClosureReadiness(termId: string): Promise<ClosureReadiness> {
  const response = await api.get<ClosureReadiness>(`/terms/${encodeURIComponent(termId)}/closure-readiness`);
  return response.data;
}

async function setCurrentYear(id: string) { await api.post(`/academic-years/${encodeURIComponent(id)}/current`); }
async function transitionTerm(id: string, status: 'OPEN' | 'CLOSED') { await api.patch(`/terms/${encodeURIComponent(id)}/status`, { status }); }
async function updateClass(id: string, input: { name?: string; division?: string; room?: string; capacity?: number }) { const response = await api.patch<SchoolClass>(`/school-classes/${encodeURIComponent(id)}`, input); return response.data; }

export function AcademicControlCenter({ currentUser }: { currentUser: CurrentUser }) {
  const enabled = currentUser.permissions.includes('academics.manage');
  const queryClient = useQueryClient();
  const [yearId, setYearId] = useState('');
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [classDraft, setClassDraft] = useState({ name: '', division: '', room: '', capacity: '' });

  const years = useQuery({ queryKey: ['academic-years-admin'], queryFn: listYears, enabled });
  const classes = useQuery({ queryKey: ['academic-classes-admin', yearId], queryFn: () => listClasses(yearId), enabled: enabled && Boolean(yearId) });
  const selectedYear = useMemo(() => years.data?.find((year) => year.id === yearId) ?? null, [years.data, yearId]);
  const currentYear = years.data?.find((year) => year.isCurrent) ?? null;

  const currentMutation = useMutation({ mutationFn: setCurrentYear, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['academic-years-admin'] }) });
  const termMutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: 'OPEN' | 'CLOSED' }) => transitionTerm(id, status), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['academic-years-admin'] }); queryClient.invalidateQueries({ queryKey: ['term-closure-readiness'] }); } });
  const classMutation = useMutation({ mutationFn: ({ id, input }: { id: string; input: { name?: string; division?: string; room?: string; capacity?: number } }) => updateClass(id, input), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['academic-classes-admin', yearId] }); setEditingClassId(null); } });

  if (!enabled) return null;

  const beginEdit = (schoolClass: SchoolClass) => {
    setEditingClassId(schoolClass.id);
    setClassDraft({ name: schoolClass.name, division: schoolClass.division ?? '', room: schoolClass.room ?? '', capacity: schoolClass.capacity === null ? '' : String(schoolClass.capacity) });
  };

  return (
    <section className="card">
      <div className="section-heading">
        <div><p className="eyebrow">Academic administration</p><h2>Academic Control Center</h2><p className="muted">Manage the authoritative school calendar and class capacity used by admissions, progression, attendance and assessments.</p></div>
      </div>
      {years.isLoading && <p>Loading academic calendar…</p>}
      {years.isError && <p role="alert">Academic calendar could not be loaded.</p>}
      {years.data && (
        <>
          <div className="detail-grid">
            <span><strong>Current academic year</strong>{currentYear?.name ?? 'Not set'}</span>
            <span><strong>Years configured</strong>{years.data.length}</span>
          </div>
          <label>Academic year<select value={yearId} onChange={(event) => setYearId(event.target.value)}><option value="">Select a year</option>{years.data.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? ' · current' : ''}</option>)}</select></label>
          {selectedYear && (
            <>
              {!selectedYear.isCurrent && <button disabled={currentMutation.isPending} onClick={() => currentMutation.mutate(selectedYear.id)}>{currentMutation.isPending ? 'Making current…' : `Make ${selectedYear.name} current`}</button>}
              <h3>Terms</h3>
              <div className="table-wrap"><table><thead><tr><th>Term</th><th>Dates</th><th>Status</th><th>Closure readiness</th><th /></tr></thead><tbody>
                {selectedYear.terms.map((term: Term) => {
                  const readinessQuery = useQuery({ queryKey: ['term-closure-readiness', term.id], queryFn: () => getClosureReadiness(term.id), enabled: term.status === 'OPEN' && enabled });
                  return <tr key={term.id}>
                    <td>{term.name} · {term.code}</td>
                    <td>{new Date(term.startsAt).toLocaleDateString()} → {new Date(term.endsAt).toLocaleDateString()}</td>
                    <td>{term.status}</td>
                    <td>{term.status === 'OPEN' && readinessQuery.data ? (readinessQuery.data.blockers.length === 0 ? 'Ready' : `${readinessQuery.data.blockers.length} blocker(s)`) : term.status === 'OPEN' ? 'Checking…' : '—'}</td>
                    <td>{term.status === 'DRAFT' && <button onClick={() => termMutation.mutate({ id: term.id, status: 'OPEN' })}>Open</button>}{term.status === 'OPEN' && <button className="danger" onClick={() => termMutation.mutate({ id: term.id, status: 'CLOSED' })}>Close</button>}</td>
                  </tr>;
                })}
              </tbody></table></div>
            </>
          )}
        </>
      )}

      {selectedYear && <>
        <h3>Classes</h3>
        {classes.isFetching && <p>Refreshing classes…</p>}
        {classes.data?.length === 0 && <p>No classes are configured for this academic year.</p>}
        {classes.data && classes.data.length > 0 && <div className="table-wrap"><table><thead><tr><th>Class</th><th>Programme</th><th>Division</th><th>Room</th><th>Capacity</th><th /></tr></thead><tbody>
          {classes.data.map((schoolClass) => editingClassId === schoolClass.id ? (
            <tr key={schoolClass.id}>
              <td><input value={classDraft.name} onChange={(e) => setClassDraft({ ...classDraft, name: e.target.value })} /></td>
              <td>{schoolClass.programme}</td>
              <td><input value={classDraft.division} onChange={(e) => setClassDraft({ ...classDraft, division: e.target.value })} /></td>
              <td><input value={classDraft.room} onChange={(e) => setClassDraft({ ...classDraft, room: e.target.value })} /></td>
              <td><input type="number" min="1" value={classDraft.capacity} onChange={(e) => setClassDraft({ ...classDraft, capacity: e.target.value })} /></td>
              <td><button disabled={classMutation.isPending} onClick={() => classMutation.mutate({ id: schoolClass.id, input: { name: classDraft.name.trim(), division: classDraft.division.trim() || undefined, room: classDraft.room.trim() || undefined, capacity: classDraft.capacity ? Number(classDraft.capacity) : undefined } })}>Save</button> <button className="secondary" onClick={() => setEditingClassId(null)}>Cancel</button></td>
            </tr>
          ) : (
            <tr key={schoolClass.id}><td>{schoolClass.name}</td><td>{schoolClass.programme}</td><td>{schoolClass.division ?? '—'}</td><td>{schoolClass.room ?? '—'}</td><td>{schoolClass.capacity ?? 'Uncapped'}</td><td><button className="secondary" onClick={() => beginEdit(schoolClass)}>Edit</button></td></tr>
          ))}
        </tbody></table></div>}
      </>}
      {(currentMutation.isError || termMutation.isError || classMutation.isError) && <p role="alert">The school calendar change was rejected by the server. Check the term/class state and try again.</p>}
    </section>
  );
}
