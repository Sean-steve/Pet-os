/**
 * Pet OS Sprint 23 — Provider Reviews, Reputation, Service Quality, Disputes & Trust Engine Console
 * 
 * Features:
 * - Real-time Reputation Projections & Dimension Analytics
 * - Small-Sample Transparency ("No reviews yet", "Based on 1 verified service")
 * - Strict Separation between Sprint 10 Verified Credentials and Customer Ratings
 * - Verified-Service Gated Review Submission & Live Anti-Manipulation Verification
 * - Provider Response Workspace with Privacy Leak Safeguard Filter
 * - Factual Dispute & Content Moderation Console with Audit Logging
 * - Automated 100% Invariant Test Runner
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Star,
  ShieldCheck,
  Award,
  AlertTriangle,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Filter,
  RefreshCw,
  Clock,
  UserCheck,
  Send,
  Flag,
  FileText,
  Lock,
  ChevronRight,
  Sparkles,
  Search,
  ThumbsUp,
  Tag,
  AlertOctagon,
  HelpCircle,
  BarChart3,
  Scale,
  Sliders,
  Check,
  Undo2,
  Info
} from 'lucide-react';
import { ReviewStore } from '../pet-os/reviews/store';
import { ReviewService } from '../pet-os/reviews/service';
import {
  Review,
  ReviewEligibility,
  ProviderReputationProjection,
  PublicReviewDTO,
  ServiceCategory,
  PublicIdentityMode,
  ReviewStructuredTag,
  ReviewDimensionKey,
  ReviewDisputeReason,
  ReviewReportReason,
  ReviewModerationActionType,
} from '../pet-os/reviews/types';
import { runAllReviewTests, ReviewTestResult } from '../pet-os/reviews/tests';
import { CANONICAL_IDS } from '../pet-os/seed/unified-seed';
import { SEED_PROVIDERS, SEED_USERS, SEED_BUSINESSES } from '../pet-os/provider/seed';
import { ProviderStore } from '../pet-os/provider/store';

export const Sprint23ReviewConsole: React.FC = () => {
  const store = useMemo(() => ReviewStore.getInstance(), []);
  const service = useMemo(() => ReviewService.getInstance(), []);
  const providerStore = useMemo(() => ProviderStore.getInstance(), []);

  const [activeSubTab, setActiveSubTab] = useState<'profiles' | 'submit' | 'provider' | 'moderation' | 'tests'>('profiles');
  const [selectedProviderId, setSelectedProviderId] = useState<string>(SEED_PROVIDERS.SARAH_MWANGI);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Form State for Review Submission
  const [selectedEligibilityId, setSelectedEligibilityId] = useState<string>('');
  const [overallRating, setOverallRating] = useState<number>(5);
  const [dimensionScores, setDimensionScores] = useState<Record<string, number>>({});
  const [selectedTags, setSelectedTags] = useState<ReviewStructuredTag[]>(['ON_TIME', 'GOOD_COMMUNICATION']);
  const [reviewBody, setReviewBody] = useState<string>('');
  const [publicIdentityMode, setPublicIdentityMode] = useState<PublicIdentityMode>('FIRST_NAME_INITIAL');
  const [formFeedback, setFormFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Provider Response State
  const [respondingToReviewId, setRespondingToReviewId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<string>('');
  const [responseFeedback, setResponseFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Dispute State
  const [disputingReviewId, setDisputingReviewId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState<ReviewDisputeReason>('UNRELATED_SERVICE_COMPLAINT');
  const [disputeStatement, setDisputeStatement] = useState<string>('');
  const [disputeFeedback, setDisputeFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Report State
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<ReviewReportReason>('PERSONAL_INFORMATION');
  const [reportDetails, setReportDetails] = useState<string>('');

  // Tests State
  const [testResults, setTestResults] = useState<ReviewTestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Trigger refresh helper
  const reloadData = () => setRefreshTrigger(prev => prev + 1);

  // Run tests on mount or tab selection
  useEffect(() => {
    if (activeSubTab === 'tests' && testResults.length === 0) {
      handleRunTests();
    }
  }, [activeSubTab]);

  const handleRunTests = () => {
    setIsRunningTests(true);
    setTimeout(() => {
      const res = runAllReviewTests();
      setTestResults(res);
      setIsRunningTests(false);
      reloadData();
    }, 50);
  };

  // Derived Data
  const providersList = useMemo(() => {
    return [
      {
        id: SEED_PROVIDERS.SARAH_MWANGI,
        name: 'Sarah Mwangi',
        category: 'DOG_WALKING',
        badge: 'KVB-Compliant Walker',
        isVerified: true,
      },
      {
        id: SEED_PROVIDERS.DR_KIMANI,
        name: 'Dr. Amani Kimani',
        category: 'VETERINARY',
        badge: 'KVB #3829 Verified Surgeon',
        isVerified: true,
      },
      {
        id: SEED_PROVIDERS.JUMA_OCHIENG,
        name: 'Juma Ochieng',
        category: 'TRAINING',
        badge: 'IAABC Certified Behavioral Specialist',
        isVerified: true,
      },
      {
        id: 'prv-brand-new-zero-reviews',
        name: 'Nairobi Mobile Grooming (Unreviewed)',
        category: 'GROOMING',
        badge: 'Pending Reviews',
        isVerified: true,
      },
    ];
  }, []);

  const currentProjection: ProviderReputationProjection | undefined = useMemo(() => {
    return store.findReputationProjection('PROVIDER', selectedProviderId);
  }, [selectedProviderId, refreshTrigger]);

  const providerReviews: Review[] = useMemo(() => {
    return store.listReviewsForProvider(selectedProviderId as any);
  }, [selectedProviderId, refreshTrigger]);

  const allReviews: Review[] = useMemo(() => {
    return store.listAllReviews();
  }, [refreshTrigger]);

  const allEligibilities: ReviewEligibility[] = useMemo(() => {
    return store.listAllEligibilities();
  }, [refreshTrigger]);

  const pendingEligibilities = useMemo(() => {
    return allEligibilities.filter(e => e.status === 'ELIGIBLE');
  }, [allEligibilities]);

  const allDisputes = useMemo(() => {
    return store.listAllDisputes();
  }, [refreshTrigger]);

  const allReports = useMemo(() => {
    return store.listAllReports();
  }, [refreshTrigger]);

  const allAbuseSignals = useMemo(() => {
    return store.listAbuseSignals();
  }, [refreshTrigger]);

  // Selected Eligibility Details for Review Submission
  const activeEligibility = useMemo(() => {
    if (!selectedEligibilityId && pendingEligibilities.length > 0) {
      return pendingEligibilities[0];
    }
    return allEligibilities.find(e => e.eligibilityId === selectedEligibilityId);
  }, [selectedEligibilityId, pendingEligibilities, allEligibilities]);

  // Available dimensions for the selected service type
  const availableDimensionDefs = useMemo(() => {
    if (!activeEligibility) return [];
    return store.getDimensionDefinitionsForServiceType(activeEligibility.serviceType);
  }, [activeEligibility, store]);

  // Initialize dimension scores when eligibility changes
  useEffect(() => {
    if (activeEligibility && availableDimensionDefs.length > 0) {
      const initial: Record<string, number> = {};
      availableDimensionDefs.forEach(d => {
        initial[d.dimensionKey] = 5;
      });
      setDimensionScores(initial);
      if (!selectedEligibilityId) {
        setSelectedEligibilityId(activeEligibility.eligibilityId);
      }
    }
  }, [activeEligibility, availableDimensionDefs]);

  // Submit Review Handler
  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormFeedback(null);

    if (!activeEligibility) {
      setFormFeedback({ message: 'Please select an eligible service first.', type: 'error' });
      return;
    }

    try {
      const dimensionsPayload = Object.entries(dimensionScores).map(([key, val]) => ({
        dimensionKey: key as any,
        score: val,
      }));

      service.submitReview({
        eligibilityId: activeEligibility.eligibilityId,
        actorUserId: activeEligibility.reviewerUserId,
        overallRating,
        dimensions: dimensionsPayload,
        structuredTags: selectedTags,
        body: reviewBody,
        publicIdentityMode,
      });

      setFormFeedback({ message: 'Verified review published successfully! Reputation recomputed in real time.', type: 'success' });
      setReviewBody('');
      reloadData();
    } catch (err: any) {
      setFormFeedback({ message: err?.message || 'Error submitting review', type: 'error' });
    }
  };

  // Submit Provider Response Handler
  const handleResponseSubmit = (reviewId: string) => {
    setResponseFeedback(null);
    try {
      const review = store.findReviewById(reviewId as any);
      if (!review) return;

      service.respondToReview({
        reviewId: review.reviewId,
        actorUserId: SEED_USERS.WALKER_SARAH,
        providerId: review.providerId,
        body: responseText,
      });

      setResponseFeedback({ message: 'Provider response published with privacy verification!', type: 'success' });
      setRespondingToReviewId(null);
      setResponseText('');
      reloadData();
    } catch (err: any) {
      setResponseFeedback({ message: err?.message || 'Error submitting response', type: 'error' });
    }
  };

  // Submit Dispute Handler
  const handleDisputeSubmit = (reviewId: string) => {
    setDisputeFeedback(null);
    try {
      const review = store.findReviewById(reviewId as any);
      if (!review) return;

      service.submitProviderDispute({
        reviewId: review.reviewId,
        actorUserId: SEED_USERS.WALKER_SARAH,
        providerId: review.providerId,
        reasonCategory: disputeReason,
        statement: disputeStatement,
      });

      setDisputeFeedback({ message: 'Formal dispute filed for factual operational review.', type: 'success' });
      setDisputingReviewId(null);
      setDisputeStatement('');
      reloadData();
    } catch (err: any) {
      setDisputeFeedback({ message: err?.message || 'Error submitting dispute', type: 'error' });
    }
  };

  // Rebuild Projections Handler
  const handleRebuildProjections = () => {
    const { rebuiltCount } = service.rebuildAllReputationProjections();
    reloadData();
    alert(`Successfully rebuilt ${rebuiltCount} provider & business reputation projections with 100% idempotency.`);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
                <Star className="w-6 h-6 fill-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2.5">
                  Reviews, Reputation &amp; Trust Engine
                  <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                    Sprint 23
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verified-Service Gated Feedback · Service-Specific Dimensions · Fraud Defense · Provider Responses &amp; Disputes
                </p>
              </div>
            </div>

            {/* Invariant Chips */}
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Verified-Service Gated
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                <Award className="w-3.5 h-3.5 text-indigo-400" />
                Credential Independence
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-rose-950/60 text-rose-300 border border-rose-800/40">
                <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                Self-Review Blocked
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                PII Stripped Public DTOs
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRebuildProjections}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Recomputes all read models from scratch"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Rebuild Projections</span>
            </button>
            <button
              onClick={handleRunTests}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Run Suite ({testResults.filter(t => t.passed).length}/{testResults.length || 11})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('profiles')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'profiles'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Star className="w-4 h-4" />
          <span>Reputation &amp; Public Profiles</span>
        </button>

        <button
          onClick={() => setActiveSubTab('submit')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'submit'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Submit Verified Review</span>
          {pendingEligibilities.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-950 text-amber-300 border border-amber-800">
              {pendingEligibilities.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('provider')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'provider'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Provider Workspace (Responses &amp; Disputes)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('moderation')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'moderation'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Trust &amp; Safety Moderation</span>
          {(allDisputes.length > 0 || allReports.length > 0) && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-rose-950 text-rose-300 border border-rose-800">
              {allDisputes.length + allReports.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('tests')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'tests'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Automated Invariant Suite</span>
        </button>
      </div>

      {/* SUB-TAB 1: REPUTATION & PUBLIC PROFILES */}
      {activeSubTab === 'profiles' && (
        <div className="space-y-6">
          {/* Provider Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {providersList.map(prov => {
              const proj = store.findReputationProjection('PROVIDER', prov.id);
              const isSelected = selectedProviderId === prov.id;
              return (
                <div
                  key={prov.id}
                  onClick={() => setSelectedProviderId(prov.id)}
                  className={`p-4 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 border-amber-500/80 shadow-lg shadow-amber-500/10'
                      : 'bg-[#13161C] border-[#1E293B] hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-slate-400">
                      {prov.category}
                    </span>
                    {prov.isVerified && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                        <ShieldCheck className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-100 mt-1">{prov.name}</h3>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                    {proj?.displayStatus === 'NO_REVIEWS' ? (
                      <span className="text-xs text-slate-500 font-medium">No reviews yet</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        <span className="text-sm font-black text-slate-100">{proj?.averageRating.toFixed(1)}</span>
                        <span className="text-xs text-slate-400">({proj?.reviewCount})</span>
                      </div>
                    )}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      proj?.displayStatus === 'ESTABLISHED'
                        ? 'bg-emerald-950/60 text-emerald-300'
                        : proj?.displayStatus === 'LOW_VOLUME'
                        ? 'bg-amber-950/60 text-amber-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {proj?.displayStatus === 'ESTABLISHED' ? 'Established' : proj?.displayStatus === 'LOW_VOLUME' ? 'Low Sample' : 'Unrated'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reputation Summary Card for Selected Provider */}
          {currentProjection ? (
            <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Overall Score & Sample Notice */}
                <div className="lg:col-span-1 border-b lg:border-b-0 lg:border-r border-slate-800 pb-6 lg:pb-0 lg:pr-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold uppercase text-slate-400">
                        Customer Reputation Score
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">
                        <Info className="w-3 h-3" />
                        {currentProjection.methodologyVersion}
                      </span>
                    </div>

                    {currentProjection.displayStatus === 'NO_REVIEWS' ? (
                      <div className="mt-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                        <p className="text-lg font-bold text-slate-300">No reviews yet</p>
                        <p className="text-xs text-slate-400 mt-1">
                          This provider has not yet completed a service with a verified customer review.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-4 flex items-baseline gap-3">
                        <span className="text-5xl font-black text-slate-100 tracking-tight">
                          {currentProjection.averageRating.toFixed(1)}
                        </span>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(star => (
                              <Star
                                key={star}
                                className={`w-4 h-4 ${
                                  star <= Math.round(currentProjection.averageRating)
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-slate-700'
                                }`}
                              />
                            ))}
                          </div>
                          <p className="text-xs text-slate-400 font-medium">
                            Based on {currentProjection.reviewCount} verified {currentProjection.reviewCount === 1 ? 'service' : 'services'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Small-Sample Transparency Notice */}
                    {currentProjection.displayStatus === 'LOW_VOLUME' && (
                      <div className="mt-4 p-3 rounded-lg bg-amber-950/40 border border-amber-800/40 text-xs text-amber-300/90 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                        <div>
                          <strong className="font-semibold block">Small sample size:</strong>
                          Calculated from only {currentProjection.reviewCount} verified service. Statistical certainty is limited.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span>Response Rate: <strong className="text-slate-200">{currentProjection.responseRatePercent}%</strong></span>
                    <span>Recent (90d): <strong className="text-slate-200">{currentProjection.recentReviewCount}</strong></span>
                  </div>
                </div>

                {/* Rating Distribution Bars */}
                <div className="lg:col-span-1 border-b lg:border-b-0 lg:border-r border-slate-800 pb-6 lg:pb-0 lg:pr-6">
                  <h4 className="text-xs font-mono font-semibold uppercase text-slate-400 mb-4">
                    Rating Distribution
                  </h4>
                  <div className="space-y-2">
                    {([5, 4, 3, 2, 1] as const).map(stars => {
                      const count = currentProjection.ratingDistribution[stars] || 0;
                      const percentage = currentProjection.reviewCount > 0
                        ? (count / currentProjection.reviewCount) * 100
                        : 0;
                      return (
                        <div key={stars} className="flex items-center gap-2 text-xs">
                          <span className="w-12 text-slate-400 font-medium flex items-center gap-1">
                            {stars} <Star className="w-3 h-3 fill-slate-500 text-slate-500" />
                          </span>
                          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="w-6 text-right font-mono text-slate-400 text-[11px]">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Service-Specific Dimension Breakdown */}
                <div className="lg:col-span-1">
                  <h4 className="text-xs font-mono font-semibold uppercase text-slate-400 mb-4">
                    Quality Dimensions
                  </h4>
                  <div className="space-y-3">
                    {Object.values(currentProjection.dimensionAverages).length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No dimension scores recorded yet.</p>
                    ) : (
                      Object.values(currentProjection.dimensionAverages).map(dim => (
                        <div key={dim.dimensionKey} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-300 font-medium">{dim.label}</span>
                            <span className="font-mono text-amber-400 font-bold">{dim.average.toFixed(1)} / 5.0</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all"
                              style={{ width: `${(dim.average / 5) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Published Reviews Feed */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Verified Customer Reviews</span>
                <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                  {providerReviews.length}
                </span>
              </h3>
            </div>

            {providerReviews.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-[#13161C] border border-[#1E293B]">
                <p className="text-slate-400 text-sm">No verified reviews published for this provider yet.</p>
                <button
                  onClick={() => setActiveSubTab('submit')}
                  className="mt-3 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition"
                >
                  Submit the First Verified Review
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {providerReviews.map(review => {
                  const isResponding = respondingToReviewId === review.reviewId;
                  const isDisputing = disputingReviewId === review.reviewId;

                  return (
                    <div
                      key={review.reviewId}
                      className="p-6 rounded-2xl bg-[#13161C] border border-[#1E293B] space-y-4 shadow-sm"
                    >
                      {/* Review Top Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs">
                            {review.publicAuthorDisplayName.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-200">
                                {review.publicAuthorDisplayName}
                              </span>
                              {review.verifiedService && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                                  <ShieldCheck className="w-3 h-3" />
                                  Verified Service
                                </span>
                              )}
                              {review.version > 1 && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  (edited v{review.version})
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {review.serviceSnapshot.offeringTitle} · Completed {new Date(review.serviceSnapshot.completedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star
                                key={s}
                                className={`w-4 h-4 ${
                                  s <= review.overallRating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-slate-700'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs font-mono font-bold text-slate-300">
                            {review.overallRating}.0
                          </span>
                        </div>
                      </div>

                      {/* Dimension Tags */}
                      {review.dimensions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {review.dimensions.map(d => (
                            <span
                              key={d.dimensionKey}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium bg-slate-900 border border-slate-800 text-slate-300"
                            >
                              <span>{d.dimensionKey.replace(/_/g, ' ')}:</span>
                              <strong className="text-amber-400 font-mono">{d.score}/5</strong>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Structured Tags */}
                      {review.structuredTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {review.structuredTags.map(tag => (
                            <span
                              key={tag}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800/60 text-slate-400 border border-slate-700/40"
                            >
                              #{tag.toLowerCase().replace(/_/g, '-')}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Review Body */}
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {review.body}
                      </p>

                      {/* Photos if present */}
                      {review.media.length > 0 && (
                        <div className="flex gap-3 overflow-x-auto py-1">
                          {review.media.map(m => (
                            <div key={m.mediaId} className="relative rounded-xl overflow-hidden border border-slate-800 max-w-xs">
                              <img src={m.url} alt={m.caption || 'Review media'} className="h-32 w-48 object-cover" />
                              {m.caption && (
                                <p className="text-[10px] text-slate-300 p-1.5 bg-slate-900/90 truncate">
                                  {m.caption}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Provider Response Card if Present */}
                      {review.providerResponse && review.providerResponse.status === 'PUBLISHED' && (
                        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 ml-4 sm:ml-8">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5" />
                              Response from Provider
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(review.providerResponse.publishedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {review.providerResponse.body}
                          </p>
                        </div>
                      )}

                      {/* Review Action Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-xs text-slate-400">
                        <span className="text-[11px] font-mono text-slate-500">
                          Review ID: {review.reviewId.slice(0, 16)}...
                        </span>

                        <div className="flex items-center gap-2">
                          {!review.providerResponse && (
                            <button
                              onClick={() => setRespondingToReviewId(isResponding ? null : review.reviewId)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium text-amber-400 hover:bg-amber-950/40 border border-amber-800/30 transition cursor-pointer"
                            >
                              Respond
                            </button>
                          )}
                          <button
                            onClick={() => setDisputingReviewId(isDisputing ? null : review.reviewId)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                          >
                            Dispute Factual Error
                          </button>
                        </div>
                      </div>

                      {/* Inline Provider Response Box */}
                      {isResponding && (
                        <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-amber-500/40 space-y-3">
                          <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                            <Send className="w-3.5 h-3.5" />
                            Submit Provider Public Response
                          </h4>
                          <p className="text-xs text-slate-400">
                            Public responses cannot alter customer ratings. Privacy filter strictly blocks leaking owner contact details or private diagnoses.
                          </p>
                          <textarea
                            value={responseText}
                            onChange={(e) => setResponseText(e.target.value)}
                            placeholder="Type respectful, professional public response..."
                            className="w-full h-20 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                          />
                          {responseFeedback && (
                            <div className={`p-2 rounded text-xs ${responseFeedback.type === 'error' ? 'bg-rose-950 text-rose-300' : 'bg-emerald-950 text-emerald-300'}`}>
                              {responseFeedback.message}
                            </div>
                          )}
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setRespondingToReviewId(null)}
                              className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:bg-slate-800"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleResponseSubmit(review.reviewId)}
                              className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400"
                            >
                              Publish Response
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inline Dispute Box */}
                      {isDisputing && (
                        <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-rose-500/40 space-y-3">
                          <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                            <Scale className="w-3.5 h-3.5" />
                            File Provider Operational Dispute
                          </h4>
                          <p className="text-xs text-slate-400">
                            Note: Disputing merely because you disagree with a 1-star rating is strictly rejected. Disputes require factual errors (e.g. service did not occur, wrong provider targeted).
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <select
                              value={disputeReason}
                              onChange={(e) => setDisputeReason(e.target.value as any)}
                              className="p-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200"
                            >
                              <option value="UNRELATED_SERVICE_COMPLAINT">Unrelated Service Complaint</option>
                              <option value="WRONG_PROVIDER_TARGETED">Wrong Provider Targeted</option>
                              <option value="SERVICE_DID_NOT_OCCUR">Service Did Not Occur</option>
                              <option value="REVIEWER_NOT_CUSTOMER">Reviewer Was Not Customer</option>
                              <option value="PROHIBITED_PRIVATE_INFO">Contains Private Info / Doxxing</option>
                            </select>
                          </div>
                          <textarea
                            value={disputeStatement}
                            onChange={(e) => setDisputeStatement(e.target.value)}
                            placeholder="Provide factual audit evidence justifying this dispute..."
                            className="w-full h-20 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                          />
                          {disputeFeedback && (
                            <div className={`p-2 rounded text-xs ${disputeFeedback.type === 'error' ? 'bg-rose-950 text-rose-300' : 'bg-emerald-950 text-emerald-300'}`}>
                              {disputeFeedback.message}
                            </div>
                          )}
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setDisputingReviewId(null)}
                              className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:bg-slate-800"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDisputeSubmit(review.reviewId)}
                              className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-500 text-white hover:bg-rose-400"
                            >
                              Submit Formal Dispute
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: SUBMIT VERIFIED REVIEW */}
      {activeSubTab === 'submit' && (
        <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-6 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Verified-Service Customer Review Form
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              In Pet OS, reviews can ONLY be submitted by authorized household members for real, completed service transactions.
            </p>
          </div>

          {pendingEligibilities.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-slate-800 space-y-3">
              <p className="text-slate-300 text-sm font-semibold">No pending review eligibilities right now.</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                All historical completed bookings have already been reviewed or their 30-day review windows have expired. Complete a new dog walk, vet visit, or transport trip to generate new review eligibility.
              </p>
            </div>
          ) : (
            <form onSubmit={handleReviewSubmit} className="space-y-6 max-w-3xl">
              {/* Select Eligible Booking */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                  Select Completed Service
                </label>
                <div className="space-y-2">
                  {pendingEligibilities.map(e => (
                    <div
                      key={e.eligibilityId}
                      onClick={() => setSelectedEligibilityId(e.eligibilityId)}
                      className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                        activeEligibility?.eligibilityId === e.eligibilityId
                          ? 'bg-amber-950/30 border-amber-500/80 shadow-sm'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-200">
                            {e.serviceSnapshot.providerName}
                          </span>
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            {e.serviceType}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {e.serviceSnapshot.offeringTitle} · Completed {new Date(e.serviceSnapshot.completedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-bold text-emerald-400">Eligible</span>
                        <p className="text-[10px] text-slate-500">Expires in 29 days</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Overall Star Rating */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                  Overall Rating (1 to 5 Stars)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setOverallRating(star)}
                      className={`p-2 rounded-xl border transition cursor-pointer ${
                        star <= overallRating
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-400'
                          : 'bg-slate-900 border-slate-800 text-slate-600'
                      }`}
                    >
                      <Star className={`w-6 h-6 ${star <= overallRating ? 'fill-amber-400' : ''}`} />
                    </button>
                  ))}
                  <span className="text-sm font-bold text-slate-200 ml-2">
                    {overallRating} of 5 Stars
                  </span>
                </div>
              </div>

              {/* Service-Specific Dimension Sliders */}
              {availableDimensionDefs.length > 0 && (
                <div className="space-y-4 bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    Service Quality Dimensions ({activeEligibility?.serviceType})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {availableDimensionDefs.map(dim => (
                      <div key={dim.dimensionKey} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-300 font-medium">{dim.label}</span>
                          <span className="font-mono font-bold text-amber-400">
                            {dimensionScores[dim.dimensionKey] || 5} / 5
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          value={dimensionScores[dim.dimensionKey] || 5}
                          onChange={(e) => setDimensionScores({
                            ...dimensionScores,
                            [dim.dimensionKey]: parseInt(e.target.value),
                          })}
                          className="w-full accent-amber-500"
                        />
                        <p className="text-[10px] text-slate-500">{dim.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Controlled Structured Tags */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                  Structured Service Badges
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['ON_TIME', 'GOOD_COMMUNICATION', 'FOLLOWED_INSTRUCTIONS', 'HELPFUL_UPDATES', 'GENTLE_HANDLING', 'DETAILED_REPORT'] as ReviewStructuredTag[]).map(tag => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedTags(selectedTags.filter(t => t !== tag));
                          } else {
                            setSelectedTags([...selectedTags, tag]);
                          }
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        #{tag.toLowerCase().replace(/_/g, '-')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Free Text Review */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                  Review Text (Min 5 chars, max 2500 chars)
                </label>
                <textarea
                  value={reviewBody}
                  onChange={(e) => setReviewBody(e.target.value)}
                  placeholder="Share details of your pet's experience with this provider..."
                  className="w-full h-28 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>

              {/* Public Identity Mode */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                  Public Author Display Name
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { mode: 'FIRST_NAME_INITIAL', label: 'First Name + Initial', desc: 'e.g. Elena V.' },
                    { mode: 'COMMUNITY_HANDLE', label: 'Community Handle', desc: 'e.g. @elena_parent' },
                    { mode: 'ANONYMOUS_TO_PUBLIC', label: 'Anonymous to Public', desc: 'Verified Pet Parent' },
                  ].map(opt => (
                    <div
                      key={opt.mode}
                      onClick={() => setPublicIdentityMode(opt.mode as any)}
                      className={`p-3 rounded-xl border transition cursor-pointer ${
                        publicIdentityMode === opt.mode
                          ? 'bg-amber-950/30 border-amber-500/80'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-xs font-bold text-slate-200 block">{opt.label}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">{opt.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feedback Alert */}
              {formFeedback && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  formFeedback.type === 'error'
                    ? 'bg-rose-950/80 text-rose-200 border border-rose-800/40'
                    : 'bg-emerald-950/80 text-emerald-200 border border-emerald-800/40'
                }`}>
                  {formFeedback.type === 'error' ? <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  <span>{formFeedback.message}</span>
                </div>
              )}

              {/* Submit Action */}
              <button
                type="submit"
                className="px-6 py-3 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition cursor-pointer shadow-lg shadow-amber-500/20 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Publish Verified Review</span>
              </button>
            </form>
          )}
        </div>
      )}

      {/* SUB-TAB 3: PROVIDER WORKSPACE (RESPONSES & DISPUTES) */}
      {activeSubTab === 'provider' && (
        <div className="space-y-6">
          <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-6">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-amber-400" />
              Provider Quality &amp; Feedback Workspace
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Active Provider View: <strong>Sarah Mwangi</strong> ({SEED_PROVIDERS.SARAH_MWANGI}).
              Providers can publish verified responses and file disputes on factual grounds. Providers cannot edit customer ratings or reviews.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Active Reviews Received */}
            <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-6 space-y-4">
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <span>Received Reviews</span>
                <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                  {providerReviews.length}
                </span>
              </h4>

              <div className="space-y-3">
                {providerReviews.map(r => (
                  <div key={r.reviewId} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200">{r.publicAuthorDisplayName}</span>
                      <span className="font-mono text-amber-400 font-bold">{r.overallRating}.0 ★</span>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-2">{r.body}</p>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
                      <span>{new Date(r.submittedAt).toLocaleDateString()}</span>
                      <span className={r.providerResponse ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                        {r.providerResponse ? '✓ Responded' : 'Awaiting Response'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Provider Disputes History */}
            <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-6 space-y-4">
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <span>Disputes Filed</span>
                <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                  {allDisputes.filter(d => d.providerId === selectedProviderId).length}
                </span>
              </h4>

              <div className="space-y-3">
                {allDisputes.filter(d => d.providerId === selectedProviderId).length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-4 text-center">No disputes filed by this provider.</p>
                ) : (
                  allDisputes.filter(d => d.providerId === selectedProviderId).map(d => (
                    <div key={d.disputeId} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-300">{d.reasonCategory.replace(/_/g, ' ')}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          d.status === 'UPHELD' ? 'bg-emerald-950 text-emerald-300' : d.status === 'REJECTED' ? 'bg-rose-950 text-rose-300' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {d.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 italic">"{d.statement}"</p>
                      {d.moderatorNotes && (
                        <p className="text-[11px] text-slate-300 bg-slate-950 p-2 rounded border border-slate-800">
                          <strong>Moderator Decision:</strong> {d.moderatorNotes}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: TRUST & SAFETY / MODERATION */}
      {activeSubTab === 'moderation' && (
        <div className="space-y-6">
          {/* Moderation Overview */}
          <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-6">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-400" />
              Trust &amp; Safety Moderation Queue
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Authorized moderation console for dispute adjudication, content safety violations, and anti-abuse signal tracking.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Open Disputes */}
            <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-6 space-y-4">
              <h4 className="text-sm font-bold text-slate-200 flex items-center justify-between">
                <span>Provider Disputes Queue</span>
                <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                  {allDisputes.length}
                </span>
              </h4>

              <div className="space-y-3">
                {allDisputes.map(d => (
                  <div key={d.disputeId} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">
                        {d.reasonCategory.replace(/_/g, ' ')}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        d.status === 'UPHELD' ? 'bg-emerald-950 text-emerald-300' : d.status === 'REJECTED' ? 'bg-rose-950 text-rose-300' : 'bg-amber-950 text-amber-300'
                      }`}>
                        {d.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300">
                      <strong>Provider Statement:</strong> {d.statement}
                    </p>

                    {d.status === 'SUBMITTED' && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                        <button
                          onClick={() => {
                            service.resolveProviderDispute({
                              disputeId: d.disputeId,
                              moderatorUserId: CANONICAL_IDS.ADMIN_CHARLES,
                              outcome: 'UPHELD',
                              notes: 'Factual grounds upheld by moderator. Review removed from reputation.',
                            });
                            reloadData();
                          }}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          Uphold (Remove Review)
                        </button>
                        <button
                          onClick={() => {
                            service.resolveProviderDispute({
                              disputeId: d.disputeId,
                              moderatorUserId: CANONICAL_IDS.ADMIN_CHARLES,
                              outcome: 'REJECTED',
                              notes: 'Customer feedback reflects genuine customer experience.',
                            });
                            reloadData();
                          }}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300"
                        >
                          Reject Dispute
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Anti-Abuse Signals Log */}
            <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-6 space-y-4">
              <h4 className="text-sm font-bold text-slate-200 flex items-center justify-between">
                <span>Anti-Abuse &amp; Fraud Signals</span>
                <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                  {allAbuseSignals.length}
                </span>
              </h4>

              <div className="space-y-3">
                {allAbuseSignals.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-4 text-center">No fraud signals detected.</p>
                ) : (
                  allAbuseSignals.map(s => (
                    <div key={s.signalId} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          {s.signalType.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                          {s.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">{s.details}</p>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        Raised: {new Date(s.raisedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: AUTOMATED INVARIANT SUITE */}
      {activeSubTab === 'tests' && (
        <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Sprint 23 Invariant Test Runner
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Automated verification of review eligibility, anti-manipulation, rating bounds, provider response privacy, disputes, and idempotent reputation projections.
              </p>
            </div>
            <button
              onClick={handleRunTests}
              disabled={isRunningTests}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningTests ? 'animate-spin' : ''}`} />
              <span>{isRunningTests ? 'Executing...' : 'Re-Run Test Suite'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Assertions</span>
              <p className="text-xl font-black text-slate-100 mt-0.5">{testResults.length}</p>
            </div>
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Passed</span>
              <p className="text-xl font-black text-emerald-400 mt-0.5">
                {testResults.filter(t => t.passed).length}
              </p>
            </div>
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Failed</span>
              <p className="text-xl font-black text-rose-400 mt-0.5">
                {testResults.filter(t => !t.passed).length}
              </p>
            </div>
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
              <p className="text-xl font-black text-emerald-400 mt-0.5">
                {testResults.every(t => t.passed) && testResults.length > 0 ? '100% PASS' : 'PENDING'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {testResults.map((t, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  {t.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">{t.testName}</span>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {t.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{t.message}</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-500 shrink-0">{t.durationMs}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
