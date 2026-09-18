import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CurrentUser, createAssessment, enterAssessmentResults, getMyStaffProfile, listAssessmentRoster } from './api/client';

const assessmentTypes = ['CLASSWORK', 'TEST', 'EXAM', 'PROJECT', 'OTHER'] as const;

type ScoreDraft = Record<string, string>;

export function TeacherAssessmentWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const enabled = currentUser.permissions.includes('assessments.manage');
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['staff-me'], queryFn: getMyStaffProfile, enabled });
  const [assignmentId, setAssignmentId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<(typeof assessmentTypes)[number]>('TEST');
  const [maxScore, setMaxScore] = useState('100');
  const [weight, setWeight] = useState('');
  const [assessmentId, setAssessmentId] = useState('');
  const [scores, setScores] = useState<ScoreDraft>({});
  const [message, setMessage] = useState('');

  const assignment = profile.data?.teaching.find((item) => item.id === assignmentId);
  const roster = useQuery({
    queryKey: ['assessment-roster', assignment?.class.id, assignment?.term.id, assignment?.subject.id],
    queryFn: () => listAssessmentRoster(assignment!.class.id, assignment!.term.id, assignment!.subject.id),
    enabled: Boolean(assignment),
  });

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
      setMessage(`Assessment created: ${result.title}`);
    },
  });

  const submit = useMutation({
    mutationFn: () => enterAssessmentResults(assessmentId, {
      results: Object.entries(scores)
        .filter(([, value]) => value.trim() !== '')
        .map(([studentId, value]) => ({ studentId, score: Number(value) })),
    }),
    onSuccess: (result) => {
      setMessage(`${result.length} results saved.`);
      queryClient.invalidateQueries({ queryKey: ['assessment-roster'] });
    },
  });

  const validScoreCount = useMemo(
    () => Object.values(scores).filter((value) => value.trim() !== '').length,
    [scores],
  );

  if (!enabled) return null;

  return (
    <section className="card">
      <h2>Assessment entry</h2>
      <p className="muted">Create an assessment for one of your assigned class/subject/term combinations, then enter scores against the authoritative class roster.</p>

      <label>
        Teaching assignment
        <select value={assignmentId} onChange={(event) => { setAssignmentId(event.target.value); setAssessmentId(''); setScores({}); setMessage(''); }}>
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
          </div>

          <button
            disabled={assignment.term.status !== 'OPEN' || !title.trim() || Number(maxScore) <= 0 || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Creating…' : assessmentId ? 'Assessment created' : 'Create assessment'}
          </button>

          {roster.isLoading && <p>Loading active class roster…</p>}
          {roster.isError && <p role="alert">The class roster could not be loaded.</p>}

          {assessmentId && roster.data && (
            <div>
              <div className="section-heading">
                <div><h3>Results</h3><p className="muted">Enter scores out of {maxScore}. The backend independently enforces the maximum.</p></div>
                <strong>{validScoreCount} entered</strong>
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
                disabled={validScoreCount === 0 || submit.isPending}
                onClick={() => submit.mutate()}
              >
                {submit.isPending ? 'Saving results…' : 'Save results'}
              </button>
            </div>
          )}
        </>
      )}

      {create.isError && <p role="alert">The assessment could not be created. Check that the term is open and your assignment is still valid.</p>}
      {submit.isError && <p role="alert">Results could not be saved. The server may have rejected a score or student that is no longer eligible.</p>}
      {message && <p>{message}</p>}
    </section>
  );
}
