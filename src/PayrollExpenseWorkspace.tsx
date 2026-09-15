import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CurrentUser,
  approvePayrollPeriod,
  calculatePayrollPeriod,
  createExpense,
  decideExpense,
  getPayrollPeriodEntries,
  listExpenses,
  listPayrollPeriods,
  submitExpense,
} from './api/client';
import { useState } from 'react';

export function PayrollExpenseWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const queryClient = useQueryClient();
  const canPayroll = currentUser.permissions.includes('payroll.manage');
  const canFinance = currentUser.permissions.includes('finance.manage');
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');

  const periods = useQuery({ queryKey: ['payroll-periods'], queryFn: listPayrollPeriods, enabled: canPayroll });
  const entries = useQuery({ queryKey: ['payroll-period-entries', selectedPeriodId], queryFn: () => getPayrollPeriodEntries(selectedPeriodId), enabled: Boolean(selectedPeriodId) && canPayroll });
  const expenses = useQuery({ queryKey: ['expenses'], queryFn: () => listExpenses(), enabled: canFinance });

  const calculate = useMutation({ mutationFn: calculatePayrollPeriod, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll-periods'] }) });
  const approve = useMutation({ mutationFn: approvePayrollPeriod, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll-periods'] }) });
  const create = useMutation({
    mutationFn: () => createExpense({ category: expenseCategory.trim(), amount: Number(expenseAmount), description: expenseDescription.trim() || undefined }),
    onSuccess: () => { setExpenseCategory(''); setExpenseAmount(''); setExpenseDescription(''); queryClient.invalidateQueries({ queryKey: ['expenses'] }); },
  });
  const submit = useMutation({ mutationFn: submitExpense, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }) });
  const decide = useMutation({ mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) => decideExpense(id, decision), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }) });

  return (
    <>
      {canPayroll && <section className="card">
        <h2>Payroll control</h2>
        <p className="muted">Calculate draft payroll periods and approve calculated periods. Disbursement is intentionally not exposed here.</p>
        <label>Payroll period<select value={selectedPeriodId} onChange={(event) => setSelectedPeriodId(event.target.value)}><option value="">Select period</option>{periods.data?.map((period) => <option key={period.id} value={period.id}>{period.code} · {period.status}</option>)}</select></label>
        {selectedPeriodId && entries.data && <div className="table-wrap"><table><thead><tr><th>Staff</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Status</th></tr></thead><tbody>{entries.data.entries.map((entry) => <tr key={entry.id}><td>{entry.staffName} · {entry.staffIdNo}</td><td>GHS {entry.grossPay}</td><td>GHS {entry.totalDeductions}</td><td>GHS {entry.netPay}</td><td>{entry.status}</td></tr>)}</tbody></table></div>}
        {selectedPeriodId && <div className="actions"><button onClick={() => calculate.mutate(selectedPeriodId)} disabled={calculate.isPending}>Calculate selected period</button><button onClick={() => approve.mutate(selectedPeriodId)} disabled={approve.isPending}>Approve selected period</button></div>}
        {(calculate.isError || approve.isError) && <p role="alert">Payroll action was rejected by the server. Check the period state and your management permission.</p>}
      </section>}

      {canFinance && <section className="card">
        <h2>School expenses</h2>
        <p className="muted">Expenses use an explicit draft → submitted → approved/rejected lifecycle. Payment/disbursement is separate.</p>
        <div className="detail-grid"><label>Category<input value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)} /></label><label>Amount (GHS)<input type="number" min="0.01" step="0.01" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} /></label></div>
        <label>Description<textarea value={expenseDescription} onChange={(event) => setExpenseDescription(event.target.value)} /></label>
        <button onClick={() => create.mutate()} disabled={!expenseCategory.trim() || Number(expenseAmount) <= 0 || create.isPending}>Save draft expense</button>
        {expenses.data && <div className="table-wrap"><table><thead><tr><th>Category</th><th>Amount</th><th>Status</th><th>Entered</th><th>Action</th></tr></thead><tbody>{expenses.data.map((expense) => <tr key={expense.id}><td>{expense.category}</td><td>GHS {expense.amount}</td><td>{expense.status}</td><td>{new Date(expense.createdAt).toLocaleString()}</td><td>{expense.status === 'DRAFT' ? <button className="secondary" onClick={() => submit.mutate(expense.id)}>Submit</button> : expense.status === 'SUBMITTED' ? <span className="actions"><button onClick={() => decide.mutate({ id: expense.id, decision: 'APPROVED' })}>Approve</button><button className="danger" onClick={() => decide.mutate({ id: expense.id, decision: 'REJECTED' })}>Reject</button></span> : '—'}</td></tr>)}</tbody></table></div>}
        {(create.isError || submit.isError || decide.isError) && <p role="alert">Expense action was rejected. The server enforces creator/approver separation.</p>}
      </section>}
    </>
  );
}
