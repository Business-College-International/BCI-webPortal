import { useQuery } from '@tanstack/react-query';
import { CurrentUser, listStudentsDirectory } from './api/client';
import { api } from './api/client';
import { useState } from 'react';

type ReceiptHistoryItem = {
  paymentId: string;
  amount: string;
  originalAmount: string;
  refundedAmount: string;
  netAmount: string;
  currency: string;
  purpose: string;
  status: string;
  completedAt: string | null;
  provider: string | null;
  providerReference: string | null;
  receipt: { id: string; receiptNumber: string; fileUrl: string | null; issuedAt: string } | null;
  allocations: Array<{ invoiceId: string; invoiceNumber: string; termId: string; amount: string }>;
};

async function getReceiptHistory(studentId: string): Promise<ReceiptHistoryItem[]> {
  const response = await api.get<ReceiptHistoryItem[]>(`/finance/students/${encodeURIComponent(studentId)}/receipts`);
  return response.data;
}

export function FinanceReceiptsWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const canRead = currentUser.permissions.includes('finance.read');
  const canReadStudents = currentUser.permissions.includes('students.read');
  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState('');
  const students = useQuery({
    queryKey: ['finance-receipt-students', search],
    queryFn: () => listStudentsDirectory({ q: search.trim() }),
    enabled: canRead && canReadStudents && search.trim().length >= 2,
  });
  const receipts = useQuery({
    queryKey: ['finance-receipts', studentId],
    queryFn: () => getReceiptHistory(studentId),
    enabled: canRead && Boolean(studentId),
  });

  if (!canRead) return null;

  const totalOriginal = receipts.data?.reduce((sum, item) => sum + Number(item.originalAmount), 0) ?? 0;
  const totalRefunded = receipts.data?.reduce((sum, item) => sum + Number(item.refundedAmount), 0) ?? 0;
  const totalNet = receipts.data?.reduce((sum, item) => sum + Number(item.netAmount), 0) ?? 0;

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h2>Receipt & refund history</h2>
          <p className="muted">Review a student's collected fees, successful refunds and net settled amounts.</p>
        </div>
      </div>

      {!canReadStudents && <p className="muted">Your account can read finance data but does not have student-directory access for receipt lookup.</p>}

      {canReadStudents && (
        <>
          <label>
            Find student
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setStudentId(''); }}
              placeholder="Search by name, admission number or other directory field"
            />
          </label>

          {students.isFetching && <p>Searching students…</p>}
          {students.isError && <p role="alert">Student search could not be completed.</p>}
          {students.data && students.data.length > 0 && !studentId && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Student</th><th>Admission no.</th><th>Class</th><th /></tr></thead>
                <tbody>
                  {students.data.slice(0, 20).map((student) => (
                    <tr key={student.id}>
                      <td>{student.firstName} {student.lastName}</td>
                      <td>{student.admissionNumber ?? '—'}</td>
                      <td>{student.enrolment?.class ?? '—'}</td>
                      <td><button className="secondary" type="button" onClick={() => setStudentId(student.id)}>View receipts</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {studentId && (
            <>
              <div className="section-heading">
                <p className="muted">Showing receipt history for the selected student.</p>
                <button className="secondary" type="button" onClick={() => setStudentId('')}>Choose another</button>
              </div>

              {receipts.isLoading && <p>Loading receipt history…</p>}
              {receipts.isError && <p role="alert">Receipt history could not be loaded.</p>}
              {receipts.data && (
                <>
                  <div className="detail-grid">
                    <span><strong>Original collected</strong>GHS {totalOriginal.toFixed(2)}</span>
                    <span><strong>Refunded</strong>GHS {totalRefunded.toFixed(2)}</span>
                    <span><strong>Net settled</strong>GHS {totalNet.toFixed(2)}</span>
                    <span><strong>Payment records</strong>{receipts.data.length}</span>
                  </div>

                  {receipts.data.length === 0 ? (
                    <p className="muted">No successful or refunded fee payments are recorded for this student.</p>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Date</th><th>Receipt</th><th>Original</th><th>Refunded</th><th>Net</th><th>Status</th><th>Provider</th><th>Invoices</th></tr></thead>
                        <tbody>
                          {receipts.data.map((payment) => (
                            <tr key={payment.paymentId}>
                              <td>{payment.completedAt ? new Date(payment.completedAt).toLocaleString() : '—'}</td>
                              <td>{payment.receipt ? payment.receipt.receiptNumber : '—'}</td>
                              <td>{payment.currency} {payment.originalAmount}</td>
                              <td>{payment.currency} {payment.refundedAmount}</td>
                              <td><strong>{payment.currency} {payment.netAmount}</strong></td>
                              <td>{payment.status}</td>
                              <td>{payment.providerReference ? `${payment.provider ?? 'Provider'} · ${payment.providerReference}` : (payment.provider ?? '—')}</td>
                              <td>{payment.allocations.map((allocation) => `${allocation.invoiceNumber} · ${payment.currency} ${allocation.amount}`).join(', ') || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
