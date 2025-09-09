// app/api/questions/route.js
export const runtime = "nodejs"; // نخلي الراوت يشتغل على Node (يسمح لنا نستخدم fs)

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// أسئلة افتراضية (نسخناها هنا كاحتياط)
const DEFAULT_QUESTIONS = [
  {
    prompt: "شيء يستخدمه الإنسان للوصول إلى وجهته؟",
    timeLimitSec: 30,
    answers: [
      { text: "سيارة", points: 50, synonyms: ["السيارة", "موتر", "عربة"] },
      { text: "طيارة", points: 40, synonyms: ["طائرة"] },
      { text: "دراجة", points: 30, synonyms: ["بسكل", "بسكليت", "عجلة"] },
      { text: "قطار", points: 20, synonyms: [] },
    ],
  },
  {
    prompt: "شيء نشوفه في المدرسة؟",
    timeLimitSec: 30,
    answers: [
      { text: "معلم", points: 50, synonyms: ["أستاذ", "مدرس"] },
      { text: "سبورة", points: 40, synonyms: ["لوح"] },
      { text: "كتب", points: 30, synonyms: ["كتاب"] },
      { text: "طابور", points: 20, synonyms: [] },
    ],
  },
  {
    prompt: "شيء نستخدمه في المطبخ للطبخ؟",
    timeLimitSec: 30,
    answers: [
      { text: "قدر", points: 50, synonyms: ["طنجرة", "حلة"] },
      { text: "مقلاة", points: 40, synonyms: ["طاسة", "قلاية", "مقلا"] },
      { text: "ملعقة", points: 30, synonyms: ["معلقة", "مغرفة"] },
      { text: "فرن", points: 20, synonyms: ["بوتاجاز", "غاز", "شواية"] },
    ],
  },
];

export async function GET() {
  try {
    // نكوّن المسار المطلق لملف public/questions.json داخل مشروعك
    const filePath = path.join(process.cwd(), "public", "questions.json");
    const file = await fs.readFile(filePath, "utf8"); // نقرأ الملف نصيًا
    const data = JSON.parse(file); // نحول النص إلى JSON (لو فيه خطأ صيغة، الاستثناء يطلع هنا)

    // نتحقق إن فيه مصفوفة questions وفيها عناصر
    if (!Array.isArray(data?.questions) || data.questions.length === 0) {
      throw new Error("questions.json موجود لكنه فارغ أو الحقل 'questions' مو مصفوفة");
    }

    return NextResponse.json(data); // نرجّع نفس المحتوى (حتى تقدر تعدله مستقبلاً)
  } catch (err) {
    // أي خطأ (ملف ناقص / صيغة خطأ / صلاحيات...) نرجّعه افتراضيًا ونوضح السبب في اللوغز
    console.error("[/api/questions] فشل قراءة questions.json:", err?.message || err);
    return NextResponse.json({ questions: DEFAULT_QUESTIONS, _fallback: true });
  }
}
