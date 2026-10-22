import { Barlow, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/app/components/Toast";
import type { Metadata, Viewport } from "next";
import Script from "next/script";

const barlow = Barlow({
  weight: ['400', '500', '700'],
  subsets: ["latin"],
  display: 'swap',
  variable: "--font-barlow",
});

const notoSansThai = Noto_Sans_Thai({
  weight: ['400', '500', '700'],
  subsets: ["thai"],
  display: 'swap',
  variable: "--font-noto-sans-thai",
});

export const metadata: Metadata = {
  title: "Spa & Massage Booking System",
  description: "ระบบจองบริการสปา",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var search = window.location.search;
                  if (!search) return;
                  var params = new URLSearchParams(search);
                  var state = params.get('liff.state');
                  if (state) {
                    var target = decodeURIComponent(state);
                    if (target.indexOf('/') !== 0) target = '/' + target;
                    var targetPath = target.split('?')[0].replace(/\/+$/, '') || '/';
                    var currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
                    if (currentPath !== targetPath) {
                      window.location.replace(target);
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <Script
          src="https://static.line-scdn.net/liff/edge/2/sdk.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className={`${barlow.variable} ${notoSansThai.variable} antialiased bg-[var(--background)] text-foreground`}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
