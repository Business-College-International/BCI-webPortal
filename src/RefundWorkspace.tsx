import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, CurrentUser } from './api/client';

type Refund = {
  id: string;
  paymentId: string;
  amount: string | number;
  currency: string;
  status: string;
  reason: string;
  requestedBy: string;
  approvedBy: string | null;
  requestedAt: string;
  completedAt: string | null;
  payment: { studentId: string | null; guardianId: string | null; amount: string | number; status: string; provider: string | null; providerReference: string | null };
};

async function listRefunds(): Promise<Refund[]> {
  const response = await api.get<Refund[]>('/finance/refunds');
  return response.data;
}

async function approveRefund(id: string): Promise<Refund> {
  const response = await api.post<Refund>(`/finance/refunds/${encodeURIComponent(id)}/approve`);
  return response.data;
}

export function RefundWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const queryClient = useQueryClient();
  const enabled = currentUser.permissions.includes('finance.manage');
  const refunds = useQuery({ queryKey: ['finance-refunds'], queryFn: listRefunds, enabled });
  const approve = useMutation({ mutationFn: approveRefund, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance-refunds'] }) });

  if (!enabled) return null;

  return (
    <section className="card">
      <div className="section-heading"><div><h2>Refund controls</h2><p className="muted">Review financial refund requests. Approval does not initiate a provider refund.</p></div><button className="secondary" onClick={() => refunds.refetch()} disabled={refunds.isFetching}>Refresh</button></div>
      {refunds.isLoading && <p>Loading refund requests…</p>}
      {refunds.isError && <p role="alert">Refund requests could not be loaded.</p>}
      {refunds.data?.length === 0 && <p>No refund requests.</p>}
      {refunds.data && refunds.data.length > 0 && (
        <div className="table-wrap"><table><thead><tr><th>Payment</th><th>Student</th><th>Amount</th><th>Status</th><th>Requested</th><th>Approved by</th><th>Action</th></tr></thead><tbody>
          {refunds.data.map((refund) => <tr key={refund.id}><td>{refund.paymentId}</td><td>{refund.payment.studentId ?? '—'}</td><td>{refund.currency} {Number(refund.amount).toFixed(2)}</td><td>{refund.status}</td><td>{new Date(refund.requestedAt).toLocaleString()}</td><td>{refund.approvedBy ?? '—'}</td><td>{refund.status === 'PENDING' && !refund.approvedBy ? <button disabled={approve.isPending || refund.requestedBy === currentUser.id} onClick={() => approve.mutate(refund.id)}>{refund.requestedBy === currentUser.id ? 'Requester cannot approve' : 'Approve'}</button> : <span className="muted">No action</span>}</td></tr>)}
        </tbody></table></div>
      )}
      {approve.isError && <p role="alert">Refund approval failed. No provider transaction was started.</p>}
    </section>
  );
}
