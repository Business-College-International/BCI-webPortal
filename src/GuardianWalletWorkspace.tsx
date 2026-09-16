import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, CurrentUser } from './api/client';

type Ward = { id: string; firstName: string; lastName: string; canManageWallet: boolean };
type Wallet = {
  student: { id: string; admissionNumber: string | null; firstName: string; lastName: string };
  exists: boolean;
  currency: string;
  balance: string | null;
  balanceStatus: 'CALCULATED' | 'NO_WALLET' | 'LEDGER_POLICY_REQUIRED';
  transactions: Array<{ id: string; type: string; amount: string; createdAt: string; note: string | null; processedBy: string | null }>;
};

async function listWalletWards(): Promise<Ward[]> {
  const response = await api.get<Ward[]>('/students/me/wards');
  return response.data.filter((ward) => ward.canManageWallet);
}

async function getWallet(studentId: string): Promise<Wallet> {
  const response = await api.get<Wallet>(`/wallets/students/${encodeURIComponent(studentId)}`);
  return response.data;
}

export function GuardianWalletWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const wards = useQuery({ queryKey: ['guardian-wallet-wards'], queryFn: listWalletWards, enabled: currentUser.roles.includes('GUARDIAN') });
  const [studentId, setStudentId] = useState<string>('');
  const wallet = useQuery({ queryKey: ['guardian-wallet', studentId], queryFn: () => getWallet(studentId), enabled: Boolean(studentId) });

  if (!currentUser.roles.includes('GUARDIAN')) return null;

  return (
    <section className="card">
      <h2>Student wallet</h2>
      <p className="muted">View wallet funds and the office withdrawal history for a ward.</p>
      {wards.isFetching && <p>Loading wallet-enabled wards…</p>}
      {wards.data?.length === 0 && <p>No ward currently has wallet access enabled for this account.</p>}
      {wards.data && wards.data.length > 0 && (
        <label>
          Ward
          <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
            <option value="">Select a ward</option>
            {wards.data.map((ward) => <option key={ward.id} value={ward.id}>{ward.firstName} {ward.lastName}</option>)}
          </select>
        </label>
      )}
      {wallet.isFetching && <p>Loading wallet ledger…</p>}
      {wallet.isError && <p role="alert">Wallet information could not be loaded.</p>}
      {wallet.data && (
        <>
          <div className="detail-grid">
            <span><strong>Balance</strong>{wallet.data.balanceStatus === 'CALCULATED' ? `${wallet.data.currency} ${wallet.data.balance}` : wallet.data.balanceStatus.replaceAll('_', ' ')}</span>
            <span><strong>Status</strong>{wallet.data.exists ? 'Active ledger' : 'No wallet created'}</span>
          </div>
          {wallet.data.balanceStatus === 'LEDGER_POLICY_REQUIRED' && <p role="alert">This wallet contains reversal entries that require office reconciliation before a reliable balance can be displayed.</p>}
          <div className="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Note</th></tr></thead><tbody>
            {wallet.data.transactions.length === 0 && <tr><td colSpan={4}>No wallet transactions.</td></tr>}
            {wallet.data.transactions.map((transaction) => <tr key={transaction.id}><td>{new Date(transaction.createdAt).toLocaleString()}</td><td>{transaction.type}</td><td>{wallet.data.currency} {transaction.amount}</td><td>{transaction.note ?? '—'}</td></tr>)}
          </tbody></table></div>
          <p className="muted">Wallet withdrawals are processed by authorized school office staff. Guardian accounts do not directly disburse cash.</p>
        </>
      )}
    </section>
  );
}
