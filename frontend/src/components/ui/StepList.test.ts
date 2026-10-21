import { createElement, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Step } from "@/lib/tx/stepper";
import { StepList } from "./StepList";

const render = (steps: Step<string>[], active = 0) =>
  renderToStaticMarkup(
    createElement(StepList as FunctionComponent<Record<string, unknown>>, {
      steps,
      active,
      copy: { permit: { title: "Sign a permit", detail: "Gasless.", action: "Sign" }, enter: { title: "Deposit", detail: "One transaction.", action: "Send" } },
      blocked: false,
      onRun: () => undefined,
    }),
  );

// Final review (U10): a live region that enters the accessibility tree together with its first text is not announced,
// so each step's region stays rendered (visually hidden while it has nothing to show).
describe("StepList live regions", () => {
  it("keeps every step's live region in the accessibility tree, even before it has text", () => {
    const out = render([{ kind: "permit", status: "idle" }, { kind: "enter", status: "idle" }]);
    expect(out.match(/aria-live="polite"/g)).toHaveLength(2);
    expect(out).not.toContain("empty:hidden");
    expect(out).toMatch(/<div aria-live="polite" class="sr-only"><\/div>/);
  });

  it("announces the wallet status once, beside the pending button", () => {
    const out = render([{ kind: "permit", status: "awaiting-wallet" }, { kind: "enter", status: "idle" }]);
    expect(out.match(/Check your wallet…/g)).toHaveLength(2); // the live region, and the button's aria-hidden status
    expect(out).toMatch(/<div aria-live="polite" class="sr-only"><span[^>]*>Check your wallet…<\/span><\/div>/);
  });
});
