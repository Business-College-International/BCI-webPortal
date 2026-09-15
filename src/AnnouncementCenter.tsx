import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAnnouncement, listAnnouncements, publishAnnouncement, CurrentUser } from './api/client';
import { useState } from 'react';

export function AnnouncementCenter({ currentUser }: { currentUser: CurrentUser }) {
  const canManage = currentUser.permissions.includes('announcements.manage');
  const queryClient = useQueryClient();
  const announcements = useQuery({ queryKey: ['announcements'], queryFn: listAnnouncements, enabled: Boolean(currentUser.id) });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audienceType, setAudienceType] = useState('ALL');
  const [audienceRef, setAudienceRef] = useState('');

  const create = useMutation({
    mutationFn: () => createAnnouncement({ title: title.trim(), body: body.trim(), audienceType, ...(audienceType === 'USER' && audienceRef.trim() ? { audienceRef: audienceRef.trim() } : {}) }),
    onSuccess: () => { setTitle(''); setBody(''); setAudienceRef(''); queryClient.invalidateQueries({ queryKey: ['announcements'] }); },
  });
  const publish = useMutation({
    mutationFn: publishAnnouncement,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements'] }),
  });

  return (
    <section className="card">
      <h2>Announcements</h2>
      {canManage && (
        <form onSubmit={(event) => { event.preventDefault(); if (title.trim() && body.trim()) create.mutate(); }}>
          <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} /></label>
          <label>Audience<select value={audienceType} onChange={(event) => setAudienceType(event.target.value)}><option value="ALL">Everyone</option><option value="GUARDIANS">Guardians</option><option value="STAFF">Staff</option><option value="TEACHERS">Teachers</option><option value="USER">Specific user</option></select></label>
          {audienceType === 'USER' && <label>Recipient user ID<input value={audienceRef} onChange={(event) => setAudienceRef(event.target.value)} /></label>}
          <label>Message<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={10000} rows={5} /></label>
          <button type="submit" disabled={create.isPending || !title.trim() || !body.trim()}>Save draft</button>
          {create.isError && <p role="alert">Announcement could not be saved.</p>}
        </form>
      )}
      {announcements.isError && <p role="alert">Announcements could not be loaded.</p>}
      {announcements.data?.map((announcement) => (
        <article key={announcement.id} className="card nested-card">
          <div className="section-heading"><div><h3>{announcement.title}</h3><p className="muted">{announcement.audienceType} · {announcement.publishedAt ? new Date(announcement.publishedAt).toLocaleString() : 'Draft'}</p></div>
            {canManage && !announcement.publishedAt && <button onClick={() => publish.mutate(announcement.id)} disabled={publish.isPending}>Publish</button>}
          </div>
          <p>{announcement.body}</p>
        </article>
      ))}
    </section>
  );
}
