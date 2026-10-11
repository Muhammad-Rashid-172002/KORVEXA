import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { TokenUsage } from '@glasswork/shared';
import type { z } from 'zod';
import type { ApiEnv } from '../../config/env';

export interface AiRequest<T> {
  system: string;
  /** Untrusted content is passed here, wrapped in tags by the caller; the model has no tools. */
  prompt: string;
  schema: z.ZodType<T>;
  maxTokens: number;
  /** Deterministic answer built from the same real data. Used by the offline stub, and as a reference for tests. */
  fallback: () => T;
}
export interface AiResult<T> {
  data: T;
  usage: TokenUsage;
  model: string;
}

export abstract class AiProvider {
  abstract readonly name: 'stub' | 'anthropic';
  abstract generate<T>(req: AiRequest<T>): Promise<AiResult<T>>;
}

/** Raised when the model declines or returns nothing usable; never leaks provider internals to users. */
export class AiUnavailableError extends Error {}

/** Offline provider for dev and CI: returns the rules-based fallback and simulates token usage from text length. */
export class StubAiProvider extends AiProvider {
  readonly name = 'stub' as const;
  constructor(private readonly env: ApiEnv) {
    super();
  }
  async generate<T>(req: AiRequest<T>): Promise<AiResult<T>> {
    const data = req.schema.parse(req.fallback());
    return {
      data,
      model: this.env.AI_MODEL,
      usage: {
        input: Math.ceil((req.system.length + req.prompt.length) / 4),
        output: Math.ceil(JSON.stringify(data).length / 4),
        cacheRead: 0,
        cacheWrite: 0,
      },
    };
  }
}

/** Claude API. Structured outputs are validated by the SDK against the same zod schema we parse with. */
export class AnthropicAiProvider extends AiProvider {
  readonly name = 'anthropic' as const;
  private readonly client: Anthropic;
  constructor(
    private readonly env: ApiEnv,
    client?: Pick<Anthropic, 'messages'>,
  ) {
    super();
    this.client =
      (client as Anthropic | undefined) ??
      new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 60_000 });
  }

  async generate<T>(req: AiRequest<T>): Promise<AiResult<T>> {
    const res = await this.client.messages.parse({
      model: this.env.AI_MODEL,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: 'user', content: req.prompt }],
      output_config: { effort: this.env.AI_EFFORT, format: zodOutputFormat(req.schema) },
    });
    if (res.stop_reason === 'refusal') throw new AiUnavailableError('The model declined this request');
    if (res.stop_reason === 'max_tokens') throw new AiUnavailableError('The answer was cut off');
    if (!res.parsed_output) throw new AiUnavailableError('The model returned no usable answer');
    return {
      data: res.parsed_output,
      model: res.model,
      usage: {
        input: res.usage.input_tokens,
        output: res.usage.output_tokens,
        cacheRead: res.usage.cache_read_input_tokens ?? 0,
        cacheWrite: res.usage.cache_creation_input_tokens ?? 0,
      },
    };
  }
}
