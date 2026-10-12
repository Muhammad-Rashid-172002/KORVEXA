import { aiUsage, and, eq, gte, sql, type DbClient } from '@glasswork/db';
import { centsToMicros, costMicros, type AiFeature, type AiStatusView } from '@glasswork/shared';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ENV, type ApiEnv } from '../../config/env';
import { DB } from '../../infra/tokens';
import { AiProvider, AiUnavailableError, type AiRequest } from './ai.provider';

const startOfUtcDay = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * The only door to a model. Every call is rate limited per user, checked against a per-user and a
 * platform daily spend cap, and recorded in `ai_usage` with real token counts. Failures are recorded too.
 */
@Injectable()
export class AiService {
  private readonly log = new Logger('AiService');
  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly provider: AiProvider,
  ) {}

  get providerName() {
    return this.provider.name;
  }

  /** The model for a feature: its own AI_MODEL_<FEATURE> override, else the AI_MODEL default. */
  modelFor(feature: AiFeature): string {
    const override = {
      brief_builder: this.env.AI_MODEL_BRIEF_BUILDER,
      matching: this.env.AI_MODEL_MATCHING,
      progress_report: this.env.AI_MODEL_PROGRESS_REPORT,
      meeting_notes: this.env.AI_MODEL_MEETING_NOTES,
    }[feature];
    return override?.trim() || this.env.AI_MODEL;
  }

  get enabled() {
    return this.env.AI_PROVIDER !== 'off';
  }

  private async spentTodayMicros(userId?: string): Promise<number> {
    const where = userId
      ? and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, startOfUtcDay()))
      : gte(aiUsage.createdAt, startOfUtcDay());
    const [row] = await this.db.db
      .select({ v: sql<string>`coalesce(sum(${aiUsage.costMicros}), 0)` })
      .from(aiUsage)
      .where(where);
    return Number(row?.v ?? 0);
  }

  async status(userId: string): Promise<AiStatusView> {
    const spent = await this.spentTodayMicros(userId);
    const left = Math.max(0, centsToMicros(this.env.AI_DAILY_USER_CAP_CENTS) - spent);
    return {
      enabled: this.enabled,
      provider: this.env.AI_PROVIDER,
      remainingTodayCents: Math.floor(left / 10_000),
    };
  }

  /** Throws 429 before any model spend when the caller is over a limit. */
  async assertAllowed(userId: string): Promise<void> {
    if (!this.enabled) throw new ServiceUnavailableException('AI features are switched off');
    const hourAgo = new Date(Date.now() - 3_600_000);
    const [recent] = await this.db.db
      .select({ n: sql<number>`count(*)::int` })
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, hourAgo)));
    if ((recent?.n ?? 0) >= this.env.AI_RATE_LIMIT_PER_HOUR)
      throw new HttpException(
        `You have reached the limit of ${this.env.AI_RATE_LIMIT_PER_HOUR} AI requests per hour. Please try again later.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    if ((await this.spentTodayMicros(userId)) >= centsToMicros(this.env.AI_DAILY_USER_CAP_CENTS))
      throw new HttpException(
        'You have used your daily AI allowance. It resets at 00:00 UTC.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    if ((await this.spentTodayMicros()) >= centsToMicros(this.env.AI_DAILY_GLOBAL_CAP_CENTS))
      throw new HttpException(
        'AI is paused for today because the platform budget was reached. Please try again tomorrow.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }

  async run<T>(
    userId: string,
    feature: AiFeature,
    req: AiRequest<T>,
    projectId?: string,
  ): Promise<{ data: T; model: string }> {
    await this.assertAllowed(userId);
    try {
      const out = await this.provider.generate({ ...req, model: this.modelFor(feature) });
      await this.db.db.insert(aiUsage).values({
        userId,
        feature,
        provider: this.provider.name,
        model: out.model,
        inputTokens: out.usage.input,
        outputTokens: out.usage.output,
        cacheReadTokens: out.usage.cacheRead,
        cacheWriteTokens: out.usage.cacheWrite,
        costMicros: costMicros(out.model, out.usage),
        projectId,
      });
      return { data: out.data, model: out.model };
    } catch (err) {
      // A failed attempt still counts toward the hourly limit (so an error loop cannot hammer the API) and is visible to admins.
      await this.db.db.insert(aiUsage).values({
        userId,
        feature,
        provider: this.provider.name,
        model: this.modelFor(feature),
        ok: false,
        error: err instanceof Error ? err.message.slice(0, 300) : 'unknown error',
        projectId,
      });
      this.log.warn(`AI call failed (${feature}): ${err instanceof Error ? err.message : String(err)}`);
      if (err instanceof AiUnavailableError) throw new ServiceUnavailableException(err.message);
      throw new ServiceUnavailableException('The AI service is temporarily unavailable. Please try again.');
    }
  }
}
