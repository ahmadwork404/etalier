import "./globals.css";
import { ToastProvider } from "./components/Toasts";
export const metadata = {
  title: "Etalier | Business workspace",
  icons: { icon: "/icon.svg" },
  description: "Salon management, designed around your day.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
