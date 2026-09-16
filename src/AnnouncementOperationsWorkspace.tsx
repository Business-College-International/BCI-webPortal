import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { CurrentUser, api } from './api/client';

type Summary = { authorized: boolean; drafts?: number; published?: number; pendingDeliveries?: number; failedDeliveries?: number };
type Preview = { audienceType: string; audienceRef: string | null; recipientCount: number; smsEligibleCount: number; pushEligibleCount: number };
type DeliveryReport = { announcement: { id: string; title: string; publishedAt: string | null }; deliveries: Array<{ channel: string; status: string; count: number }> };

async function getSummary(): Promise<Summary> { const response = await api.get<Summary>('/announcements/operations/summary'); return response.data; }
async function getPreview(audienceType: string, audienceRef?: string): Promise<Preview> { const response = await api.get<Preview>('/announcements/operations/preview', { params: { audienceType, ...(audienceRef ? { audienceRef } : {}) } }); return response.data; }
async function getDeliveryReport(id: string): Promise<DeliveryReport> { const response = await api.get<DeliveryReport>(`/announcements/operations/${encodeURIComponent(id)}/delivery-report`); return response.data; }

export function AnnouncementOperationsWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const enabled = currentUser.permissions.includes('announcements.manage');
  const [audience, setAudience] = useState('GUARDIANS');
  const [audienceRef, setAudienceRef] = useState('');
  const [announcementId, setAnnouncementId] = useState('');
  const summary = useQuery({ queryKey: ['announcement-operations-summary'], queryFn: getSummary, enabled });
  const preview = useQuery({ queryKey: ['announcement-audience-preview', audience, audienceRef], queryFn: () => getPreview(audience, audienceRef.trim() || undefined), enabled: enabled && audience !== 'USER' ? true : enabled && Boolean(audienceRef.trim()) });
  const delivery = useQuery({ queryKey: ['announcement-delivery-report', announcementId], queryFn: () => getDeliveryReport(announcementId), enabled: enabled && Boolean(announcementId.trim()) });

  if (!enabled) return null;
  return (
    <section className="card">
      <p className="eyebrow">Communication operations</p>
      <h2>Announcement delivery</h2>
      {summary.isError && <p role="alert">Announcement operations could not be loaded.</p>}
      <div className="detail-grid">
        <span><strong>Drafts</strong>{summary.data?.drafts ?? '—'}</span>
        <span><strong>Published</strong>{summary.data?.published ?? '—'}</span>
        <span><strong>Pending deliveries</strong>{summary.data?.pendingDeliveries ?? '—'}</span>
        <span><strong>Failed deliveries</strong>{summary.data?.failedDeliveries ?? '—'}</span>
      </div>

      <h3>Audience preview</h3>
      <div className="detail-grid">
        <label>Audience<select value={audience} onChange={(event) => setAudience(event.target.value)}><option value="ALL">Everyone</option><option value="GUARDIANS">Guardians</option><option value="TEACHERS">Teachers</option><option value="STAFF">Staff</option><option value="USER">Specific user</option></select></label>
        {audience === 'USER' && <label>Recipient user ID<input value={audienceRef} onChange={(event) => setAudienceRef(event.target.value)} /></label>}
      </div>
      {preview.isFetching && <p>Calculating audience…</p>}
      {preview.data && <div className="detail-grid"><span><strong>Recipients</strong>{preview.data.recipientCount}</span><span><strong>SMS eligible</strong>{preview.data.smsEligibleCount}</span><span><strong>Push eligible</strong>{preview.data.pushEligibleCount}</span></div>}

      <h3>Delivery report</h3>
      <label>Published announcement ID<input value={announcementId} onChange={(event) => setAnnouncementId(event.target.value)} placeholder="Paste an announcement ID" /></label>
      {delivery.isFetching && <p>Loading delivery report…</p>}
      {delivery.data && <div className="table-wrap"><table><thead><tr><th>Channel</th><th>Status</th><th>Count</th></tr></thead><tbody>{delivery.data.deliveries.map((row) => <tr key={`${row.channel}-${row.status}`}><td>{row.channel}</td><td>{row.status}</td><td>{row.count}</td></tr>)}</tbody></table></div>}
      {delivery.data && delivery.data.announcement.publishedAt === null && <p className="muted">This announcement has not been published yet.</p>}
      <p className="muted">Provider delivery remains adapter-gated. This dashboard reports state; it does not fabricate successful SMS or push delivery.</p>
    </section>
  );
}
