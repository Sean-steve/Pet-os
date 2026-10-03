/**
 * Pet OS Shared Kernel - Unique Identifiers (UUIDv7)
 * Implements ADR-003: All externally visible primary IDs use UUIDv7.
 * Provides approximate time-ordering and global uniqueness.
 */

export type Brand<K, T> = K & { readonly __brand: T };

export type UserId = Brand<string, 'UserId'>;
export type HouseholdId = Brand<string, 'HouseholdId'>;
export type PetId = Brand<string, 'PetId'>;
export type DeviceId = Brand<string, 'DeviceId'>;
export type BookingId = Brand<string, 'BookingId'>;
export type WalkSessionId = Brand<string, 'WalkSessionId'>;
export type PaymentIntentId = Brand<string, 'PaymentIntentId'>;
export type IncidentId = Brand<string, 'IncidentId'>;
export type GeofenceId = Brand<string, 'GeofenceId'>;
export type EventId = Brand<string, 'EventId'>;
export type CorrelationId = Brand<string, 'CorrelationId'>;
export type AuditEventId = Brand<string, 'AuditEventId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type InvitationId = Brand<string, 'InvitationId'>;
export type MembershipId = Brand<string, 'MembershipId'>;
export type OrderId = Brand<string, 'OrderId'>;
export type ProductId = Brand<string, 'ProductId'>;
export type RecommendationId = Brand<string, 'RecommendationId'>;

// Sprint 28 - Pet Intelligence & AI Platform IDs
export type AIModelDefinitionId = Brand<string, 'AIModelDefinitionId'>;
export type AIModelDeploymentId = Brand<string, 'AIModelDeploymentId'>;
export type AIPromptTemplateId = Brand<string, 'AIPromptTemplateId'>;
export type AIPromptVersionId = Brand<string, 'AIPromptVersionId'>;
export type AIConversationId = Brand<string, 'AIConversationId'>;
export type AIMessageId = Brand<string, 'AIMessageId'>;
export type AIRequestId = Brand<string, 'AIRequestId'>;
export type AIResponseId = Brand<string, 'AIResponseId'>;
export type AIContextAssemblyId = Brand<string, 'AIContextAssemblyId'>;
export type AISafetyDecisionId = Brand<string, 'AISafetyDecisionId'>;
export type AIConsentId = Brand<string, 'AIConsentId'>;
export type AIEvaluationCaseId = Brand<string, 'AIEvaluationCaseId'>;
export type AIEvaluationRunId = Brand<string, 'AIEvaluationRunId'>;
export type AIIncidentId = Brand<string, 'AIIncidentId'>;
export type PetPhotoId = Brand<string, 'PetPhotoId'>;
export type MicrochipId = Brand<string, 'MicrochipId'>;
export type PetRelationshipId = Brand<string, 'PetRelationshipId'>;
export type TimelineEventId = Brand<string, 'TimelineEventId'>;
export type PetDocumentId = Brand<string, 'PetDocumentId'>;
export type DocumentVersionId = Brand<string, 'DocumentVersionId'>;
export type PassportShareId = Brand<string, 'PassportShareId'>;
export type PassportExportId = Brand<string, 'PassportExportId'>;
export type ConditionId = Brand<string, 'ConditionId'>;
export type AllergyId = Brand<string, 'AllergyId'>;
export type EncounterId = Brand<string, 'EncounterId'>;
export type VaccinationId = Brand<string, 'VaccinationId'>;
export type MedicationId = Brand<string, 'MedicationId'>;
export type ProcedureId = Brand<string, 'ProcedureId'>;
export type DiagnosticResultId = Brand<string, 'DiagnosticResultId'>;
export type ClinicalNoteId = Brand<string, 'ClinicalNoteId'>;
export type AmendmentId = Brand<string, 'AmendmentId'>;
export type ProviderId = Brand<string, 'ProviderId'>;
export type ClinicId = Brand<string, 'ClinicId'>;
export type CareObligationId = Brand<string, 'CareObligationId'>;
export type CareOccurrenceId = Brand<string, 'CareOccurrenceId'>;
export type CareCompletionRecordId = Brand<string, 'CareCompletionRecordId'>;
export type ReminderPolicyId = Brand<string, 'ReminderPolicyId'>;
export type NotificationId = Brand<string, 'NotificationId'>;
export type NotificationPreferenceId = Brand<string, 'NotificationPreferenceId'>;
export type DeliveryAttemptId = Brand<string, 'DeliveryAttemptId'>;
export type FoodId = Brand<string, 'FoodId'>;
export type FeedingPlanId = Brand<string, 'FeedingPlanId'>;
export type MealScheduleId = Brand<string, 'MealScheduleId'>;
export type MealOccurrenceId = Brand<string, 'MealOccurrenceId'>;
export type MealLogId = Brand<string, 'MealLogId'>;
export type TreatLogId = Brand<string, 'TreatLogId'>;
export type HydrationLogId = Brand<string, 'HydrationLogId'>;
export type AppetiteObservationId = Brand<string, 'AppetiteObservationId'>;
export type DietaryRestrictionId = Brand<string, 'DietaryRestrictionId'>;
export type FoodTransitionPlanId = Brand<string, 'FoodTransitionPlanId'>;
export type FoodTransitionStageId = Brand<string, 'FoodTransitionStageId'>;
export type SkillId = Brand<string, 'SkillId'>;
export type TrainingGoalId = Brand<string, 'TrainingGoalId'>;
export type TrainingPlanId = Brand<string, 'TrainingPlanId'>;
export type TrainingProgramId = Brand<string, 'TrainingProgramId'>;
export type ProgramVersionId = Brand<string, 'ProgramVersionId'>;
export type ProgramStageId = Brand<string, 'ProgramStageId'>;
export type TrainingExerciseId = Brand<string, 'TrainingExerciseId'>;
export type TrainingSessionId = Brand<string, 'TrainingSessionId'>;
export type ExerciseAttemptId = Brand<string, 'ExerciseAttemptId'>;
export type SkillProgressId = Brand<string, 'SkillProgressId'>;
export type TrainingMilestoneId = Brand<string, 'TrainingMilestoneId'>;
export type TrainingEvidenceId = Brand<string, 'TrainingEvidenceId'>;
export type BehaviorObservationId = Brand<string, 'BehaviorObservationId'>;
export type BehaviorAmendmentId = Brand<string, 'BehaviorAmendmentId'>;
export type ActivityId = Brand<string, 'ActivityId'>;
export type ActivitySessionId = Brand<string, 'ActivitySessionId'>;
export type ActivityRoutineId = Brand<string, 'ActivityRoutineId'>;
export type ActivityOccurrenceId = Brand<string, 'ActivityOccurrenceId'>;
export type ActivityGoalId = Brand<string, 'ActivityGoalId'>;
export type DailyCareTaskId = Brand<string, 'DailyCareTaskId'>;
export type RestObservationId = Brand<string, 'RestObservationId'>;

// Sprint 10 - Provider Platform IDs
export type BusinessId = Brand<string, 'BusinessId'>;
export type BusinessMembershipId = Brand<string, 'BusinessMembershipId'>;
export type CredentialId = Brand<string, 'CredentialId'>;
export type VerificationCaseId = Brand<string, 'VerificationCaseId'>;
export type ServiceOfferingId = Brand<string, 'ServiceOfferingId'>;
export type ServiceTypeId = Brand<string, 'ServiceTypeId'>;
export type LocationId = Brand<string, 'LocationId'>;
export type ServiceAreaId = Brand<string, 'ServiceAreaId'>;
export type AvailabilityRuleId = Brand<string, 'AvailabilityRuleId'>;
export type AvailabilityExceptionId = Brand<string, 'AvailabilityExceptionId'>;
export type TrustIndicatorId = Brand<string, 'TrustIndicatorId'>;
export type ProviderReportId = Brand<string, 'ProviderReportId'>;

