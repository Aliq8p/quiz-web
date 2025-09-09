"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ========== أدوات مساعدة ========== */
// توحيد/تبسيط النص العربي قبل المطابقة (يشيل التشكيل، يطبع الحروف، إلخ)
function normalizeArabic(input) {
  if (!input) return "";
  let s = input.trim();
  const diacritics = /[\u0610-\u061A\u064B-\u065F\u0670-\u06ED\u0640]/g;
  s = s.normalize("NFD").replace(diacritics, "");
  const maps = [
    { from: /[أإآا]/g, to: "ا" },
    { from: /[ىيئ]/g, to: "ي" },
    { from: /[ةه]/g, to: "ه" },
    { from: /[ؤو]/g, to: "و" },
  ];
  maps.forEach((m) => (s = s.replace(m.from, m.to)));
  return s.replace(/\s+/g, " ").toLowerCase();
}

// اختيار n عناصر عشوائيًا (خوارزمية Fisher–Yates)
function pickRandom(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

/* ========== بطاقة الإجابة (عرض خانة واحدة) ========== */
function Card({ index, revealed, answer, points }) {
  return (
    <motion.div
      layout
      className="rounded-2xl shadow-md border bg-white/70 p-4 flex items-center justify-center min-h-[96px] text-center"
    >
      {!revealed ? (
        <span className="text-2xl font-semibold text-gray-700">{index + 1}</span>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <span className="text-xl font-bold">{answer}</span>
          <span className="text-sm font-semibold text-emerald-600">
            {points > 0 ? `+${points}` : "+0"}
          </span>
        </div>
      )}
    </motion.div>
  );
}

/* ========== التطبيق الرئيسي ========== */
export default function QuizWebApp() {
  // الحالة (State)
  const [questions, setQuestions] = useState([]);      // قائمة الأسئلة الجاري اللعب بها
  const [qIndex, setQIndex] = useState(0);             // رقم السؤال الحالي
  const [score, setScore] = useState(0);               // مجموع النقاط
  const [attemptsLeft, setAttemptsLeft] = useState(7); // عدد المحاولات المتبقية
  const [timeLeft, setTimeLeft] = useState(30);        // عداد الوقت للسؤال
  const [input, setInput] = useState("");              // حقل الإدخال
  const [revealed, setRevealed] = useState([false, false, false, false]); // كشف البطاقات
  const [locked, setLocked] = useState(false);         // قفل الإدخال أثناء العد التنازلي/النهاية
  const [countdown, setCountdown] = useState(0);       // عد تنازلي 3..2..1
  const [usedFallback, setUsedFallback] = useState(false); // هل استخدمنا أسئلة احتياطية؟
  const [loadError, setLoadError] = useState("");      // نص خطأ إن وجد (للتوضيح)

  // دالة تجيب سؤالين عشوائيًا من API
  async function loadTwoQuestions() {
    setLoadError("");
    try {
      const r = await fetch("/api/questions", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const all = Array.isArray(data?.questions) ? data.questions : [];
      if (!all.length) throw new Error("الـ API رجّع questions فارغة");
      setUsedFallback(Boolean(data?._fallback)); // السيرفر يرسل هذه العلامة لو رجّع الافتراضي
      return pickRandom(all, 2);
    } catch (e) {
      // لو صار أي خطأ هنا، خليه واضح عشان تعرف السبب
      setLoadError(`تعذر تحميل الأسئلة من /api/questions: ${e.message}`);
      // نرجّع قائمة فاضية حتى تظهر رسالة التحميل/الخطأ للمستخدم
      return [];
    }
  }

  // تحميل أولي للأسئلة
  useEffect(() => {
    (async () => {
      const chosen = await loadTwoQuestions();
      if (chosen.length === 0) return; // صار خطأ كبير، بنعرض رسالة تحت
      setQuestions(chosen);
      setQIndex(0);
      setScore(0);
      setAttemptsLeft(7);
      setRevealed([false, false, false, false]);
      setLocked(false);
      setCountdown(0);
      setTimeLeft(chosen[0]?.timeLimitSec || 30);
    })();
  }, []);

  const current = questions[qIndex];
  const allRevealed = revealed.every(Boolean);

  // مؤقّت السؤال
  useEffect(() => {
    if (locked || !current) return;
    if (timeLeft <= 0 || allRevealed || attemptsLeft <= 0) return;
    const id = setInterval(() => setTimeLeft((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [timeLeft, locked, allRevealed, attemptsLeft, current]);

  // عند انتهاء الوقت/المحاولات/كشف الكل -> ابدأ العد التنازلي
  useEffect(() => {
    if (locked || !current) return;
    if (timeLeft <= 0 || attemptsLeft <= 0 || allRevealed) startCountdown();
  }, [timeLeft, attemptsLeft, allRevealed, current, locked]);

  // مطابقة الإجابة
  function matches(player, ans) {
    const p = normalizeArabic(player);
    if (!p) return false;
    if (p === normalizeArabic(ans.text)) return true;
    if (ans.synonyms) for (const s of ans.synonyms) if (p === normalizeArabic(s)) return true;
    return false;
  }

  // عند إرسال اللاعب للإجابة
  function onSubmit() {
    if (locked || !current) return;
    const val = input.trim();
    if (!val || allRevealed) return;

    const ans = current.answers;
    let found = -1;
    for (let i = 0; i < ans.length; i++) {
      if (revealed[i]) continue;
      if (matches(val, ans[i])) { found = i; break; }
    }

    if (found >= 0) {
      setScore((s) => s + (current.answers[found].points || 0));
      setRevealed((r) => { const c = [...r]; c[found] = true; return c; });
    } else {
      setAttemptsLeft((a) => Math.max(0, a - 1));
    }
    setInput("");
  }

  // بدء العد التنازلي 3..2..1
  function startCountdown() { setLocked(true); setCountdown(3); }

  // إدارة العد التنازلي والانتقال للسؤال التالي أو النهاية
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          setRevealed((r) => r.map(() => true));
          setTimeout(() => {
            if (qIndex + 1 < questions.length) {
              const next = qIndex + 1;
              setQIndex(next);
              setAttemptsLeft(7);
              setRevealed([false, false, false, false]);
              setLocked(false);
              setCountdown(0);
              setTimeLeft(questions[next]?.timeLimitSec || 30);
            } else {
              setLocked(true);
              setCountdown(0);
            }
          }, 900);
          return 0;
        }
        return c - 1;
      });
    }, 700);
    return () => clearInterval(id);
  }, [countdown, qIndex, questions]);

  const finished =
    locked &&
    countdown === 0 &&
    questions.length > 0 &&
    qIndex === questions.length - 1 &&
    revealed.every(Boolean) &&
    (timeLeft === 0 || attemptsLeft === 0 || allRevealed);

  /* ===== حالات التحميل/الخطأ ===== */
  if (!current) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div>جاري التحميل…</div>
        {loadError && (
          <div className="text-xs text-red-600 max-w-md text-center px-3">
            {loadError}<br/>
            تأكد من وجود الملف <code>/public/questions.json</code> وصيغه صحيحة،
            ثم حدّث الصفحة (Ctrl+F5).
          </div>
        )}
      </div>
    );
  }

  /* ===== الواجهة ===== */
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900 p-4">
      <div className="max-w-xl mx-auto flex flex-col gap-4">
        {/* رأس الصفحة */}
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">لعبة الأسئلة والأجوبة</div>
          <div className="text-sm opacity-70">نسخة الويب</div>
        </div>

        {/* تنبيه لو الأسئلة من fallback */}
        {usedFallback && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-800 text-sm">
            ملاحظة: تعذّر قراءة <code>public/questions.json</code>، نعرض أسئلة افتراضية مؤقتًا.
          </div>
        )}

        {/* مؤشرات الحالة */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white shadow p-3">
            <div className="text-xs opacity-60">الوقت</div>
            <div className="text-xl font-bold">{timeLeft}s</div>
          </div>
          <div className="rounded-xl bg-white shadow p-3">
            <div className="text-xs opacity-60">محاولات</div>
            <div className="text-xl font-bold">{attemptsLeft}</div>
          </div>
          <div className="rounded-xl bg-white shadow p-3">
            <div className="text-xs opacity-60">النقاط</div>
            <div className="text-xl font-bold">{score}</div>
          </div>
        </div>

        {/* السؤال الحالي */}
        <div className="rounded-2xl bg-white shadow p-4">
          <div className="text-sm opacity-60 mb-1">
            سؤال {qIndex + 1} من {questions.length}
          </div>
          <div className="text-xl font-bold leading-relaxed">{current.prompt}</div>
        </div>

        {/* إدخال الإجابة */}
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            className="flex-1 rounded-xl border border-slate-300 bg-white p-3 outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="اكتب الجواب هنا..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
            disabled={locked}
          />
          <button
            onClick={onSubmit}
            disabled={locked}
            className="rounded-xl px-5 py-3 bg-emerald-600 text-white font-semibold shadow hover:bg-emerald-700 disabled:opacity-50"
          >
            أرسل
          </button>
        </div>

        {/* بطاقات الإجابات */}
        <div className="grid grid-cols-2 gap-3">
          {current.answers.map((a, i) => (
            <Card key={i} index={i} revealed={revealed[i]} answer={a.text} points={revealed[i] ? a.points : 0} />
          ))}
        </div>

        {/* شاشة النهاية + زر إعادة تحميل من الـ API */}
        {finished && (
          <div className="rounded-2xl bg-white shadow p-6 text-center space-y-3">
            <div className="text-2xl font-extrabold">انتهت الجولة 👏</div>
            <div className="text-lg">مجموع نقاطك: <span className="font-bold">{score}</span></div>
            <button
              className="mt-2 rounded-xl px-5 py-3 bg-slate-900 text-white font-semibold hover:bg-slate-800"
              onClick={async () => {
                const chosen = await loadTwoQuestions();
                if (chosen.length === 0) return;
                setQuestions(chosen);
                setQIndex(0);
                setScore(0);
                setAttemptsLeft(7);
                setRevealed([false, false, false, false]);
                setLocked(false);
                setCountdown(0);
                setTimeLeft(chosen[0]?.timeLimitSec || 30);
              }}
            >
              إعادة اللعب (اختيار جديد)
            </button>
          </div>
        )}
      </div>

      {/* عدّ تنازلي 3..2..1 */}
      <AnimatePresence>
        {countdown > 0 && (
          <motion.div className="fixed inset-0 flex items-center justify-center bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div key={countdown} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1.2, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.3 }} className="text-white text-7xl font-black drop-shadow-xl">
              {countdown}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
