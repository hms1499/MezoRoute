import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Column } from "@/components/ui/Column";

// U14 B4: Next's default 404 used the system font and had no way back. This one renders inside the root layout (the
// header, the footer, the theme) and the static export writes it to 404.html, which Vercel serves.

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <Column>
      <div className="space-y-4 py-8">
        <h1 className="text-title">Page not found</h1>
        <p className="text-sm text-muted">This address is not part of MezoRoute. Check the link, or go to one of these pages.</p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/" arrow>
            Open the dashboard
          </ButtonLink>
          <ButtonLink href="/positions/" variant="secondary">
            Positions
          </ButtonLink>
        </div>
      </div>
    </Column>
  );
}
