import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CurrentUser, listNotifications, markAllNotificationsRead, markNotificationRead } from './api/client';

export function NotificationCenter({ currentUser }: { currentUser: CurrentUser }) {
  const queryClient = useQueryClient();
  const enabled = currentUser.permissions.length > 0;
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: () => listNotifications(), enabled, refetchInterval: 30_000 });
  const markRead = useMutation({ mutationFn: markNotificationRead, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) });
  const markAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) });

  if (!enabled) return null;
  const unread = notifications.data?.filter((item) => item.status !== 'read').length ?? 0;

  return (
    <section className="card">
      <div className="section-heading">
        <div><h2>Notifications {unread > 0 ? `(${unread} unread)` : ''}</h2><p className="muted">Delivery state is maintained by the backend. External SMS/push providers remain separate adapters.</p></div>
        {unread > 0 && <button className="secondary" disabled={markAll.isPending} onClick={() => markAll.mutate()}>{markAll.isPending ? 'Updating…' : 'Mark all read'}</button>}
      </div>
      {notifications.isLoading && <p>Loading notifications…</p>}
      {notifications.isError && <p role="alert">Notifications could not be loaded.</p>}
      {notifications.data && notifications.data.length === 0 && <p>No notifications yet.</p>}
      {notifications.data && notifications.data.length > 0 && (
        <div className="table-wrap"><table><thead><tr><th>Notification</th><th>Channel</th><th>Status</th><th>Received</th><th /></tr></thead><tbody>
          {notifications.data.map((item) => <tr key={item.id}><td><strong>{item.announcement?.title ?? 'BCI notification'}</strong><div className="muted">{item.announcement?.body ?? ''}</div></td><td>{item.channel}</td><td>{item.status}</td><td>{new Date(item.createdAt).toLocaleString()}</td><td>{item.status !== 'read' && <button className="secondary" onClick={() => markRead.mutate(item.id)}>Mark read</button>}</td></tr>)}
        </tbody></table></div>
      )}
    </section>
  );
}
