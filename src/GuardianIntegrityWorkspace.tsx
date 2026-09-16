import { useQuery } from '@tanstack/react-query';
import { CurrentUser, api } from './api/client';

type Integrity = {
  summary: { wardCount: number; guardianLinkCount: number; findingCount: number; blockingCount: number };
  findings: Array<Record<string, unknown>>;
};

async function getIntegrity(): Promise<Integrity> {
  const response = await api.get<Integrity>('/guardians/integrity');
  return response.data;
}

export function GuardianIntegrityWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const enabled = currentUser.permissions.includes('students.manage');
  const query = useQuery({ queryKey: ['guardian-integrity'], queryFn: getIntegrity, enabled });
  if (!enabled) return null;

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Student/guardian governance</p>
          <h2>Guardian Relationship Integrity</h2>
          <p className="muted">Review primary-contact and portal-permission consistency before operational workflows depend on the relationship.</p>
        </div>
      </div>
      {query.isLoading && <p>Checking guardian relationships…</p>}
      {query.isError && <p role="alert">Guardian integrity could not be loaded.</p>}
      {query.data && (
        <>
          <div className="detail-grid">
            <span><strong>Wards reviewed</strong>{query.data.summary.wardCount}</span>
            <span><strong>Guardian links</strong>{query.data.summary.guardianLinkCount}</span>
            <span><strong>Findings</strong>{query.data.summary.findingCount}</span>
            <span><strong>Blocking</strong>{query.data.summary.blockingCount}</span>
          </div>
          {query.data.findings.length === 0 ? <p>No integrity findings.</p> : (
            <div className="table-wrap"><table><thead><tr><th>Severity</th><th>Code</th><th>Student</th><th>Guardian</th></tr></thead><tbody>
              {query.data.findings.map((finding, index) => (
                <tr key={`${String(finding.code)}-${String(finding.studentId)}-${String(finding.guardianId ?? index)}`}>
                  <td>{String(finding.severity)}</td>
                  <td>{String(finding.code)}</td>
                  <td>{String(finding.studentId ?? '—')}</td>
                  <td>{String(finding.guardianId ?? '—')}</td>
                </tr>
              ))}
            </tbody></table></div>
          )}
        </>
      )}
    </section>
  );
}
