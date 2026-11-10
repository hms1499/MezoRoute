import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo/pages";

export const metadata = pageMetadata("/route/lp/confirm/");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
