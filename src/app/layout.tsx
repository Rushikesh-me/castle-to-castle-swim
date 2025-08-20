import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "./components/ui/NavBar";
import Image from "next/image";
import AuthProvider from "./utils/providers/SessionProvider";
import { auth } from "./utils/auth";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Castle to Castle Swim",
  description: "Castle to Castle Swim is a swim event that takes place in Athlone, Ireland. It is a 13km swim race for solo swimmers and relay teams.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
	const session = await auth();
  return (
		<html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased relative`}>
        <NavBar />
			  <main className="relative">
				  <AuthProvider session={session}>
					  {children}
					  </AuthProvider>
          </main>
				{/* <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
					<a className="flex items-center gap-2 hover:underline hover:underline-offset-4" href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app" target="_blank" rel="noopener noreferrer">
						<Image aria-hidden src="/file.svg" alt="File icon" width={16} height={16} />
						Learn
					</a>
					<a className="flex items-center gap-2 hover:underline hover:underline-offset-4" href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app" target="_blank" rel="noopener noreferrer">
						<Image aria-hidden src="/window.svg" alt="Window icon" width={16} height={16} />
						Examples
					</a>
					<a className="flex items-center gap-2 hover:underline hover:underline-offset-4" href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app" target="_blank" rel="noopener noreferrer">
						<Image aria-hidden src="/globe.svg" alt="Globe icon" width={16} height={16} />
						Go to nextjs.org →
					</a>
				</footer> */}
			</body>
		</html>
  );
}
