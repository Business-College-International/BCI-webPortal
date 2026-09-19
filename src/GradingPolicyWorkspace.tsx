import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  CurrentUser,
  GradingPolicy,
  createGradingPolicy,
  listAcademicYears,
  listGradingPolicies,
  publishGradingPolicy,
  retireGradingPolicy,
  updateGradingPolicy,
} from './api/client';

const levels = ['KG1','KG2','P1','P2','P3','P4','P5','P6','JHS1','JHS2','JHS3','SHS1','SHS2','SHS3'];
const programmes = ['NONE','AGRIC','GENERAL_ARTS','BUSINESS','HOME_ECONOMICS'];
type BandDraft = { code: string; lowerInclusive: string; upperExclusive: string; pass: boolean; descriptor: string; points: string; };
const blankBand = (order: number): BandDraft => ({ code: '', lowerInclusive: order === 1 ? '0' : '', upperExclusive: '', pass: true, descriptor: '', points: '' });

export function GradingPolicyWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const canRead = currentUser.permissions.includes('grading.read') || currentUser.permissions.includes('grading.manage');
  const canManage = currentUser.permissions.includes('grading.manage');
  const queryClient = useQueryClient();
  const [academicYearId, setAcademicYearId] = useState('');
  const [level, setLevel] = useState('SHS1');
  const [programme, setProgramme] = useState('NONE');
  const [name, setName] = useState('');
  const [bands, setBands] = useState<BandDraft[]>([blankBand(1), blankBand(2)]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const academicYears = useQuery({ queryKey: ['grading-policy-years'], queryFn: listAcademicYears, enabled: canRead });
  const policies = useQuery({
    queryKey: ['grading-policies', academicYearId, level, programme],
    queryFn: () => listGradingPolicies({ academicYearId: academicYearId || undefined, level, programme: programme === 'NONE' ? undefined : programme }),
    enabled: canRead,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!academicYearId) throw new Error('Select an academic year.');
      const cleanBands = bands.map((band, index) => ({
        code: band.code.trim(),
        lowerInclusive: band.lowerInclusive.trim(),
        ...(band.upperExclusive.trim() ? { upperExclusive: band.upperExclusive.trim() } : {}),
        pass: band.pass,
        descriptor: band.descriptor.trim(),
        ...(band.points.trim() ? { points: band.points.trim() } : {}),
        order: index + 1,
      }));
      return editingId
        ? updateGradingPolicy(editingId, { name: name.trim(), bands: cleanBands })
        : createGradingPolicy({ academicYearId, name: name.trim(), level, programme: programme === 'NONE' ? null : programme, bands: cleanBands });
    },
    onSuccess: (policy) => {
      queryClient.invalidateQueries({ queryKey: ['grading-policies'] });
      setMessage(editingId ? 'Draft grading policy updated.' : 'Draft grading policy created.');
      loadPolicy(policy);
    },
  });

  const publish = useMutation({ mutationFn: publishGradingPolicy, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['grading-policies'] }); setMessage('Grading policy published. Published versions are immutable.'); resetForm(); } });
  const retire = useMutation({ mutationFn: retireGradingPolicy, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['grading-policies'] }); setMessage('Grading policy retired.'); } });
  const orderedBands = useMemo(() => bands.map((band, index) => ({ ...band, order: index + 1 })), [bands]);

  if (!canRead) return null;

  function loadPolicy(policy: GradingPolicy) {
    setEditingId(policy.status === 'DRAFT' ? policy.id : null);
    setAcademicYearId(policy.academicYearId);
    setLevel(policy.level);
    setProgramme(policy.programme || 'NONE');
    setName(policy.name);
    setBands(policy.bands.map((band) => ({ code: band.code, lowerInclusive: String(band.lowerInclusive), upperExclusive: band.upperExclusive == null ? '' : String(band.upperExclusive), pass: band.pass, descriptor: band.descriptor, points: band.points == null ? '' : String(band.points) })));
  }

  function resetForm() {
    setEditingId(null); setName(''); setBands([blankBand(1), blankBand(2)]);
  }

  function updateBand(index: number, patch: Partial<BandDraft>) {
    setBands((current) => current.map((band, i) => i === index ? { ...band, ...patch } : band));
  }

  return (
    <section className="card">
      <div className="section-heading"><div><h2>Grading policies</h2><p className="muted">Create versioned school grading policies without hard-coding grade thresholds.</p></div></div>
      {canManage && <div className="card nested-card">
        <div className="section-heading"><div><h3>{editingId ? 'Edit draft policy' : 'Create draft policy'}</h3><p className="muted">The server rejects gaps, overlaps and invalid ranges before publication.</p></div>{editingId && <button className="secondary" onClick={resetForm}>New draft</button>}</div>
        <div className="detail-grid">
          <label>Academic year<select value={academicYearId} onChange={(event) => setAcademicYearId(event.target.value)} disabled={Boolean(editingId)}><option value="">Select academic year</option>{academicYears.data?.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label>
          <label>Level<select value={level} onChange={(event) => setLevel(event.target.value)} disabled={Boolean(editingId)}>{levels.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Programme<select value={programme} onChange={(event) => setProgramme(event.target.value)} disabled={Boolean(editingId)}>{programmes.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Policy name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} /></label>
        </div>
        <div className="table-wrap"><table><thead><tr><th>#</th><th>Code</th><th>Lower</th><th>Upper</th><th>Pass</th><th>Descriptor</th><th>Points</th><th /></tr></thead><tbody>
          {orderedBands.map((band, index) => <tr key={index}><td>{index + 1}</td><td><input value={band.code} onChange={(event) => updateBand(index, { code: event.target.value })} /></td><td><input inputMode="decimal" value={band.lowerInclusive} onChange={(event) => updateBand(index, { lowerInclusive: event.target.value })} /></td><td><input inputMode="decimal" value={band.upperExclusive} onChange={(event) => updateBand(index, { upperExclusive: event.target.value })} /></td><td><input type="checkbox" checked={band.pass} onChange={(event) => updateBand(index, { pass: event.target.checked })} /></td><td><input value={band.descriptor} onChange={(event) => updateBand(index, { descriptor: event.target.value })} /></td><td><input inputMode="decimal" value={band.points} onChange={(event) => updateBand(index, { points: event.target.value })} /></td><td><button className="secondary" onClick={() => setBands((current) => current.filter((_, i) => i !== index))} disabled={bands.length <= 1}>Remove</button></td></tr>)}
        </tbody></table></div>
        <div className="actions"><button className="secondary" onClick={() => setBands((current) => [...current, blankBand(current.length + 1)])}>Add band</button><button onClick={() => save.mutate()} disabled={save.isPending || !name.trim() || !academicYearId}>{save.isPending ? 'Saving…' : editingId ? 'Save draft' : 'Create draft'}</button></div>
        {save.isError && <p role="alert">The grading policy was rejected. Check every range, code, descriptor and order.</p>}
      </div>}
      {policies.isFetching && <p>Loading grading policies…</p>}
      {policies.isError && <p role="alert">Grading policies could not be loaded.</p>}
      {message && <p role="status">{message}</p>}
      {policies.data && policies.data.length > 0 && <div className="table-wrap"><table><thead><tr><th>Version</th><th>Scope</th><th>Status</th><th>Bands</th><th>Published</th><th /></tr></thead><tbody>
        {policies.data.map((policy) => <tr key={policy.id}><td>{policy.version}</td><td>{policy.level}{policy.programme ? ' · ' + policy.programme : ' · generic'} · {academicYears.data?.find((year) => year.id === policy.academicYearId)?.name || policy.academicYearId}</td><td>{policy.status}</td><td>{policy.bands.map((band) => band.code + ' ' + band.lowerInclusive + '–' + (band.upperExclusive == null ? '100' : band.upperExclusive)).join(' · ')}</td><td>{policy.publishedAt ? new Date(policy.publishedAt).toLocaleDateString() : '—'}</td><td>{canManage && policy.status === 'DRAFT' && <button className="secondary" onClick={() => loadPolicy(policy)}>Edit</button>} {canManage && policy.status === 'DRAFT' && <button onClick={() => publish.mutate(policy.id)} disabled={publish.isPending}>Publish</button>} {canManage && policy.status === 'ACTIVE' && <button className="danger" onClick={() => retire.mutate(policy.id)} disabled={retire.isPending}>Retire</button>}</td></tr>)}
      </tbody></table></div>}
      {policies.data?.length === 0 && <p>No grading policies have been configured for the selected scope.</p>}
    </section>
  );
}