import "./globals.css";
import { getEventSettings } from "../lib/eventConfig";

export async function generateMetadata() {
  const EVENT = await getEventSettings();
  return {
    title: `${EVENT.name} — ${EVENT.dateDisplay}`,
    description: `${EVENT.subtitle}. Boarding ${EVENT.boardingTime}. Tickets $${EVENT.priceAUD}.`,
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="true"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
