import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo/pages";

export const metadata = pageMetadata("/route/stability-pool/");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
