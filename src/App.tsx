import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApplicationListItem,
  CurrentUser,
  getApplicationStatus,
  getCurrentUser,
  listApplications,
  login,
  logoutLocal,
  reviewApplication,
} from './api/client';

function StaffLogin({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const mutation = useMutation({
    mutationFn: () => login(identifier.trim(), password),
    onSuccess: onLoggedIn,
  });

  return (
    <main className="shell narrow">
      <header>
        <p className="eyebrow">Business College International</p>
        <h1>Staff portal</h1>
        <p className="muted">Authorized BCI staff sign in to manage school operations.</p>
      </header>
      <section className="card">
        <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
          <label>
            Phone or email
            <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
          <button disabled={!identifier.trim() || !password || mutation.isPending} type="submit">
            {mutation.isPending ? 'Signing in…' : 'Sign in'}
          </button>
          {mutation.isError && <p role="alert">Sign-in failed. Check your credentials or account status.</p>}
        </form>
      </section>
    </main>
  );
}

function Admissions({ currentUser, onLogout }: { currentUser: CurrentUser; onLogout: () => void }) {
  const queryClient = useQueryClient();
  const [trackingCode, setTrackingCode] = useState('');
  const [submittedTrackingCode, setSubmittedTrackingCode] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewReason, setReviewReason] = useState('');

  const applications = useQuery({
    queryKey: ['applications'],
    queryFn: listApplications,
    refetchInterval: 30_000,
    enabled: currentUser.permissions.includes('applications.read'),
  });

  const publicStatus = useQuery({
    queryKey: ['application-status', submittedTrackingCode],
    queryFn: () => getApplicationStatus(submittedTrackingCode),
    enabled: submittedTrackingCode.length > 0,
  });

  const review = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'UNDER_REVIEW' | 'REJECTED' }) =>
      reviewApplication(id, status, reviewReason || undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
  });

  const selectedApplication: ApplicationListItem | undefined = applications.data?.find((item) => item.id === selectedId);
  const canReview = currentUser.permissions.includes('applications.review');

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Business College International</p>
          <h1>Admissions workspace</h1>
          <p className="muted">
            {currentUser.person ? `${currentUser.person.firstName} ${currentUser.person.lastName}` : 'Authenticated staff'} · {currentUser.roles.join(', ')}
          </p>
        </div>
        <button className="secondary" onClick={() => { logoutLocal(); onLogout(); }}>Sign out</button>
      </header>

      <section className="card">
        <h2>Applications</h2>
        <p className="muted">This list is loaded from the authoritative backend and shown only when your server-side permission includes application read access.</p>
        {!currentUser.permissions.includes('applications.read') && <p>You are authenticated, but your account does not currently have application-read access.</p>}
        {applications.isFetching && <p>Refreshing applications…</p>}
        {applications.isError && <p role="alert">Applications could not be loaded.</p>}
        {applications.data && applications.data.length === 0 && <p>No applications have been submitted.</p>}
        {applications.data && applications.data.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Applicant</th><th>Level</th><th>Programme</th><th>Status</th><th>Submitted</th><th /></tr></thead>
              <tbody>
                {applications.data.map((item) => (
                  <tr key={item.id}>
                    <td>{item.firstName} {item.lastName}</td>
                    <td>{item.levelApplied}</td>
                    <td>{item.programmeApplied}</td>
                    <td>{item.status}</td>
                    <td>{new Date(item.submittedAt).toLocaleDateString()}</td>
                    <td><button className="secondary" onClick={() => setSelectedId(item.id)}>Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedApplication && (
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>{selectedApplication.firstName} {selectedApplication.lastName}</h2>
              <p className="muted">Tracking code: {selectedApplication.trackingCode}</p>
            </div>
            <button className="secondary" onClick={() => setSelectedId(null)}>Close</button>
          </div>
          <div className="detail-grid">
            <span><strong>Date of birth</strong>{new Date(selectedApplication.dob).toLocaleDateString()}</span>
            <span><strong>Guardian</strong>{selectedApplication.guardianName} · {selectedApplication.guardianPhone}</span>
            <span><strong>Level</strong>{selectedApplication.levelApplied}</span>
            <span><strong>Programme</strong>{selectedApplication.programmeApplied}</span>
            <span><strong>Status</strong>{selectedApplication.status}</span>
          </div>
          {canReview && <>
            <label>
              Review note
              <textarea value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} placeholder="Optional note retained with the decision." />
            </label>
            <div className="actions">
              <button
                disabled={selectedApplication.status !== 'PENDING' && selectedApplication.status !== 'UNDER_REVIEW'}
                onClick={() => review.mutate({ id: selectedApplication.id, status: 'UNDER_REVIEW' })}
              >
                Mark under review
              </button>
              <button
                className="danger"
                disabled={selectedApplication.status !== 'PENDING' && selectedApplication.status !== 'UNDER_REVIEW'}
                onClick={() => review.mutate({ id: selectedApplication.id, status: 'REJECTED' })}
              >
                Reject
              </button>
            </div>
          </>}
          {!canReview && <p>You can view this application, but your current server permissions do not allow review actions.</p>}
          {review.isPending && <p>Saving server-side decision…</p>}
          {review.isError && <p role="alert">The review action failed.</p>}
        </section>
      )}

      <section className="card">
        <h2>Public status lookup</h2>
        <form onSubmit={(event: FormEvent) => { event.preventDefault(); setSubmittedTrackingCode(trackingCode.trim()); }}>
          <input aria-label="Tracking code" value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} placeholder="BCI tracking code" />
          <button disabled={!trackingCode.trim()} type="submit">Check status</button>
        </form>
        {publicStatus.isFetching && <p>Loading authoritative status…</p>}
        {publicStatus.isError && <p role="alert">That tracking code could not be found.</p>}
        {publicStatus.data && <div className="result"><strong>{publicStatus.data.trackingCode}</strong><span>{publicStatus.data.levelApplied} · {publicStatus.data.programmeApplied}</span><span>Status: {publicStatus.data.status}</span></div>}
      </section>
    </main>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(localStorage.getItem('bci_access_token')));
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!authenticated) {
      setCurrentUser(null);
      setAuthChecked(true);
      return;
    }

    setAuthChecked(false);
    getCurrentUser()
      .then((user) => {
        if (!cancelled) setCurrentUser(user);
      })
      .catch(() => {
        if (!cancelled) {
          logoutLocal();
          setAuthenticated(false);
          setCurrentUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });

    return () => { cancelled = true; };
  }, [authenticated]);

  useEffect(() => {
    const listener = () => setAuthenticated(Boolean(localStorage.getItem('bci_access_token')));
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }, []);

  if (!authenticated) return <StaffLogin onLoggedIn={() => setAuthenticated(true)} />;
  if (!authChecked || !currentUser) return <main className="shell narrow"><section className="card"><p>Verifying your BCI session…</p></section></main>;
  return <Admissions currentUser={currentUser} onLogout={() => { setAuthenticated(false); setCurrentUser(null); }} />;
}
