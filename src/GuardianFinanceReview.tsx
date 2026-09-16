import { useState } from 'react';
import { api, CurrentUser } from './api/client';

type Invoice = { id: string; invoiceNumber: string; status: string; outstandingAmount: string };
type PaymentPreflight = {
  requestedAmount: string;
  selectedOutstandingAmount: string;
  allocations: Array<{ invoiceId: string; invoiceNumber: string; termId: string; amount: string }>;
  pendingPayments: { count: number; amount: string };
  reservation: { available: boolean; requiredBeforeProviderInitiation: boolean; reason: string };
};

async function listWardInvoices(studentId: string): Promise<Invoice[]> {
  const response = await api.get<Invoice[]>(`/finance/students/${encodeURIComponent(studentId)}/invoices`);
  return response.data;
}

async function paymentPreflight(studentId: string, invoiceIds: string[]): Promise<PaymentPreflight> {
  const response = await api.post<PaymentPreflight>(`/finance/students/${encodeURIComponent(studentId)}/payment-preflight`, { invoiceIds });
  return response.data;
}

export function GuardianFinanceReview({ currentUser }: { currentUser: CurrentUser }) {
  const [studentId, setStudentId] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [review, setReview] = useState<PaymentPreflight | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ward = currentUser.guardian ? null : null;

  if (!currentUser.roles.includes('GUARDIAN')) return null;

  const loadWard = async (id: string) => {
    setBusy(true);
    setError(null);
    setReview(null);
    try {
      const data = await listWardInvoices(id);
      setInvoices(data);
      setStudentId(id);
    } catch {
      setError('Ward fee information could not be loaded.');
    } finally {
      setBusy(false);
    }
  };

  const reviewPayment = async () => {
    const payable = invoices.filter((invoice) =>
      (invoice.status === 'OPEN' || invoice.status === 'PARTIALLY_PAID') && Number(invoice.outstandingAmount) > 0,
    );
    if (payable.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      setReview(await paymentPreflight(studentId, payable.map((invoice) => invoice.id)));
    } catch {
      setError('The payment review could not be prepared.');
    } finally {
      setBusy(false);
    }
  };

  const payable = invoices.filter((invoice) =>
    (invoice.status === 'OPEN' || invoice.status === 'PARTIALLY_PAID') && Number(invoice.outstandingAmount) > 0,
  );

  return (
    <section className="card">
      <h2>Fee payment review</h2>
      <p className="muted">Prepare the allocation before any payment-provider transaction is permitted.</p>
      <label>Ward student ID<input value={studentId} onChange={(event) => setStudentId(event.target.value.trim())} placeholder="Select or enter the ward student ID" /></label>
      <div className="section-heading">
        <button disabled={busy || !studentId} onClick={() => loadWard(studentId)}>{busy ? 'Loading…' : 'Load ward fees'}</button>
        <button className="secondary" disabled={busy || payable.length === 0} onClick={reviewPayment}>Review payment allocation</button>
      </div>
      {error && <p role="alert">{error}</p>}
      {invoices.length > 0 && (
        <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Status</th><th>Outstanding</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td>{invoice.invoiceNumber}</td><td>{invoice.status}</td><td>GH₵ {invoice.outstandingAmount}</td></tr>)}</tbody></table></div>
      )}
      {review && (
        <div className="card nested-card">
          <h3>Allocation preview</h3>
          <p>Amount: <strong>GH₵ {review.requestedAmount}</strong></p>
          {review.allocations.map((allocation) => <p key={allocation.invoiceId}>{allocation.invoiceNumber}: GH₵ {allocation.amount}</p>)}
          {review.pendingPayments.count > 0 && <p className="warning">There are already {review.pendingPayments.count} payment attempt(s) processing, totalling GH₵ {review.pendingPayments.amount}.</p>}
          <p>{review.reservation.available ? 'A reservation is available.' : 'Payment initiation remains disabled.'}</p>
          <p className="muted">{review.reservation.reason}</p>
        </div>
      )}
    </section>
  );
}
