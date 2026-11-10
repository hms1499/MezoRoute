"use client";

import type { ReactNode } from "react";
import { FlowColumn } from "@/components/flow/FlowColumn";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConnectCta } from "./ConnectCta";

/**
 * A route page before a wallet connects (U13 follow-up): the page keeps its own title, its progress step, and its
 * flow frame (U14: the card two thirds of the page), and the connect card carries the route's name and what it does. Without this a route opened cold
 * was a bare card at the container's left edge with no heading, which read as a broken page rather than a way in.
 */
export function ConnectPage({
  back,
  step,
  title,
  cardTitle,
  cardNote,
}: {
  back: { href: string; label: string };
  step?: 1 | 2 | 3;
  title: ReactNode;
  cardTitle: ReactNode;
  cardNote?: ReactNode;
}) {
  return (
    <FlowColumn header={<PageHeader back={back} step={step} title={title} />}>
      <Card title={cardTitle} subtitle={cardNote}>
        <div className="mt-4">
          <ConnectCta />
        </div>
      </Card>
    </FlowColumn>
  );
}
