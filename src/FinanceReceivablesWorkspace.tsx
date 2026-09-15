import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CurrentUser } from './api/client';
import { api } from './api/client';

type ReceivableInvoice = {
  id: string;
  invoiceNumber: string;
  student: { admissionNumber: string | null; firstName: string; lastName: string };
  term: { id: string; code: string; name: string };
  status: string;
  issuedAt: string;
  dueAt: string | null;
  totalAmount: string;
  allocatedAmount: string;
  outstandingAmount: string;
};

type Ageing = {
  asOf: string;
  totals: { current: string; days1to30: string; days31to60: string; days61to90: string; over90: string; outstanding: string };
  rows: Array<{ invoiceId: string; invoiceNumber: string; student: { admissionNumber: string | null; firstName: string; lastName: string }; dueAt: string | null; outstandingAmount: string; bucket: string }>;
};

async function listReceivables(): Promise<ReceivableInvoice[]> {
  const response = await api.get<ReceivableInvoice[]>('/finance/receivables/invoices');
  return response.data;
}

async function getAgeing(): Promise<Ageing> {
  const response = await api.get<Ageing>('/finance/receivables/ageing');
  return response.data;
}

async function voidInvoice(invoiceId: string, reason: string) {
  const response = await api.patch(`/finance/receivables/invoices/${encodeURIComponent(invoiceId)}/void`, { reason });
  return response.data;
}

export function FinanceReceivablesWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const canRead = currentUser.permissions.includes('finance.read');
  const canManage = currentUser.permissions.includes('finance.manage');
  const queryClient = useQueryClient();
  const receivables = useQuery({ queryKey: ['finance-receivables'], queryFn: listReceivables, enabled: canRead });
  const ageing = useQuery({ queryKey: ['finance-ageing'], queryFn: getAgeing, enabled: canRead });
  const voidMutation = useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => voidInvoice(id, reason), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['finance-receivables'] }); queryClient.invalidateQueries({ queryKey: ['finance-ageing'] }); } });

  if (!canRead) return null;

  return (
    <section className="card">
      <div className="section-heading"><div><h2>Finance receivables</h2><p className="muted">Open and partially-paid invoices, outstanding balances and ageing.</p></div><button className="secondary" onClick={() => { receivables.refetch(); ageing.refetch(); }}>Refresh</button></div>
      {ageing.data && <div className="detail-grid">
        <span><strong>Current</strong>GHS {ageing.data.totals.current}</span>
        <span><strong>1–30 days</strong>GHS {ageing.data.totals.days1to30}</span>
        <span><strong>31–60 days</strong>GHS {ageing.data.totals.days31to60}</span>
        <span><strong>61–90 days</strong>GHS {ageing.data.totals.days61to90}</span>
        <span><strong>90+ days</strong>GHS {ageing.data.totals.over90}</span>
        <span><strong>Total outstanding</strong>GHS {ageing.data.totals.outstanding}</span>
      </div>}
      {receivables.isLoading && <p>Loading receivables…</p>}
      {receivables.isError && <p role="alert">Receivables could not be loaded.</p>}
      {receivables.data && <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Student</th><th>Term</th><th>Status</th><th>Outstanding</th><th>Due</th><th /></tr></thead><tbody>
        {receivables.data.map((invoice) => <tr key={invoice.id}><td>{invoice.invoiceNumber}</td><td>{invoice.student.firstName} {invoice.student.lastName}{invoice.student.admissionNumber ? ` · ${invoice.student.admissionNumber}` : ''}</td><td>{invoice.term.code}</td><td>{invoice.status}</td><td>GHS {invoice.outstandingAmount}</td><td>{invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString() : '—'}</td><td>{canManage && invoice.status !== 'VOID' && invoice.outstandingAmount !== '0.00' && <button className="secondary" onClick={() => { const reason = window.prompt('Reason for voiding this invoice:'); if (reason?.trim()) voidMutation.mutate({ id: invoice.id, reason: reason.trim() }); }}>{voidMutation.isPending ? 'Saving…' : 'Void'}</button>}</td></tr>)}
      </tbody></table></div>}
      {voidMutation.isError && <p role="alert">The invoice could not be voided. Invoices with allocated payments must use the payment/refund workflow.</p>}
    </section>
  );
}
