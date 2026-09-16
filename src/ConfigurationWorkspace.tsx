import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { listAcademicYears, CurrentUser } from './api/client';
import { createFeeSchedule, createSubject, listFeeSchedules, listSubjects, updateFeeSchedule, updateSubject } from './api/configuration';

const levels = ['KG1','KG2','P1','P2','P3','P4','P5','P6','JHS1','JHS2','JHS3','SHS1','SHS2','SHS3'];
const programmes = ['NONE','AGRIC','GENERAL_ARTS','BUSINESS','HOME_ECONOMICS'];

export function ConfigurationWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const canAcademic = currentUser.permissions.includes('academics.manage');
  const canFinance = currentUser.permissions.includes('finance.manage');
  const queryClient = useQueryClient();
  const [subjectForm, setSubjectForm] = useState({ code: '', name: '', level: 'SHS1', programme: 'NONE', isElective: false });
  const [termId, setTermId] = useState('');
  const [feeForm, setFeeForm] = useState({ level: 'SHS1', programme: 'NONE', itemCode: '', itemName: '', amount: '', isOptional: false });

  const subjects = useQuery({ queryKey: ['configuration-subjects'], queryFn: () => listSubjects({ isActive: true }), enabled: canAcademic });
  const academicYears = useQuery({ queryKey: ['configuration-academic-years'], queryFn: listAcademicYears, enabled: canFinance });
  const selectedYear = academicYears.data?.find((year) => year.terms.some((term) => term.id === termId));
  const terms = academicYears.data?.flatMap((year) => year.terms) ?? [];
  const fees = useQuery({ queryKey: ['fee-schedules', termId], queryFn: () => listFeeSchedules(termId), enabled: canFinance && Boolean(termId) });

  const addSubject = useMutation({ mutationFn: () => createSubject({ ...subjectForm, isElective: subjectForm.isElective }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['configuration-subjects'] }); setSubjectForm({ code: '', name: '', level: 'SHS1', programme: 'NONE', isElective: false }); } });
  const toggleSubject = useMutation({ mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateSubject(id, { isActive }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['configuration-subjects'] }) });
  const addFee = useMutation({ mutationFn: () => createFeeSchedule({ termId, level: feeForm.level, programme: feeForm.programme, itemCode: feeForm.itemCode, itemName: feeForm.itemName, amount: Number(feeForm.amount), isOptional: feeForm.isOptional }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fee-schedules', termId] }); setFeeForm({ level: 'SHS1', programme: 'NONE', itemCode: '', itemName: '', amount: '', isOptional: false }); } });
  const editFee = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { itemName?: string; isOptional?: boolean; isActive?: boolean } }) => updateFeeSchedule(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fee-schedules', termId] }),
  });

  if (!canAcademic && !canFinance) return null;

  return <section className="card">
    <div className="section-heading"><div><h2>School configuration</h2><p className="muted">Manage the authoritative subject catalogue and fee schedules. Server permissions remain decisive.</p></div></div>

    {canAcademic && <div className="card nested-card">
      <h3>Subject catalogue</h3>
      <div className="filter-grid">
        <label>Code<input value={subjectForm.code} onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })} placeholder="e.g. MAT" /></label>
        <label>Name<input value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} placeholder="Mathematics" /></label>
        <label>Level<select value={subjectForm.level} onChange={(e) => setSubjectForm({ ...subjectForm, level: e.target.value })}>{levels.map((level) => <option key={level}>{level}</option>)}</select></label>
        <label>Programme<select value={subjectForm.programme} onChange={(e) => setSubjectForm({ ...subjectForm, programme: e.target.value })}>{programmes.map((programme) => <option key={programme}>{programme}</option>)}</select></label>
      </div>
      <label><input type="checkbox" checked={subjectForm.isElective} onChange={(e) => setSubjectForm({ ...subjectForm, isElective: e.target.checked })} /> Elective subject</label>
      <button disabled={!subjectForm.code.trim() || !subjectForm.name.trim() || addSubject.isPending} onClick={() => addSubject.mutate()}>{addSubject.isPending ? 'Adding…' : 'Add subject'}</button>
      {addSubject.isError && <p role="alert">Subject could not be created.</p>}
      {subjects.data && <div className="table-wrap"><table><thead><tr><th>Code</th><th>Subject</th><th>Level</th><th>Programme</th><th>Elective</th><th>Status</th><th /></tr></thead><tbody>{subjects.data.map((subject) => <tr key={subject.id}><td>{subject.code}</td><td>{subject.name}</td><td>{subject.level}</td><td>{subject.programme}</td><td>{subject.isElective ? 'Yes' : 'No'}</td><td>{subject.isActive ? 'Active' : 'Inactive'}</td><td><button className="secondary" disabled={toggleSubject.isPending} onClick={() => toggleSubject.mutate({ id: subject.id, isActive: !subject.isActive })}>{subject.isActive ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div>}
    </div>}

    {canFinance && <div className="card nested-card">
      <h3>Fee schedules</h3>
      <label>Term<select value={termId} onChange={(e) => setTermId(e.target.value)}><option value="">Select term</option>{terms.map((term) => <option key={term.id} value={term.id}>{selectedYear?.name ? `${selectedYear.name} · ` : ''}{term.name} ({term.code})</option>)}</select></label>
      {termId && <>
        <div className="filter-grid">
          <label>Level<select value={feeForm.level} onChange={(e) => setFeeForm({ ...feeForm, level: e.target.value })}>{levels.map((level) => <option key={level}>{level}</option>)}</select></label>
          <label>Programme<select value={feeForm.programme} onChange={(e) => setFeeForm({ ...feeForm, programme: e.target.value })}>{programmes.map((programme) => <option key={programme}>{programme}</option>)}</select></label>
          <label>Item code<input value={feeForm.itemCode} onChange={(e) => setFeeForm({ ...feeForm, itemCode: e.target.value })} placeholder="TUITION" /></label>
          <label>Item name<input value={feeForm.itemName} onChange={(e) => setFeeForm({ ...feeForm, itemName: e.target.value })} placeholder="Tuition fees" /></label>
          <label>Amount (GHS)<input type="number" min="0" step="0.01" value={feeForm.amount} onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })} /></label>
        </div>
        <label><input type="checkbox" checked={feeForm.isOptional} onChange={(e) => setFeeForm({ ...feeForm, isOptional: e.target.checked })} /> Optional charge</label>
        <button disabled={!feeForm.itemCode.trim() || !feeForm.itemName.trim() || feeForm.amount === '' || addFee.isPending} onClick={() => addFee.mutate()}>{addFee.isPending ? 'Adding…' : 'Add fee item'}</button>
        {addFee.isError && <p role="alert">Fee schedule item could not be created.</p>}
        {fees.data && <div className="table-wrap"><table><thead><tr><th>Code</th><th>Item</th><th>Level</th><th>Programme</th><th>Amount</th><th>Optional</th><th>Status</th><th /></tr></thead><tbody>{fees.data.map((fee) => <tr key={fee.id}><td>{fee.itemCode}</td><td>{fee.itemName}</td><td>{fee.level}</td><td>{fee.programme}</td><td>{fee.amount}</td><td>{fee.isOptional ? 'Yes' : 'No'}</td><td>{fee.isActive ? 'Active' : 'Inactive'}</td><td><button className="secondary" disabled={editFee.isPending} onClick={() => { const nextName = window.prompt('Fee item name', fee.itemName); if (nextName !== null && nextName.trim()) editFee.mutate({ id: fee.id, input: { itemName: nextName.trim() } }); }} >Rename</button>{' '}<button className="secondary" disabled={editFee.isPending} onClick={() => editFee.mutate({ id: fee.id, input: { isOptional: !fee.isOptional } })}>{fee.isOptional ? 'Make required' : 'Make optional'}</button>{' '}<button className="secondary" disabled={editFee.isPending} onClick={() => editFee.mutate({ id: fee.id, input: { isActive: !fee.isActive } })}>{fee.isActive ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div>}
        {editFee.isError && <p role="alert">Fee schedule update was rejected by the server.</p>}
      </>}
    </div>}
  </section>;
}
