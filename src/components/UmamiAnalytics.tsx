'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

// Umami (self-hosted, cookieless). The admin area shares the root layout, so
// it is excluded here. data-domains makes the tracker a no-op on localhost and
// preview deployments.
export function UmamiAnalytics() {
  const pathname = usePathname();
  if (pathname === '/admin' || pathname?.startsWith('/admin/')) return null;

  return (
    <Script
      src="https://analytics.thechats.me/script.js"
      strategy="afterInteractive"
      defer
      data-website-id="98af3f7b-2e82-4580-b6e9-d9030a14305a"
      data-domains="portfolio.josefelipedev.com"
      data-do-not-track="true"
    />
  );
}
