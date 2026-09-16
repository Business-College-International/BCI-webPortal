import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, CurrentUser } from './api/client';
import { GuardianFeeStatement } from './GuardianFeeStatement';
import { GuardianFinanceReview } from './GuardianFinanceReview';
import { GuardianStationeryWorkspace } from './StationeryWorkspace';
import { GuardianWalletWorkspace } from './GuardianWalletWorkspace';
import { SecurityWorkspace } from './SecurityWorkspace';

type GuardianProfile = { firstName: string; middleName: string | null; lastName: string; phone: string | null; email: string | null; address: string | null; occupation: string | null; hometown: string | null; region: string | null; preferredSms: boolean; preferredPush: boolean };
type Ward = { id: string; firstName: string; lastName: string; relationship: string; status: string; canViewAcademic: boolean; canPayFees: boolean; canManageWallet: boolean };
type Notification = { id: string; channel: string; provider: string | null; status: string; createdAt: string; sentAt: string | null; deliveredAt: string | null; announcement: { id: string; title: string; body: string; audienceType: string; publishedAt: string | null } | null };

async function getGuardianProfile(): Promise<GuardianProfile> { const response = await api.get<GuardianProfile>('/guardians/me/profile'); return response.data; }
async function updateGuardianProfile(input: { firstName: string; lastName: string; address?: string; occupation?: string; hometown?: string; region?: string; preferredSms: boolean; preferredPush: boolean }): Promise<GuardianProfile> { const response = await api.patch<GuardianProfile>('/guardians/me/profile', input); return response.data; }
async function listWards(): Promise<Ward[]> { const response = await api.get<Ward[]>('/students/me/wards'); return response.data; }
async function listNotifications(): Promise<Notification[]> { const response = await api.get<Notification[]>('/notifications/me'); return response.data; }
async function markNotificationRead(id: string): Promise<void> { await api.patch(`/notifications/${encodeURIComponent(id)}/read`); }
async function markAllNotificationsRead(): Promise<{ updatedCount: number }> { const response = await api.post<{ updatedCount: number }>('/notifications/me/read-all'); return response.data; }

export function GuardianWorkspace({ currentUser, onLogout }: { currentUser: CurrentUser; onLogout: () => void }) {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['guardian-profile'], queryFn: getGuardianProfile, enabled: currentUser.roles.includes('GUARDIAN') });
  const wards = useQuery({ queryKey: ['guardian-wards'], queryFn: listWards, enabled: currentUser.roles.includes('GUARDIAN') });
  const notifications = useQuery({ queryKey: ['guardian-notifications'], queryFn: listNotifications, enabled: currentUser.roles.includes('GUARDIAN') });
  const save = useMutation({ mutationFn: updateGuardianProfile, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['guardian-profile'] }) });
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['guardian-notifications'] }) });
  const markRead = useMutation({ mutationFn: markNotificationRead, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['guardian-notifications'] }) });

  if (!currentUser.roles.includes('GUARDIAN')) return null;
  if (profile.isLoading) return <main className="shell narrow"><section className="card"><p>Loading your guardian profile…</p></section></main>;
  if (profile.isError || !profile.data) return <main className="shell narrow"><section className="card"><p role="alert">Guardian profile could not be loaded.</p></section></main>;

  const initial = profile.data;
  return (
    <main className="shell">
      <header className="topbar">
        <div><p className="eyebrow">Business College International</p><h1>Guardian portal</h1><p className="muted">{initial.firstName} {initial.lastName} · Manage your school contact and notification preferences.</p></div>
        <button className="secondary" onClick={onLogout}>Sign out</button>
      </header>

      <SecurityWorkspace currentUser={currentUser} />
      <GuardianFeeStatement currentUser={currentUser} />
      <GuardianFinanceReview currentUser={currentUser} />
      <GuardianWalletWorkspace currentUser={currentUser} />
      <GuardianStationeryWorkspace currentUser={currentUser} wards={wards.data ?? []} />

      <section className="card">
        <h2>My wards</h2>
        {wards.isFetching && <p>Loading ward relationships…</p>}
        {wards.isError && <p role="alert">Ward information could not be loaded.</p>}
        {wards.data?.length === 0 && <p>No wards are currently linked to this guardian account.</p>}
        <div className="detail-grid">
          {wards.data?.map((ward) => <article className="card nested-card" key={ward.id}><h3>{ward.firstName} {ward.lastName}</h3><p className="muted">{ward.relationship} · {ward.status}</p><div className="detail-grid"><span><strong>Academic</strong>{ward.canViewAcademic ? 'Enabled' : 'Restricted'}</span><span><strong>Fees</strong>{ward.canPayFees ? 'Enabled' : 'Restricted'}</span><span><strong>Wallet</strong>{ward.canManageWallet ? 'Enabled' : 'Restricted'}</span></div></article>)}
        </div>
      </section>

      <section className="card">
        <h2>My profile</h2>
        <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); save.mutate({ firstName: String(form.get('firstName') ?? '').trim(), lastName: String(form.get('lastName') ?? '').trim(), address: String(form.get('address') ?? '').trim() || undefined, occupation: String(form.get('occupation') ?? '').trim() || undefined, hometown: String(form.get('hometown') ?? '').trim() || undefined, region: String(form.get('region') ?? '').trim() || undefined, preferredSms: form.get('preferredSms') === 'on', preferredPush: form.get('preferredPush') === 'on' }); }}>
          <div className="detail-grid"><label>First name<input name="firstName" defaultValue={initial.firstName} required /></label><label>Last name<input name="lastName" defaultValue={initial.lastName} required /></label><label>Phone<input value={initial.phone ?? ''} readOnly /></label><label>Email<input value={initial.email ?? ''} readOnly /></label><label>Address<input name="address" defaultValue={initial.address ?? ''} /></label><label>Occupation<input name="occupation" defaultValue={initial.occupation ?? ''} /></label><label>Hometown<input name="hometown" defaultValue={initial.hometown ?? ''} /></label><label>Region<input name="region" defaultValue={initial.region ?? ''} /></label></div>
          <div className="detail-grid"><label><input type="checkbox" name="preferredSms" defaultChecked={initial.preferredSms} /> SMS notifications</label><label><input type="checkbox" name="preferredPush" defaultChecked={initial.preferredPush} /> Push notifications</label></div>
          <button disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save profile'}</button>
          {save.isError && <p role="alert">Your profile could not be updated.</p>}{save.isSuccess && <p>Profile updated successfully.</p>}
        </form>
      </section>

      <section className="card"><div className="section-heading"><div><h2>Notifications</h2><p className="muted">School notifications delivered to your account.</p></div><button className="secondary" disabled={readAll.isPending} onClick={() => readAll.mutate()}>{readAll.isPending ? 'Updating…' : 'Mark all read'}</button></div>{notifications.isFetching && <p>Refreshing notifications…</p>}{notifications.data?.length === 0 && <p>No notifications yet.</p>}{notifications.data?.map((item) => <article key={item.id} className="card nested-card"><div className="section-heading"><div><strong>{item.announcement?.title ?? 'BCI notification'}</strong><p className="muted">{item.announcement?.body ?? 'Notification delivered through BCI.'}</p></div>{item.status !== 'read' && <button className="secondary" onClick={() => markRead.mutate(item.id)}>Mark read</button>}</div><small>Channel: {item.channel} · Status: {item.status} · {new Date(item.createdAt).toLocaleString()}</small></article>)}</section>
    </main>
  );
}