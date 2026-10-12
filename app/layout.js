import { Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const plex = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono', display: 'swap' });

export const metadata = { title: 'VC Pipeline Intelligence', description: "Vikram's seed-round VC pipeline: who to message today, why, and who to skip" };
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#0B1F3A' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${plex.variable}`}>
      <body>{children}</body>
    </html>
  );
}
