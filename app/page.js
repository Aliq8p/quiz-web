import dynamic from "next/dynamic";
const QuizWebApp = dynamic(() => import("./QuizWebApp"), { ssr: false });

export default function Page() {
  return <QuizWebApp />;
}