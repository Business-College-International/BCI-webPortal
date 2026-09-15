import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CurrentUser, getStudent, linkGuardian, listGuardianDirectory, withdrawStudent } from './api/client';

export function StudentProfilePanel({ studentId, currentUser, onClose }: { studentId: string; currentUser: CurrentUser; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [showGuardianLink, setShowGuardianLink] = useState(false);
  const [guardianSearch, setGuardianSearch] = useState('');
  const [guardianId, setGuardianId] = useState('');
  const [relationship, setRelationship] = useState('');
  const [primary, setPrimary] = useState(false);
  const [academic, setAcademic] = useState(true);
  const [fees, setFees] = useState(true);
  const [wallet, setWallet] = useState(true);
  const [withdrawReason, setWithdrawReason] = useState('');

  const profile = useQuery({ queryKey: ['student', studentId], queryFn: () => getStudent(studentId) });
  const guardians = useQuery({
    queryKey: ['guardian-directory', guardianSearch],
    queryFn: () => listGuardianDirectory(guardianSearch),
    enabled: showGuardianLink && currentUser.permissions.includes('students.manage'),
  });

  const link = useMutation({
    mutationFn: () => linkGuardian(studentId, { guardianId, relationship: relationship.trim(), isPrimaryContact: primary, canViewAcademic: academic, canPayFees: fees, canManageWallet: wallet }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      setShowGuardianLink(false);
      setGuardianId('');
      setRelationship('');
      setGuardianSearch('');
    },
  });

  const withdraw = useMutation({
    mutationFn: () => withdrawStudent(studentId, withdrawReason.trim()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      await queryClient.invalidateQueries({ queryKey: ['students-directory'] });
      setWithdrawReason('');
    },
  });

  const canManage = currentUser.permissions.includes('students.manage');

  return (
    <section className="card nested-card">
      <div className="section-heading">
        <div><h3>Student profile</h3><p className="muted">Server-authoritative academic and guardian record.</p></div>
        <button className="secondary" onClick={onClose}>Close</button>
      </div>

      {profile.isLoading && <p>Loading student record…</p>}
      {profile.isError && <p role="alert">Student record could not be loaded.</p>}
      {profile.data && (
        <>
          <div className="detail-grid">
            <span><strong>Name</strong>{profile.data.student.firstName} {profile.data.student.lastName}</span>
            <span><strong>Admission</strong>{profile.data.student.admissionNumber ?? '—'}</span>
            <span><strong>Date of birth</strong>{new Date(profile.data.student.dateOfBirth).toLocaleDateString()}</span>
            <span><strong>Status</strong>{profile.data.student.status}</span>
            <span><strong>Previous school</strong>{profile.data.student.previousSchool ?? '—'}</span>
            <span><strong>Current class</strong>{profile.data.enrolments[0]?.class.name ?? '—'}</span>
          </div>

          <h4>Enrolment history</h4>
          {profile.data.enrolments.length === 0 ? <p>No enrolment history is available.</p> : (
            <div className="table-wrap"><table><thead><tr><th>Year</th><th>Term</th><th>Class</th><th>Programme</th><th>Status</th></tr></thead><tbody>
              {profile.data.enrolments.map((enrolment) => <tr key={enrolment.id}><td>{enrolment.academicYear.name}</td><td>{enrolment.term.name}</td><td>{enrolment.class.name}</td><td>{enrolment.programme}</td><td>{enrolment.status}</td></tr>)}
            </tbody></table></div>
          )}

          <h4>Guardians</h4>
          {profile.data.guardians.length === 0 ? <p>No guardian relationships have been linked.</p> : (
            <div className="table-wrap"><table><thead><tr><th>Relationship</th><th>Primary contact</th></tr></thead><tbody>
              {profile.data.guardians.map((guardian, index) => <tr key={`${guardian.relationship}-${index}`}><td>{guardian.relationship}</td><td>{guardian.isPrimaryContact ? 'Yes' : 'No'}</td></tr>)}
            </tbody></table></div>
          )}

          <h4>Documents</h4>
          {profile.data.documents.length === 0 ? <p>No documents have been uploaded.</p> : (
            <div className="table-wrap"><table><thead><tr><th>Type</th><th>Added</th><th /></tr></thead><tbody>
              {profile.data.documents.map((document) => <tr key={document.id}><td>{document.type}</td><td>{new Date(document.createdAt).toLocaleDateString()}</td><td><a href={document.fileUrl} target="_blank" rel="noreferrer">Open</a></td></tr>)}
            </tbody></table></div>
          )}

          {canManage && (
            <div className="actions">
              <button className="secondary" onClick={() => setShowGuardianLink((value) => !value)}>{showGuardianLink ? 'Cancel guardian link' : 'Link guardian'}</button>
            </div>
          )}

          {showGuardianLink && canManage && (
            <div className="card nested-card">
              <h4>Find guardian</h4>
              <label>Search by name, phone or email<input value={guardianSearch} onChange={(event) => setGuardianSearch(event.target.value)} placeholder="Search guardian directory" /></label>
              <label>Selected guardian<select value={guardianId} onChange={(event) => setGuardianId(event.target.value)}><option value="">Select guardian</option>{guardians.data?.map((guardian) => <option key={guardian.personId} value={guardian.personId}>{guardian.name}{guardian.phone ? ` · ${guardian.phone}` : ''} · {guardian.wardCount} ward(s)</option>)}</select></label>
              <label>Relationship<input value={relationship} onChange={(event) => setRelationship(event.target.value)} placeholder="Mother, father, aunt, guardian…" /></label>
              <div className="detail-grid">
                <label><input type="checkbox" checked={primary} onChange={(event) => setPrimary(event.target.checked)} /> Primary contact</label>
                <label><input type="checkbox" checked={academic} onChange={(event) => setAcademic(event.target.checked)} /> Academic access</label>
                <label><input type="checkbox" checked={fees} onChange={(event) => setFees(event.target.checked)} /> Fee/payment access</label>
                <label><input type="checkbox" checked={wallet} onChange={(event) => setWallet(event.target.checked)} /> Wallet access</label>
              </div>
              <button disabled={!guardianId || !relationship.trim() || link.isPending} onClick={() => link.mutate()}>{link.isPending ? 'Linking…' : 'Link guardian'}</button>
              {link.isError && <p role="alert">Guardian link could not be created. The guardian may already be linked.</p>}
            </div>
          )}

          {canManage && profile.data.student.status === 'ACTIVE' && (
            <div className="card nested-card">
              <h4>Withdraw student</h4>
              <p className="muted">This closes the current enrolment, changes the student status, and creates an audit record.</p>
              <label>Reason<textarea value={withdrawReason} onChange={(event) => setWithdrawReason(event.target.value)} placeholder="Required withdrawal reason" /></label>
              <button className="danger" disabled={!withdrawReason.trim() || withdraw.isPending} onClick={() => { if (window.confirm('Withdraw this student? This is an audited lifecycle change.')) withdraw.mutate(); }}>{withdraw.isPending ? 'Withdrawing…' : 'Withdraw student'}</button>
              {withdraw.isError && <p role="alert">Withdrawal could not be completed.</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
