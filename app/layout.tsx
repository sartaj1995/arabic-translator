import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "Riyadh Talk",
  description:
    "Two-way English ↔ Saudi Najdi Arabic translator for everyday life in Riyadh.",
  manifest: "/manifest.webmanifest",
  applicationName: "Riyadh Talk",
  appleWebApp: {
    capable: true,
    title: "Riyadh Talk",
    // "default" keeps the status bar dark-on-light, matching the white shell.
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // viewport-fit=cover lets us paint under the notch and use env(safe-area-*).
  viewportFit: "cover",
  themeColor: "#ffffff",
  // Zoom stays enabled on purpose — this is a text-heavy accessibility tool.
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
