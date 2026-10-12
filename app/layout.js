import './globals.css';

export const metadata = { title: 'VC Pipeline Intelligence', description: "Vikram's seed-round VC pipeline: who to reach out to this week" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
