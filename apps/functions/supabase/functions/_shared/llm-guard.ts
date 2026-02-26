// _shared/llm-guard.ts
const INJECTION_PATTERNS = [
  /ignore (all |previous )?(instructions|rules|system)/gi,
  /you are now/gi,
  /forget (your|all|previous)/gi,
  /override (system|your)/gi,
];

export function sanitizeForPrompt(text: string, maxLength = 2000): string {
  let sanitized = text;
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[filtered]');
  }
  return sanitized.slice(0, maxLength);
}

export const LLM_DEFAULTS = {
  maxTokens: 500,
  temperature: 0.7,
} as const;
