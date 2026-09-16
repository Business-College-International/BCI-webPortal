import { useQuery } from '@tanstack/react-query';
import { CurrentUser, api } from './api/client';

type IntegrityReport = {
  generatedAt: string;
  summary: {
    invoiceCount: number;
    paymentCount: number;
    allocationCount: number;
    totalInvoiceAmount: string;
    totalSucceededAllocated: string;
  };
  findings: {
    orphanAllocations: Array<{ id: string; paymentId: string; invoiceId: string; amount: string }>;
    invalidStatusAllocations: Array<{ id: string; paymentId: string; status: string; amount: string }>;
    overAllocatedPayments: Array<{ paymentId: string; paymentAmount: string; allocatedAmount: string }>;
    statusMismatches: Array<{ invoiceId: string; invoiceNumber: string; storedStatus: string; expectedStatus: string; amountDue: string; succeededAllocated: string }>;
    succeededWithoutReceipt: Array<{ paymentId: string; amount: string; completedAt: string | null }>;
  };
  healthy: boolean;
};

async function getFinanceIntegrity(): Promise<IntegrityReport> {
  const response = await api.get<IntegrityReport>('/finance/integrity');
  return response.data;
}

export function FinanceIntegrityWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const enabled = currentUser.permissions.includes('finance.read');
  const report = useQuery({ queryKey: ['finance-integrity'], queryFn: getFinanceIntegrity, enabled });

  if (!enabled) return null;

  if (report.isLoading) {
    return <section className="card"><h2>Finance integrity</h2><p>Checking financial invariants…</p></section>;
  }
  if (report.isError || !report.data) {
    return <section className="card"><h2>Finance integrity</h2><p role="alert">The financial integrity report could not be loaded.</p></section>;
  }

  const { findings } = report.data;
  const findingCount = findings.orphanAllocations.length
    + findings.invalidStatusAllocations.length
    + findings.overAllocatedPayments.length
    + findings.statusMismatches.length
    + findings.succeededWithoutReceipt.length;

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h2>Finance integrity</h2>
          <p className="muted">Read-only reconciliation checks across invoices, payments, allocations and receipts.</p>
        </div>
        <button className="secondary" onClick={() => report.refetch()} disabled={report.isFetching}>{report.isFetching ? 'Checking…' : 'Run checks'}</button>
      </div>

      <div className="detail-grid">
        <span><strong>Invoices</strong>{report.data.summary.invoiceCount}</span>
        <span><strong>Payments</strong>{report.data.summary.paymentCount}</span>
        <span><strong>Allocations</strong>{report.data.summary.allocationCount}</span>
        <span><strong>Findings</strong>{findingCount}</span>
      </div>

      {report.data.healthy
        ? <p className="success">No financial integrity findings were detected.</p>
        : <p className="warning">{findingCount} finding(s) require finance review.</p>}

      {findings.orphanAllocations.length > 0 && <div><h3>Orphan allocations</h3>{findings.orphanAllocations.map((item) => <p key={item.id}>Allocation {item.id}: payment {item.paymentId}, invoice {item.invoiceId}, GH₵ {item.amount}</p>)}</div>}
      {findings.invalidStatusAllocations.length > 0 && <div><h3>Allocations on non-succeeded payments</h3>{findings.invalidStatusAllocations.map((item) => <p key={item.id}>Payment {item.paymentId} is {item.status}; allocated GH₵ {item.amount}.</p>)}</div>}
      {findings.overAllocatedPayments.length > 0 && <div><h3>Over-allocated payments</h3>{findings.overAllocatedPayments.map((item) => <p key={item.paymentId}>Payment {item.paymentId}: paid GH₵ {item.paymentAmount}, allocated GH₵ {item.allocatedAmount}.</p>)}</div>}
      {findings.statusMismatches.length > 0 && <div><h3>Invoice status mismatches</h3>{findings.statusMismatches.map((item) => <p key={item.invoiceId}>{item.invoiceNumber}: stored {item.storedStatus}, expected {item.expectedStatus}; succeeded allocations GH₵ {item.succeededAllocated} of GH₵ {item.amountDue}.</p>)}</div>}
      {findings.succeededWithoutReceipt.length > 0 && <div><h3>Succeeded payments without receipts</h3>{findings.succeededWithoutReceipt.map((item) => <p key={item.paymentId}>Payment {item.paymentId}: GH₵ {item.amount}.</p>)}</div>}
      <small>Generated {new Date(report.data.generatedAt).toLocaleString()}.</small>
    </section>
  );
}
