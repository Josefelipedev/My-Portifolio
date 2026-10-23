// Together removed meta-llama/Llama-3.3-70B-Instruct-Turbo from serverless on
// 2026-10-23. Its replacement reasons before answering and the reasoning
// counts against max_tokens: short limits (500 for the WakaTime ranking) could
// come back with finish_reason=length and empty content. Even with
// reasoning_effort=none it spends 50-190 tokens thinking, hence the headroom.
export const DEFAULT_TOGETHER_MODEL = 'meta-models/Muse-Glimmer-30B';

const REASONING_MODEL_PREFIXES = ['meta-models/Muse-Glimmer'];
const REASONING_TOKEN_HEADROOM = 512;

export function isReasoningModel(model: string | null | undefined): boolean {
  return !!model && REASONING_MODEL_PREFIXES.some((p) => model.startsWith(p));
}

/**
 * max_tokens (and reasoning_effort when needed) for an OpenAI-compatible request.
 * together-ai types reasoning_effort as low|medium|high only, but the API takes
 * "none" and the SDK sends unknown fields as-is, so it stays out of the type.
 */
export function completionLimits(model: string, maxTokens: number): { max_tokens: number } {
  if (!isReasoningModel(model)) return { max_tokens: maxTokens };
  return {
    max_tokens: maxTokens + REASONING_TOKEN_HEADROOM,
    reasoning_effort: 'none',
  } as { max_tokens: number };
}
