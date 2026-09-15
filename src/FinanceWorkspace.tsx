import { useQuery } from '@tanstack/react-query';
import { CurrentUser, getFinanceSummary } from './api/client';

export function FinanceWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const enabled = currentUser.permissions.includes('finance.read');
  const summary = useQuery({ queryKey: ['finance-summary'], queryFn: () => getFinanceSummary(), enabled, refetchInterval: 30_000 });

  if (!enabled) return null;

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h2>Finance reconciliation</h2>
          <p className="muted">Amounts below separate successfully collected money from pending or processing payment attempts.</p>
        </div>
        <span className="muted">Auto-refresh: 30s</span>
      </div>
      {summary.isLoading && <p>Loading finance summary…</p>}
      {summary.isError && <p role="alert">Finance summary could not be loaded.</p>}
      {summary.data && (
        <>
          <div className="detail-grid">
            <span><strong>Invoices</strong>{summary.data.invoices.count}</span>
            <span><strong>Open</strong>{summary.data.invoices.open}</span>
            <span><strong>Partially paid</strong>{summary.data.invoices.partiallyPaid}</span>
            <span><strong>Paid</strong>{summary.data.invoices.paid}</span>
            <span><strong>Invoiced</strong>GHS {summary.data.invoices.invoicedAmount}</span>
            <span><strong>Allocated</strong>GHS {summary.data.invoices.allocatedAmount}</span>
            <span><strong>Outstanding</strong>GHS {summary.data.invoices.outstandingAmount}</span>
            <span><strong>Collected</strong>GHS {summary.data.payments.collectedAmount}</span>
            <span><strong>Pending / processing</strong>GHS {summary.data.payments.pendingAmount}</span>
          </div>
          <p className="muted">Payment records considered: {summary.data.payments.totalPaymentRecords}. Pending and processing amounts are not included in collected.</p>
        </>
      )}
    </section>
  );
}
