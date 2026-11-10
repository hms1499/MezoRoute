import type { ReactNode } from "react";
import { FLOW_WIDTH } from "@/lib/ui/layout";
import { cx } from "@/lib/ui/cx";

/**
 * A flow route's frame. Every state the route renders (loading, a load error, connect, the flow itself) sits in the
 * one centred 520 px flow column, so nothing on the way to the flow starts at another edge or has another width.
 */
export function FlowPage({ children }: { children: ReactNode }) {
  return <div className={cx("mx-auto w-full", FLOW_WIDTH)}>{children}</div>;
}
