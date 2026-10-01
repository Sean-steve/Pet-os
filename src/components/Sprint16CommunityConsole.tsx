import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  AlertTriangle,
  Calendar,
  MessageSquare,
  ShieldCheck,
  Search,
  Heart,
  ThumbsUp,
  Share2,
  MapPin,
  Clock,
  Sparkles,
  Award,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  UserPlus,
  UserMinus,
  Ban,
  Send,
  Plus,
  Filter,
  Flame,
  Radio,
  PawPrint,
  Check,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { CommunityService } from '../pet-os/community/service';
import { seedCommunityData } from '../pet-os/community/seed';
import { runSprint16CommunityTests, TestResult } from '../pet-os/community/tests';
import {
  CommunityProfile,
  CommunityGroup,
  CommunityPostDto,
  CommunityEvent,
  CommunityRecoveryAlert,
  PostType,
  GroupCategory,
  CommunityVisibility,
  VolunteerRole,
} from '../pet-os/community/types';
import { asUserId, asCommunityProfileId, asCommunityPostId, asCommunityGroupId, asCommunityEventId } from '../pet-os/kernel/ids';

export const Sprint16CommunityConsole: React.FC = () => {
  const service = useMemo(() => CommunityService.getInstance(), []);

  // Initialize seed data once
  const [initialized, setInitialized] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'feed' | 'alerts' | 'groups' | 'events' | 'profiles' | 'moderation' | 'tests'>('alerts');

  // Active actor profile (Elena Vance by default)
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  
  // Data state
  const [feed, setFeed] = useState<CommunityPostDto[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [alerts, setAlerts] = useState<CommunityRecoveryAlert[]>([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');
  const [selectedPostTypeFilter, setSelectedPostTypeFilter] = useState<string>('ALL');

  // Post composer state
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostType, setNewPostType] = useState<PostType>('TIP');
  const [newPostGroupId, setNewPostGroupId] = useState<string>('');
  const [newPostPetId, setNewPostPetId] = useState<string>('');

  // Comment input state per post
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Sighting report modal state
  const [reportingAlertId, setReportingAlertId] = useState<string | null>(null);
  const [sightingText, setSightingText] = useState('');
  const [sightingArea, setSightingArea] = useState('');
  const [sightingSuccess, setSightingSuccess] = useState<string | null>(null);

  // Volunteer state
  const [volunteerRole, setVolunteerRole] = useState<VolunteerRole>('SEARCH_PARTICIPANT');
  const [volunteerNotes, setVolunteerNotes] = useState('');
  const [volunteeringAlertId, setVolunteeringAlertId] = useState<string | null>(null);

  // Test suite execution
  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<{ total: number; passed: number; results: TestResult[] } | null>(null);

  const refreshData = () => {
    const currentProfileId = activeProfileId ? asCommunityProfileId(activeProfileId) : undefined;
    const allGroups = service.getGroups();
    const allEvents = service.getEvents();
    const allAlerts = service.getActiveRecoveryAlerts();
    
    setGroups(allGroups);
    setEvents(allEvents);
    setAlerts(allAlerts);

    const filterObj: any = {};
    if (selectedGroupFilter !== 'ALL') filterObj.groupId = asCommunityGroupId(selectedGroupFilter);
    if (selectedPostTypeFilter !== 'ALL') filterObj.postType = selectedPostTypeFilter as PostType;

    const posts = service.getFeed(currentProfileId, filterObj);
    setFeed(posts);
  };

  useEffect(() => {
    seedCommunityData();
    const elenaProfile = service.getProfileByUserId(asUserId('usr-elena-vance-001'));
    if (elenaProfile) {
      setActiveProfileId(elenaProfile.profileId);
    }
    setInitialized(true);
  }, [service]);

  useEffect(() => {
    if (initialized) {
      refreshData();
    }
  }, [initialized, activeProfileId, selectedGroupFilter, selectedPostTypeFilter]);

  const activeProfile = activeProfileId ? service.getProfileById(asCommunityProfileId(activeProfileId)) : undefined;
  const userPetProfiles = activeProfile ? service.getPetProfiles(activeProfile.profileId) : [];

  // Handlers
  const handleToggleReaction = (postId: string, type: 'HELPFUL' | 'LIKE' | 'CARE') => {
    if (!activeProfile) return;
    service.toggleReaction({
      targetType: 'POST',
      targetId: postId,
      profileId: activeProfile.profileId,
      reactionType: type,
    });
    refreshData();
  };

  const handleAddComment = (postId: string) => {
    if (!activeProfile) return;
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    service.addComment({
      postId: asCommunityPostId(postId),
      authorProfileId: activeProfile.profileId,
      content: text,
    });

    setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
    refreshData();
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile || !newPostContent.trim()) return;

    service.createPost({
      authorProfileId: activeProfile.profileId,
      groupId: newPostGroupId ? asCommunityGroupId(newPostGroupId) : undefined,
      petProfileId: newPostPetId ? (newPostPetId as any) : undefined,
      postType: newPostType,
      content: newPostContent.trim(),
      coarseLocationArea: activeProfile.coarseLocation.neighborhood + ', ' + activeProfile.coarseLocation.city,
    });

    setNewPostContent('');
    setNewPostGroupId('');
    setNewPostPetId('');
    refreshData();
  };

  const handleJoinGroup = (groupId: string) => {
    if (!activeProfile) return;
    try {
      service.joinGroup(asCommunityGroupId(groupId), activeProfile.profileId);
      refreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLeaveGroup = (groupId: string) => {
    if (!activeProfile) return;
    try {
      service.leaveGroup(asCommunityGroupId(groupId), activeProfile.profileId);
      refreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEventRsvp = (eventId: string, status: 'GOING' | 'INTERESTED' | 'NOT_GOING') => {
    if (!activeProfile) return;
    try {
      service.rsvpEvent({
        eventId: asCommunityEventId(eventId),
        profileId: activeProfile.profileId,
        status,
      });
      refreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReportSighting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile || !reportingAlertId || !sightingText.trim()) return;

    try {
      const sighting = service.reportCommunitySighting({
        communityAlertId: reportingAlertId as any,
        reporterProfileId: activeProfile.profileId,
        sightingTimestamp: new Date().toISOString(),
        latitude: -1.2868, // Simulated coarse reading near Kilimani
        longitude: 36.7865,
        coarseDescription: sightingArea.trim() || 'Near neighborhood compound',
        notes: sightingText.trim(),
      });

      setSightingSuccess(`Sighting verified and routed directly to Sprint 15 Recovery incident (ID: ${sighting.sightingId})! Owner notified.`);
      setSightingText('');
      setSightingArea('');
      setTimeout(() => {
        setSightingSuccess(null);
        setReportingAlertId(null);
      }, 3000);
      refreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleVolunteer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile || !volunteeringAlertId) return;

    try {
      service.volunteerForRecovery({
        alertId: volunteeringAlertId as any,
        profileId: activeProfile.profileId,
        volunteerRole,
        notes: volunteerNotes.trim(),
      });
      setVolunteeringAlertId(null);
      setVolunteerNotes('');
      refreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const runTests = async () => {
    setTestRunning(true);
    try {
      const res = await runSprint16CommunityTests();
      setTestResults(res);
    } catch (err) {
      console.error(err);
    } finally {
      setTestRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Domain Top Hero */}
      <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-r from-rose-950/40 via-slate-900/60 to-slate-950 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                SPRINT 16 ACTIVE
              </span>
              <span className="text-xs text-slate-400 font-mono">Bound to Sprint 15 Recovery &amp; Unified Kernel</span>
            </div>
            <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2.5">
              <Users className="w-7 h-7 text-rose-400" />
              Pet Community, Recovery Network &amp; Trust
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Strict privacy-first community architecture: coarse geofenced incident broadcasts, 
              sanitized pet twins (no microchips or medical records), non-algorithmic feeds, and 
              authoritative Sprint 15 sighting ingestion.
            </p>
          </div>

          {/* Actor Profile Switcher */}
          <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 p-2 rounded-xl backdrop-blur-sm self-start md:self-auto">
            <span className="text-xs text-slate-400 font-medium pl-1">Viewing as:</span>
            <select
              id="community-actor-select"
              value={activeProfileId}
              onChange={(e) => setActiveProfileId(e.target.value)}
              className="bg-slate-950 text-slate-200 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              {service.getProfiles().map((p) => (
                <option key={p.profileId} value={p.profileId}>
                  {p.displayName} (@{p.handle}) {p.providerBadge ? `[${p.providerBadge}]` : ''}
                </option>
              ))}
            </select>
            <button
              onClick={refreshData}
              title="Refresh console data"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Coarse Privacy Notice Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Zero Stalker Precision
            </span>
            <span>• Neighborhood Coarse Resolution Only</span>
            <span>• Medical Records &amp; Microchips Redacted</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-rose-400 font-semibold">{alerts.length} Active Recovery Broadcast{alerts.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      {/* Sub navigation tabs */}
      <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 overflow-x-auto">
        <button
          id="btn-subtab-alerts"
          onClick={() => setActiveSubTab('alerts')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'alerts'
              ? 'bg-rose-500 text-slate-950 font-bold shadow-md shadow-rose-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Recovery Network</span>
          {alerts.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${activeSubTab === 'alerts' ? 'bg-slate-950 text-rose-400' : 'bg-rose-500 text-slate-950'}`}>
              {alerts.length}
            </span>
          )}
        </button>

        <button
          id="btn-subtab-feed"
          onClick={() => setActiveSubTab('feed')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'feed'
              ? 'bg-rose-500 text-slate-950 font-bold shadow-md shadow-rose-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Community Feed</span>
          <span className="text-[10px] opacity-70">({feed.length})</span>
        </button>

        <button
          id="btn-subtab-groups"
          onClick={() => setActiveSubTab('groups')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'groups'
              ? 'bg-rose-500 text-slate-950 font-bold shadow-md shadow-rose-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Groups</span>
          <span className="text-[10px] opacity-70">({groups.length})</span>
        </button>

        <button
          id="btn-subtab-events"
          onClick={() => setActiveSubTab('events')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'events'
              ? 'bg-rose-500 text-slate-950 font-bold shadow-md shadow-rose-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Events &amp; Pack Walks</span>
          <span className="text-[10px] opacity-70">({events.length})</span>
        </button>

        <button
          id="btn-subtab-profiles"
          onClick={() => setActiveSubTab('profiles')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'profiles'
              ? 'bg-rose-500 text-slate-950 font-bold shadow-md shadow-rose-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <PawPrint className="w-3.5 h-3.5" />
          <span>Profiles &amp; Twins</span>
        </button>

        <button
          id="btn-subtab-moderation"
          onClick={() => setActiveSubTab('moderation')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'moderation'
              ? 'bg-rose-500 text-slate-950 font-bold shadow-md shadow-rose-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Moderation &amp; Trust</span>
        </button>

        <button
          id="btn-subtab-tests"
          onClick={() => setActiveSubTab('tests')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ml-auto ${
            activeSubTab === 'tests'
              ? 'bg-rose-500 text-slate-950 font-bold shadow-md shadow-rose-500/20'
              : 'text-rose-400 hover:bg-rose-950/40 border border-rose-900/30'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Test Suite (9 Tests)</span>
        </button>
      </div>

      {/* 1. RECOVERY NETWORK TAB */}
      {activeSubTab === 'alerts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                Active Community Recovery Alerts
              </h2>
              <p className="text-xs text-slate-400">
                Coarse emergency broadcasts activated by pet owners via Sprint 15. Real-time sighting reports route directly into the canonical incident.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                Authoritative Source: <strong className="text-rose-400">RecoveryService (Sprint 15)</strong>
              </span>
            </div>
          </div>

          {alerts.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
              <h3 className="text-sm font-semibold text-slate-200">No Active Missing Pet Emergencies</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                All community pets in your area are currently safe at home. If a pet escapes, the owner can initiate a community broadcast from their Recovery Console.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {alerts.map((alert) => (
                <div
                  key={alert.communityAlertId}
                  className="rounded-2xl border-2 border-rose-500/40 bg-slate-900/90 shadow-2xl overflow-hidden relative"
                >
                  <div className="bg-rose-500/15 border-b border-rose-500/30 px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                      <span className="text-xs font-black text-rose-400 uppercase tracking-wider">
                        COMMUNITY EMERGENCY BROADCAST
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {new Date(alert.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="flex items-start gap-4">
                      {alert.photoUrl ? (
                        <img
                          src={alert.photoUrl}
                          alt={alert.petDisplayName}
                          referrerPolicy="no-referrer"
                          className="w-20 h-20 rounded-xl object-cover border border-rose-500/30 shadow-md shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                          <PawPrint className="w-8 h-8" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-xl font-black text-slate-100 tracking-tight">
                          {alert.petDisplayName}
                        </h3>
                        <p className="text-xs text-rose-300 font-semibold">
                          {alert.species} {alert.breed ? `· ${alert.breed}` : ''}
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-rose-400" />
                          <span>Search Area: {alert.coarseTargetArea.neighborhood}, {alert.coarseTargetArea.city} (r ≈ {alert.coarseTargetArea.radiusKm} km)</span>
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-300">
                      <div className="text-[11px] text-slate-400 font-bold uppercase mb-1">Owner Guidance:</div>
                      <p className="italic">"{alert.ownerInstructions || 'Please do not chase or corner; call or report sighting.'}"</p>
                    </div>

                    {/* Stats & Community Support */}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                      <div className="flex items-center gap-4">
                        <span>👥 <strong className="text-slate-200">{alert.volunteersCount}</strong> Volunteer{alert.volunteersCount === 1 ? '' : 's'}</span>
                        <span>👀 <strong className="text-slate-200">{alert.sightingsCount}</strong> Sighting{alert.sightingsCount === 1 ? '' : 's'}</span>
                        <span>🔔 <strong className="text-slate-200">{alert.followersCount}</strong> Following</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        id={`btn-report-sighting-${alert.communityAlertId}`}
                        onClick={() => {
                          setReportingAlertId(alert.communityAlertId);
                          setVolunteeringAlertId(null);
                        }}
                        className="py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-500 text-slate-950 hover:bg-rose-400 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-500/20"
                      >
                        <Eye className="w-4 h-4" />
                        <span>I Spotted This Pet</span>
                      </button>

                      <button
                        id={`btn-volunteer-${alert.communityAlertId}`}
                        onClick={() => {
                          setVolunteeringAlertId(alert.communityAlertId);
                          setReportingAlertId(null);
                        }}
                        className="py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Heart className="w-4 h-4 text-rose-400" />
                        <span>Join Search Crew</span>
                      </button>
                    </div>

                    {/* Volunteer inline form */}
                    {volunteeringAlertId === alert.communityAlertId && (
                      <form onSubmit={handleVolunteer} className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-200">Volunteer to Help Search</h4>
                          <button
                            type="button"
                            onClick={() => setVolunteeringAlertId(null)}
                            className="text-slate-400 hover:text-slate-200 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Your Role</label>
                          <select
                            value={volunteerRole}
                            onChange={(e) => setVolunteerRole(e.target.value as VolunteerRole)}
                            className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2"
                          >
                            <option value="SEARCH_PARTICIPANT">On-Foot Search Participant</option>
                            <option value="FLYER_DISTRIBUTION">Flyer &amp; Poster Distribution</option>
                            <option value="TEMPORARY_SHELTER">Temporary Safe Holding / Shelter</option>
                            <option value="TRANSPORT">Emergency Pet Transport</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Availability / Notes</label>
                          <input
                            type="text"
                            placeholder="e.g. Walking my dog around Menelik Rd until 11am"
                            value={volunteerNotes}
                            onChange={(e) => setVolunteerNotes(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs cursor-pointer transition-colors"
                        >
                          Confirm Volunteer Enrollment
                        </button>
                      </form>
                    )}

                    {/* Report Sighting inline form */}
                    {reportingAlertId === alert.communityAlertId && (
                      <form onSubmit={handleReportSighting} className="mt-4 p-4 rounded-xl bg-slate-950 border border-rose-500/40 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5" />
                            Report a Sighting (Direct to Sprint 15 Engine)
                          </h4>
                          <button
                            type="button"
                            onClick={() => setReportingAlertId(null)}
                            className="text-slate-400 hover:text-slate-200 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Coarse Area / Landmark</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Near Yaya Centre corner under green shrubs"
                            value={sightingArea}
                            onChange={(e) => setSightingArea(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">What did you observe?</label>
                          <textarea
                            required
                            rows={2}
                            placeholder="Direction pet was heading, condition, collar visible..."
                            value={sightingText}
                            onChange={(e) => setSightingText(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2"
                          />
                        </div>
                        <div className="text-[10px] text-slate-400 italic">
                          ℹ️ All sightings are automatically scanned for extortion/ransom keywords before passing to the owner.
                        </div>
                        <button
                          type="submit"
                          className="w-full py-2 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer transition-colors"
                        >
                          Submit Verified Sighting
                        </button>
                      </form>
                    )}

                    {sightingSuccess && (
                      <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{sightingSuccess}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. COMMUNITY FEED TAB */}
      {activeSubTab === 'feed' && (
        <div className="space-y-6">
          {/* Post Composer */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-sm overflow-hidden">
                {activeProfile?.avatarUrl ? (
                  <img src={activeProfile.avatarUrl} alt={activeProfile.displayName} className="w-full h-full object-cover" />
                ) : (
                  activeProfile?.displayName.charAt(0) || 'U'
                )}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <span>{activeProfile?.displayName}</span>
                  {activeProfile?.providerBadge && (
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                      {activeProfile.providerBadge}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400">@{activeProfile?.handle} · {activeProfile?.coarseLocation.neighborhood}</span>
              </div>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-3">
              <textarea
                required
                rows={3}
                placeholder="Share a training tip, question, or pet update with your local community..."
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Post Type Selector */}
                  <select
                    value={newPostType}
                    onChange={(e) => setNewPostType(e.target.value as PostType)}
                    className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value="TIP">💡 Helpful Tip</option>
                    <option value="PET_UPDATE">🐾 Pet Update</option>
                    <option value="QUESTION">❓ Question</option>
                    <option value="RECOMMENDATION">⭐ Recommendation</option>
                    <option value="MEETUP_INVITE">🤝 Meetup Invite</option>
                  </select>

                  {/* Group Selector */}
                  <select
                    value={newPostGroupId}
                    onChange={(e) => setNewPostGroupId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value="">Public Community Feed</option>
                    {groups.map((g) => (
                      <option key={g.groupId} value={g.groupId}>
                        {g.name}
                      </option>
                    ))}
                  </select>

                  {/* Pet Twin Selector */}
                  {userPetProfiles.length > 0 && (
                    <select
                      value={newPostPetId}
                      onChange={(e) => setNewPostPetId(e.target.value)}
                      className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
                    >
                      <option value="">No Pet Tag</option>
                      {userPetProfiles.map((p) => (
                        <option key={p.petProfileId} value={p.petProfileId}>
                          Tag {p.displayName} ({p.breed || p.species})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!newPostContent.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 text-slate-950 hover:bg-rose-400 disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-500/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish Post</span>
                </button>
              </div>
            </form>
          </div>

          {/* Feed Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Filter Feed:</span>
              <select
                value={selectedGroupFilter}
                onChange={(e) => setSelectedGroupFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1"
              >
                <option value="ALL">All Communities &amp; Groups</option>
                {groups.map((g) => (
                  <option key={g.groupId} value={g.groupId}>
                    {g.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedPostTypeFilter}
                onChange={(e) => setSelectedPostTypeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1"
              >
                <option value="ALL">All Post Types</option>
                <option value="TIP">Tips</option>
                <option value="PET_UPDATE">Pet Updates</option>
                <option value="QUESTION">Questions</option>
                <option value="RECOMMENDATION">Recommendations</option>
              </select>
            </div>

            <div className="text-[11px] text-slate-400 font-mono">
              Deterministic Chronological Ordering · Zero Engagement Algorithms
            </div>
          </div>

          {/* Feed Items */}
          <div className="space-y-4">
            {feed.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400 text-xs">
                No posts match the current filter or viewer privacy constraints.
              </div>
            ) : (
              feed.map((post) => (
                <div
                  key={post.postId}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3 shadow-md hover:border-slate-700 transition-colors"
                >
                  {/* Post Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs overflow-hidden border border-slate-700">
                        {post.author.avatarUrl ? (
                          <img src={post.author.avatarUrl} alt={post.author.displayName} className="w-full h-full object-cover" />
                        ) : (
                          post.author.displayName.charAt(0)
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-200">{post.author.displayName}</span>
                          <span className="text-[11px] text-slate-400 font-mono">@{post.author.handle}</span>
                          {post.author.providerBadge && (
                            <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                              {post.author.providerBadge}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span>{post.coarseLocationArea || post.author.coarseLocation.neighborhood}</span>
                          <span>•</span>
                          <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                          {post.revisionCount > 0 && <span className="text-amber-400 font-mono">(edited)</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {post.postType}
                      </span>
                    </div>
                  </div>

                  {/* Pet tag preview */}
                  {post.pet && (
                    <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-1.5 text-xs text-slate-300 w-fit">
                      <PawPrint className="w-3.5 h-3.5 text-rose-400" />
                      <span className="font-semibold">{post.pet.displayName}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400 text-[11px]">{post.pet.breed || post.pet.species}</span>
                    </div>
                  )}

                  {/* Post Content */}
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{post.content}</p>

                  {/* Media preview if any */}
                  {post.mediaUrls && post.mediaUrls.length > 0 && (
                    <div className="rounded-xl overflow-hidden border border-slate-800 max-h-72">
                      <img src={post.mediaUrls[0]} alt="Post media" className="w-full h-full object-cover" />
                    </div>
                  )}

                  {/* Post Actions: Reactions & Comments */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleReaction(post.postId, 'HELPFUL')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                          post.userReaction === 'HELPFUL'
                            ? 'bg-rose-500/20 text-rose-400 font-bold border border-rose-500/40'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Helpful ({post.reactionCounts.HELPFUL || 0})</span>
                      </button>

                      <button
                        onClick={() => handleToggleReaction(post.postId, 'LIKE')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                          post.userReaction === 'LIKE'
                            ? 'bg-rose-500/20 text-rose-400 font-bold border border-rose-500/40'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>Like ({post.reactionCounts.LIKE || 0})</span>
                      </button>

                      <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {post.commentCount} comments
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        const reason = prompt('Report post to moderation team (e.g. SPAM, HARASSMENT, DANGEROUS):', 'SPAM');
                        if (reason && activeProfile) {
                          service.reportContent({
                            reporterProfileId: activeProfile.profileId,
                            targetType: 'POST',
                            targetId: post.postId,
                            reasonCategory: reason as any,
                          });
                          alert('Report submitted for moderation review.');
                        }
                      }}
                      className="text-slate-500 hover:text-rose-400 text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <ShieldAlert className="w-3 h-3" />
                      Report
                    </button>
                  </div>

                  {/* Threaded Comments Section */}
                  <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-2">
                    {service.getComments(asCommunityPostId(post.postId)).map((comment) => {
                      const commentAuthor = service.getProfileById(comment.authorProfileId);
                      return (
                        <div key={comment.commentId} className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-xs flex items-start gap-2.5">
                          <div className="w-6 h-6 rounded-lg bg-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-300 shrink-0">
                            {commentAuthor?.displayName.charAt(0) || 'U'}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-200 text-[11px]">{commentAuthor?.displayName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">@{commentAuthor?.handle}</span>
                              <span className="text-[10px] text-slate-500">{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-slate-300 text-xs mt-0.5">{comment.content}</p>
                          </div>
                        </div>
                      );
                    })}

                    {/* Add comment input */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Write a helpful response..."
                        value={commentInputs[post.postId] || ''}
                        onChange={(e) => setCommentInputs({ ...commentInputs, [post.postId]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddComment(post.postId);
                          }
                        }}
                        className="flex-1 bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-rose-500"
                      />
                      <button
                        onClick={() => handleAddComment(post.postId)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. GROUPS TAB */}
      {activeSubTab === 'groups' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-rose-400" />
                Community Groups &amp; Breed Collectives
              </h2>
              <p className="text-xs text-slate-400">
                Local and breed-specific groups with verified member role hierarchies (Owner, Admin, Moderator, Member).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {groups.map((group) => {
              const membership = activeProfile ? service.getMembership(group.groupId, activeProfile.profileId) : undefined;
              const isMember = membership !== undefined && membership.status === 'ACTIVE';

              return (
                <div
                  key={group.groupId}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between shadow-lg space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {group.category}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {group.privacyType}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-100">{group.name}</h3>
                    <p className="text-xs text-slate-400 line-clamp-3">{group.description}</p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>👥 {group.memberCount} members</span>
                      {group.coarseLocation && (
                        <span className="text-[11px]">{group.coarseLocation.neighborhood || group.coarseLocation.city}</span>
                      )}
                    </div>

                    {isMember ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          Joined ({membership.role})
                        </span>
                        {membership.role !== 'OWNER' && (
                          <button
                            onClick={() => handleLeaveGroup(group.groupId)}
                            className="text-slate-400 hover:text-rose-400 text-xs cursor-pointer"
                          >
                            Leave
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleJoinGroup(group.groupId)}
                        className="w-full py-2 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Join Group
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. EVENTS TAB */}
      {activeSubTab === 'events' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-rose-400" />
                Community Events &amp; Structured Pack Walks
              </h2>
              <p className="text-xs text-slate-400">
                Safe, structured social walks and veterinary workshops with strict capacity caps and vaccination policies.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {events.map((event) => {
              const rsvp = activeProfile ? service.getRsvp(event.eventId, activeProfile.profileId) : undefined;
              const organizer = service.getProfileById(event.organizerProfileId);

              return (
                <div
                  key={event.eventId}
                  className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4 shadow-xl relative"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        {event.eventType}
                      </span>
                      <h3 className="text-base font-bold text-slate-100 mt-1">{event.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Organized by {organizer?.displayName || 'Community'}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-300 block">
                        {new Date(event.startTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{event.description}</p>

                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 text-xs space-y-1.5 text-slate-400">
                    <div className="flex items-center gap-2 text-slate-200 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      <span>{event.venueName}</span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] pt-1">
                      <span>🐕 Leash Required: {event.petPolicy.leashRequired ? 'Yes' : 'No'}</span>
                      <span>💉 Vaccinated: {event.petPolicy.requireVaccinated ? 'Required' : 'Recommended'}</span>
                    </div>
                  </div>

                  {/* Capacity Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Attendee Capacity</span>
                      <span className="font-bold text-slate-200">
                        {event.currentAttendeeCount} / {event.maxAttendees || 'Unlimited'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          event.maxAttendees && event.currentAttendeeCount >= event.maxAttendees ? 'bg-amber-400' : 'bg-rose-500'
                        }`}
                        style={{
                          width: event.maxAttendees
                            ? `${Math.min(100, (event.currentAttendeeCount / event.maxAttendees) * 100)}%`
                            : '20%',
                        }}
                      />
                    </div>
                  </div>

                  {/* RSVP buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => handleEventRsvp(event.eventId, 'GOING')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        rsvp?.rsvpStatus === 'GOING'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {rsvp?.rsvpStatus === 'GOING' ? '✓ Going' : 'Going'}
                    </button>

                    <button
                      onClick={() => handleEventRsvp(event.eventId, 'INTERESTED')}
                      className={`py-2 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        rsvp?.rsvpStatus === 'INTERESTED'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Interested
                    </button>

                    {rsvp && (
                      <button
                        onClick={() => handleEventRsvp(event.eventId, 'NOT_GOING')}
                        className="py-2 px-3 text-slate-400 hover:text-rose-400 text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. PROFILES & PET TWINS TAB */}
      {activeSubTab === 'profiles' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <PawPrint className="w-5 h-5 text-rose-400" />
                Community Profiles &amp; Sanitized Pet Twins
              </h2>
              <p className="text-xs text-slate-400">
                Projections from Pet Core into the community graph. Strictly redacted: no microchip numbers, no medical history, and no raw GPS trails.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {service.getProfiles().map((prof) => {
              const pets = service.getPetProfiles(prof.profileId);
              return (
                <div key={prof.profileId} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 shadow-lg">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-800 overflow-hidden border border-slate-700 shrink-0">
                      {prof.avatarUrl ? (
                        <img src={prof.avatarUrl} alt={prof.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-slate-400">{prof.displayName.charAt(0)}</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-100">{prof.displayName}</h3>
                        {prof.providerBadge && (
                          <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                            {prof.providerBadge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-rose-400 font-mono">@{prof.handle}</p>
                      <p className="text-xs text-slate-400 mt-1">{prof.coarseLocation.neighborhood}, {prof.coarseLocation.city}</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{prof.bio}</p>

                  {/* Sanitized Pet Twins Attached */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sanitized Pet Twins ({pets.length})</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {pets.map((p) => (
                        <div key={p.petProfileId} className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200">{p.displayName}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{p.species}</span>
                          </div>
                          <p className="text-[11px] text-slate-400">{p.breed || 'Companion'}</p>
                          <div className="text-[10px] text-emerald-400 flex items-center gap-1 pt-1 font-mono">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Microchip Redacted</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. MODERATION & TRUST TAB */}
      {activeSubTab === 'moderation' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                Moderation &amp; Trust Inspection Console
              </h2>
              <p className="text-xs text-slate-400">
                Community reports, review queue, and irreversible moderation audit records.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-200">Pending &amp; Resolved Community Reports</h3>
            {service.getReports().length === 0 ? (
              <p className="text-xs text-slate-400">No content reports filed.</p>
            ) : (
              <div className="space-y-3">
                {service.getReports().map((report) => (
                  <div key={report.reportId} className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-400">{report.reasonCategory} on {report.targetType}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${report.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {report.status}
                      </span>
                    </div>
                    <p className="text-slate-300">Details: {report.details || 'No additional commentary.'}</p>
                    <div className="text-[11px] text-slate-500">Report ID: {report.reportId} · Filed: {new Date(report.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. TEST SUITE TAB */}
      {activeSubTab === 'tests' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-rose-400" />
                Sprint 16 Verification Suite
              </h2>
              <p className="text-xs text-slate-400">
                Unit, integration, security &amp; privacy boundary tests covering the full 181-step Community specification.
              </p>
            </div>
            <button
              id="btn-run-community-tests"
              onClick={runTests}
              disabled={testRunning}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold rounded-xl text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-500/20"
            >
              {testRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{testRunning ? 'Running Tests...' : 'Execute Test Suite'}</span>
            </button>
          </div>

          {testResults && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-200">
                  Tests Passed: {testResults.passed} / {testResults.total}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${testResults.passed === testResults.total ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'}`}>
                  {testResults.passed === testResults.total ? '100% ALL VERIFIED' : 'TESTS FAILED'}
                </span>
              </div>

              <div className="space-y-2">
                {testResults.results.map((res, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-2.5">
                      {res.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-semibold text-slate-200">{res.name}</div>
                        {res.error && <div className="text-rose-400 text-[11px] mt-1 font-mono">{res.error}</div>}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {res.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
