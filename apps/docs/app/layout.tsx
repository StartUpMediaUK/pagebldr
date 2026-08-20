import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider/next";

import "./global.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://pagebldr.dev"),
  title: { default: "pagebldr", template: "%s | pagebldr" },
  description: "Build, embed, and render visual pages in React applications.",
  openGraph: {
    title: "pagebldr",
    description: "The embeddable visual page-building engine.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
