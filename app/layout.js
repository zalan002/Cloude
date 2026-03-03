import './globals.css';

export const metadata = {
  title: 'CONSORTIO Munkaidő nyilvántartó',
  description: 'Training Hungary Kft. munkaidő nyilvántartó rendszer',
};

export default function RootLayout({ children }) {
  return (
    <html lang="hu">
      <body className="font-opensans text-dark-text bg-page-bg min-h-screen">
        {children}
      </body>
    </html>
  );
}
