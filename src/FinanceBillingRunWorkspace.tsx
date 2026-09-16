import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { CurrentUser, listAcademicYears, listSchoolClasses } from './api/client';
import { api } from './api/client';

type Candidate = { studentId: string; admissionNumber: string | null; studentName: string; className: string; level: string; programme: string; status: 'READY' | 'SKIP'; reason?: string; estimatedAmount: string };
type Preview = { term: { id: string; code: string; name: string; status: string }; candidates: Candidate[]; candidateCount: number; readyCount: number; skippedCount: number; estimatedInvoicedAmount: string };

async function previewBilling(input: { termId: string; classId?: string; dueAt?: string; includeOptional?: boolean }): Promise<Preview> {
  const response = await api.post<Preview>('/finance/billing-runs/preview', input);
  return response.data;
}
async function executeBilling(input: { termId: string; classId?: string; dueAt?: string; includeOptional?: boolean }): Promise<Preview & { issuedCount: number; invoices: Array<{ id: string; invoiceNumber: string; studentId: string; amount: string }> }> {
  const response = await api.post('/finance/billing-runs/execute', input);
  return response.data;
}

export function FinanceBillingRunWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const enabled = currentUser.permissions.includes('finance.manage');
  const [termId, setTermId] = useState('');
  const [classId, setClassId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [includeOptional, setIncludeOptional] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  const years = useQuery({ queryKey: ['billing-run-academic-years'], queryFn: listAcademicYears, enabled });
  const terms = useMemo(() => years.data?.flatMap((year) => year.terms) ?? [], [years.data]);
  const selectedTerm = terms.find((term) => term.id === termId);
  const year = years.data?.find((entry) => entry.terms.some((term) => term.id === termId));
  const classes = useQuery({ queryKey: ['billing-run-classes', year?.id], queryFn: () => listSchoolClasses(year!.id), enabled: enabled && Boolean(year?.id) });
  const previewMutation = useMutation({ mutationFn: previewBilling, onSuccess: setPreview });
  const executeMutation = useMutation({ mutationFn: executeBilling, onSuccess: (result) => setPreview(result) });

  if (!enabled) return null;

  const input = { termId, ...(classId ? { classId } : {}), ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}), includeOptional };

  return (
    <section className="card">
      <div className="section-heading"><div><h2>Billing run</h2><p className="muted">Preview and issue term invoices in one controlled batch. Students with an open/partially-paid invoice are skipped.</p></div></div>
      <div className="filter-grid">
        <label>Term<select value={termId} onChange={(e) => { setTermId(e.target.value); setClassId(''); setPreview(null); }}><option value="">Select term</option>{terms.map((term) => <option key={term.id} value={term.id}>{year?.name ? `${year.name} · ` : ''}{term.name} ({term.code})</option>)}</select></label>
        <label>Class<select value={classId} onChange={(e) => { setClassId(e.target.value); setPreview(null); }} disabled={!termId}><option value="">All active classes</option>{classes.data?.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label>
        <label>Due date<input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></label>
      </div>
      <label><input type="checkbox" checked={includeOptional} onChange={(e) => { setIncludeOptional(e.target.checked); setPreview(null); }} /> Include optional fee items</label>
      <div className="button-row">
        <button disabled={!termId || previewMutation.isPending} onClick={() => previewMutation.mutate(input)}>{previewMutation.isPending ? 'Previewing…' : 'Preview billing'}</button>
        <button className="secondary" disabled={!preview || preview.readyCount === 0 || executeMutation.isPending} onClick={() => { if (window.confirm(`Issue ${preview?.readyCount ?? 0} invoices totalling GHS ${preview?.estimatedInvoicedAmount ?? '0.00'}?`)) executeMutation.mutate(input); }}>{executeMutation.isPending ? 'Issuing…' : 'Execute billing run'}</button>
      </div>
      {(previewMutation.isError || executeMutation.isError) && <p role="alert">The billing operation could not be completed. Refresh the preview and try again.</p>}
      {preview && <>
        <div className="detail-grid">
          <span><strong>Term</strong>{preview.term.code} · {preview.term.name}</span>
          <span><strong>Candidates</strong>{preview.candidateCount}</span>
          <span><strong>Ready</strong>{preview.readyCount}</span>
          <span><strong>Skipped</strong>{preview.skippedCount}</span>
          <span><strong>Estimated amount</strong>GHS {preview.estimatedInvoicedAmount}</span>
          {'issuedCount' in preview && <span><strong>Issued</strong>{preview.issuedCount}</span>}
        </div>
        <div className="table-wrap"><table><thead><tr><th>Student</th><th>Class</th><th>Programme</th><th>Status</th><th>Amount</th><th>Reason</th></tr></thead><tbody>
          {preview.candidates.map((candidate) => <tr key={candidate.studentId}><td>{candidate.studentName}{candidate.admissionNumber ? ` · ${candidate.admissionNumber}` : ''}</td><td>{candidate.className}</td><td>{candidate.level} · {candidate.programme}</td><td>{candidate.status}</td><td>GHS {candidate.estimatedAmount}</td><td>{candidate.reason ?? '—'}</td></tr>)}
        </tbody></table></div>
      </>}
      {selectedTerm?.status === 'CLOSED' && <p role="alert">This term is closed. Billing is disabled by the server.</p>}
    </section>
  );
}
