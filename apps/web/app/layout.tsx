export const metadata = {
  title: "Spotter Organizer Portal",
  description: "Tournament Organizer Portal for managing golf events",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
