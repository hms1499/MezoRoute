"use client";

import { Dashboard } from "@/components/dashboard/Dashboard";
import { Column } from "@/components/ui/Column";
import { RequireWallet } from "./RequireWallet";

export default function Home() {
  return (
    <Column>
      <RequireWallet>{(account) => <Dashboard account={account} />}</RequireWallet>
    </Column>
  );
}
