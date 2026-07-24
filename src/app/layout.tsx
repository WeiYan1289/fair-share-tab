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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${instrumentSerif.variable} ${workSans.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
