import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, CurrentUser } from './api/client';

type Assignment = {
  id: string;
  staff: { person: { firstName: string; lastName: string; phone: string | null; email: string | null } };
  class: { id: string; name: string; level: string; programme: string; room: string | null };
  subject: { id: string; code: string; name: string };
  term: { id: string; code: string; name: string; startsAt: string; endsAt: string; status: string };
};

async function listAssignments(): Promise<Assignment[]> {
  const response = await api.get<Assignment[]>('/staff/teacher-assignments');
  return response.data;
}

async function unassign(id: string): Promise<void> {
  await api.post(`/staff/teacher-assignments/${encodeURIComponent(id)}/unassign`);
}

export function TeacherAssignmentManagementWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const enabled = currentUser.permissions.includes('staff.manage');
  const queryClient = useQueryClient();
  const assignments = useQuery({ queryKey: ['teacher-assignment-management'], queryFn: listAssignments, enabled });
  const removal = useMutation({
    mutationFn: unassign,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teacher-assignment-management'] }),
  });

  if (!enabled) return null;

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h2>Teacher assignment planning</h2>
          <p className="muted">Review the authoritative teacher/class/subject assignments. Closed terms remain immutable.</p>
        </div>
        <button className="secondary" onClick={() => assignments.refetch()} disabled={assignments.isFetching}>Refresh</button>
      </div>
      {assignments.isLoading && <p>Loading teacher assignments…</p>}
      {assignments.isError && <p role="alert">Teacher assignments could not be loaded.</p>}
      {assignments.data?.length === 0 && <p>No teacher assignments have been configured.</p>}
      {assignments.data && assignments.data.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Teacher</th><th>Class</th><th>Subject</th><th>Term</th><th>Status</th><th /></tr></thead>
            <tbody>
              {assignments.data.map((assignment) => {
                const locked = assignment.term.status === 'CLOSED';
                return (
                  <tr key={assignment.id}>
                    <td>{assignment.staff.person.firstName} {assignment.staff.person.lastName}</td>
                    <td>{assignment.class.name}<br /><small>{assignment.class.level} · {assignment.class.programme}{assignment.class.room ? ` · Room ${assignment.class.room}` : ''}</small></td>
                    <td>{assignment.subject.code} · {assignment.subject.name}</td>
                    <td>{assignment.term.name} ({assignment.term.code})</td>
                    <td>{assignment.term.status}</td>
                    <td>
                      <button
                        className="secondary"
                        disabled={locked || removal.isPending}
                        onClick={() => {
                          if (window.confirm(`Unassign ${assignment.staff.person.firstName} ${assignment.staff.person.lastName} from ${assignment.subject.name} / ${assignment.class.name}?`)) {
                            removal.mutate(assignment.id);
                          }
                        }}
                      >
                        {locked ? 'Locked' : 'Unassign'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {removal.isError && <p role="alert">The assignment could not be changed. The server may have locked the term or rejected the transition.</p>}
    </section>
  );
}