// Sprint 11 - Service Discovery & Booking Engine IDs
export type ReservationHoldId = Brand<string, 'ReservationHoldId'>;
export type BookingSeriesId = Brand<string, 'BookingSeriesId'>;
export type BookingAccessGrantId = Brand<string, 'BookingAccessGrantId'>;
export type RescheduleRequestId = Brand<string, 'RescheduleRequestId'>;
export type BookingCancellationId = Brand<string, 'BookingCancellationId'>;
export type CapacityAllocationId = Brand<string, 'CapacityAllocationId'>;
export type SlotId = Brand<string, 'SlotId'>;

// Sprint 12 - Financial Platform & Ledger IDs
export type PaymentTransactionId = Brand<string, 'PaymentTransactionId'>;
export type LedgerAccountId = Brand<string, 'LedgerAccountId'>;
export type LedgerJournalId = Brand<string, 'LedgerJournalId'>;
export type LedgerEntryId = Brand<string, 'LedgerEntryId'>;
export type CommissionRuleId = Brand<string, 'CommissionRuleId'>;
export type CommissionSnapshotId = Brand<string, 'CommissionSnapshotId'>;
export type ProviderEarningId = Brand<string, 'ProviderEarningId'>;
export type EarningHoldId = Brand<string, 'EarningHoldId'>;
export type RefundId = Brand<string, 'RefundId'>;
export type FinancialAdjustmentId = Brand<string, 'FinancialAdjustmentId'>;
export type ProviderPayoutDestinationId = Brand<string, 'ProviderPayoutDestinationId'>;
export type ProviderPayoutId = Brand<string, 'ProviderPayoutId'>;
export type PayoutAllocationId = Brand<string, 'PayoutAllocationId'>;
export type ReconciliationRunId = Brand<string, 'ReconciliationRunId'>;
export type ReconciliationItemId = Brand<string, 'ReconciliationItemId'>;
export type FinancialReceiptId = Brand<string, 'FinancialReceiptId'>;
export type WebhookEventId = Brand<string, 'WebhookEventId'>;

// Sprint 13 - Dog Walking Platform IDs
export type HandoverId = Brand<string, 'HandoverId'>;
export type WalkIncidentId = Brand<string, 'WalkIncidentId'>;
export type WalkTelemetryId = Brand<string, 'WalkTelemetryId'>;
export type WalkCompletionReportId = Brand<string, 'WalkCompletionReportId'>;
export type WalkMediaId = Brand<string, 'WalkMediaId'>;
export type OfflineSyncEventId = Brand<string, 'OfflineSyncEventId'>;

// Sprint 14 - Tracking & Location Platform IDs
export type TrackingDeviceAssignmentId = Brand<string, 'TrackingDeviceAssignmentId'>;
export type TrackingSessionId = Brand<string, 'TrackingSessionId'>;
export type LocationObservationId = Brand<string, 'LocationObservationId'>;
export type RouteId = Brand<string, 'RouteId'>;
export type IngestionId = Brand<string, 'IngestionId'>;
export type IntegrationCredentialId = Brand<string, 'IntegrationCredentialId'>;
export type DeadLetterEventId = Brand<string, 'DeadLetterEventId'>;

// Sprint 15 - Geofencing & Lost Pet Recovery IDs
export type SafeZoneId = Brand<string, 'SafeZoneId'>;
export type GeofenceTransitionEventId = Brand<string, 'GeofenceTransitionEventId'>;
export type LostPetIncidentId = Brand<string, 'LostPetIncidentId'>;
export type LostPetSightingId = Brand<string, 'LostPetSightingId'>;
export type PublicRecoveryProfileId = Brand<string, 'PublicRecoveryProfileId'>;
export type TagTokenId = Brand<string, 'TagTokenId'>;
export type ContactRelaySessionId = Brand<string, 'ContactRelaySessionId'>;

// Sprint 16 - Pet Community, Groups, Events & Recovery Network IDs
export type CommunityProfileId = Brand<string, 'CommunityProfileId'>;
export type CommunityPetProfileId = Brand<string, 'CommunityPetProfileId'>;
export type CommunityGroupId = Brand<string, 'CommunityGroupId'>;
export type GroupMembershipId = Brand<string, 'GroupMembershipId'>;
export type GroupInvitationId = Brand<string, 'GroupInvitationId'>;
export type CommunityPostId = Brand<string, 'CommunityPostId'>;
export type PostRevisionId = Brand<string, 'PostRevisionId'>;
export type PostMediaId = Brand<string, 'PostMediaId'>;
export type CommunityCommentId = Brand<string, 'CommunityCommentId'>;
export type CommunityReactionId = Brand<string, 'CommunityReactionId'>;
export type CommunityEventId = Brand<string, 'CommunityEventId'>;
export type EventAttendanceId = Brand<string, 'EventAttendanceId'>;
export type CommunityRecoveryAlertId = Brand<string, 'CommunityRecoveryAlertId'>;
export type CommunityRecoveryAlertFollowerId = Brand<string, 'CommunityRecoveryAlertFollowerId'>;
export type CommunityRecoveryVolunteerId = Brand<string, 'CommunityRecoveryVolunteerId'>;
export type RecoveryConsentId = Brand<string, 'RecoveryConsentId'>;
export type CommunityReportId = Brand<string, 'CommunityReportId'>;
export type ModerationActionId = Brand<string, 'ModerationActionId'>;
export type ContentFlagId = Brand<string, 'ContentFlagId'>;
export type ModerationAppealId = Brand<string, 'ModerationAppealId'>;

// Sprint 17 - Privacy-Preserving BLE Crowd Recovery Network IDs
export type ScannerInstallationId = Brand<string, 'ScannerInstallationId'>;
export type BleRecoveryKeyReferenceId = Brand<string, 'BleRecoveryKeyReferenceId'>;
export type CrowdRecoverySessionId = Brand<string, 'CrowdRecoverySessionId'>;
export type CrowdObservationId = Brand<string, 'CrowdObservationId'>;
export type CrowdObservationClusterId = Brand<string, 'CrowdObservationClusterId'>;
export type CrowdRecoveryEvidenceId = Brand<string, 'CrowdRecoveryEvidenceId'>;
export type CrowdRecoveryAbuseFlagId = Brand<string, 'CrowdRecoveryAbuseFlagId'>;

