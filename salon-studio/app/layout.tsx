import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Atelier | Salon & Beauty CRM',description:'Your salon, beautifully in sync.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
