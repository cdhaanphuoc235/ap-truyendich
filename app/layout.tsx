// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        {children}
        {/* @ts-expect-error async */}
        <script async src="/sw.js" />
      </body>
    </html>
  );
}