// Sprint 18 - Rescue, Shelter, Foster, Reunification, Adoption & Animal Welfare IDs
export type RescueOrganizationId = Brand<string, 'RescueOrganizationId'>;
export type RescueOrganizationMembershipId = Brand<string, 'RescueOrganizationMembershipId'>;
export type RescueFacilityId = Brand<string, 'RescueFacilityId'>;
export type AnimalIntakeCaseId = Brand<string, 'AnimalIntakeCaseId'>;
export type RescueAnimalId = Brand<string, 'RescueAnimalId'>;
export type RescueCustodyRecordId = Brand<string, 'RescueCustodyRecordId'>;
export type ShelterPlacementId = Brand<string, 'ShelterPlacementId'>;
export type FosterProfileId = Brand<string, 'FosterProfileId'>;
export type FosterApplicationId = Brand<string, 'FosterApplicationId'>;
export type FosterPlacementId = Brand<string, 'FosterPlacementId'>;
export type AnimalWelfareCaseId = Brand<string, 'AnimalWelfareCaseId'>;
export type WelfareEvidenceId = Brand<string, 'WelfareEvidenceId'>;
export type WelfareActionId = Brand<string, 'WelfareActionId'>;
export type ReunificationCaseId = Brand<string, 'ReunificationCaseId'>;
export type ReunificationClaimId = Brand<string, 'ReunificationClaimId'>;
export type OwnershipEvidenceId = Brand<string, 'OwnershipEvidenceId'>;
export type AdoptionCaseId = Brand<string, 'AdoptionCaseId'>;
export type AdoptionProfileId = Brand<string, 'AdoptionProfileId'>;
export type AdoptionApplicationId = Brand<string, 'AdoptionApplicationId'>;
export type HomeCheckCaseId = Brand<string, 'HomeCheckCaseId'>;
export type AdoptionAgreementId = Brand<string, 'AdoptionAgreementId'>;
export type AdoptionPlacementId = Brand<string, 'AdoptionPlacementId'>;
export type AdoptionReturnCaseId = Brand<string, 'AdoptionReturnCaseId'>;
export type RescueAnimalOutcomeId = Brand<string, 'RescueAnimalOutcomeId'>;
export type PublicFoundPetProfileId = Brand<string, 'PublicFoundPetProfileId'>;

// Sprint 19 - Veterinary Professional Workspace IDs
export type ClinicalAccessGrantId = Brand<string, 'ClinicalAccessGrantId'>;
export type VeterinaryConsentId = Brand<string, 'VeterinaryConsentId'>;
export type ClinicalBreakGlassAccessId = Brand<string, 'ClinicalBreakGlassAccessId'>;
export type ClinicalSignatureId = Brand<string, 'ClinicalSignatureId'>;
export type PrescriptionId = Brand<string, 'PrescriptionId'>;
export type DiagnosticOrderId = Brand<string, 'DiagnosticOrderId'>;
export type CarePlanId = Brand<string, 'CarePlanId'>;
export type ClinicalRecordCorrectionRequestId = Brand<string, 'ClinicalRecordCorrectionRequestId'>;
export type VeterinaryReferralId = Brand<string, 'VeterinaryReferralId'>;
export type WorkQueueItemId = Brand<string, 'WorkQueueItemId'>;

// Sprint 20 - Trainer Professional Workspace IDs
export type TrainingAccessGrantId = Brand<string, 'TrainingAccessGrantId'>;
export type TrainerClientRelationshipId = Brand<string, 'TrainerClientRelationshipId'>;
export type TrainerConsentId = Brand<string, 'TrainerConsentId'>;
export type TrainingEngagementId = Brand<string, 'TrainingEngagementId'>;
export type ProfessionalTrainingAssessmentId = Brand<string, 'ProfessionalTrainingAssessmentId'>;
export type TrainerSessionAssignmentId = Brand<string, 'TrainerSessionAssignmentId'>;
export type TrainerProgressReviewId = Brand<string, 'TrainerProgressReviewId'>;
export type TrainerHomeworkHandoffId = Brand<string, 'TrainerHomeworkHandoffId'>;
export type TrainerReportId = Brand<string, 'TrainerReportId'>;
export type TrainerRecordAmendmentId = Brand<string, 'TrainerRecordAmendmentId'>;
export type TrainerCorrectionRequestId = Brand<string, 'TrainerCorrectionRequestId'>;
export type TrainerWorkQueueItemId = Brand<string, 'TrainerWorkQueueItemId'>;

// Sprint 21 - Groomer, Pet Sitter & Boarding Professional Care Workspace IDs
export type CareEngagementId = Brand<string, 'CareEngagementId'>;
export type CareInstructionSnapshotId = Brand<string, 'CareInstructionSnapshotId'>;
export type CareAccessGrantId = Brand<string, 'CareAccessGrantId'>;
export type CareHandoverId = Brand<string, 'CareHandoverId'>;
export type CareAccessSecretId = Brand<string, 'CareAccessSecretId'>;
export type CareServiceIncidentId = Brand<string, 'CareServiceIncidentId'>;
export type CareCompletionEvidenceId = Brand<string, 'CareCompletionEvidenceId'>;
export type CareShiftHandoverId = Brand<string, 'CareShiftHandoverId'>;
export type CareServiceUpdateId = Brand<string, 'CareServiceUpdateId'>;
export type CareServiceObservationId = Brand<string, 'CareServiceObservationId'>;
export type CareServiceMediaId = Brand<string, 'CareServiceMediaId'>;
export type GroomingSessionId = Brand<string, 'GroomingSessionId'>;
export type GroomingProcedureId = Brand<string, 'GroomingProcedureId'>;
export type SitterVisitId = Brand<string, 'SitterVisitId'>;
export type BoardingStayId = Brand<string, 'BoardingStayId'>;
export type BoardingUnitId = Brand<string, 'BoardingUnitId'>;
export type BoardingUnitAssignmentId = Brand<string, 'BoardingUnitAssignmentId'>;
export type BoardingDailyLogId = Brand<string, 'BoardingDailyLogId'>;
export type BoardingStayExtensionId = Brand<string, 'BoardingStayExtensionId'>;

// Sprint 22 - Pet Transport Professional Workspace IDs
export type TransportDriverProfileId = Brand<string, 'TransportDriverProfileId'>;
export type TransportVehicleId = Brand<string, 'TransportVehicleId'>;
export type TransportTripId = Brand<string, 'TransportTripId'>;
export type TransportTripPetId = Brand<string, 'TransportTripPetId'>;
export type TransportStopId = Brand<string, 'TransportStopId'>;
export type TransportLegId = Brand<string, 'TransportLegId'>;
export type TransportCustodyRecordId = Brand<string, 'TransportCustodyRecordId'>;
export type TransportInstructionSnapshotId = Brand<string, 'TransportInstructionSnapshotId'>;
export type TransportContainmentAssignmentId = Brand<string, 'TransportContainmentAssignmentId'>;
export type TransportDelayId = Brand<string, 'TransportDelayId'>;
export type TransportEnvironmentObservationId = Brand<string, 'TransportEnvironmentObservationId'>;
export type TransportSafetyAlertId = Brand<string, 'TransportSafetyAlertId'>;
export type TransportIncidentId = Brand<string, 'TransportIncidentId'>;
export type TransportHandoverRecordId = Brand<string, 'TransportHandoverRecordId'>;
export type TransportCompletionEvidenceId = Brand<string, 'TransportCompletionEvidenceId'>;
export type TransportBelongingItemId = Brand<string, 'TransportBelongingItemId'>;

