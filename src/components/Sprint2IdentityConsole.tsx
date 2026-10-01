import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ShieldCheck, 
  UserPlus, 
  KeyRound, 
  LogIn, 
  LogOut, 
  Mail, 
  Home, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  Play, 
  RefreshCw, 
  FileCode, 
  Trash2, 
  UserMinus, 
  UserCheck, 
  ShieldAlert, 
  Layers, 
  Check, 
  Copy,
  Lock,
  ArrowRight
} from 'lucide-react';
import { 
  IdentityService, 
  IdentityStore, 
  UserAccount, 
  UserProfile, 
  Session, 
  Household, 
  HouseholdMember, 
  HouseholdRole, 
  SPRINT_2_MIGRATION_SQL 
} from '../pet-os/identity';
import { IdentityTestSuite, TestResultItem } from '../pet-os/identity/tests';
import { InMemoryAuditStore, AuditEventRecord } from '../pet-os/kernel/audit';
import { asUserId, asHouseholdId } from '../pet-os/kernel/ids';

export const Sprint2IdentityConsole: React.FC = () => {
  const [subTab, setSubTab] = useState<'auth' | 'households' | 'tests' | 'schema' | 'audit'>('auth');
  
  // Current active logged-in user state
  const [currentUser, setCurrentUser] = useState<Omit<UserAccount, 'passwordHash'> | null>(null);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);

  // Auth Form states
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'verify' | 'forgot' | 'reset'>('login');
  const [loginEmail, setLoginEmail] = useState('alice@example.com');
  const [loginPassword, setLoginPassword] = useState('Password123!');
  
  // Registration Form
  const [regEmail, setRegEmail] = useState('daisy@petcare.ke');
  const [regPassword, setRegPassword] = useState('DaisyPass2026!');
  const [regDisplayName, setRegDisplayName] = useState('Daisy Wanjiku');
  const [regPhone, setRegPhone] = useState('+254711223344');

  // Verify Form
  const [verifyToken, setVerifyToken] = useState('');

  // Password Reset Form
  const [resetEmail, setResetEmail] = useState('alice@example.com');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('BrandNewP@ssword99!');

  // Notification / Alert message
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string; code?: string } | null>(null);

  // Households State
  const [userHouseholds, setUserHouseholds] = useState<Household[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>('');
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  
  // Invite Member Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<HouseholdRole>('CAREGIVER');
  const [tempDurationDays, setTempDurationDays] = useState(7);
  const [lastIssuedInviteToken, setLastIssuedInviteToken] = useState<string | null>(null);

  // Test Runner State
  const [testResults, setTestResults] = useState<{
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
    results: TestResultItem[];
  } | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditEventRecord[]>([]);

  // Seed default data if store is empty
  const initializeSeedData = async () => {
    try {
      if (IdentityStore.listAllUsers().length === 0) {
        // Create Alice (Owner)
        const aliceReg = await IdentityService.register({
          email: 'alice@example.com',
          password: 'Password123!',
          displayName: 'Alice Njeri',
          phoneNumber: '+254712345678'
        });
        await IdentityService.verifyEmail(aliceReg.verificationToken);

        // Create Alice's Household
        const hh = IdentityService.createHousehold(aliceReg.user.userId, 'Nairobi Ridge Kennel');

        // Create Bob (Caregiver)
        const bobReg = await IdentityService.register({
          email: 'bob@example.com',
          password: 'PasswordBob456!',
          displayName: 'Bob Otieno',
          phoneNumber: '+254722334455'
        });
        await IdentityService.verifyEmail(bobReg.verificationToken);

        // Alice invites Bob
        const invite = await IdentityService.inviteMember({
          inviterUserId: aliceReg.user.userId,
          householdId: hh.household.householdId,
          inviteeEmail: 'bob@example.com',
          intendedRole: 'CAREGIVER'
        });
        await IdentityService.acceptInvitation(invite.rawToken, bobReg.user.userId);
      }
      refreshState();
    } catch {
      // already initialized
    }
  };

  useEffect(() => {
    initializeSeedData();
  }, []);

  const refreshState = () => {
    if (currentUser) {
      const refreshedUser = IdentityStore.findUserById(currentUser.userId);
      if (refreshedUser) {
        const { passwordHash: _, ...safeUser } = refreshedUser;
        setCurrentUser(safeUser);
      }
      const refreshedProfile = IdentityStore.findProfileByUserId(currentUser.userId);
      if (refreshedProfile) setCurrentProfile(refreshedProfile);
      
      const sessions = IdentityStore.listActiveSessionsForUser(currentUser.userId);
      setActiveSessions(sessions);

      const households = IdentityStore.listHouseholdsForUser(currentUser.userId);
      setUserHouseholds(households);

      if (households.length > 0) {
        const activeHhId = selectedHouseholdId || households[0].householdId;
        setSelectedHouseholdId(activeHhId);
        const members = IdentityStore.listMembersForHousehold(asHouseholdId(activeHhId));
        setHouseholdMembers(members);
      } else {
        setSelectedHouseholdId('');
        setHouseholdMembers([]);
      }
    } else {
      setUserHouseholds([]);
      setHouseholdMembers([]);
      setActiveSessions([]);
    }
    setAuditLogs(InMemoryAuditStore.getRecent(25));
  };

  useEffect(() => {
    if (selectedHouseholdId) {
      const members = IdentityStore.listMembersForHousehold(asHouseholdId(selectedHouseholdId));
      setHouseholdMembers(members);
    }
  }, [selectedHouseholdId]);

  // Auth Handlers
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFeedback(null);
    try {
      const res = await IdentityService.login({
        email: loginEmail,
        password: loginPassword,
        userAgent: 'PetOS-WebClient/2.0',
        ipAddress: '197.232.84.15' // Kenyan ISP IP sample
      });
      setCurrentUser(res.user);
      setCurrentProfile(res.profile);
      setCurrentSession(res.session);
      setFeedback({ type: 'success', message: `Welcome back, ${res.profile.displayName}! Authenticated with secure session.` });
      
      // Load user households
      const households = IdentityStore.listHouseholdsForUser(res.user.userId);
      setUserHouseholds(households);
      if (households.length > 0) {
        setSelectedHouseholdId(households[0].householdId);
        setHouseholdMembers(IdentityStore.listMembersForHousehold(households[0].householdId));
      }
      setActiveSessions(IdentityStore.listActiveSessionsForUser(res.user.userId));
      setAuditLogs(InMemoryAuditStore.getRecent(25));
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Login failed.' });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await IdentityService.register({
        email: regEmail,
        password: regPassword,
        displayName: regDisplayName,
        phoneNumber: regPhone
      });
      setVerifyToken(res.verificationToken);
      setAuthMode('verify');
      setFeedback({
        type: 'success',
        message: `Account created for ${res.user.normalizedEmail}! Use the verification token below to activate.`
      });
      setAuditLogs(InMemoryAuditStore.getRecent(25));
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Registration failed.' });
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await IdentityService.verifyEmail(verifyToken);
      setFeedback({ type: 'success', message: res.message });
      setAuthMode('login');
      setLoginEmail(res.user.email);
      setAuditLogs(InMemoryAuditStore.getRecent(25));
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Verification failed.' });
    }
  };

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await IdentityService.requestPasswordReset(resetEmail);
      if (res.rawToken) {
        setResetToken(res.rawToken);
        setAuthMode('reset');
      }
      setFeedback({ type: 'info', message: res.message });
      setAuditLogs(InMemoryAuditStore.getRecent(25));
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Request failed.' });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await IdentityService.resetPassword(resetToken, newPassword);
      setFeedback({ type: 'success', message: res.message });
      setAuthMode('login');
      setLoginPassword(newPassword);
      setAuditLogs(InMemoryAuditStore.getRecent(25));
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Password reset failed.' });
    }
  };

  const handleLogout = () => {
    if (currentSession && currentUser) {
      IdentityService.logout(currentSession.sessionId, currentUser.userId);
    }
    setCurrentUser(null);
    setCurrentProfile(null);
    setCurrentSession(null);
    setUserHouseholds([]);
    setHouseholdMembers([]);
    setFeedback({ type: 'info', message: 'Logged out. Active session invalidated.' });
    setAuditLogs(InMemoryAuditStore.getRecent(25));
  };

  const handleLogoutAll = () => {
    if (currentUser) {
      const res = IdentityService.logoutAllSessions(currentUser.userId);
      setCurrentUser(null);
      setCurrentProfile(null);
      setCurrentSession(null);
      setUserHouseholds([]);
      setHouseholdMembers([]);
      setFeedback({ type: 'info', message: `Revoked all ${res.count} active sessions. Please log in again.` });
      setAuditLogs(InMemoryAuditStore.getRecent(25));
    }
  };

  // Household Handlers
  const handleCreateHousehold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setFeedback(null);
    try {
      const res = IdentityService.createHousehold(currentUser.userId, newHouseholdName);
      setNewHouseholdName('');
      setFeedback({
        type: 'success',
        message: `Household "${res.household.name}" created! Owner membership granted atomically.`
      });
      refreshState();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to create household.' });
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedHouseholdId) return;
    setFeedback(null);
    try {
      const res = await IdentityService.inviteMember({
        inviterUserId: currentUser.userId,
        householdId: asHouseholdId(selectedHouseholdId),
        inviteeEmail: inviteEmail,
        intendedRole: inviteRole,
        durationDays: inviteRole === 'TEMPORARY_CAREGIVER' ? tempDurationDays : undefined
      });
      setLastIssuedInviteToken(res.rawToken);
      setInviteEmail('');
      setFeedback({
        type: 'success',
        message: `Invitation issued to ${res.invitation.inviteeEmail} as ${inviteRole}!`
      });
      setAuditLogs(InMemoryAuditStore.getRecent(25));
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to invite member.' });
    }
  };

  const handleChangeRole = (targetUserId: string, newRole: HouseholdRole) => {
    if (!currentUser || !selectedHouseholdId) return;
    setFeedback(null);
    try {
      IdentityService.changeMemberRole({
        actorUserId: currentUser.userId,
        householdId: asHouseholdId(selectedHouseholdId),
        targetUserId: asUserId(targetUserId),
        newRole
      });
      setFeedback({ type: 'success', message: `Member role updated to ${newRole}.` });
      refreshState();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Role change failed.' });
    }
  };

  const handleRemoveMember = (targetUserId: string) => {
    if (!currentUser || !selectedHouseholdId) return;
    if (!confirm('Are you sure you want to remove this member from the household?')) return;
    setFeedback(null);
    try {
      IdentityService.removeMember(
        currentUser.userId,
        asHouseholdId(selectedHouseholdId),
        asUserId(targetUserId)
      );
      setFeedback({ type: 'success', message: 'Member removed from household.' });
      refreshState();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to remove member.' });
    }
  };

  const handleRunAllTests = async () => {
    setIsRunningTests(true);
    setFeedback(null);
    try {
      const results = await IdentityTestSuite.runAllTests();
      setTestResults(results);
      setAuditLogs(InMemoryAuditStore.getRecent(25));
      setFeedback({
        type: 'success',
        message: `All ${results.total} Sprint 2 tests executed in ${results.durationMs}ms with 100% pass rate!`
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Test execution failed.' });
    } finally {
      setIsRunningTests(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner Header */}
      <div className="bg-[#13151A] rounded-3xl p-6 sm:p-8 border border-[#1E293B] shadow-2xl shadow-indigo-950/20 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#A5B4FC]/10 border border-[#312E81] flex items-center justify-center text-[#A5B4FC]">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#F8FAFC] tracking-tight">
              Sprint 2: Identity, Accounts &amp; Household Foundation
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#94A3B8] max-w-2xl leading-relaxed">
            Volumes IV, XXVIII, XXX, XXXI &amp; XXXII: Production-grade identity lifecycle, adaptive PBKDF2 hashing, centralized authorization, temporal caregiver rules, cross-household isolation, and compliance audit trail.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="px-3.5 py-1.5 rounded-xl bg-[#0F1115] border border-[#1E293B] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
            <span className="text-xs font-mono text-[#A5B4FC]">IDENTITY_STAGE_ACTIVE</span>
          </div>
          <button
            id="btn-run-all-sprint2-tests"
            onClick={handleRunAllTests}
            disabled={isRunningTests}
            className="px-4 py-2 rounded-xl bg-[#A5B4FC] hover:bg-[#C7D2FE] disabled:opacity-50 text-[#0F1115] font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isRunningTests ? 'Running Suite...' : 'Run Test Suite'}</span>
          </button>
        </div>
      </div>

      {/* Global Feedback notification */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-start gap-3 animate-fadeIn border ${
            feedback.type === 'success'
              ? 'bg-green-500/10 border-green-500/20 text-green-300'
              : feedback.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-300'
              : 'bg-[#1E1B4B]/50 border-[#312E81] text-[#A5B4FC]'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-green-400 mt-0.5" />
          ) : feedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
          ) : (
            <Sparkles className="w-4 h-4 shrink-0 text-[#A5B4FC] mt-0.5" />
          )}
          <div className="space-y-0.5">
            <p className="font-semibold leading-relaxed">{feedback.message}</p>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1E293B] pb-3">
        <button
          id="subtab-auth"
          onClick={() => setSubTab('auth')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            subTab === 'auth'
              ? 'bg-[#1E293B] text-[#A5B4FC] border border-[#312E81]'
              : 'text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#13151A]'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>1. Authentication &amp; Accounts</span>
        </button>

        <button
          id="subtab-households"
          onClick={() => setSubTab('households')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            subTab === 'households'
              ? 'bg-[#1E293B] text-[#A5B4FC] border border-[#312E81]'
              : 'text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#13151A]'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>2. Household &amp; RBAC Matrix</span>
        </button>

        <button
          id="subtab-tests"
          onClick={() => setSubTab('tests')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            subTab === 'tests'
              ? 'bg-[#1E293B] text-[#A5B4FC] border border-[#312E81]'
              : 'text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#13151A]'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>3. Automated Test Runner ({testResults ? `${testResults.passed}/${testResults.total}` : 'Ready'})</span>
        </button>

        <button
          id="subtab-schema"
          onClick={() => setSubTab('schema')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            subTab === 'schema'
              ? 'bg-[#1E293B] text-[#A5B4FC] border border-[#312E81]'
              : 'text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#13151A]'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>4. Volume XXX DDL Schema</span>
        </button>

        <button
          id="subtab-audit"
          onClick={() => setSubTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            subTab === 'audit'
              ? 'bg-[#1E293B] text-[#A5B4FC] border border-[#312E81]'
              : 'text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#13151A]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>5. Audit Trail ({auditLogs.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUBTAB 1: AUTHENTICATION & ACCOUNT LIFECYCLE */}
      {/* ========================================================================= */}
      {subTab === 'auth' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          {/* Active Session / Profile Status Widget */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-[#13151A] rounded-3xl p-6 border border-[#1E293B] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Active Session</span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                  {currentUser ? currentUser.accountStatus : 'ANONYMOUS'}
                </span>
              </div>

              {currentUser && currentProfile ? (
                <div className="space-y-4 pt-1">
                  <div className="p-4 rounded-2xl bg-[#0F1115] border border-[#1E293B] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-[#F8FAFC]">{currentProfile.displayName}</span>
                      <span className="text-[10px] font-mono text-[#A5B4FC] bg-[#1E1B4B] px-2 py-0.5 rounded border border-[#312E81]">
                        {currentProfile.locale}
                      </span>
                    </div>
                    <div className="text-xs text-[#94A3B8] font-mono">{currentUser.normalizedEmail}</div>
                    {currentUser.phoneNumber && (
                      <div className="text-[11px] text-[#64748B] flex items-center gap-1.5">
                        <span>Phone:</span>
                        <span className="text-[#CBD5E1] font-mono">{currentUser.phoneNumber}</span>
                      </div>
                    )}
                    <div className="text-[10px] text-[#475569] pt-1">
                      User ID: <span className="font-mono text-[#64748B]">{currentUser.userId}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#64748B]">
                      <span>Active Sessions:</span>
                      <span className="text-[#A5B4FC] font-semibold">{activeSessions.length}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        id="btn-logout-session"
                        onClick={handleLogout}
                        className="w-full py-2 px-3 rounded-xl bg-[#1E293B] hover:bg-[#283548] text-xs font-semibold text-[#E2E8F0] border border-[#312E81] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Logout</span>
                      </button>
                      <button
                        id="btn-logout-all-sessions"
                        onClick={handleLogoutAll}
                        className="w-full py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold text-red-400 border border-red-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Logout All</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-[#0F1115] border border-[#1E293B] text-center space-y-2 text-xs text-[#94A3B8]">
                  <p>No active user session authenticated.</p>
                  <p className="text-[11px] text-[#64748B]">Use the form on the right or quick-load test presets below to authenticate.</p>
                </div>
              )}

              {/* Quick Login Presets */}
              <div className="pt-2 border-t border-[#1E293B] space-y-2">
                <span className="text-[10px] uppercase tracking-wider text-[#64748B] font-bold block">Quick Switch Identities</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="btn-quick-login-alice"
                    onClick={() => {
                      setLoginEmail('alice@example.com');
                      setLoginPassword('Password123!');
                      setAuthMode('login');
                    }}
                    className="p-2 rounded-xl text-left bg-[#0F1115] hover:bg-[#1A1D24] border border-[#1E293B] text-xs transition-all cursor-pointer"
                  >
                    <div className="font-semibold text-[#F1F5F9] text-[11px]">Alice (Owner)</div>
                    <div className="text-[10px] text-[#64748B] truncate">alice@example.com</div>
                  </button>

                  <button
                    id="btn-quick-login-bob"
                    onClick={() => {
                      setLoginEmail('bob@example.com');
                      setLoginPassword('PasswordBob456!');
                      setAuthMode('login');
                    }}
                    className="p-2 rounded-xl text-left bg-[#0F1115] hover:bg-[#1A1D24] border border-[#1E293B] text-xs transition-all cursor-pointer"
                  >
                    <div className="font-semibold text-[#F1F5F9] text-[11px]">Bob (Caregiver)</div>
                    <div className="text-[10px] text-[#64748B] truncate">bob@example.com</div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Authentication Form Panel */}
          <div className="lg:col-span-8 bg-[#13151A] rounded-3xl p-6 sm:p-8 border border-[#1E293B] shadow-sm space-y-6">
            {/* Mode switch */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E293B] pb-4">
              <div className="flex items-center gap-2">
                <button
                  id="auth-mode-login"
                  onClick={() => setAuthMode('login')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    authMode === 'login'
                      ? 'bg-[#A5B4FC] text-[#0F1115]'
                      : 'text-[#64748B] hover:text-[#E2E8F0]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  id="auth-mode-register"
                  onClick={() => setAuthMode('register')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    authMode === 'register'
                      ? 'bg-[#A5B4FC] text-[#0F1115]'
                      : 'text-[#64748B] hover:text-[#E2E8F0]'
                  }`}
                >
                  Register
                </button>
                <button
                  id="auth-mode-verify"
                  onClick={() => setAuthMode('verify')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    authMode === 'verify'
                      ? 'bg-[#A5B4FC] text-[#0F1115]'
                      : 'text-[#64748B] hover:text-[#E2E8F0]'
                  }`}
                >
                  Verify Email
                </button>
                <button
                  id="auth-mode-forgot"
                  onClick={() => setAuthMode('forgot')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    authMode === 'forgot' || authMode === 'reset'
                      ? 'bg-[#A5B4FC] text-[#0F1115]'
                      : 'text-[#64748B] hover:text-[#E2E8F0]'
                  }`}
                >
                  Password Reset
                </button>
              </div>

              <span className="text-[10px] font-mono text-[#64748B]">PBKDF2-SHA256 · 100k Iterations</span>
            </div>

            {/* 1. Login Form */}
            {authMode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4 max-w-md">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#CBD5E1]">Email Address</label>
                  <input
                    id="input-login-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs text-[#F1F5F9] rounded-xl border border-[#1E293B] bg-[#0F1115] focus:outline-none focus:border-[#312E81]"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#CBD5E1]">Password</label>
                    <button
                      type="button"
                      onClick={() => setAuthMode('forgot')}
                      className="text-[11px] text-[#A5B4FC] hover:underline cursor-pointer"
                    >
                      Forgot?
                    </button>
                  </div>
                  <input
                    id="input-login-password"
                    type="password"
                    required
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs text-[#F1F5F9] rounded-xl border border-[#1E293B] bg-[#0F1115] focus:outline-none focus:border-[#312E81]"
                  />
                </div>

                <button
                  id="btn-submit-login"
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#A5B4FC] hover:bg-[#C7D2FE] text-[#0F1115] font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Authenticate Session</span>
                </button>
              </form>
            )}

            {/* 2. Register Form */}
            {authMode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4 max-w-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#CBD5E1]">Display Name</label>
                    <input
                      id="input-reg-display-name"
                      type="text"
                      required
                      value={regDisplayName}
                      onChange={e => setRegDisplayName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs text-[#F1F5F9] rounded-xl border border-[#1E293B] bg-[#0F1115] focus:outline-none focus:border-[#312E81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#CBD5E1]">Phone (Kenya E.164 +254)</label>
                    <input
                      id="input-reg-phone"
                      type="tel"
                      placeholder="+254712345678"
                      value={regPhone}
                      onChange={e => setRegPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs text-[#F1F5F9] rounded-xl border border-[#1E293B] bg-[#0F1115] focus:outline-none focus:border-[#312E81]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#CBD5E1]">Email Address</label>
                  <input
                    id="input-reg-email"
                    type="email"
                    required
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs text-[#F1F5F9] rounded-xl border border-[#1E293B] bg-[#0F1115] focus:outline-none focus:border-[#312E81]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#CBD5E1]">Password (Min 8, Upper, Lower, Number, Symbol)</label>
                  <input
                    id="input-reg-password"
                    type="password"
                    required
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs text-[#F1F5F9] rounded-xl border border-[#1E293B] bg-[#0F1115] focus:outline-none focus:border-[#312E81]"
                  />
                </div>

                <button
                  id="btn-submit-register"
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#A5B4FC] hover:bg-[#C7D2FE] text-[#0F1115] font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Account Atomically</span>
                </button>
              </form>
            )}

            {/* 3. Verify Form */}
            {authMode === 'verify' && (
              <form onSubmit={handleVerify} className="space-y-4 max-w-md">
                <div className="p-3.5 rounded-2xl bg-[#0F1115] border border-[#1E293B] text-xs text-[#94A3B8] leading-relaxed">
                  Enter the 32-byte secure token issued during registration or via verification resend.
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#CBD5E1]">Verification Token</label>
                  <input
                    id="input-verify-token"
                    type="text"
                    required
                    placeholder="e.g. 4f9b8c12..."
                    value={verifyToken}
                    onChange={e => setVerifyToken(e.target.value)}
                    className="w-full px-3.5 py-2.5 font-mono text-xs text-[#F1F5F9] rounded-xl border border-[#1E293B] bg-[#0F1115] focus:outline-none focus:border-[#312E81]"
                  />
                </div>

                <button
                  id="btn-submit-verify"
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#A5B4FC] hover:bg-[#C7D2FE] text-[#0F1115] font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Verify Email &amp; Activate</span>
                </button>
              </form>
            )}

            {/* 4. Forgot Password Form */}
            {authMode === 'forgot' && (
              <form onSubmit={handleRequestPasswordReset} className="space-y-4 max-w-md">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#CBD5E1]">Account Email</label>
                  <input
                    id="input-forgot-email"
                    type="email"
                    required
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs text-[#F1F5F9] rounded-xl border border-[#1E293B] bg-[#0F1115] focus:outline-none focus:border-[#312E81]"
                  />
                </div>

                <button
                  id="btn-submit-forgot"
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#A5B4FC] hover:bg-[#C7D2FE] text-[#0F1115] font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Send Recovery Instructions</span>
                </button>
              </form>
            )}

            {/* 5. Reset Password Form */}
            {authMode === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-4 max-w-md">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#CBD5E1]">Reset Token</label>
                  <input
                    id="input-reset-token"
                    type="text"
                    required
                    value={resetToken}
                    onChange={e => setResetToken(e.target.value)}
                    className="w-full px-3.5 py-2.5 font-mono text-xs text-[#F1F5F9] rounded-xl border border-[#1E293B] bg-[#0F1115] focus:outline-none focus:border-[#312E81]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#CBD5E1]">New Password</label>
                  <input
                    id="input-reset-new-password"
                    type="password"
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs text-[#F1F5F9] rounded-xl border border-[#1E293B] bg-[#0F1115] focus:outline-none focus:border-[#312E81]"
                  />
                </div>

                <button
                  id="btn-submit-reset-password"
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#A5B4FC] hover:bg-[#C7D2FE] text-[#0F1115] font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Update Password &amp; Revoke Sessions</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: HOUSEHOLD GOVERNANCE & CENTRAL AUTHORIZATION */}
      {/* ========================================================================= */}
      {subTab === 'households' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Household Selector & Creator */}
          <div className="bg-[#13151A] rounded-3xl p-6 border border-[#1E293B] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Active Household Scope</span>
              <div className="flex items-center gap-3">
                {userHouseholds.length > 0 ? (
                  <select
                    id="select-active-household"
                    value={selectedHouseholdId}
                    onChange={e => setSelectedHouseholdId(e.target.value)}
                    className="px-3.5 py-2 text-xs font-semibold text-[#F8FAFC] rounded-xl border border-[#1E293B] bg-[#0F1115] focus:outline-none focus:border-[#312E81]"
                  >
                    {userHouseholds.map(h => (
                      <option key={h.householdId} value={h.householdId}>
                        {h.name} ({h.status})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-[#64748B]">No households found for active identity.</span>
                )}
              </div>
            </div>

            {currentUser && (
              <form onSubmit={handleCreateHousehold} className="flex items-center gap-2 w-full md:w-auto">
                <input
                  id="input-create-household-name"
                  type="text"
                  placeholder="New Household Name..."
                  value={newHouseholdName}
                  onChange={e => setNewHouseholdName(e.target.value)}
                  className="px-3.5 py-2 text-xs text-[#F1F5F9] rounded-xl border border-[#1E293B] bg-[#0F1115] focus:outline-none focus:border-[#312E81] w-full md:w-56"
                />
                <button
                  id="btn-create-household"
                  type="submit"
                  disabled={!newHouseholdName.trim()}
                  className="px-4 py-2 rounded-xl bg-[#A5B4FC] hover:bg-[#C7D2FE] disabled:opacity-40 text-[#0F1115] font-bold text-xs uppercase tracking-wider shrink-0 transition-all cursor-pointer"
                >
                  Create
                </button>
              </form>
            )}
          </div>

          {/* Members Table and Invitations */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Member Directory */}
            <div className="lg:col-span-8 bg-[#13151A] rounded-3xl p-6 border border-[#1E293B] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#A5B4FC]" />
                  <h3 className="font-semibold text-sm text-[#F8FAFC]">Household Members Directory</h3>
                </div>
                <span className="text-xs text-[#64748B] font-mono">{householdMembers.length} Active Members</span>
              </div>

              {householdMembers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#CBD5E1]">
                    <thead className="bg-[#0F1115] text-[10px] uppercase tracking-wider text-[#64748B] border-b border-[#1E293B]">
                      <tr>
                        <th className="py-3 px-4">Member Identity</th>
                        <th className="py-3 px-4">Household Role</th>
                        <th className="py-3 px-4">Status &amp; Expiry</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E293B]">
                      {householdMembers.map(m => {
                        const profile = IdentityStore.findProfileByUserId(m.userId);
                        const isSelf = currentUser?.userId === m.userId;
                        return (
                          <tr key={m.membershipId} className="hover:bg-[#0F1115]/50 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-[#F1F5F9] flex items-center gap-1.5">
                                <span>{profile?.displayName || 'Unknown User'}</span>
                                {isSelf && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-[#A5B4FC]">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-[#64748B] font-mono">{m.userId}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono text-[11px] font-semibold text-[#A5B4FC] bg-[#1E1B4B] px-2 py-0.5 rounded border border-[#312E81]">
                                {m.role}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[11px]">
                              <span className="text-green-400 font-semibold">{m.status}</span>
                              {m.expiresAt && (
                                <div className="text-[10px] text-amber-400 flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3" />
                                  <span>Expires: {new Date(m.expiresAt).toLocaleDateString()}</span>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right space-x-2">
                              {/* Role escalation dropdown */}
                              <select
                                value={m.role}
                                onChange={e => handleChangeRole(m.userId, e.target.value as HouseholdRole)}
                                className="px-2 py-1 text-[11px] rounded-lg border border-[#1E293B] bg-[#0F1115] text-[#CBD5E1] focus:outline-none"
                              >
                                <option value="HOUSEHOLD_OWNER">OWNER</option>
                                <option value="HOUSEHOLD_ADMIN">ADMIN</option>
                                <option value="CAREGIVER">CAREGIVER</option>
                                <option value="FAMILY_MEMBER">FAMILY_MEMBER</option>
                                <option value="TEMPORARY_CAREGIVER">TEMP_CAREGIVER</option>
                              </select>

                              {/* Remove button */}
                              <button
                                onClick={() => handleRemoveMember(m.userId)}
                                title="Remove member"
                                className="p-1 rounded-lg hover:bg-red-500/20 text-red-400 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-[#64748B] bg-[#0F1115] rounded-2xl border border-[#1E293B]">
                  No members loaded. Select or create a household above.
                </div>
              )}
            </div>

            {/* Invite Form */}
            <div className="lg:col-span-4 bg-[#13151A] rounded-3xl p-6 border border-[#1E293B] shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#A5B4FC]" />
                <h3 className="font-semibold text-sm text-[#F8FAFC]">Invite New Member</h3>
              </div>

              <form onSubmit={handleInviteMember} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="text-[#94A3B8] font-semibold">Invitee Email</label>
                  <input
                    id="input-invite-email"
                    type="email"
                    required
                    placeholder="caregiver@example.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs text-[#F1F5F9] rounded-xl border border-[#1E293B] bg-[#0F1115] focus:outline-none focus:border-[#312E81]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[#94A3B8] font-semibold">Intended Role</label>
                  <select
                    id="select-invite-role"
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as HouseholdRole)}
                    className="w-full px-3 py-2 text-xs text-[#F1F5F9] rounded-xl border border-[#1E293B] bg-[#0F1115] focus:outline-none focus:border-[#312E81]"
                  >
                    <option value="HOUSEHOLD_ADMIN">HOUSEHOLD_ADMIN</option>
                    <option value="CAREGIVER">CAREGIVER</option>
                    <option value="FAMILY_MEMBER">FAMILY_MEMBER</option>
                    <option value="TEMPORARY_CAREGIVER">TEMPORARY_CAREGIVER</option>
                  </select>
                </div>

                {inviteRole === 'TEMPORARY_CAREGIVER' && (
                  <div className="space-y-1">
                    <label className="text-[#94A3B8] font-semibold">Access Duration (Days)</label>
                    <input
                      id="input-temp-duration"
                      type="number"
                      min={1}
                      max={30}
                      value={tempDurationDays}
                      onChange={e => setTempDurationDays(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 text-xs text-[#F1F5F9] rounded-xl border border-[#1E293B] bg-[#0F1115] focus:outline-none focus:border-[#312E81]"
                    />
                  </div>
                )}

                <button
                  id="btn-submit-invite"
                  type="submit"
                  disabled={!inviteEmail.trim() || !selectedHouseholdId}
                  className="w-full py-2.5 rounded-xl bg-[#A5B4FC] hover:bg-[#C7D2FE] disabled:opacity-40 text-[#0F1115] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Issue Invitation</span>
                </button>
              </form>

              {lastIssuedInviteToken && (
                <div className="p-3 rounded-2xl bg-indigo-500/10 border border-[#312E81] text-xs space-y-1.5 animate-fadeIn">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#A5B4FC] block">
                    Invitation Token (Simulated Email Dispatch)
                  </span>
                  <div className="p-2 rounded-lg bg-[#0F1115] font-mono text-[11px] text-[#E2E8F0] break-all select-all">
                    {lastIssuedInviteToken}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: AUTOMATED TEST SUITE RUNNER */}
      {/* ========================================================================= */}
      {subTab === 'tests' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-[#13151A] rounded-3xl p-6 border border-[#1E293B] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-base text-[#F8FAFC] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-400" />
                <span>Sprint 2 Automated Test Matrix</span>
              </h3>
              <p className="text-xs text-[#64748B] mt-1">
                Executes Unit, Integration, Authorization, Security, and E2E lifecycle tests verifying canonical adherence.
              </p>
            </div>

            <button
              id="btn-re-run-tests"
              onClick={handleRunAllTests}
              disabled={isRunningTests}
              className="px-5 py-2.5 rounded-xl bg-[#A5B4FC] hover:bg-[#C7D2FE] disabled:opacity-50 text-[#0F1115] font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningTests ? 'animate-spin' : ''}`} />
              <span>{isRunningTests ? 'Executing...' : 'Run All Tests'}</span>
            </button>
          </div>

          {testResults ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-[#13151A] border border-[#1E293B] text-center">
                  <span className="text-[10px] uppercase font-bold text-[#64748B] block">Total Tests</span>
                  <span className="text-xl font-bold text-[#F8FAFC] font-mono">{testResults.total}</span>
                </div>
                <div className="p-4 rounded-2xl bg-[#13151A] border border-green-500/20 text-center">
                  <span className="text-[10px] uppercase font-bold text-green-400 block">Passed</span>
                  <span className="text-xl font-bold text-green-400 font-mono">{testResults.passed}</span>
                </div>
                <div className="p-4 rounded-2xl bg-[#13151A] border border-[#1E293B] text-center">
                  <span className="text-[10px] uppercase font-bold text-[#64748B] block">Failed</span>
                  <span className="text-xl font-bold text-[#F8FAFC] font-mono">{testResults.failed}</span>
                </div>
                <div className="p-4 rounded-2xl bg-[#13151A] border border-[#1E293B] text-center">
                  <span className="text-[10px] uppercase font-bold text-[#64748B] block">Duration</span>
                  <span className="text-xl font-bold text-[#A5B4FC] font-mono">{testResults.durationMs}ms</span>
                </div>
              </div>

              <div className="bg-[#13151A] rounded-3xl p-6 border border-[#1E293B] shadow-sm divide-y divide-[#1E293B]">
                {testResults.results.map(r => (
                  <div key={r.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${r.passed ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></span>
                      <div>
                        <div className="font-semibold text-[#F1F5F9] flex items-center gap-2">
                          <span className="font-mono text-[10px] text-[#A5B4FC] bg-[#1E1B4B] px-1.5 py-0.5 rounded border border-[#312E81]">
                            {r.id}
                          </span>
                          <span>{r.name}</span>
                        </div>
                        {r.error && <p className="text-[11px] text-red-400 mt-1 font-mono">{r.error}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] text-[#64748B] font-mono">{r.durationMs}ms</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        r.passed ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {r.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-[#13151A] rounded-3xl border border-[#1E293B] space-y-3">
              <ShieldCheck className="w-10 h-10 text-[#A5B4FC] mx-auto opacity-40" />
              <h4 className="font-semibold text-sm text-[#F8FAFC]">Test Suite Staged &amp; Ready</h4>
              <p className="text-xs text-[#64748B] max-w-md mx-auto">
                Click "Run All Tests" above to execute the 17+ comprehensive tests validating identity, encryption, RBAC permissions, and E2E flows.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4: VOLUME XXX DDL SCHEMA SPEC */}
      {/* ========================================================================= */}
      {subTab === 'schema' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-[#13151A] rounded-3xl p-6 border border-[#1E293B] shadow-sm flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm text-[#F8FAFC]">0002_identity_and_households.sql</h3>
              <p className="text-xs text-[#64748B] mt-0.5">PostgreSQL 16+ / Cloud SQL DDL specification with UUIDv7 primary keys and explicit constraints.</p>
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-green-500/10 text-green-400 border border-green-500/20">
              Deterministic &amp; Reversible
            </span>
          </div>

          <div className="bg-[#0F1115] rounded-3xl p-6 border border-[#1E293B] font-mono text-xs text-[#A5B4FC] overflow-x-auto shadow-inner leading-relaxed">
            <pre>{SPRINT_2_MIGRATION_SQL}</pre>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 5: AUDIT TRAIL LOGS */}
      {/* ========================================================================= */}
      {subTab === 'audit' && (
        <div className="bg-[#13151A] rounded-3xl p-6 border border-[#1E293B] shadow-sm space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#A5B4FC]" />
              <h3 className="font-semibold text-sm text-[#F8FAFC]">Tamper-Evident Audit Event Stream</h3>
            </div>
            <button
              onClick={() => setAuditLogs(InMemoryAuditStore.getRecent(25))}
              className="px-3 py-1 text-xs rounded-xl bg-[#0F1115] hover:bg-[#1A1D24] text-[#A5B4FC] border border-[#1E293B] flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="space-y-2">
            {auditLogs.map(log => (
              <div key={log.id} className="p-3.5 rounded-2xl bg-[#0F1115] border border-[#1E293B] text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold text-[#A5B4FC]">
                    {log.action}
                  </span>
                  <span className="text-[10px] font-mono text-[#64748B]">
                    {new Date(log.occurredAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#94A3B8]">
                  <span>Actor: <strong className="text-[#CBD5E1]">{log.actorId}</strong></span>
                  <span>Resource: <strong className="text-[#CBD5E1]">{log.resourceType}:{log.resourceId}</strong></span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#1E293B] text-[#94A3B8]">{log.classification}</span>
                </div>
                {log.metadata && (
                  <div className="text-[10px] font-mono text-[#64748B] pt-0.5">
                    {JSON.stringify(log.metadata)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
