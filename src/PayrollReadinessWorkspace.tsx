import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { CurrentUser, api } from './api/client';

interface PayrollPeriod { id: string; code: string; startsAt: string; endsAt: string; status: string; }
interface PayrollReadiness {
  period: PayrollPeriod;
  summary: { entryCount: number; grossTotal: string; deductionsTotal: string; netTotal: string; successfulDisbursementTotal: string; outstandingDisbursementTotal: string };
  ready: boolean;
  findings: Array<{ code: string; payrollEntryId?: string; staffIdNo?: string; message: string }>;
  entries: Array<{ id: string; staffIdNo: string; staffName: string; employmentStatus: string; grossPay: string; totalDeductions: string; netPay: string; status: string; successfulDisbursementTotal: string }>;
}

async function listPayrollPeriods(): Promise<PayrollPeriod[]> {
  const response = await api.get<PayrollPeriod[]>('/payroll/periods');
  return response.data;
}
async function getReadiness(periodId: string): Promise<PayrollReadiness> {
  const response = await api.get<PayrollReadiness>(`/payroll/readiness/periods/${encodeURIComponent(periodId)}`);
  return response.data;
}

export function PayrollReadinessWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const enabled = currentUser.permissions.includes('payroll.read');
  const periods = useQuery({ queryKey: ['payroll-periods-readiness'], queryFn: listPayrollPeriods, enabled });
  const [periodId, setPeriodId] = useState('');
  const selectedPeriodId = periodId || periods.data?.[0]?.id || '';
  const readiness = useQuery({ queryKey: ['payroll-readiness', selectedPeriodId], queryFn: () => getReadiness(selectedPeriodId), enabled: enabled && Boolean(selectedPeriodId) });

  if (!enabled) return null;

  return (
    <section className="card">
      <div className="section-heading"><div><h2>Payroll readiness</h2><p className="muted">Pre-disbursement integrity checks for staff payroll.</p></div></div>
      <label>Payroll period<select value={selectedPeriodId} onChange={(event) => setPeriodId(event.target.value)}><option value="">Select a period</option>{periods.data?.map((period) => <option value={period.id} key={period.id}>{period.code} · {period.status}</option>)}</select></label>
      {periods.isError && <p role="alert">Payroll periods could not be loaded.</p>}
      {readiness.isFetching && <p>Checking payroll readiness…</p>}
      {readiness.data && <>
        <div className="detail-grid">
          <span><strong>State</strong>{readiness.data.period.status}</span>
          <span><strong>Payroll entries</strong>{readiness.data.summary.entryCount}</span>
          <span><strong>Net payroll</strong>GHS {readiness.data.summary.netTotal}</span>
          <span><strong>Successfully disbursed</strong>GHS {readiness.data.summary.successfulDisbursementTotal}</span>
          <span><strong>Outstanding</strong>GHS {readiness.data.summary.outstandingDisbursementTotal}</span>
          <span><strong>Ready for disbursement</strong>{readiness.data.ready ? 'YES' : 'NO'}</span>
        </div>
        {readiness.data.findings.length > 0 && <div><h3>Blocking findings</h3><div className="table-wrap"><table><thead><tr><th>Code</th><th>Staff</th><th>Issue</th></tr></thead><tbody>{readiness.data.findings.map((finding, index) => <tr key={`${finding.code}-${finding.payrollEntryId ?? index}`}><td>{finding.code}</td><td>{finding.staffIdNo ?? 'Period'}</td><td>{finding.message}</td></tr>)}</tbody></table></div></div>}
        <h3>Staff payment status</h3><div className="table-wrap"><table><thead><tr><th>Staff</th><th>Status</th><th>Net pay</th><th>Disbursed</th><th>Employment</th></tr></thead><tbody>{readiness.data.entries.map((entry) => <tr key={entry.id}><td>{entry.staffIdNo} · {entry.staffName}</td><td>{entry.status}</td><td>GHS {entry.netPay}</td><td>GHS {entry.successfulDisbursementTotal}</td><td>{entry.employmentStatus}</td></tr>)}</tbody></table></div>
      </>}
    </section>
  );
}
