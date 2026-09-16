import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, CurrentUser } from './api/client';

type AuditItem = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: unknown;
  afterJson: unknown;
  createdAt: string;
};

type AuditResponse = { items: AuditItem[]; page: number; pageSize: number; total: number; totalPages: number };

async function listAudit(params: Record<string, string | number | undefined>) {
  const response = await api.get<AuditResponse>('/audit/logs', { params });
  return response.data;
}

export function AuditCenter({ currentUser }: { currentUser: CurrentUser }) {
  const enabled = currentUser.permissions.includes('audit.read');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [actorUserId, setActorUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['audit-center', action, entityType, actorUserId, from, to, page],
    queryFn: () => listAudit({ action: action || undefined, entityType: entityType || undefined, actorUserId: actorUserId || undefined, from: from || undefined, to: to || undefined, page, pageSize: 50 }),
    enabled,
  });

  if (!enabled) return null;

  return (
    <section className="card">
      <div className="section-heading">
        <div><p className="eyebrow">Compliance</p><h2>Audit Center</h2><p className="muted">Read-only history of administrative and financial changes recorded by BCI.</p></div>
      </div>
      <div className="detail-grid">
        <label>Action<select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}><option value="">All actions</option><option value="CREATE">CREATE</option><option value="UPDATE">UPDATE</option><option value="DELETE">DELETE</option><option value="APPROVE">APPROVE</option><option value="REJECT">REJECT</option><option value="LOGIN">LOGIN</option><option value="LOGOUT">LOGOUT</option><option value="DISBURSE">DISBURSE</option><option value="RECONCILE">RECONCILE</option></select></label>
        <label>Entity type<input value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} placeholder="e.g. Student" /></label>
        <label>Actor user ID<input value={actorUserId} onChange={(e) => { setActorUserId(e.target.value); setPage(1); }} /></label>
        <label>From<input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></label>
        <label>To<input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></label>
      </div>
      {query.isLoading && <p>Loading audit records…</p>}
      {query.isError && <p role="alert">Audit records could not be loaded.</p>}
      {query.data && (
        <>
          <div className="detail-grid"><span><strong>Records</strong>{query.data.total}</span><span><strong>Page</strong>{query.data.page} / {Math.max(1, query.data.totalPages)}</span></div>
          <div className="table-wrap"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>ID</th><th>Details</th></tr></thead><tbody>
            {query.data.items.map((item) => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString()}</td><td className="mono">{item.actorUserId ?? 'system'}</td><td>{item.action}</td><td>{item.entityType}</td><td className="mono">{item.entityId}</td><td><details><summary>View change</summary><div><strong>Before</strong><pre>{JSON.stringify(item.beforeJson, null, 2)}</pre><strong>After</strong><pre>{JSON.stringify(item.afterJson, null, 2)}</pre></div></details></td></tr>)}
            {query.data.items.length === 0 && <tr><td colSpan={6}>No audit records match these filters.</td></tr>}
          </tbody></table></div>
          <div className="section-heading"><button className="secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><button className="secondary" disabled={page >= query.data.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div>
        </>
      )}
    </section>
  );
}
