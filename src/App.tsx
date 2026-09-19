import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AcademicYear,
  ApplicationListItem,
  CurrentUser,
  getApplicationStatus,
  getCurrentUser,
  listAcademicYears,
  listApplications,
  listSchoolClasses,
  login,
  logoutLocal,
  admitApplication,
  reviewApplication,
} from './api/client';
import { FinanceWorkspace } from './FinanceWorkspace';
import { FinanceReceiptsWorkspace } from './FinanceReceiptsWorkspace';
import { GradingPolicyWorkspace } from './GradingPolicyWorkspace';
import { GuardianWorkspace } from './GuardianWorkspace';
import { StaffWorkspace } from './StaffWorkspace';

function PortalLogin({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const mutation = useMutation({ mutationFn: () => login(identifier.trim(), password), onSuccess: onLoggedIn });

  return (
    <main className="shell narrow">
      <header>
        <p className="eyebrow">Business College International</p>
        <h1>BCI portal</h1>
        <p className="muted">Sign in as an authorized BCI staff member or guardian.</p>
      </header>
      <section className="card">
        <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>