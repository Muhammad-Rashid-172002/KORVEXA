import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import type { ApiEnv } from '../../config/env';
import { AiService } from './ai.service';
import { AiUnavailableError, AnthropicAiProvider, StubAiProvider } from './ai.provider';
import { fallbackBrief, fallbackQuestions } from './brief-builder.service';
import { ruleExplanation } from './matching.service';
import { fallbackTasks } from './meeting-notes.service';
import { rulesReport, type ReportFacts } from './progress-reports.service';

const env = { AI_MODEL: 'claude-opus-5-5', AI_EFFORT: 'medium', ANTHROPIC_API_KEY: 'sk-test' } as ApiEnv;
const schema = z.object({ answer: z.string() });
const req = { system: 's', prompt: 'p', schema, maxTokens: 100, fallback: () => ({ answer: 'x' }) };

function client(res: Record<string, unknown>) {
  const parse = vi.fn().mockResolvedValue(res);
  return { parse, c: { messages: { parse } } as never };
}

describe('AnthropicAiProvider', () => {
  it('sends the configured model, effort and a json-schema output format, and maps usage', async () => {
    const { parse, c } = client({
      stop_reason: 'end_turn',
      parsed_output: { answer: 'hi' },
      model: 'claude-opus-5-5',
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: 2,
        cache_creation_input_tokens: null,
      },
    });
    const out = await new AnthropicAiProvider(env, c).generate(req);
    expect(out).toEqual({
      data: { answer: 'hi' },
      model: 'claude-opus-5-5',
      usage: { input: 10, output: 5, cacheRead: 2, cacheWrite: 0 },
    });
    const sent = parse.mock.calls[0]![0];
    expect(sent.model).toBe('claude-opus-5-5');
    expect(sent.output_config.effort).toBe('medium');
    expect(sent.output_config.format).toBeTruthy();
    expect(sent.tools).toBeUndefined(); // the model never gets tools
    expect(sent.messages).toEqual([{ role: 'user', content: 'p' }]);
  });

  it.each([
    ['refusal', { stop_reason: 'refusal', parsed_output: null }],
    ['max_tokens', { stop_reason: 'max_tokens', parsed_output: null }],
    ['no output', { stop_reason: 'end_turn', parsed_output: null }],
  ])('turns %s into a clean AiUnavailableError', async (_n, res) => {
    const { c } = client({ model: 'm', usage: { input_tokens: 1, output_tokens: 1 }, ...res });
    await expect(new AnthropicAiProvider(env, c).generate(req)).rejects.toBeInstanceOf(AiUnavailableError);
  });
});

describe('StubAiProvider', () => {
  it('returns the validated fallback and simulates positive token usage', async () => {
    const out = await new StubAiProvider(env).generate(req);
    expect(out.data).toEqual({ answer: 'x' });
    expect(out.usage.input).toBeGreaterThan(0);
    expect(out.usage.output).toBeGreaterThan(0);
  });
  it('rejects a fallback that does not satisfy the schema', async () => {
    await expect(
      new StubAiProvider(env).generate({ ...req, fallback: () => ({ answer: 1 }) as never }),
    ).rejects.toThrow();
  });
});

