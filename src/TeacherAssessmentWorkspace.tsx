import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CurrentUser,
  createAssessment,
  enterAssessmentResults,
  getMyStaffProfile,
  listAssignedAssessments,
  listAssessmentRoster,
} from './api/client';

const assessmentTypes = ['CLASSWORK', 'TEST', 'EXAM', 'PROJECT', 'OTHER'] as const;
type ScoreDraft = Record<string, string>;

export function TeacherAssessmentWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const enabled = currentUser.permissions.includes('assessments.manage');
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['staff-me'], queryFn: getMyStaffProfile, enabled });
  const [assignmentId, setAssignmentId] = useState('');
  const [entryMode, setEntryMode] = useState<'new' | 'existing'>('new');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<(typeof assessmentTypes)[number]>('TEST');
  const [maxScore, setMaxScore] = useState('100');
  const [weight, setWeight] = useState('');
  const [assessmentId, setAssessmentId] = useState('');
  const [scores, setScores] = useState<ScoreDraft>({});
  const [initialScores, setInitialScores] = useState<ScoreDraft>({});
  const [message, setMessage] = useState('');

  const assignment = profile.data?.teaching.find((item) => item.id === assignmentId);

  const roster = useQuery({
    queryKey: ['assessment-roster', assignment?.class.id, assignment?.term.id, assignment?.subject.id],
    queryFn: () => listAssessmentRoster(assignment!.class.id, assignment!.term.id, assignment!.subject.id),
    enabled: Boolean(assignment),
  });

  const existingAssessments = useQuery({
    queryKey: ['assigned-assessments', assignment?.class.id, assignment?.term.id, assignment?.subject.id],
    queryFn: () => listAssignedAssessments(assignment!.class.id, assignment!.term.id, assignment!.subject.id),
    enabled: Boolean(assignment) && entryMode === 'existing',
  });

  const selectedExisting = existingAssessments.data?.find((item) => item.id === assessmentId);

  const changedScoreCount = useMemo(
    () => Object.entries(scores).filter(([studentId, value]) => {
      const trimmed = value.trim();
      return trimmed !== '' && trimmed !== (initialScores[studentId] ?? '');
    }).length,
    [scores, initialScores],
  );

  const selectAssignment = (value: string) => {
    setAssignmentId(value);
    setAssessmentId('');
    setScores({});
    setInitialScores({});
    setMessage('');
  };

  const selectMode = (mode: 'new' | 'existing') => {
    setEntryMode(mode);
    setAssessmentId('');
    setScores({});
    setInitialScores({});
    setMessage('');
  };

  const selectExistingAssessment = (id: string) => {
    const selected = existingAssessments.data?.find((item) => item.id === id);
    if (!selected) {
      setAssessmentId('');
      setScores({});
      setInitialScores({});
      return;
    }
    const nextScores = Object.fromEntries(selected.results.map((result) => [result.studentId, result.score]));
    setAssessmentId(selected.id);
    setTitle(selected.title);
    setType(selected.type as (typeof assessmentTypes)[number]);
    setMaxScore(selected.maxScore);
    setWeight(selected.weight ?? '');
    setScores(nextScores);
    setInitialScores(nextScores);
    setMessage('Existing assessment loaded. Change only the scores that need correction, then save results.');
  };

  const create = useMutation({
    mutationFn: () => createAssessment({
      termId: assignment!.term.id,
      subjectId: assignment!.subject.id,
      title: title.trim(),
      type,
      maxScore: Number(maxScore),
      ...(weight.trim() ? { weight: Number(weight) } : {}),
    }),
    onSuccess: (result) => {
      setAssessmentId(result.id);
      setScores({});
      setInitialScores({});
      setMessage(`Assessment created: ${result.title}`);
      queryClient.invalidateQueries({ queryKey: ['assigned-assessments'] });
    },
  });

  const submit = useMutation({
    mutationFn: () => enterAssessmentResults(assessmentId, {
      results: Object.entries(scores)
        .filter(([studentId, value]) => {
          const trimmed = value.trim();
          return trimmed !== '' && trimmed !== (initialScores[studentId] ?? '');
        })
        .map(([studentId, value]) => ({ studentId, score: Number(value) })),
    }),
    onSuccess: (result) => {
      setInitialScores({ ...scores });
      setMessage(`${result.length} result rows saved.`);
      queryClient.invalidateQueries({ queryKey: ['assessment-roster'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-assessments'] });
    },
  });

  if (!enabled) return null;

  return (
    <section className="card">
      <h2>Assessment entry</h2>
      <p className="muted">
        Create a new assessment or edit an existing assessment you are assigned to. Published report cards require an approved correction request before their scores can be changed.
      </p>

      <label>
        Teaching assignment
        <select value={assignmentId} onChange={(event) => selectAssignment(event.target.value)}>
          <option value="">Select class / subject / term</option>
          {profile.data?.teaching.map((item) => (
            <option key={item.id} value={item.id}>
              {item.class.name} · {item.subject.code} · {item.term.name}
            </option>
          ))}
        </select>
      </label>

      {assignment && (
        <>
          <div className="detail-grid">
            <span><strong>Class</strong>{assignment.class.name}</span>
            <span><strong>Subject</strong>{assignment.subject.code} · {assignment.subject.name}</span>
            <span><strong>Term</strong>{assignment.term.name}</span>
            <span><strong>Term status</strong>{assignment.term.status}</span>
          </div>

          <div className="detail-grid">
            <button type="button" onClick={() => selectMode('new')} disabled={entryMode === 'new'}>New assessment</button>
            <button type="button" onClick={() => selectMode('existing')} disabled={entryMode === 'existing'}>Edit existing assessment</button>
          </div>

          {entryMode === 'existing' ? (
            <>
              <label>
                Existing assessment
                <select value={assessmentId} onChange={(event) => selectExistingAssessment(event.target.value)} disabled={existingAssessments.isLoading}>
                  <option value="">Select an existing assessment</option>
                  {existingAssessments.data?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} · {item.type} · max {item.maxScore}{item.weight ? ` · ${item.weight}%` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {existingAssessments.isFetching && <p className="muted">Loading existing assessments…</p>}
              {existingAssessments.isError && <p role="alert">Existing assessments could not be loaded.</p>}
              {selectedExisting && (
                <p className="muted">
                  Editing “{selectedExisting.title}”. The server will reject any published student result that is not covered by a pending correction request.
                </p>
              )}
            </>
          ) : (
            <div className="detail-grid">
              <label>
                Assessment title
                <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="e.g. First class test" />
              </label>
              <label>
                Type
                <select value={type} onChange={(event) => setType(event.target.value as (typeof assessmentTypes)[number])}>
                  {assessmentTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                Maximum score
                <input inputMode="decimal" value={maxScore} onChange={(event) => setMaxScore(event.target.value)} />
              </label>
              <label>
                Weight (optional)
                <input inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="0–100" />
              </label>
              <button
                type="button"
                disabled={assignment.term.status !== 'OPEN' || !title.trim() || Number(maxScore) <= 0 || create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending ? 'Creating…' : assessmentId ? 'Assessment created' : 'Create assessment'}
              </button>
            </div>
          )}

          {roster.isLoading && <p>Loading active class roster…</p>}
          {roster.isError && <p role="alert">The class roster could not be loaded.</p>}

          {assessmentId && roster.data && (
            <div>
              <div className="section-heading">
                <div>
                  <h3>Results</h3>
                  <p className="muted">
                    {entryMode === 'existing'
                      ? 'Only changed non-empty scores will be submitted.'
                      : `Enter scores out of ${maxScore}. The backend independently enforces the maximum.`}
                  </p>
                </div>
                <strong>{entryMode === 'existing' ? changedScoreCount : Object.values(scores).filter((value) => value.trim() !== '').length} changed</strong>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Student</th><th>Admission no.</th><th>Score</th></tr></thead>
                  <tbody>
                    {roster.data.map((student) => (
                      <tr key={student.id}>
                        <td>{student.firstName} {student.lastName}</td>
                        <td>{student.admissionNumber ?? '—'}</td>
                        <td>
                          <input
                            aria-label={`Score for ${student.firstName} ${student.lastName}`}
                            inputMode="decimal"
                            value={scores[student.id] ?? ''}
                            onChange={(event) => setScores((current) => ({ ...current, [student.id]: event.target.value }))}
                            min="0"
                            max={maxScore}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                disabled={(entryMode === 'existing' ? changedScoreCount === 0 : Object.values(scores).every((value) => value.trim() === '')) || submit.isPending}
                onClick={() => submit.mutate()}
              >
                {submit.isPending ? 'Saving results…' : 'Save results'}
              </button>
            </div>
          )}
        </>
      )}

      {create.isError && <p role="alert">The assessment could not be created. Check that the term is open and your assignment is still valid.</p>}
      {submit.isError && <p role="alert">Results could not be saved. Published students require a pending correction request before their score can change.</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
