import type { ReactNode } from "react";
import type { Metadata } from "next";

import "pagebldr/styles.css";

export const metadata: Metadata = { title: "pagebldr Next.js example" };

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
