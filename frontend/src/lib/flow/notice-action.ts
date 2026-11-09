// U12: a blocked page's primary action is the first way out. The pure split keeps the page a composition and lets the
// notice drop the action it no longer owns.

export type NoticeAction = { label: string; onClick?: () => void; href?: string };

/** The first action becomes the page's primary; the rest stay in the notice. The input is not mutated. */
export function splitPrimary(actions: readonly NoticeAction[]): { primary: NoticeAction | null; rest: NoticeAction[] } {
  const [primary, ...rest] = actions;
  return { primary: primary ?? null, rest };
}
