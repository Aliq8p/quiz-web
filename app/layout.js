export const metadata = {
  title: "لعبة الأسئلة والأجوبة",
  description: "نسخة ويب بسيطة للعبة الأسئلة والأجوبة بالعربي",
};
import "./globals.css";
export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
