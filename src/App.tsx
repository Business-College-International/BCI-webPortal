import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApplicationStatus } from './api/client';

export default function App() {
  const [applicationId, setApplicationId] = useState('');
  const [submittedId, setSubmittedId] = useState('');

  const application = useQuery({
    queryKey: ['application-status', submittedId],
    queryFn: () => getApplicationStatus(submittedId),
    enabled: submittedId.length > 0,
  });

  return (
    <main className="shell">
      <header>
        <p className="eyebrow">Business College International</p>
        <h1>School Management Portal</h1>
        <p className="muted">The internal operating surface for authorized BCI staff and leadership.</p>
      </header>

      <section className="card">
        <h2>Admissions status</h2>
        <p className="muted">Use an application ID to verify the server-side application state.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSubmittedId(applicationId.trim());
          }}
        >
          <input
            aria-label="Application ID"
            placeholder="Application ID"
            value={applicationId}
            onChange={(event) => setApplicationId(event.target.value)}
          />
          <button type="submit" disabled={!applicationId.trim()}>Check status</button>
        </form>

        {application.isFetching && <p>Loading authoritative application state…</p>}
        {application.isError && <p role="alert">Application could not be loaded.</p>}
        {application.data && (
          <div className="result">
            <strong>{application.data.firstName} {application.data.lastName}</strong>
            <span>{application.data.levelApplied} · {application.data.programmeApplied}</span>
            <span>Status: {application.data.status}</span>
          </div>
        )}
      </section>
    </main>
  );
}
