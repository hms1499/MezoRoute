"use client";

import { Dashboard } from "@/components/dashboard/Dashboard";
import { Landing } from "@/components/landing/Landing";
import { RequireWallet } from "./RequireWallet";

export default function Home() {
  return <RequireWallet fallback={<Landing />}>{(account) => <Dashboard account={account} />}</RequireWallet>;
}
