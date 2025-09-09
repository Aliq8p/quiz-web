// lib/supabase.js
import { createClient } from "@supabase/supabase-js";

// ندعم الاسمين: NEXT_PUBLIC_* أو SUPABASE_* (للاحتياط)
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// إنشاء عميل واحد نستخدمه في الصفحات والراوتات
export const supabase = createClient(url || "", anon || "", {
  auth: { persistSession: false },
});
