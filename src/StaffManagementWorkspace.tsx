import { useMemo, useState } from 'react';
import { CurrentUser } from './api/client';
import { api } from './api/client';

type StaffRow = {
  personId: string;
  staffIdNo: string;
  department: string | null;
  contractType: string | null;
  employmentStatus: string;
  person: { firstName: string; middleName: string | null; lastName: string; phone: string | null; email: string | null; photoUrl: string | null };
  user: { status: string; roles: Array<{ role: string }> } | null;
  duties: Array<{ id: string; description: string; startsAt: string | null; endsAt: string | null; active: boolean }>;
};

async function loadStaff(): Promise<StaffRow[]> {
  const response = await api.get<StaffRow[]>('/staff/directory');
  return response.data;
}

async function updateStaff(personId: string, input: { department?: string; contractType?: string; employmentStatus?: string }) {
  const response = await api.patch(`/staff-management/${encodeURIComponent(personId)}`, input);
  return response.data;
}

async function completeDuty(dutyId: string) {
  const response = await api.post(`/staff-management/duties/${encodeURIComponent(dutyId)}/complete`);
  return response.data;
}

export function StaffManagementWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const canManage = currentUser.permissions.includes('staff.manage');
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [department, setDepartment] = useState('');
  const [contractType, setContractType] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState('active');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const selected = useMemo(() => rows.find((row) => row.personId === selectedId) ?? null, [rows, selectedId]);

  if (!canManage) return null;

  async function refresh() {
    setLoading(true);
    setMessage('');
    try {
      const data = await loadStaff();
      setRows(data);
      const current = data.find((row) => row.personId === selectedId) ?? data[0];
      if (current) {
        setSelectedId(current.personId);
        setDepartment(current.department ?? '');
        setContractType(current.contractType ?? '');
        setEmploymentStatus(current.employmentStatus);
      }
    } catch {
      setMessage('Staff records could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!selected) return;
    if (employmentStatus === 'terminated' && selected.employmentStatus !== 'terminated') {
      const confirmed = window.confirm('Terminate this staff employment record? Any unresolved payroll will be rejected by the server.');
      if (!confirmed) return;
    }
    setLoading(true);
    setMessage('');
    try {
      await updateStaff(selected.personId, { department, contractType, employmentStatus });
      await refresh();
      setMessage('Staff record updated.');
    } catch {
      setMessage('The staff record could not be updated.');
    } finally {
      setLoading(false);
    }
  }

  async function finishDuty(dutyId: string) {
    setLoading(true);
    try {
      await completeDuty(dutyId);
      await refresh();
      setMessage('Duty marked complete.');
    } catch {
      setMessage('The duty could not be completed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <div className="section-heading">
        <div><h2>Staff Administration</h2><p className="muted">Manage employment records and active duties. Account roles are not changed here.</p></div>
        <button type="button" onClick={refresh} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh staff'}</button>
      </div>
      <div className="detail-grid">
        <span><strong>Staff records</strong>{rows.length}</span>
        <span><strong>Active duties</strong>{rows.reduce((sum, row) => sum + row.duties.filter((duty) => duty.active).length, 0)}</span>
        <span><strong>Selected</strong>{selected ? selected.staffIdNo : 'None'}</span>
      </div>
      <div className="form-grid">
        <label>Staff member<select value={selectedId} onChange={(event) => {
          const row = rows.find((item) => item.personId === event.target.value);
          setSelectedId(event.target.value);
          setDepartment(row?.department ?? '');
          setContractType(row?.contractType ?? '');
          setEmploymentStatus(row?.employmentStatus ?? 'active');
        }}>
          <option value="">Select staff</option>{rows.map((row) => <option key={row.personId} value={row.personId}>{row.staffIdNo} — {row.person.firstName} {row.person.lastName}</option>)}
        </select></label>
        <label>Department<input value={department} onChange={(event) => setDepartment(event.target.value)} /></label>
        <label>Contract type<input value={contractType} onChange={(event) => setContractType(event.target.value)} /></label>
        <label>Employment status<select value={employmentStatus} onChange={(event) => setEmploymentStatus(event.target.value)}>
          <option value="active">Active</option><option value="on_leave">On leave</option><option value="suspended">Suspended</option><option value="terminated">Terminated</option>
        </select></label>
      </div>
      <div className="actions"><button type="button" onClick={save} disabled={!selected || loading}>Save staff record</button></div>
      {selected && <>
        <h3>Current duties</h3>
        {selected.duties.length === 0 ? <p className="muted">No duties recorded.</p> : <div className="table-wrap"><table><thead><tr><th>Duty</th><th>Start</th><th>End</th><th>Status</th><th /></tr></thead><tbody>
          {selected.duties.map((duty) => <tr key={duty.id}><td>{duty.description}</td><td>{duty.startsAt ? new Date(duty.startsAt).toLocaleString() : '—'}</td><td>{duty.endsAt ? new Date(duty.endsAt).toLocaleString() : '—'}</td><td>{duty.active ? 'Active' : 'Completed'}</td><td>{duty.active && <button type="button" onClick={() => finishDuty(duty.id)} disabled={loading}>Complete</button>}</td></tr>)}
        </tbody></table></div>}
      </>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
