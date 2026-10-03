import { AIModelDeployment } from './types';
import { AIContextSourceRef, AIUseCase, AISafetyDecision } from './types';

export interface AIModelGenerateInput {
  deployment: AIModelDeployment;
  useCase: AIUseCase;
  userText: string;
  context: AIContextSourceRef[];
  safety: AISafetyDecision;
}

export interface AIModelGenerateOutput {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AIModelProvider {
  readonly providerName: string;
  generate(input: AIModelGenerateInput): Promise<AIModelGenerateOutput>;
}

/**
 * Safe deterministic demo provider used by the static prototype.
 * It proves routing, provenance and policy behavior without exposing production API keys in GitHub Pages.
 */
export class GroundedDemoModelProvider implements AIModelProvider {
  readonly providerName = 'PET_OS_DETERMINISTIC_DEMO';

  async generate(input: AIModelGenerateInput): Promise<AIModelGenerateOutput> {
    const pet = input.context.find(c => c.sourceDomain === 'PET_CORE');
    const health = input.context.filter(c => c.sourceDomain === 'HEALTH');
    const care = input.context.filter(c => c.sourceDomain === 'CARE');
    const nutrition = input.context.filter(c => c.sourceDomain === 'NUTRITION');
    const training = input.context.filter(c => c.sourceDomain === 'TRAINING');
    const activity = input.context.filter(c => c.sourceDomain === 'ACTIVITY');
    const tracking = input.context.filter(c => c.sourceDomain === 'TRACKING');
    const lower=input.userText.toLowerCase();

    let content = '';
    if (/dose|dosage|double dose|missed dose/.test(lower)) {
      content = 'I can explain the medication instructions already recorded for your pet, but I cannot change a dose, frequency, duration, or route. If the record does not include a missed-dose instruction, contact the prescribing veterinarian before changing what you give.';
    } else if (input.useCase === 'PET_SUMMARY' || /summar/.test(lower)) {
      content = `${pet?.summary || 'I found the pet profile.'} I found ${health.length} health record references, ${care.length} current care references, ${nutrition.length} nutrition references, ${training.length} training references, and ${activity.length} recent activity references. I have not filled in anything that is missing from the record.`;
    } else if (input.useCase === 'TRACKER_TROUBLESHOOTING' || /tracker|gps|location/.test(lower)) {
      content = tracking.length
        ? `The tracking records show: ${tracking.map(x => x.summary).join(' ')} I am keeping plan, network/device state, and location freshness separate; an active subscription does not prove that a fresh GPS fix exists.`
        : 'I do not see enough authorized tracking context to determine the tracker’s current state.';
    } else if (input.useCase === 'HEALTH_SUMMARY' || /health|vaccin|allergy|vet|medication/.test(lower)) {
      content = health.length
        ? `From the authorized health record: ${health.slice(0,5).map(x => x.summary).join(' ')} This is a summary of recorded information, not a new diagnosis or prescription.`
        : 'I do not see enough authorized health information to answer this as a pet-specific fact. I can give general information instead.';
    } else if (input.useCase === 'NUTRITION_INFORMATION' || /food|diet|meal|nutrition/.test(lower)) {
      content = nutrition.length
        ? `The authorized nutrition record shows: ${nutrition.slice(0,4).map(x => x.summary).join(' ')} I will not override a veterinary diet or recorded allergy restriction.`
        : 'I do not see a current authorized feeding plan, so I cannot state a pet-specific diet. I can provide general nutrition information.';
    } else if (input.useCase === 'TRAINING_GUIDANCE' || /training|recall|leash/.test(lower)) {
      content = training.length
        ? `The training context shows: ${training.slice(0,4).map(x=>x.summary).join(' ')} Any exercise I suggest should remain consistent with the active trainer plan and recorded safety notes.`
        : 'I do not see an active authorized training plan. I can offer only general, low-risk training guidance.';
    } else {
      content = `${pet?.summary || 'I have limited pet context.'} Ask me about care, health records, nutrition, training, activity, tracking, or preparing for a professional appointment. I will distinguish recorded facts from general information and suggestions.`;
    }

    return {
      content,
      inputTokens: Math.max(30, Math.ceil((input.userText.length + input.context.map(x=>x.summary).join(' ').length)/4)),
      outputTokens: Math.max(20, Math.ceil(content.length/4)),
    };
  }
}

export class AIModelProviderRegistry {
  private static providers = new Map<string, AIModelProvider>([
    ['PET_OS_DETERMINISTIC_DEMO', new GroundedDemoModelProvider()],
  ]);

  static register(provider: AIModelProvider): void {
    this.providers.set(provider.providerName, provider);
  }

  static get(providerName: string): AIModelProvider {
    const provider=this.providers.get(providerName);
    if (!provider) throw new Error(`AI_PROVIDER_UNAVAILABLE: ${providerName}`);
    return provider;
  }
}
