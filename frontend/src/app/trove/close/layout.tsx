import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo/pages";

export const metadata = pageMetadata("/trove/close/");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
