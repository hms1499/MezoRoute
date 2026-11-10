import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo/pages";

export const metadata = pageMetadata("/compare/");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
