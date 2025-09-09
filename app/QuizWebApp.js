"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ========== أدوات مساعدة ========== */
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

// اختيار n عناصر عشوائيًا (Fisher–Yates)
function pickRandom(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

/* ========== بطاقة الإجابة ========== */
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

/* ========== التطبيق ========== */
export default function QuizWebApp() {
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(7);
  const [timeLeft, setTimeLeft] = useState(30);
  const [input, setInput] = useState("");
  const [revealed, setRevealed] = useState([false, false, false, false]);
  const [locked, setLocked] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // تحميل الأسئلة واختيار سؤالين عشوائياً
  useEffect(() => {
    fetch("/questions.json")
      .then((r) => r.json())
      .then((data) => {
        const all = data?.questions || [];
        const chosen = pickRandom(all, 2);
        setQuestions(chosen);

        // تهيئة الحالة لأول سؤال
        setQIndex(0);
        setScore(0);
        setAttemptsLeft(7);
        setRevealed([false, false, false, false]);
        setLocked(false);
        setCountdown(0);
        if (chosen[0]) setTimeLeft(chosen[0].timeLimitSec || 30);
      })
      .catch(() => {
        // في حال فشل القراءة، نخلي كل شيء افتراضي
        setQuestions([]);
      });
  }, []);

  const current = questions[qIndex];
  const allRevealed = revealed.every(Boolean);

  // مؤقّت الجولة
  useEffect(() => {
    if (locked || !current) return;
    if (timeLeft <= 0 || allRevealed || attemptsLeft <= 0) return;
    const id = setInterval(() => setTimeLeft((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [timeLeft, locked, allRevealed, attemptsLeft, current]);

  // عند انتهاء الوقت/المحاولات/كشف الكل نبدأ 3..2..1
  useEffect(() => {
    if (locked || !current) return;
    if (timeLeft <= 0 || attemptsLeft <= 0 || allRevealed) startCountdown();
  }, [timeLeft, attemptsLeft, allRevealed, current, locked]);

  function matches(player, ans) {
    const p = normalizeArabic(player);
    if (!p) return false;
    if (p === normalizeArabic(ans.text)) return true;
    if (ans.synonyms) for (const s of ans.synonyms) if (p === normalizeArabic(s)) return true;
    return false;
  }

  function onSubmit() {
    if (locked || !current) return;
    const val = input.trim();
    if (!val || allRevealed) return;

    const ans = current.answers;
    let found = -1;
    for (let i = 0; i < ans.length; i++) {
      if (revealed[i]) continue;
      if (matches(val, ans[i])) {
        found = i;
        break;
      }
    }

    if (found >= 0) {
      setScore((s) => s + (current.answers[found].points || 0));
      setRevealed((r) => {
        const c = [...r];
        c[found] = true;
        return c;
      });
    } else {
      setAttemptsLeft((a) => Math.max(0, a - 1));
    }
    setInput("");
  }

  function startCountdown() {
    setLocked(true);
    setCountdown(3);
  }

  // 3..2..1 ثم إما سؤال تالي أو انتهاء
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          setRevealed((r) => r.map(() => true));
          setTimeout(() => {
            if (qIndex + 1 < questions.length) {
              // سؤال تالي
              const next = qIndex + 1;
              setQIndex(next);
              setAttemptsLeft(7);
              setRevealed([false, false, false, false]);
              setLocked(false);
              setCountdown(0);
              const q = questions[next];
              setTimeLeft(q?.timeLimitSec || 30);
            } else {
              // انتهت الجولة الأخيرة
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

  if (!current) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        جاري التحميل…
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900 p-4">
      <div className="max-w-xl mx-auto flex flex-col gap-4">
        {/* العنوان */}
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">لعبة الأسئلة والأجوبة</div>
          <div className="text-sm opacity-70">نسخة الويب</div>
        </div>

        {/* شريط الحالة */}
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

        {/* السؤال */}
        <div className="rounded-2xl bg-white shadow p-4">
          <div className="text-sm opacity-60 mb-1">
            سؤال {qIndex + 1} من {questions.length}
          </div>
          <div className="text-xl font-bold leading-relaxed">{current.prompt}</div>
        </div>

        {/* الإدخال */}
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            className="flex-1 rounded-xl border border-slate-300 bg-white p-3 outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="اكتب الجواب هنا..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmit();
            }}
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

        {/* البطاقات */}
        <div className="grid grid-cols-2 gap-3">
          {current.answers.map((a, i) => (
            <Card
              key={i}
              index={i}
              revealed={revealed[i]}
              answer={a.text}
              points={revealed[i] ? (revealed.filter(Boolean).length ? a.points : a.points) : 0}
            />
          ))}
        </div>

        {/* النهاية */}
        {finished && (
          <div className="rounded-2xl bg-white shadow p-6 text-center space-y-2">
            <div className="text-2xl font-extrabold">انتهت الجولة 👏</div>
            <div className="text-lg">
              مجموع نقاطك: <span className="font-bold">{score}</span>
            </div>
            <button
              className="mt-2 rounded-xl px-5 py-3 bg-slate-900 text-white font-semibold hover:bg-slate-800"
              onClick={() => {
                // إعادة اختيار عشوائي جديد بدون إعادة تحميل الصفحة
                fetch("/questions.json")
                  .then((r) => r.json())
                  .then((data) => {
                    const chosen = pickRandom(data?.questions || [], 2);
                    setQuestions(chosen);
                    setQIndex(0);
                    setScore(0);
                    setAttemptsLeft(7);
                    setRevealed([false, false, false, false]);
                    setLocked(false);
                    setCountdown(0);
                    if (chosen[0]) setTimeLeft(chosen[0].timeLimitSec || 30);
                  });
              }}
            >
              إعادة اللعب (اختيار عشوائي جديد)
            </button>
          </div>
        )}
      </div>

      {/* عدّ تنازلي 3..2..1 */}
      <AnimatePresence>
        {countdown > 0 && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              key={countdown}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-white text-7xl font-black drop-shadow-xl"
            >
              {countdown}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
