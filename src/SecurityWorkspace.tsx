import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, CurrentUser } from './api/client';

type Session = { id: string; createdAt: string; lastUsedAt: string | null; expiresAt: string; revokedAt: string | null };

async function listSessions(): Promise<Session[]> {
  const response = await api.get<Session[]>('/auth/sessions');
  return response.data;
}

async function changePassword(input: { currentPassword: string; newPassword: string }) {
  const response = await api.post('/auth/change-password', input);
  return response.data as { success: boolean; sessionsRevoked: boolean };
}

async function revokeSession(sessionId: string) {
  const response = await api.post('/auth/revoke-session', { sessionId });
  return response.data as { success: boolean };
}

async function revokeAllSessions() {
  const response = await api.post('/auth/revoke-all-sessions');
  return response.data as { success: boolean; revokedCount: number };
}

export function SecurityWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: ['security-sessions'], queryFn: listSessions });
  const password = useMutation({ mutationFn: changePassword, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['security-sessions'] }) });
  const revoke = useMutation({ mutationFn: revokeSession, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['security-sessions'] }) });
  const revokeAll = useMutation({ mutationFn: revokeAllSessions, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['security-sessions'] }) });

  const activeSessions = sessions.data?.filter((item) => !item.revokedAt) ?? [];
  const submitPassword = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    password.mutate({ currentPassword: String(form.get('currentPassword') ?? ''), newPassword: String(form.get('newPassword') ?? '') });
    event.currentTarget.reset();
  };

  return (
    <section className="card">
      <h2>Account security</h2>
      <p className="muted">{currentUser.person?.firstName ?? 'Your'} account security controls. Refresh tokens and password hashes are never exposed here.</p>
      <div className="detail-grid">
        <form onSubmit={submitPassword}>
          <h3>Change password</h3>
          <label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
          <label>New password<input name="newPassword" type="password" minLength={12} autoComplete="new-password" required /><small>At least 12 characters with upper, lower, number and special character.</small></label>
          <button disabled={password.isPending}>{password.isPending ? 'Updating…' : 'Change password'}</button>
          {password.isError && <p role="alert">Password change failed. Verify the current password and the new-password requirements.</p>}
          {password.isSuccess && <p>Password changed. Existing sessions were revoked.</p>}
        </form>
        <div>
          <div className="section-heading"><div><h3>Sessions</h3><p className="muted">Active sessions are refresh-token sessions; no token material is shown.</p></div><button className="secondary" disabled={revokeAll.isPending || activeSessions.length === 0} onClick={() => revokeAll.mutate()}>{revokeAll.isPending ? 'Revoking…' : 'Revoke all sessions'}</button></div>
          {sessions.isFetching && <p>Refreshing sessions…</p>}
          {sessions.data?.length === 0 && <p>No refresh sessions recorded.</p>}
          {sessions.data?.map((session) => (
            <article key={session.id} className="card nested-card">
              <div className="section-heading"><strong>{session.revokedAt ? 'Revoked session' : 'Active session'}</strong>{!session.revokedAt && <button className="secondary" onClick={() => revoke.mutate(session.id)} disabled={revoke.isPending}>Revoke</button>}</div>
              <small>Created {new Date(session.createdAt).toLocaleString()} · Last used {session.lastUsedAt ? new Date(session.lastUsedAt).toLocaleString() : 'Not used since issue'} · Expires {new Date(session.expiresAt).toLocaleString()}</small>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
