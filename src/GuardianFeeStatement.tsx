import { useEffect, useState } from 'react';
import { api, CurrentUser } from './api/client';

type Ward = { id: string; firstName: string; lastName: string; canPayFees: boolean };
type Statement = {
  student: { id: string; admissionNumber: string | null; name: string };
  summary: { totalDue: string; totalPaid: string; totalOutstanding: string };
  invoices: Array<{
    invoiceId: string;
    invoiceNumber: string;
    status: string;
    issuedAt: string;
    dueAt: string | null;
    totalDue: string;
    paid: string;
    outstanding: string;
    term: { code: string; name: string };
    lines: Array<{ id: string; description: string; amountDue: string }>;
  }>;
  receipts: Array<{
    paymentId: string;
    amount: string;
    currency: string;
    purpose: string;
    completedAt: string | null;
    receipt: { receiptNumber: string; fileUrl: string | null; issuedAt: string } | null;
    allocations: Array<{ invoiceNumber: string; amount: string }>;
  }>;
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

export function GuardianFeeStatement({ currentUser }: { currentUser: CurrentUser }) {
  const [wards, setWards] = useState<Ward[]>([]);
  const [studentId, setStudentId] = useState('');
  const [statement, setStatement] = useState<Statement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser.roles.includes('GUARDIAN')) return;
    listWards().then(setWards).catch(() => setError('Ward relationships could not be loaded.'));
  }, [currentUser.roles]);

  if (!currentUser.roles.includes('GUARDIAN')) return null;

  const payableWards = wards.filter((ward) => ward.canPayFees);
  const loadStatement = async (id: string) => {
    setStudentId(id);
    setStatement(null);
    setError(null);
    if (!id) return;
    setBusy(true);
    try {
      const response = await api.get<Statement>(`/finance/students/${encodeURIComponent(id)}/statement`);
      setStatement(response.data);
    } catch {
      setError('The fee statement could not be loaded.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <div className="section-heading">
        <div><h2>Fee statement & receipts</h2><p className="muted">Charges, successful payments, outstanding balances and issued receipts in one view.</p></div>
        {busy && <span className="muted">Loading…</span>}
      </div>
      {payableWards.length === 0 && <p>No ward is currently enabled for fee statement access.</p>}
      {payableWards.length > 0 && <label>Ward<select value={studentId} onChange={(event) => loadStatement(event.target.value)} disabled={busy}><option value="">Select a ward</option>{payableWards.map((ward) => <option key={ward.id} value={ward.id}>{ward.firstName} {ward.lastName}</option>)}</select></label>}
      {error && <p role="alert">{error}</p>}
      {statement && <>
        <div className="detail-grid">
          <span><strong>Total billed</strong>GH₵ {statement.summary.totalDue}</span>
          <span><strong>Total paid</strong>GH₵ {statement.summary.totalPaid}</span>
          <span><strong>Outstanding</strong>GH₵ {statement.summary.totalOutstanding}</span>
          <span><strong>Admission no.</strong>{statement.student.admissionNumber ?? '—'}</span>
        </div>
        <h3>Invoices</h3>
        {statement.invoices.length === 0 ? <p>No invoices have been issued.</p> : <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Term</th><th>Status</th><th>Billed</th><th>Paid</th><th>Outstanding</th><th>Due</th></tr></thead><tbody>{statement.invoices.map((invoice) => <tr key={invoice.invoiceId}><td>{invoice.invoiceNumber}</td><td>{invoice.term.name} ({invoice.term.code})</td><td>{invoice.status}</td><td>GH₵ {invoice.totalDue}</td><td>GH₵ {invoice.paid}</td><td>GH₵ {invoice.outstanding}</td><td>{invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString() : '—'}</td></tr>)}</tbody></table></div>}
        <h3>Receipts</h3>
        {statement.receipts.length === 0 ? <p>No successful fee payments have been recorded.</p> : <div className="table-wrap"><table><thead><tr><th>Receipt</th><th>Amount</th><th>Completed</th><th>Purpose</th><th>Invoices</th><th>Receipt file</th></tr></thead><tbody>{statement.receipts.map((receipt) => <tr key={receipt.paymentId}><td>{receipt.receipt?.receiptNumber ?? 'Pending receipt'}</td><td>{receipt.currency} {receipt.amount}</td><td>{receipt.completedAt ? new Date(receipt.completedAt).toLocaleString() : '—'}</td><td>{receipt.purpose}</td><td>{receipt.allocations.map((allocation) => `${allocation.invoiceNumber}: GH₵ ${allocation.amount}`).join(' · ') || '—'}</td><td>{receipt.receipt?.fileUrl ? <a href={receipt.receipt.fileUrl} target="_blank" rel="noreferrer">Open</a> : '—'}</td></tr>)}</tbody></table></div>}
      </>}
    </section>
  );
}