// Sprint 23 - Provider Reviews, Reputation, Service Quality & Trust Engine IDs
export type ReviewEligibilityId = Brand<string, 'ReviewEligibilityId'>;
export type ReviewId = Brand<string, 'ReviewId'>;
export type ReviewRevisionId = Brand<string, 'ReviewRevisionId'>;
export type ReviewDimensionDefinitionId = Brand<string, 'ReviewDimensionDefinitionId'>;
export type ReviewMediaId = Brand<string, 'ReviewMediaId'>;
export type ReviewResponseId = Brand<string, 'ReviewResponseId'>;
export type ReviewResponseRevisionId = Brand<string, 'ReviewResponseRevisionId'>;
export type ReviewReportId = Brand<string, 'ReviewReportId'>;
export type ReviewDisputeId = Brand<string, 'ReviewDisputeId'>;
export type ReviewDisputeEvidenceId = Brand<string, 'ReviewDisputeEvidenceId'>;
export type ReviewAppealId = Brand<string, 'ReviewAppealId'>;
export type ReviewModerationActionId = Brand<string, 'ReviewModerationActionId'>;
export type ReviewAbuseSignalId = Brand<string, 'ReviewAbuseSignalId'>;
export type ReputationProjectionId = Brand<string, 'ReputationProjectionId'>;

// Sprint 24 - Consumer Subscription, Premium Entitlements & Monetization IDs
export type ConsumerPlanId = Brand<string, 'ConsumerPlanId'>;
export type PlanVersionId = Brand<string, 'PlanVersionId'>;
export type PlanPriceId = Brand<string, 'PlanPriceId'>;
export type EntitlementDefinitionId = Brand<string, 'EntitlementDefinitionId'>;
export type EntitlementBundleId = Brand<string, 'EntitlementBundleId'>;
export type EntitlementGrantId = Brand<string, 'EntitlementGrantId'>;
export type ConsumerSubscriptionId = Brand<string, 'ConsumerSubscriptionId'>;
export type SubscriptionBillingAgreementId = Brand<string, 'SubscriptionBillingAgreementId'>;
export type SubscriptionStatusHistoryId = Brand<string, 'SubscriptionStatusHistoryId'>;
export type SubscriptionInvoiceId = Brand<string, 'SubscriptionInvoiceId'>;
export type SubscriptionTrialId = Brand<string, 'SubscriptionTrialId'>;
export type SubscriptionChangeRequestId = Brand<string, 'SubscriptionChangeRequestId'>;
export type SubscriptionCancellationRecordId = Brand<string, 'SubscriptionCancellationRecordId'>;
export type SubscriptionProviderEventId = Brand<string, 'SubscriptionProviderEventId'>;
export type SubscriptionReconciliationRunId = Brand<string, 'SubscriptionReconciliationRunId'>;
export type EntitlementReconciliationRunId = Brand<string, 'EntitlementReconciliationRunId'>;
export type PromotionalGrantId = Brand<string, 'PromotionalGrantId'>;
export type SupportGrantId = Brand<string, 'SupportGrantId'>;
export type EntitlementUsageId = Brand<string, 'EntitlementUsageId'>;
export type OfflineEntitlementTokenId = Brand<string, 'OfflineEntitlementTokenId'>;

// Sprint 25 - Tracker Connectivity Subscription & Device Service Plan IDs
export type TrackerServicePlanId = Brand<string, 'TrackerServicePlanId'>;
export type TrackerPlanVersionId = Brand<string, 'TrackerPlanVersionId'>;
export type TrackerPlanPriceId = Brand<string, 'TrackerPlanPriceId'>;
export type TrackerSubscriptionId = Brand<string, 'TrackerSubscriptionId'>;
export type TrackerBillingAgreementId = Brand<string, 'TrackerBillingAgreementId'>;
export type TrackerSubscriptionInvoiceId = Brand<string, 'TrackerSubscriptionInvoiceId'>;
export type TrackerCarrierServiceRecordId = Brand<string, 'TrackerCarrierServiceRecordId'>;
export type TrackerEntitlementGrantId = Brand<string, 'TrackerEntitlementGrantId'>;
export type TrackerDeviceTransferRecordId = Brand<string, 'TrackerDeviceTransferRecordId'>;
export type TrackerDataUsageRecordId = Brand<string, 'TrackerDataUsageRecordId'>;
export type TrackerSafetyOverrideRecordId = Brand<string, 'TrackerSafetyOverrideRecordId'>;
export type TrackerWebhookEventId = Brand<string, 'TrackerWebhookEventId'>;
export type TrackerReconciliationRunId = Brand<string, 'TrackerReconciliationRunId'>;

// Sprint 26 - Provider Business SaaS & Professional Subscription IDs
export type ProviderSaaSPlanId = Brand<string, 'ProviderSaaSPlanId'>;
export type ProviderSaaSPlanVersionId = Brand<string, 'ProviderSaaSPlanVersionId'>;
export type ProviderSaaSPriceId = Brand<string, 'ProviderSaaSPriceId'>;
export type ProviderSaaSSubscriptionId = Brand<string, 'ProviderSaaSSubscriptionId'>;
export type ProviderSaaSBillingAgreementId = Brand<string, 'ProviderSaaSBillingAgreementId'>;
export type ProviderSaaSSubscriptionInvoiceId = Brand<string, 'ProviderSaaSSubscriptionInvoiceId'>;
export type ProviderSaaSContinuityGrantId = Brand<string, 'ProviderSaaSContinuityGrantId'>;
export type ProviderSaaSSupportGrantId = Brand<string, 'ProviderSaaSSupportGrantId'>;
export type ProviderSaaSChangeRequestId = Brand<string, 'ProviderSaaSChangeRequestId'>;
export type ProviderSaaSReconciliationRunId = Brand<string, 'ProviderSaaSReconciliationRunId'>;
export type ProviderSaaSUsageProjectionId = Brand<string, 'ProviderSaaSUsageProjectionId'>;

// Sprint 27 - Marketplace Seller & Commerce Operations Platform IDs
export type SellerId = Brand<string, 'SellerId'>;
export type SellerMembershipId = Brand<string, 'SellerMembershipId'>;
export type SellerVerificationCaseId = Brand<string, 'SellerVerificationCaseId'>;
export type SellerAgreementId = Brand<string, 'SellerAgreementId'>;
export type ProductCategoryId = Brand<string, 'ProductCategoryId'>;
export type ProductBrandId = Brand<string, 'ProductBrandId'>;
export type ProductVariantId = Brand<string, 'ProductVariantId'>;
export type SkuId = Brand<string, 'SkuId'>;
export type ProductMediaId = Brand<string, 'ProductMediaId'>;
export type ProductDocumentId = Brand<string, 'ProductDocumentId'>;
export type ProductModerationCaseId = Brand<string, 'ProductModerationCaseId'>;
export type SellerListingId = Brand<string, 'SellerListingId'>;
export type ListingPriceHistoryId = Brand<string, 'ListingPriceHistoryId'>;
export type InventoryLocationId = Brand<string, 'InventoryLocationId'>;
export type InventoryItemId = Brand<string, 'InventoryItemId'>;
export type InventoryMovementId = Brand<string, 'InventoryMovementId'>;
export type InventoryReservationId = Brand<string, 'InventoryReservationId'>;
export type CartId = Brand<string, 'CartId'>;
export type CartItemId = Brand<string, 'CartItemId'>;
export type CheckoutId = Brand<string, 'CheckoutId'>;
export type CheckoutSnapshotId = Brand<string, 'CheckoutSnapshotId'>;
export type SellerOrderId = Brand<string, 'SellerOrderId'>;
export type OrderItemId = Brand<string, 'OrderItemId'>;
export type FulfillmentId = Brand<string, 'FulfillmentId'>;
export type ShipmentId = Brand<string, 'ShipmentId'>;
export type ShipmentStatusHistoryId = Brand<string, 'ShipmentStatusHistoryId'>;
export type DeliveryEvidenceId = Brand<string, 'DeliveryEvidenceId'>;
export type ReturnRequestId = Brand<string, 'ReturnRequestId'>;
export type ReturnItemId = Brand<string, 'ReturnItemId'>;
export type ReturnEvidenceId = Brand<string, 'ReturnEvidenceId'>;
export type ReturnInspectionId = Brand<string, 'ReturnInspectionId'>;
export type CommerceDisputeId = Brand<string, 'CommerceDisputeId'>;
export type CommerceSupportCaseId = Brand<string, 'CommerceSupportCaseId'>;
export type ProductSafetyReportId = Brand<string, 'ProductSafetyReportId'>;
export type ProductRecallNoticeId = Brand<string, 'ProductRecallNoticeId'>;
export type CommerceReconciliationRunId = Brand<string, 'CommerceReconciliationRunId'>;

