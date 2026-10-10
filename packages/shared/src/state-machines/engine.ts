/** Minimal, typed finite-state-machine engine. Pure functions — the API enforces them in DB transactions. */
export type Actor = 'buyer' | 'seller' | 'admin' | 'system';

export interface Transition<S extends string, E extends string> {
  event: E;
  from: readonly S[];
  to: S;
  actors: readonly Actor[];
}

export interface Machine<S extends string, E extends string> {
  name: string;
  states: readonly S[];
  initial: S;
  terminal: readonly S[];
  transitions: readonly Transition<S, E>[];
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly machine: string,
    readonly from: string,
    readonly event: string,
    readonly actor: Actor,
  ) {
    super(`${machine}: '${event}' is not allowed from '${from}' by ${actor}`);
    this.name = 'InvalidTransitionError';
  }
}

export function findTransition<S extends string, E extends string>(
  machine: Machine<S, E>,
  from: S,
  event: E,
  actor: Actor,
): Transition<S, E> | undefined {
  return machine.transitions.find((t) => t.event === event && t.from.includes(from) && t.actors.includes(actor));
}

/** Returns the next state or throws InvalidTransitionError. */
export function transition<S extends string, E extends string>(
  machine: Machine<S, E>,
  from: S,
  event: E,
  actor: Actor,
): S {
  const t = findTransition(machine, from, event, actor);
  if (!t) throw new InvalidTransitionError(machine.name, from, event, actor);
  return t.to;
}

/** Events an actor may fire from a state (drives which buttons the UI shows). */
export function availableEvents<S extends string, E extends string>(
  machine: Machine<S, E>,
  from: S,
  actor: Actor,
): E[] {
  return machine.transitions.filter((t) => t.from.includes(from) && t.actors.includes(actor)).map((t) => t.event);
}
