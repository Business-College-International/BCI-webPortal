import { useQuery } from '@tanstack/react-query';
import { api, CurrentUser } from './api/client';

type PermissionReviewItem = {
  id: string;
  userId: string;
  userStatus: string;
  roles: string[];
  permissionCode: string;
  grantType: 'GLOBAL' | 'SCOPED';
  scopeType: string | null;
  scopeId: string | null;
  grantedAt: string;
  grantedBy: string | null;
  globalRouteEffective: boolean;
  finding: string;
};

async function listPermissionReview(): Promise<PermissionReviewItem[]> {
  const response = await api.get<PermissionReviewItem[]>('/security/permission-review');
  return response.data;
}

export function PermissionReviewWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const enabled = currentUser.roles.includes('DIRECTOR') && currentUser.permissions.includes('users.manage');
  const review = useQuery({ queryKey: ['permission-review'], queryFn: listPermissionReview, enabled });

  if (!enabled) return null;

  const findings = review.data?.filter((item) => item.finding !== 'NONE') ?? [];

  return (
    <section className="card">
      <div className="section-heading"><div><h2>Permission review</h2><p className="muted">Director-only review of direct permission assignments. Scoped grants are not treated as global route permissions.</p></div><button className="secondary" onClick={() => review.refetch()} disabled={review.isFetching}>Refresh</button></div>
      {review.isLoading && <p>Loading permission assignments…</p>}
      {review.isError && <p role="alert">Permission review could not be loaded.</p>}
      {review.data && <>
        <div className="detail-grid">
          <span><strong>Total direct grants</strong>{review.data.length}</span>
          <span><strong>Scoped grants</strong>{review.data.filter((item) => item.grantType === 'SCOPED').length}</span>
          <span><strong>Review findings</strong>{findings.length}</span>
        </div>
        <div className="table-wrap"><table><thead><tr><th>User</th><th>Roles</th><th>Permission</th><th>Grant</th><th>Scope</th><th>Status</th><th>Finding</th></tr></thead><tbody>
          {review.data.map((item) => <tr key={item.id}><td>{item.userId}</td><td>{item.roles.join(', ') || '—'}</td><td>{item.permissionCode}</td><td>{item.grantType}</td><td>{item.scopeType ? `${item.scopeType}:${item.scopeId ?? '—'}` : '—'}</td><td>{item.userStatus}</td><td>{item.finding}</td></tr>)}
        </tbody></table></div>
      </>}
    </section>
  );
}
