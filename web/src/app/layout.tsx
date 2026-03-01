import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Pi Web UI - Example",
	description: "Example usage of @mariozechner/pi-web-ui",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
