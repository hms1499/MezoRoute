"use client";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { useNetwork } from "@/lib/config/network-context";
import { decodeError } from "@/lib/errors/decode";

/** A failed snapshot read: the decoded message and a Retry button. */
export function LoadError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { network } = useNetwork();
  return (
    <Notice
      tone="danger"
      role="alert"
      action={
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      }
    >
      {decodeError(error, network).message}
    </Notice>
  );
}
