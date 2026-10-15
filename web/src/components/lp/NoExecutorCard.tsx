"use client";

import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { useNetwork } from "@/lib/config/network-context";
import { writeBlockerMessage } from "@/lib/config/write-gate";

export function NoExecutorCard() {
  const { network } = useNetwork();
  return (
    <Card>
      <Notice>{writeBlockerMessage("no-executor", network)}</Notice>
      <ButtonLink href="/" variant="secondary" className="mt-4">
        Back to dashboard
      </ButtonLink>
    </Card>
  );
}
