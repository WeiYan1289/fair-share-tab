import type { Metadata } from "next";
import { Instrument_Serif, Work_Sans } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "FairShareTab",
  description: "Split bills fairly, settle up with the fewest transfers.",
};

// Runs before paint so the stored theme applies immediately -- without
// this, the page would flash light before React hydrates and reads
// localStorage (CLAUDE.md/design goal: one consistent mode, no flicker).
const themeInitScript = `
  try {
    if (localStorage.getItem("fst-theme") === "dark") {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
`;

// Records the viewport in a cookie on every page load so the server can route a
// group switch straight to the one-page workspace (desktop) or the classic
// list (mobile) without an /events -> /workspace URL blink. Runs before paint;
// worst case (a first-ever visit before the cookie exists) the events page's
// own pre-paint script still handles the redirect.
const viewportCookieScript = `
  try {
    var d = matchMedia("(min-width:1024px)").matches ? "d" : "m";
    document.cookie = "fst_vw=" + d + "; path=/; max-age=31536000; SameSite=Lax";
  } catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: viewportCookieScript }} />
      </head>
      <body
        className={`${instrumentSerif.variable} ${workSans.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
