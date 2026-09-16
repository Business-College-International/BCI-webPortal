import { useEffect, useState } from 'react';
import { api, CurrentUser } from './api/client';

type Ward = { id: string; firstName: string; lastName: string; canPayFees: boolean };
type Invoice = { id: string; invoiceNumber: string; status: string; outstandingAmount: string };
type PaymentPreflight = {
  requestedAmount: string;
  selectedOutstandingAmount: string;
  allocations: Array<{ invoiceId: string; invoiceNumber: string; termId: string; amount: string }>;
  pendingPayments: { count: number; amount: string };
  reservation: { available: boolean; requiredBeforeProviderInitiation: boolean; reason: string };
};

async function listWards(): Promise<Ward[]> {
  const response = await api.get<Array<{ student: { id: string; firstName: string; lastName: string }; permissions?: { canPayFees?: boolean } }>>('/students/me/wards');
  return response.data.map((item) => ({
    id: item.student.id,
    firstName: item.student.firstName,
    lastName: item.student.lastName,
    canPayFees: item.permissions?.canPayFees ?? false,
  }));
}

async function listWardInvoices(studentId: string): Promise<Invoice[]> {
  const response = await api.get<Invoice[]>(`/finance/students/${encodeURIComponent(studentId)}/invoices`);
  return response.data;
}

async function paymentPreflight(studentId: string, invoiceIds: string[]): Promise<PaymentPreflight> {
  const response = await api.post<PaymentPreflight>(`/finance/students/${encodeURIComponent(studentId)}/payment-preflight`, { invoiceIds });
  return response.data;
}

export function GuardianFinanceReview({ currentUser }: { currentUser: CurrentUser }) {
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [review, setReview] = useState<PaymentPreflight | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser.roles.includes('GUARDIAN')) return;
    listWards().then(setWards).catch(() => setError('Ward relationships could not be loaded.'));
  }, [currentUser.roles]);

  if (!currentUser.roles.includes('GUARDIAN')) return null;

  const payableWards = wards.filter((ward) => ward.canPayFees);
  const payableInvoices = invoices.filter((invoice) =>
    (invoice.status === 'OPEN' || invoice.status === 'PARTIALLY_PAID') && Number(invoice.outstandingAmount) > 0,
  );

  const loadWard = async (id: string) => {
    setSelectedStudentId(id);
    setBusy(true);
    setError(null);
    setReview(null);
    try {
      setInvoices(await listWardInvoices(id));
    } catch {
      setInvoices([]);
      setError('Ward fee information could not be loaded.');
    } finally {
      setBusy(false);
    }
  };

  const reviewPayment = async () => {
    if (!selectedStudentId || payableInvoices.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      setReview(await paymentPreflight(selectedStudentId, payableInvoices.map((invoice) => invoice.id)));
    } catch {
      setError('The payment review could not be prepared.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2>Fee payment review</h2>
      <p className="muted">Prepare the allocation before any payment-provider transaction is permitted.</p>
      {payableWards.length === 0 && <p>No ward is currently enabled for fee payment.</p>}
      {payableWards.length > 0 && (
        <label>Ward
          <select value={selectedStudentId} onChange={(event) => loadWard(event.target.value)} disabled={busy}>
            <option value="">Select a ward</option>
            {payableWards.map((ward) => <option key={ward.id} value={ward.id}>{ward.firstName} {ward.lastName}</option>)}
          </select>
        </label>
      )}
      {selectedStudentId && (
        <button className="secondary" disabled={busy || payableInvoices.length === 0} onClick={reviewPayment}>
          {busy ? 'Working…' : 'Review payment allocation'}
        </button>
      )}
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
