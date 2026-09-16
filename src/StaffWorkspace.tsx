import { useQuery } from '@tanstack/react-query';
import { CurrentUser, getMyStaffProfile } from './api/client';
import { AcademicReportWorkspace } from './AcademicReportWorkspace';
import { AnnouncementCenter } from './AnnouncementCenter';
import { AnnouncementOperationsWorkspace } from './AnnouncementOperationsWorkspace';
import { AcademicControlCenter } from './AcademicControlCenter';
import { AdmissionsQueueWorkspace } from './AdmissionsQueueWorkspace';
import { AttendanceAnalyticsWorkspace } from './AttendanceAnalyticsWorkspace';
import { AuditCenter } from './AuditCenter';
import { ClassRosterWorkspace } from './ClassRosterWorkspace';
import { ConfigurationWorkspace } from './ConfigurationWorkspace';
import { FinanceIntegrityWorkspace } from './FinanceIntegrityWorkspace';
import { FinanceReceivablesWorkspace } from './FinanceReceivablesWorkspace';
import { NotificationCenter } from './NotificationCenter';
import { RefundWorkspace } from './RefundWorkspace';
import { ReportReadinessWorkspace } from './ReportReadinessWorkspace';
import { SecurityWorkspace } from './SecurityWorkspace';
import { StationeryOperationsWorkspace } from './StationeryWorkspace';
import { StudentDirectory } from './StudentDirectory';
import { TeacherAssignmentManagementWorkspace } from './TeacherAssignmentManagementWorkspace';
import { TeacherAssessmentWorkspace } from './TeacherAssessmentWorkspace';
import { TeacherAttendanceWorkspace } from './TeacherAttendanceWorkspace';

export function StaffWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const enabled = currentUser.permissions.includes('staff.read');
  const canTakeAttendance = currentUser.permissions.includes('attendance.manage');
  const canEnterAssessments = currentUser.permissions.includes('assessments.manage');
  const profile = useQuery({ queryKey: ['staff-me'], queryFn: getMyStaffProfile, enabled });

  if (!enabled) return null;

  return (
    <>
      <AuditCenter currentUser={currentUser} />
      <NotificationCenter currentUser={currentUser} />
      <SecurityWorkspace currentUser={currentUser} />
      <AdmissionsQueueWorkspace currentUser={currentUser} />
      <AcademicControlCenter currentUser={currentUser} />
      <AcademicReportWorkspace currentUser={currentUser} />
      <ReportReadinessWorkspace currentUser={currentUser} />
      <TeacherAssignmentManagementWorkspace currentUser={currentUser} />
      <AttendanceAnalyticsWorkspace currentUser={currentUser} />
      <FinanceReceivablesWorkspace currentUser={currentUser} />
      <FinanceIntegrityWorkspace currentUser={currentUser} />
      <RefundWorkspace currentUser={currentUser} />
      <StationeryOperationsWorkspace currentUser={currentUser} />
      <section className="card">
        <h2>My staff workspace</h2>
        {profile.isLoading && <p>Loading your staff duties and teaching assignments…</p>}
        {profile.isError && <p role="alert">Your staff profile could not be loaded.</p>}
        {profile.data && (
          <>
            <p className="muted">
              {profile.data.person.firstName} {profile.data.person.lastName} · {profile.data.staffIdNo}
              {profile.data.department ? ` · ${profile.data.department}` : ''}
            </p>
            <div className="detail-grid">
              <span><strong>Employment</strong>{profile.data.employmentStatus}</span>
              <span><strong>Active duties</strong>{profile.data.duties.length}</span>
              <span><strong>Teaching assignments</strong>{profile.data.teaching.length}</span>
            </div>
            {profile.data.duties.length > 0 && (
              <div>
                <h3>Duties</h3>
                <div className="table-wrap"><table><thead><tr><th>Duty</th><th>Start</th><th>End</th></tr></thead><tbody>
                  {profile.data.duties.map((duty) => <tr key={duty.id}><td>{duty.description}</td><td>{duty.startsAt ? new Date(duty.startsAt).toLocaleString() : '—'}</td><td>{duty.endsAt ? new Date(duty.endsAt).toLocaleString() : '—'}</td></tr>)}
                </tbody></table></div>
              </div>
            )}
            {profile.data.teaching.length > 0 && (
              <div>
                <h3>Teaching assignments</h3>
                <div className="table-wrap"><table><thead><tr><th>Class</th><th>Subject</th><th>Term</th><th>Status</th></tr></thead><tbody>
                  {profile.data.teaching.map((assignment) => <tr key={assignment.id}><td>{assignment.class.name}</td><td>{assignment.subject.code} · {assignment.subject.name}</td><td>{assignment.term.name}</td><td>{assignment.term.status}</td></tr>)}
                </tbody></table></div>
              </div>
            )}
          </>
        )}
      </section>
      <ConfigurationWorkspace currentUser={currentUser} />
      <StudentDirectory currentUser={currentUser} />
      <ClassRosterWorkspace currentUser={currentUser} />
      <AnnouncementCenter currentUser={currentUser} />
      <AnnouncementOperationsWorkspace currentUser={currentUser} />
      {canTakeAttendance && profile.data && <TeacherAttendanceWorkspace assignments={profile.data.teaching} />}
      {canEnterAssessments && profile.data && <TeacherAssessmentWorkspace currentUser={currentUser} />}
    </>
  );
}
