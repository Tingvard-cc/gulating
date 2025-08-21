import type { Metadata } from "next";
import "./globals.css";
import { MeshProviderApp } from "@/providers/meshProvider";
import "@meshsdk/react/styles.css";

export const metadata: Metadata = {
  title: "Tingvard Toolkit",
  description: "Tingvard Toolkit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <MeshProviderApp>{children}</MeshProviderApp>
      </body>
    </html>
  );
}
