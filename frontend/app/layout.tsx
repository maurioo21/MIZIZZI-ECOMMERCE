import { Inter } from "next/font/google"
import "./globals.css"
import { Providers as AppProviders } from "./providers"
import { Providers as StateProviders } from "@/components/providers/index"
import type React from "react"
import { defaultMetadata } from "@/lib/metadata-utils"
import { LayoutRenderer } from "@/components/layout/layout-renderer"
import { PageTransitionWrapper } from "@/components/transitions/page-transition-wrapper"
import Script from "next/script"
import { ThemeProvider } from "@/contexts/theme-context"
import type { Viewport } from "next"
import { getFooterSettings } from "@/lib/server/get-footer-settings"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-inter",
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
  adjustFontFallback: false,
})

export const metadata = defaultMetadata

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const footerSettings = await getFooterSettings()

  // Call the async LayoutRenderer function and await its result before returning JSX.
  // Cast to any-compatible signature to allow passing additional props without TS errors.
  const layoutRenderer = await (LayoutRenderer as unknown as (props: any) => Promise<React.ReactNode>)({
    footerSettings,
    children,
  })

  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth" data-scroll-behavior="smooth">
      <head>
        {/* Suppress React DevTools warning in development */}
        {process.env.NODE_ENV === "development" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
      // Suppress React DevTools warning
      console.warn = (function(originalWarn) {
        return function(msg, ...args) {
          if (typeof msg === 'string' && (
            msg.includes('Download the React DevTools') ||
            msg.includes('react-devtools')
          )) {
            return;
          }
          return originalWarn.call(console, msg, ...args);
        };
      })(console.warn);
    `,
            }}
          />
        )}
      </head>
      <body className={`${inter.className} ${inter.variable}`} suppressHydrationWarning>
        {/* Defer Google Sign-In until page is interactive */}
        <Script src="https://accounts.google.com/gsi/client" strategy="lazyOnload" async defer />

        <ThemeProvider>
          <StateProviders>
            <AppProviders>
              <PageTransitionWrapper />
              <div className="w-full min-h-screen overflow-x-hidden">
                <RootLayoutContent>{layoutRenderer}</RootLayoutContent>
              </div>
            </AppProviders>
          </StateProviders>
        </ThemeProvider>
      </body>
    </html>
  )
}

function RootLayoutContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
