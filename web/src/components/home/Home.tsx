"use client";

import { Dashboard } from "@/components/dashboard/Dashboard";
import { RequireWallet } from "./RequireWallet";

export default function Home() {
  return <RequireWallet>{(account) => <Dashboard account={account} />}</RequireWallet>;
}
