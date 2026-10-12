import './globals.css';

export const metadata = { title: 'VC Pipeline Intelligence', description: "Vikram's seed-round VC pipeline: who to reach out to this week" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <a href="/" className="brand">VC Pipeline Intelligence</a>
          <nav><a href="/">Pipeline</a><a href="/runs">Runs &amp; cost</a><a href="/api/verify">Verify</a></nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