/**
 * Generates a standard RFC 9562 compliant UUIDv7.
 * Uses Unix epoch timestamp in milliseconds in the top 48 bits,
 * followed by version 7 and random/counter bits.
 */
export function generateUUIDv7(): string {
  const now = Date.now();
  const bytes = new Uint8Array(16);

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Set 48-bit timestamp
  bytes[0] = (now / 0x10000000000) & 0xff;
  bytes[1] = (now / 0x100000000) & 0xff;
  bytes[2] = (now / 0x1000000) & 0xff;
  bytes[3] = (now / 0x10000) & 0xff;
  bytes[4] = (now / 0x100) & 0xff;
  bytes[5] = now & 0xff;

  // Set version to 7 (bits 48-51 -> 0111)
  bytes[6] = (bytes[6] & 0x0f) | 0x70;

  // Set variant to RFC 4122/9562 (bits 64-65 -> 10)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Extracts the timestamp from a valid UUIDv7
 */
export function extractTimestampFromUUIDv7(uuid: string): Date | null {
  try {
    const clean = uuid.replace(/-/g, '');
    if (clean.length !== 32) return null;
    const timeHex = clean.slice(0, 12);
    const ms = parseInt(timeHex, 16);
    if (isNaN(ms)) return null;
    return new Date(ms);
  } catch {
    return null;
  }
}

/**
 * Checks if a string conforms to UUIDv7 pattern
 */
export function isUUIDv7(value: string): boolean {
  const uuidv7Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidv7Regex.test(value);
}

// Brand helper constructors
export const asUserId = (id: string) => id as UserId;
export const asHouseholdId = (id: string) => id as HouseholdId;
export const asPetId = (id: string) => id as PetId;
export const asDeviceId = (id: string) => id as DeviceId;
export const asBookingId = (id: string) => id as BookingId;
export const asWalkSessionId = (id: string) => id as WalkSessionId;
export const asPaymentIntentId = (id: string) => id as PaymentIntentId;
export const asEventId = (id: string) => id as EventId;
export const asCorrelationId = (id: string) => id as CorrelationId;
export const asAuditEventId = (id: string) => id as AuditEventId;
export const asSessionId = (id: string) => id as SessionId;
export const asInvitationId = (id: string) => id as InvitationId;
export const asMembershipId = (id: string) => id as MembershipId;
export const asPetPhotoId = (id: string) => id as PetPhotoId;
export const asMicrochipId = (id: string) => id as MicrochipId;
export const asPetRelationshipId = (id: string) => id as PetRelationshipId;
export const asTimelineEventId = (id: string) => id as TimelineEventId;
export const asPetDocumentId = (id: string) => id as PetDocumentId;
export const asDocumentVersionId = (id: string) => id as DocumentVersionId;
export const asPassportShareId = (id: string) => id as PassportShareId;
export const asPassportExportId = (id: string) => id as PassportExportId;
export const asConditionId = (id: string) => id as ConditionId;
export const asAllergyId = (id: string) => id as AllergyId;
export const asEncounterId = (id: string) => id as EncounterId;
export const asVaccinationId = (id: string) => id as VaccinationId;
export const asMedicationId = (id: string) => id as MedicationId;
export const asProcedureId = (id: string) => id as ProcedureId;
export const asDiagnosticResultId = (id: string) => id as DiagnosticResultId;
export const asClinicalNoteId = (id: string) => id as ClinicalNoteId;
export const asAmendmentId = (id: string) => id as AmendmentId;
export const asProviderId = (id: string) => id as ProviderId;
export const asClinicId = (id: string) => id as ClinicId;
export const asCareObligationId = (id: string) => id as CareObligationId;
export const asCareOccurrenceId = (id: string) => id as CareOccurrenceId;
export const asCareCompletionRecordId = (id: string) => id as CareCompletionRecordId;
export const asReminderPolicyId = (id: string) => id as ReminderPolicyId;
export const asNotificationId = (id: string) => id as NotificationId;
export const asNotificationPreferenceId = (id: string) => id as NotificationPreferenceId;
export const asDeliveryAttemptId = (id: string) => id as DeliveryAttemptId;
export const asFoodId = (id: string) => id as FoodId;
export const asFeedingPlanId = (id: string) => id as FeedingPlanId;
export const asMealScheduleId = (id: string) => id as MealScheduleId;
export const asMealOccurrenceId = (id: string) => id as MealOccurrenceId;
export const asMealLogId = (id: string) => id as MealLogId;
export const asTreatLogId = (id: string) => id as TreatLogId;
export const asHydrationLogId = (id: string) => id as HydrationLogId;
export const asAppetiteObservationId = (id: string) => id as AppetiteObservationId;
export const asDietaryRestrictionId = (id: string) => id as DietaryRestrictionId;
export const asFoodTransitionPlanId = (id: string) => id as FoodTransitionPlanId;
export const asFoodTransitionStageId = (id: string) => id as FoodTransitionStageId;
export const asSkillId = (id: string) => id as SkillId;
export const asTrainingGoalId = (id: string) => id as TrainingGoalId;
export const asTrainingPlanId = (id: string) => id as TrainingPlanId;
export const asTrainingProgramId = (id: string) => id as TrainingProgramId;
export const asProgramVersionId = (id: string) => id as ProgramVersionId;
export const asProgramStageId = (id: string) => id as ProgramStageId;
export const asTrainingExerciseId = (id: string) => id as TrainingExerciseId;
export const asTrainingSessionId = (id: string) => id as TrainingSessionId;
export const asExerciseAttemptId = (id: string) => id as ExerciseAttemptId;
export const asSkillProgressId = (id: string) => id as SkillProgressId;
export const asTrainingMilestoneId = (id: string) => id as TrainingMilestoneId;
export const asTrainingEvidenceId = (id: string) => id as TrainingEvidenceId;
export const asBehaviorObservationId = (id: string) => id as BehaviorObservationId;
export const asBehaviorAmendmentId = (id: string) => id as BehaviorAmendmentId;
export const asActivityId = (id: string) => id as ActivityId;
export const asActivitySessionId = (id: string) => id as ActivitySessionId;
export const asActivityRoutineId = (id: string) => id as ActivityRoutineId;
export const asActivityOccurrenceId = (id: string) => id as ActivityOccurrenceId;
export const asActivityGoalId = (id: string) => id as ActivityGoalId;
export const asDailyCareTaskId = (id: string) => id as DailyCareTaskId;
export const asRestObservationId = (id: string) => id as RestObservationId;
export const asBusinessId = (id: string) => id as BusinessId;
export const asBusinessMembershipId = (id: string) => id as BusinessMembershipId;
export const asCredentialId = (id: string) => id as CredentialId;
export const asVerificationCaseId = (id: string) => id as VerificationCaseId;
export const asServiceOfferingId = (id: string) => id as ServiceOfferingId;
export const asServiceTypeId = (id: string) => id as ServiceTypeId;
export const asLocationId = (id: string) => id as LocationId;
export const asServiceAreaId = (id: string) => id as ServiceAreaId;
export const asAvailabilityRuleId = (id: string) => id as AvailabilityRuleId;
export const asAvailabilityExceptionId = (id: string) => id as AvailabilityExceptionId;
export const asTrustIndicatorId = (id: string) => id as TrustIndicatorId;
export const asProviderReportId = (id: string) => id as ProviderReportId;
export const asReservationHoldId = (id: string) => id as ReservationHoldId;
export const asBookingSeriesId = (id: string) => id as BookingSeriesId;
export const asBookingAccessGrantId = (id: string) => id as BookingAccessGrantId;
export const asRescheduleRequestId = (id: string) => id as RescheduleRequestId;
export const asBookingCancellationId = (id: string) => id as BookingCancellationId;
export const asCapacityAllocationId = (id: string) => id as CapacityAllocationId;
export const asSlotId = (id: string) => id as SlotId;

// Sprint 12 brand helper constructors
export const asPaymentTransactionId = (id: string) => id as PaymentTransactionId;
export const asLedgerAccountId = (id: string) => id as LedgerAccountId;
export const asLedgerJournalId = (id: string) => id as LedgerJournalId;
export const asLedgerEntryId = (id: string) => id as LedgerEntryId;
export const asCommissionRuleId = (id: string) => id as CommissionRuleId;
export const asCommissionSnapshotId = (id: string) => id as CommissionSnapshotId;
export const asProviderEarningId = (id: string) => id as ProviderEarningId;
export const asEarningHoldId = (id: string) => id as EarningHoldId;
export const asRefundId = (id: string) => id as RefundId;
export const asFinancialAdjustmentId = (id: string) => id as FinancialAdjustmentId;
export const asProviderPayoutDestinationId = (id: string) => id as ProviderPayoutDestinationId;
export const asProviderPayoutId = (id: string) => id as ProviderPayoutId;
export const asPayoutAllocationId = (id: string) => id as PayoutAllocationId;
export const asReconciliationRunId = (id: string) => id as ReconciliationRunId;
export const asReconciliationItemId = (id: string) => id as ReconciliationItemId;
export const asFinancialReceiptId = (id: string) => id as FinancialReceiptId;
export const asWebhookEventId = (id: string) => id as WebhookEventId;

// Sprint 13 brand helper constructors
export const asIncidentId = (id: string) => id as IncidentId;
export const asHandoverId = (id: string) => id as HandoverId;
export const asWalkIncidentId = (id: string) => id as WalkIncidentId;
export const asWalkTelemetryId = (id: string) => id as WalkTelemetryId;
export const asWalkCompletionReportId = (id: string) => id as WalkCompletionReportId;
export const asWalkMediaId = (id: string) => id as WalkMediaId;
export const asOfflineSyncEventId = (id: string) => id as OfflineSyncEventId;

// Sprint 14 brand helper constructors
export const asTrackingDeviceAssignmentId = (id: string) => id as TrackingDeviceAssignmentId;
export const asTrackingSessionId = (id: string) => id as TrackingSessionId;
export const asLocationObservationId = (id: string) => id as LocationObservationId;
export const asRouteId = (id: string) => id as RouteId;
export const asIngestionId = (id: string) => id as IngestionId;
export const asIntegrationCredentialId = (id: string) => id as IntegrationCredentialId;
export const asDeadLetterEventId = (id: string) => id as DeadLetterEventId;

// Sprint 15 brand helper constructors
export const asSafeZoneId = (id: string) => id as SafeZoneId;
export const asGeofenceTransitionEventId = (id: string) => id as GeofenceTransitionEventId;
export const asLostPetIncidentId = (id: string) => id as LostPetIncidentId;
export const asLostPetSightingId = (id: string) => id as LostPetSightingId;
export const asPublicRecoveryProfileId = (id: string) => id as PublicRecoveryProfileId;
export const asTagTokenId = (id: string) => id as TagTokenId;
export const asContactRelaySessionId = (id: string) => id as ContactRelaySessionId;

// Sprint 16 brand helper constructors
export const asCommunityProfileId = (id: string) => id as CommunityProfileId;
export const asCommunityPetProfileId = (id: string) => id as CommunityPetProfileId;
export const asCommunityGroupId = (id: string) => id as CommunityGroupId;
export const asGroupMembershipId = (id: string) => id as GroupMembershipId;
export const asGroupInvitationId = (id: string) => id as GroupInvitationId;
export const asCommunityPostId = (id: string) => id as CommunityPostId;
export const asPostRevisionId = (id: string) => id as PostRevisionId;
export const asPostMediaId = (id: string) => id as PostMediaId;
export const asCommunityCommentId = (id: string) => id as CommunityCommentId;
export const asCommunityReactionId = (id: string) => id as CommunityReactionId;
export const asCommunityEventId = (id: string) => id as CommunityEventId;
export const asEventAttendanceId = (id: string) => id as EventAttendanceId;
export const asCommunityRecoveryAlertId = (id: string) => id as CommunityRecoveryAlertId;
export const asCommunityRecoveryAlertFollowerId = (id: string) => id as CommunityRecoveryAlertFollowerId;
export const asCommunityRecoveryVolunteerId = (id: string) => id as CommunityRecoveryVolunteerId;
export const asRecoveryConsentId = (id: string) => id as RecoveryConsentId;
export const asCommunityReportId = (id: string) => id as CommunityReportId;
export const asModerationActionId = (id: string) => id as ModerationActionId;
export const asContentFlagId = (id: string) => id as ContentFlagId;
export const asModerationAppealId = (id: string) => id as ModerationAppealId;

// Sprint 17 brand helper constructors
export const asScannerInstallationId = (id: string) => id as ScannerInstallationId;
export const asBleRecoveryKeyReferenceId = (id: string) => id as BleRecoveryKeyReferenceId;
export const asCrowdRecoverySessionId = (id: string) => id as CrowdRecoverySessionId;
export const asCrowdObservationId = (id: string) => id as CrowdObservationId;
export const asCrowdObservationClusterId = (id: string) => id as CrowdObservationClusterId;
export const asCrowdRecoveryEvidenceId = (id: string) => id as CrowdRecoveryEvidenceId;
export const asCrowdRecoveryAbuseFlagId = (id: string) => id as CrowdRecoveryAbuseFlagId;

// Sprint 18 brand helper constructors
export const asRescueOrganizationId = (id: string) => id as RescueOrganizationId;
export const asRescueOrganizationMembershipId = (id: string) => id as RescueOrganizationMembershipId;
export const asRescueFacilityId = (id: string) => id as RescueFacilityId;
export const asAnimalIntakeCaseId = (id: string) => id as AnimalIntakeCaseId;
export const asRescueAnimalId = (id: string) => id as RescueAnimalId;
export const asRescueCustodyRecordId = (id: string) => id as RescueCustodyRecordId;
export const asShelterPlacementId = (id: string) => id as ShelterPlacementId;
export const asFosterProfileId = (id: string) => id as FosterProfileId;
export const asFosterApplicationId = (id: string) => id as FosterApplicationId;
export const asFosterPlacementId = (id: string) => id as FosterPlacementId;
export const asAnimalWelfareCaseId = (id: string) => id as AnimalWelfareCaseId;
export const asWelfareEvidenceId = (id: string) => id as WelfareEvidenceId;
export const asWelfareActionId = (id: string) => id as WelfareActionId;
export const asReunificationCaseId = (id: string) => id as ReunificationCaseId;
export const asReunificationClaimId = (id: string) => id as ReunificationClaimId;
export const asOwnershipEvidenceId = (id: string) => id as OwnershipEvidenceId;
export const asAdoptionCaseId = (id: string) => id as AdoptionCaseId;
export const asAdoptionProfileId = (id: string) => id as AdoptionProfileId;
export const asAdoptionApplicationId = (id: string) => id as AdoptionApplicationId;
export const asHomeCheckCaseId = (id: string) => id as HomeCheckCaseId;
export const asAdoptionAgreementId = (id: string) => id as AdoptionAgreementId;
export const asAdoptionPlacementId = (id: string) => id as AdoptionPlacementId;
export const asAdoptionReturnCaseId = (id: string) => id as AdoptionReturnCaseId;
export const asRescueAnimalOutcomeId = (id: string) => id as RescueAnimalOutcomeId;
export const asPublicFoundPetProfileId = (id: string) => id as PublicFoundPetProfileId;

// Sprint 19 brand helper constructors
export const asClinicalAccessGrantId = (id: string) => id as ClinicalAccessGrantId;
export const asVeterinaryConsentId = (id: string) => id as VeterinaryConsentId;
export const asClinicalBreakGlassAccessId = (id: string) => id as ClinicalBreakGlassAccessId;
export const asClinicalSignatureId = (id: string) => id as ClinicalSignatureId;
export const asPrescriptionId = (id: string) => id as PrescriptionId;
export const asDiagnosticOrderId = (id: string) => id as DiagnosticOrderId;
export const asCarePlanId = (id: string) => id as CarePlanId;
export const asClinicalRecordCorrectionRequestId = (id: string) => id as ClinicalRecordCorrectionRequestId;
export const asVeterinaryReferralId = (id: string) => id as VeterinaryReferralId;
export const asWorkQueueItemId = (id: string) => id as WorkQueueItemId;

// Sprint 20 brand helper constructors
export const asTrainingAccessGrantId = (id: string) => id as TrainingAccessGrantId;
export const asTrainerClientRelationshipId = (id: string) => id as TrainerClientRelationshipId;
export const asTrainerConsentId = (id: string) => id as TrainerConsentId;
export const asTrainingEngagementId = (id: string) => id as TrainingEngagementId;
export const asProfessionalTrainingAssessmentId = (id: string) => id as ProfessionalTrainingAssessmentId;
export const asTrainerSessionAssignmentId = (id: string) => id as TrainerSessionAssignmentId;
export const asTrainerProgressReviewId = (id: string) => id as TrainerProgressReviewId;
export const asTrainerHomeworkHandoffId = (id: string) => id as TrainerHomeworkHandoffId;
export const asTrainerReportId = (id: string) => id as TrainerReportId;
export const asTrainerRecordAmendmentId = (id: string) => id as TrainerRecordAmendmentId;
export const asTrainerCorrectionRequestId = (id: string) => id as TrainerCorrectionRequestId;
export const asTrainerWorkQueueItemId = (id: string) => id as TrainerWorkQueueItemId;

// Sprint 21 brand helper constructors
export const asCareEngagementId = (id: string) => id as CareEngagementId;
export const asCareInstructionSnapshotId = (id: string) => id as CareInstructionSnapshotId;
export const asCareAccessGrantId = (id: string) => id as CareAccessGrantId;
export const asCareHandoverId = (id: string) => id as CareHandoverId;
export const asCareAccessSecretId = (id: string) => id as CareAccessSecretId;
export const asCareServiceIncidentId = (id: string) => id as CareServiceIncidentId;
export const asCareCompletionEvidenceId = (id: string) => id as CareCompletionEvidenceId;
export const asCareShiftHandoverId = (id: string) => id as CareShiftHandoverId;
export const asCareServiceUpdateId = (id: string) => id as CareServiceUpdateId;
export const asCareServiceObservationId = (id: string) => id as CareServiceObservationId;
export const asCareServiceMediaId = (id: string) => id as CareServiceMediaId;
export const asGroomingSessionId = (id: string) => id as GroomingSessionId;
export const asGroomingProcedureId = (id: string) => id as GroomingProcedureId;
export const asSitterVisitId = (id: string) => id as SitterVisitId;
export const asBoardingStayId = (id: string) => id as BoardingStayId;
export const asBoardingUnitId = (id: string) => id as BoardingUnitId;
export const asBoardingUnitAssignmentId = (id: string) => id as BoardingUnitAssignmentId;
export const asBoardingDailyLogId = (id: string) => id as BoardingDailyLogId;
export const asBoardingStayExtensionId = (id: string) => id as BoardingStayExtensionId;

// Sprint 22 brand helper constructors
export const asTransportDriverProfileId = (id: string) => id as TransportDriverProfileId;
export const asTransportVehicleId = (id: string) => id as TransportVehicleId;
export const asTransportTripId = (id: string) => id as TransportTripId;
export const asTransportTripPetId = (id: string) => id as TransportTripPetId;
export const asTransportStopId = (id: string) => id as TransportStopId;
export const asTransportLegId = (id: string) => id as TransportLegId;
export const asTransportCustodyRecordId = (id: string) => id as TransportCustodyRecordId;
export const asTransportInstructionSnapshotId = (id: string) => id as TransportInstructionSnapshotId;
export const asTransportContainmentAssignmentId = (id: string) => id as TransportContainmentAssignmentId;
export const asTransportDelayId = (id: string) => id as TransportDelayId;
export const asTransportEnvironmentObservationId = (id: string) => id as TransportEnvironmentObservationId;
export const asTransportSafetyAlertId = (id: string) => id as TransportSafetyAlertId;
export const asTransportIncidentId = (id: string) => id as TransportIncidentId;
export const asTransportHandoverRecordId = (id: string) => id as TransportHandoverRecordId;
export const asTransportCompletionEvidenceId = (id: string) => id as TransportCompletionEvidenceId;
export const asTransportBelongingItemId = (id: string) => id as TransportBelongingItemId;

// Sprint 23 brand helper constructors
export const asReviewEligibilityId = (id: string) => id as ReviewEligibilityId;
export const asReviewId = (id: string) => id as ReviewId;
export const asReviewRevisionId = (id: string) => id as ReviewRevisionId;
export const asReviewDimensionDefinitionId = (id: string) => id as ReviewDimensionDefinitionId;
export const asReviewMediaId = (id: string) => id as ReviewMediaId;
export const asReviewResponseId = (id: string) => id as ReviewResponseId;
export const asReviewResponseRevisionId = (id: string) => id as ReviewResponseRevisionId;
export const asReviewReportId = (id: string) => id as ReviewReportId;
export const asReviewDisputeId = (id: string) => id as ReviewDisputeId;
export const asReviewDisputeEvidenceId = (id: string) => id as ReviewDisputeEvidenceId;
export const asReviewAppealId = (id: string) => id as ReviewAppealId;
export const asReviewModerationActionId = (id: string) => id as ReviewModerationActionId;
export const asReviewAbuseSignalId = (id: string) => id as ReviewAbuseSignalId;
export const asReputationProjectionId = (id: string) => id as ReputationProjectionId;

// Sprint 24 brand helper constructors
export const asConsumerPlanId = (id: string) => id as ConsumerPlanId;
export const asPlanVersionId = (id: string) => id as PlanVersionId;
export const asPlanPriceId = (id: string) => id as PlanPriceId;
export const asEntitlementDefinitionId = (id: string) => id as EntitlementDefinitionId;
export const asEntitlementBundleId = (id: string) => id as EntitlementBundleId;
export const asEntitlementGrantId = (id: string) => id as EntitlementGrantId;
export const asConsumerSubscriptionId = (id: string) => id as ConsumerSubscriptionId;
export const asSubscriptionBillingAgreementId = (id: string) => id as SubscriptionBillingAgreementId;
export const asSubscriptionStatusHistoryId = (id: string) => id as SubscriptionStatusHistoryId;
export const asSubscriptionInvoiceId = (id: string) => id as SubscriptionInvoiceId;
export const asSubscriptionTrialId = (id: string) => id as SubscriptionTrialId;
export const asSubscriptionChangeRequestId = (id: string) => id as SubscriptionChangeRequestId;
export const asSubscriptionCancellationRecordId = (id: string) => id as SubscriptionCancellationRecordId;
export const asSubscriptionProviderEventId = (id: string) => id as SubscriptionProviderEventId;
export const asSubscriptionReconciliationRunId = (id: string) => id as SubscriptionReconciliationRunId;
export const asEntitlementReconciliationRunId = (id: string) => id as EntitlementReconciliationRunId;
export const asPromotionalGrantId = (id: string) => id as PromotionalGrantId;
export const asSupportGrantId = (id: string) => id as SupportGrantId;
export const asEntitlementUsageId = (id: string) => id as EntitlementUsageId;
export const asOfflineEntitlementTokenId = (id: string) => id as OfflineEntitlementTokenId;

// Sprint 25 brand helper constructors
export const asTrackerServicePlanId = (id: string) => id as TrackerServicePlanId;
export const asTrackerPlanVersionId = (id: string) => id as TrackerPlanVersionId;
export const asTrackerPlanPriceId = (id: string) => id as TrackerPlanPriceId;
export const asTrackerSubscriptionId = (id: string) => id as TrackerSubscriptionId;
export const asTrackerBillingAgreementId = (id: string) => id as TrackerBillingAgreementId;
export const asTrackerSubscriptionInvoiceId = (id: string) => id as TrackerSubscriptionInvoiceId;
export const asTrackerCarrierServiceRecordId = (id: string) => id as TrackerCarrierServiceRecordId;
export const asTrackerEntitlementGrantId = (id: string) => id as TrackerEntitlementGrantId;
export const asTrackerDeviceTransferRecordId = (id: string) => id as TrackerDeviceTransferRecordId;
export const asTrackerDataUsageRecordId = (id: string) => id as TrackerDataUsageRecordId;
export const asTrackerSafetyOverrideRecordId = (id: string) => id as TrackerSafetyOverrideRecordId;
export const asTrackerWebhookEventId = (id: string) => id as TrackerWebhookEventId;
export const asTrackerReconciliationRunId = (id: string) => id as TrackerReconciliationRunId;

// Sprint 26 brand helper constructors
export const asProviderSaaSPlanId = (id: string) => id as ProviderSaaSPlanId;
export const asProviderSaaSPlanVersionId = (id: string) => id as ProviderSaaSPlanVersionId;
export const asProviderSaaSPriceId = (id: string) => id as ProviderSaaSPriceId;
export const asProviderSaaSSubscriptionId = (id: string) => id as ProviderSaaSSubscriptionId;
export const asProviderSaaSBillingAgreementId = (id: string) => id as ProviderSaaSBillingAgreementId;
export const asProviderSaaSSubscriptionInvoiceId = (id: string) => id as ProviderSaaSSubscriptionInvoiceId;
export const asProviderSaaSContinuityGrantId = (id: string) => id as ProviderSaaSContinuityGrantId;
export const asProviderSaaSSupportGrantId = (id: string) => id as ProviderSaaSSupportGrantId;
export const asProviderSaaSChangeRequestId = (id: string) => id as ProviderSaaSChangeRequestId;
export const asProviderSaaSReconciliationRunId = (id: string) => id as ProviderSaaSReconciliationRunId;
export const asProviderSaaSUsageProjectionId = (id: string) => id as ProviderSaaSUsageProjectionId;

// Sprint 27 brand helper constructors
export const asOrderId = (id: string) => id as OrderId;
export const asProductId = (id: string) => id as ProductId;
export const asSellerId = (id: string) => id as SellerId;
export const asSellerMembershipId = (id: string) => id as SellerMembershipId;
export const asSellerVerificationCaseId = (id: string) => id as SellerVerificationCaseId;
export const asSellerAgreementId = (id: string) => id as SellerAgreementId;
export const asProductCategoryId = (id: string) => id as ProductCategoryId;
export const asProductBrandId = (id: string) => id as ProductBrandId;
export const asProductVariantId = (id: string) => id as ProductVariantId;
export const asSkuId = (id: string) => id as SkuId;
export const asProductMediaId = (id: string) => id as ProductMediaId;
export const asProductDocumentId = (id: string) => id as ProductDocumentId;
export const asProductModerationCaseId = (id: string) => id as ProductModerationCaseId;
export const asSellerListingId = (id: string) => id as SellerListingId;
export const asListingPriceHistoryId = (id: string) => id as ListingPriceHistoryId;
export const asInventoryLocationId = (id: string) => id as InventoryLocationId;
export const asInventoryItemId = (id: string) => id as InventoryItemId;
export const asInventoryMovementId = (id: string) => id as InventoryMovementId;
export const asInventoryReservationId = (id: string) => id as InventoryReservationId;
export const asCartId = (id: string) => id as CartId;
export const asCartItemId = (id: string) => id as CartItemId;
export const asCheckoutId = (id: string) => id as CheckoutId;
export const asCheckoutSnapshotId = (id: string) => id as CheckoutSnapshotId;
export const asSellerOrderId = (id: string) => id as SellerOrderId;
export const asOrderItemId = (id: string) => id as OrderItemId;
export const asFulfillmentId = (id: string) => id as FulfillmentId;
export const asShipmentId = (id: string) => id as ShipmentId;
export const asShipmentStatusHistoryId = (id: string) => id as ShipmentStatusHistoryId;
export const asDeliveryEvidenceId = (id: string) => id as DeliveryEvidenceId;
export const asReturnRequestId = (id: string) => id as ReturnRequestId;
export const asReturnItemId = (id: string) => id as ReturnItemId;
export const asReturnEvidenceId = (id: string) => id as ReturnEvidenceId;
export const asReturnInspectionId = (id: string) => id as ReturnInspectionId;
export const asCommerceDisputeId = (id: string) => id as CommerceDisputeId;
export const asCommerceSupportCaseId = (id: string) => id as CommerceSupportCaseId;
export const asProductSafetyReportId = (id: string) => id as ProductSafetyReportId;
export const asProductRecallNoticeId = (id: string) => id as ProductRecallNoticeId;
export const asCommerceReconciliationRunId = (id: string) => id as CommerceReconciliationRunId;




