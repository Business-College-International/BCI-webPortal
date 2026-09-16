import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CurrentUser, api } from './api/client';

type Delivery = { id: string; channel: string; provider: string | null; status: string; sentAt: string | null; deliveredAt: string | null; failureCode: string | null; createdAt: string; recipientUserId: string | null; announcement: { id: string; title: string; audienceType: string; publishedAt: string | null } | null };

async function listQueue(): Promise<Delivery[]> { const response = await api.get<Delivery[]>('/notifications/operations/queue'); return response.data; }
async function requeue(id: string): Promise<unknown> { const response = await api.post(`/notifications/operations/${encodeURIComponent(id)}/requeue`); return response.data; }

export function NotificationOperationsWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const enabled = currentUser.permissions.includes('announcements.manage');
  const queryClient = useQueryClient();
  const queue = useQuery({ queryKey: ['notification-operations-queue'], queryFn: listQueue, enabled });
  const retry = useMutation({ mutationFn: requeue, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-operations-queue'] }) });
  if (!enabled) return null;

  return (
    <section className="card">
      <p className="eyebrow">Communication operations</p>
      <h2>Delivery queue</h2>
      <p className="muted">Pending and failed notification deliveries. Requeue only failed records; a provider adapter is responsible for actual transmission.</p>
      {queue.isFetching && <p>Loading delivery queue…</p>}
      {queue.isError && <p role="alert">Delivery queue could not be loaded.</p>}
      {queue.data?.length === 0 && <p>No pending or failed deliveries.</p>}
      {queue.data && queue.data.length > 0 && <div className="table-wrap"><table><thead><tr><th>Announcement</th><th>Channel</th><th>Provider</th><th>Status</th><th>Failure</th><th /></tr></thead><tbody>{queue.data.map((item) => <tr key={item.id}><td>{item.announcement?.title ?? 'Direct notification'}</td><td>{item.channel}</td><td>{item.provider ?? '—'}</td><td>{item.status}</td><td>{item.failureCode ?? '—'}</td><td>{item.status === 'failed' && <button disabled={retry.isPending} onClick={() => retry.mutate(item.id)}>{retry.isPending ? 'Requeue…' : 'Requeue'}</button>}</td></tr>)}</tbody></table></div>}
      {retry.isError && <p role="alert">The failed delivery could not be requeued.</p>}
    </section>
  );
}
