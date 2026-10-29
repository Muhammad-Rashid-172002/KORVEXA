import type { ProjectView } from '@glasswork/shared';
import { CalendarClock, Hand, Wallet } from 'lucide-react';
import { money } from '@/lib/format';
import { HelpTip } from '../help-tip';

/** Plain-language copy for the three questions every buyer has. Pure so it can be unit-tested. */
export function summarise(p: ProjectView) {
  const m = p.milestones.find((x) => x.id === p.currentMilestoneId);
  const buyer = p.myRole === 'buyer';
  const other = buyer ? p.seller.name : p.buyer.name;
  if (p.status === 'completed' || p.status === 'reviewed') {
    return {
      now: 'This project is finished. Every step was approved.',
      todo:
        p.status === 'completed' && buyer ? 'Leave a review to help other buyers.' : 'Nothing. Thank you!',
      pay: 'Nothing left to pay.',
    };
  }
  if (p.status === 'cancelled')
    return { now: 'This project was cancelled.', todo: 'Nothing.', pay: 'Nothing is due.' };
  if (p.status === 'disputed')
    return {
      now: 'There is a disagreement. Our team is looking at it.',
      todo: 'Add anything that helps in the case page. Payments are on hold until we decide.',
      pay: 'On hold until the case is decided.',
    };
  if (p.status === 'paused')
    return {
      now: 'The project is paused.',
      todo: 'Wait for the project to resume.',
      pay: 'Nothing is due while paused.',
    };
  if (!m)
    return {
      now: 'Waiting for the next step to be planned.',
      todo: 'Nothing yet.',
      pay: 'Nothing is due yet.',
    };

  const amt = money(m.amount, p.currency);
  const step = `Step ${m.position}: ${m.title}`;
  switch (m.status) {
    case 'pending':
      return {
        now: `${step} is waiting to be paid for.`,
        todo: buyer
          ? `Pay for this step (${amt}) so ${other} can start. The money is held safely.`
          : `Waiting for ${other} to pay for this step.`,
        pay: `${amt} for this step, released to the expert only after you approve it.`,
      };
    case 'funded':
      return {
        now: `${step} is paid and ready to start.`,
        todo: buyer ? `Nothing. ${other} will start soon.` : 'Start the step when you are ready.',
        pay: `${amt} is held safely until this step is approved.`,
      };
    case 'in_progress':
      return {
        now: `${other === p.seller.name ? p.seller.name : 'You'} ${buyer ? 'is' : 'are'} working on ${step}.`,
        todo: buyer
          ? 'Nothing right now. You will be told when it is ready to check.'
          : 'Send the work for the buyer to check when it is done.',
        pay: `${amt} is held and will be released when you approve${buyer ? '' : ' (the buyer approves)'}.`,
      };
    case 'submitted':
      return {
        now: `${step} was sent in and is waiting for a check.`,
        todo: buyer
          ? 'Look at the work, then approve it or ask for changes.'
          : `Waiting for ${other} to check your work.`,
        pay: buyer ? `${amt} is paid out when you approve.` : `${amt} is paid to you when ${other} approves.`,
      };
    case 'revision_requested':
      return {
        now: `Changes were asked for in ${step}.`,
        todo: buyer
          ? `Waiting for ${other} to make the changes.`
          : 'Read the notes and send in a new version.',
        pay: `${amt} stays held until the step is approved.`,
      };
    default:
      return { now: `${step} is ${m.status.replace('_', ' ')}.`, todo: 'Nothing.', pay: `${amt}` };
  }
}

/** The three-line answer shown at the top of the project page, before the detailed tabs. */
export function RoomSummary({ project: p }: { project: ProjectView }) {
  const s = summarise(p);
  const item = 'flex gap-3 rounded-xl border border-border bg-surface p-4';
  return (
    <section aria-label="Summary" className="grid gap-3 md:grid-cols-3" data-testid="room-summary">
      <div className={item}>
        <CalendarClock size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">What is happening now</h2>
          <p className="mt-1 text-sm" data-testid="summary-now">
            {s.now}
          </p>
        </div>
      </div>
      <div className={`${item} border-primary/50 bg-primary/5`}>
        <Hand size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">What you need to do</h2>
          <p className="mt-1 text-sm font-medium" data-testid="summary-todo">
            {s.todo}
          </p>
        </div>
      </div>
      <div className={item}>
        <Wallet size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">
            Next payment{' '}
            <HelpTip label="held safely">
              Money for a step is held by {`the platform`} while the expert works. It is paid to the expert
              only after you approve that step.
            </HelpTip>
          </h2>
          <p className="mt-1 text-sm" data-testid="summary-pay">
            {s.pay}
          </p>
        </div>
      </div>
    </section>
  );
}