describe('rules fallbacks (the same code the stub serves)', () => {
  it('questions skip what the idea already says', () => {
    expect(fallbackQuestions('A web dashboard for tracking my team')).not.toContain(
      'Which platforms do you need: web, iOS, Android?',
    );
    expect(fallbackQuestions('Something for my shop')).toContain(
      'Which platforms do you need: web, iOS, Android?',
    );
  });
  it('brief estimates stay ordered and are only built from the text', () => {
    const b = fallbackBrief('An iOS and Android app with payments and login for dog walkers', []);
    expect(b.platforms).toEqual(['iOS', 'Android']);
    expect(b.integrations).toEqual(expect.arrayContaining(['Payments', 'Sign-in']));
    expect(b.estimate.budgetMinUsd).toBeLessThan(b.estimate.budgetMaxUsd);
    expect(fallbackBrief('Tiny idea about something vague here', []).platforms).toEqual(['To be decided']);
  });
  it('meeting notes: bullets and commitments become tasks, chatter does not', () => {
    expect(
      fallbackTasks('Nice meeting.\n- Send the logo files\n1. Fix the signup bug\nWe had coffee.').tasks.map(
        (t) => t.title,
      ),
    ).toEqual(['Send the logo files', 'Fix the signup bug']);
    expect(
      fallbackTasks('Alice will send the contract by Friday. Great weather today.').tasks.map((t) => t.title),
    ).toEqual(['Alice will send the contract by Friday']);
    expect(fallbackTasks('Just a chat about nothing in particular, really.').tasks).toEqual([]);
    expect(fallbackTasks('- a\n- a\n- Same task\n- same task').tasks).toHaveLength(1); // too short and duplicates dropped
  });
  const facts = (o: Partial<ReportFacts> = {}): ReportFacts => ({
    project: { title: 'Shop', code: 'GW-1', status: 'active' },
    period: { start: '2026-10-01', end: '2026-10-08' },
    tasksDone: [],
    tasksInProgress: [],
    tasksInReview: [],
    tasksTodo: [],
    milestonesProgressed: [],
    milestonesAwaitingBuyer: [],
    milestonesOverdue: [],
    milestonesWithRevisions: [],
    nextMilestone: null,
    nextMilestoneUnfunded: false,
    openChangeRequests: 0,
    openDisputes: 0,
    ...o,
  });
  it('a quiet week says so plainly and invents nothing', () => {
    const r = rulesReport(facts());
    expect(r.summary).toMatch(/no recorded progress/);
    expect([r.done, r.next, r.risks, r.decisionsNeeded]).toEqual([[], [], [], []]);
  });
  it('risks and decisions come only from real signals', () => {
    const r = rulesReport(
      facts({
        tasksDone: ['Build login'],
        milestonesAwaitingBuyer: ['Design'],
        milestonesOverdue: [{ title: 'Core', dueOn: '2026-10-01' }],
        nextMilestone: { title: 'Launch', status: 'pending', dueOn: null },
        nextMilestoneUnfunded: true,
        openChangeRequests: 1,
      }),
    );
    expect(r.done).toEqual(['Finished task: Build login']);
    expect(r.risks).toEqual(['Core was due on 2026-10-01 and is not finished yet']);
    expect(r.decisionsNeeded).toEqual([
      'Please review and approve: Design',
      'Fund the next milestone, Launch, so work can continue',
      '1 scope change is waiting for an answer',
    ]);
  });
  it('match explanations are honest about weak spots', () => {
    const t = ruleExplanation('Sam', {
      skills: { matched: [], score: 0 },
      rating: { average: null, count: 0, score: 0.3 },
      verified: { labels: [], score: 0 },
      responseHours: { median: null, score: 0.5 },
      availability: { value: 'busy', score: 0.5 },
      budget: { fit: 'over', score: 0.2 },
    });
    expect(t).toMatch(/No listed skill matches/);
    expect(t).toMatch(/no reviews yet/);
    expect(t).toMatch(/above your budget/);
    expect(t).toMatch(/currently busy/);
  });
});

describe('AiService.modelFor', () => {
  const svc = (e: Partial<ApiEnv>) =>
    new AiService(null as never, { AI_MODEL: 'claude-sonnet-5-5', ...e } as ApiEnv, null as never);
  it('defaults every feature to AI_MODEL', () => {
    expect(svc({}).modelFor('matching')).toBe('claude-sonnet-5-5');
    expect(svc({}).modelFor('brief_builder')).toBe('claude-sonnet-5-5');
  });
  it('lets one feature opt into another model without touching the rest', () => {
    const s = svc({ AI_MODEL_BRIEF_BUILDER: 'claude-opus-5-5', AI_MODEL_MATCHING: '  ' });
    expect(s.modelFor('brief_builder')).toBe('claude-opus-5-5');
    expect(s.modelFor('matching')).toBe('claude-sonnet-5-5'); // blank = default
    expect(s.modelFor('progress_report')).toBe('claude-sonnet-5-5');
  });
});
