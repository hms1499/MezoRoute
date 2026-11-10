import type { ReactNode } from "react";
import { FLOW_WIDTH } from "@/lib/ui/layout";
import { cx } from "@/lib/ui/cx";

/**
 * A flow route's frame. Every state the route renders (loading, a load error, connect, the flow itself) sits in the
 * one centred flow column, so nothing on the way to the flow starts at another edge. From `xl` a `FlowColumn` with an
 * aside (`data-flow-aside`) takes the page's full width for its right rail, still centring the flow itself.
 */
export function FlowPage({ children }: { children: ReactNode }) {
  return <div className={cx("mx-auto w-full", FLOW_WIDTH, "xl:has-[[data-flow-aside]]:max-w-none")}>{children}</div>;
}
