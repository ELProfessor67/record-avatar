import Script from "next/script";
import "./globals.css";
import { Suspense } from "react";


export const metadata = {
  title: "AI Chatting Bot",
  description: "AI Chatting Bot.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
          rel="stylesheet"
        />
      </head>
      <body>
        <Suspense>

      
        {children}
        </Suspense>
        <Script src="https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.umd.min.js"/>
        <Script src="/main.js"/>
      </body>
    </html>
  );
}
