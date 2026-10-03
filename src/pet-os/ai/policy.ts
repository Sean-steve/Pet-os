import { AIRequestId, AISafetyDecisionId } from '../kernel/ids';
import { generateUUIDv7 } from '../kernel/ids';
import { AIRiskClass, AISafetyAction, AISafetyDecision, AIContextSourceRef } from './types';

export const AI_POLICY_VERSION = 'AI-SAFETY-1.0.0';

const emergencyPatterns: Array<[RegExp,string]> = [
  [/struggl(ing|e) to breathe|can'?t breathe|difficulty breathing|blue gums/i, 'BREATHING_DISTRESS'],
  [/seizure|convuls(ion|ing)|unconscious|collapsed/i, 'NEUROLOGIC_EMERGENCY'],
  [/severe bleeding|won'?t stop bleeding|major trauma|hit by (a )?car/i, 'TRAUMA'],
  [/poison|toxic ingestion|ate .*chocolate|antifreeze|rat poison|xylitol/i, 'TOXIC_INGESTION'],
];

const highRiskPatterns: Array<[RegExp,string]> = [
  [/dose|dosage|double (the )?dose|missed dose|medication|prescription/i, 'MEDICATION'],
  [/vomit|diarrhea|blood in stool|fever|letharg/i, 'MEDICAL_SYMPTOMS'],
  [/bite|aggressive|attack|fight/i, 'BEHAVIORAL_DANGER'],
  [/pregnan|labor|giving birth/i, 'PREGNANCY_BIRTH'],
];

export class AISafetyPolicy {
  static classify(text: string): { riskClass: AIRiskClass; categories: string[] } {
    const categories: string[] = [];
    for (const [pattern, category] of emergencyPatterns) if (pattern.test(text)) categories.push(category);
    if (categories.length) return { riskClass: 'EMERGENCY', categories };

    for (const [pattern, category] of highRiskPatterns) if (pattern.test(text)) categories.push(category);
    if (categories.length) return { riskClass: 'HIGH', categories };

    if (/health|allergy|vaccin|vet|food|diet|behavior|tracker|lost|location/i.test(text)) {
      return { riskClass: 'MEDIUM', categories: ['PET_CARE_CONTEXT'] };
    }
    return { riskClass: 'LOW', categories: [] };
  }

  static decide(requestId: AIRequestId, text: string): AISafetyDecision {
    const classified=this.classify(text);
    let action: AISafetyAction = 'ALLOW';
    let warning: string | undefined;

    if (classified.riskClass === 'EMERGENCY') {
      action='EMERGENCY_ESCALATION';
      warning='Potential emergency detected. Urgent veterinary care may be required.';
    } else if (classified.riskClass === 'HIGH') {
      action='ALLOW_WITH_WARNING';
      warning='High-risk care question: Pet OS will not diagnose, prescribe, or alter medication instructions.';
    } else if (classified.riskClass === 'MEDIUM') {
      action='ALLOW_WITH_WARNING';
    }

    if (/ignore (all|the|previous).*instruction|reveal .*secret|system prompt|api key/i.test(text)) {
      action='LIMIT_RESPONSE';
      classified.categories.push('PROMPT_INJECTION');
      warning='Untrusted instruction detected and ignored.';
    }

    return {
      safetyDecisionId: `aisd-${generateUUIDv7()}` as AISafetyDecisionId,
      requestId,
      riskClass: classified.riskClass,
      policyVersion: AI_POLICY_VERSION,
      detectedCategories: classified.categories,
      action,
      warning,
      createdAt: new Date().toISOString(),
    };
  }

  static emergencyResponse(categories: string[]): string {
    if (categories.includes('BREATHING_DISTRESS')) {
      return 'This can be an emergency. Contact an emergency veterinarian now and transport your pet promptly. Keep them as calm as possible and avoid forcing food, water, or medication while breathing is difficult.';
    }
    if (categories.includes('TOXIC_INGESTION')) {
      return 'Suspected poisoning can be an emergency. Contact a veterinarian or veterinary poison service immediately and keep the product or packaging available. Do not induce vomiting unless a veterinary professional specifically instructs you to do so.';
    }
    if (categories.includes('TRAUMA')) {
      return 'This may require emergency veterinary care. Minimize movement, control only obvious external bleeding with gentle pressure if safe, and contact an emergency veterinarian now.';
    }
    if (categories.includes('NEUROLOGIC_EMERGENCY')) {
      return 'This can be an emergency. Contact an emergency veterinarian now. Keep the area clear and safe; do not place hands or objects in your pet’s mouth during a seizure.';
    }
    return 'This may be an emergency. Contact an emergency veterinarian now.';
  }

  static validateOutput(content: string, context: AIContextSourceRef[]): { safe: boolean; reasons: string[] } {
    const reasons: string[] = [];
    if (/(take|give|increase|decrease|double|halve).{0,25}(mg|ml|tablet|dose)/i.test(content)) {
      reasons.push('POTENTIAL_DOSING_INSTRUCTION');
    }
    if (/definitely has|diagnosis is|i diagnose/i.test(content)) {
      reasons.push('UNSUPPORTED_DIAGNOSIS');
    }
    if (/api[_ -]?key|secret token|system prompt/i.test(content)) {
      reasons.push('SECRET_OR_PROMPT_DISCLOSURE');
    }

    const petSpecificClaim = /your pet|recorded|according to|latest|current/i.test(content);
    if (petSpecificClaim && context.length === 0 && !/I don'?t have enough information|I can only give general information/i.test(content)) {
      reasons.push('UNGROUNDED_PET_SPECIFIC_CLAIM');
    }
    return { safe: reasons.length === 0, reasons };
  }
}
