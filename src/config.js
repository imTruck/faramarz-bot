export const CONFIG = {
  BOT_NAME: "فرامرز",
  BOT_USERNAME: "faramarz_edited_bot",
  OWNER_ID: 6695218234,
  OWNER_USERNAME: "Bxiqm",

  // زنجیره اولویت دقیق مدل‌های چت (چیدمان به ترتیب درخواست)
  DEFAULT_FALLBACK_CHAIN: [
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash"
  ],

  // مدل‌های اختصاصی دوگانه برای سرچ و پژوهش
  SEARCH_MODELS: {
    deep: {
      id: "deep",
      title: "🚀 سرچ طولانی و با جزئیات کامل (عمیق)",
      model: "models/deep-research-max-preview-04-2026",
      desc: "تحلیل جامع، استخراج موشکافانه و استناد دقیق به منابع وب"
    },
    fast: {
      id: "fast",
      title: "⚡ سرچ سریع و فوری (خلاصه)",
      model: "gemini-2.5-flash-lite",
      desc: "پاسخ فوق‌سریع در کسری از ثانیه همراه با منابع کلیدی"
    }
  },

  // لیست مدل‌های قابل انتخاب در پنل مدیریت
  GEMINI_MODELS: [
    { id: "gemini-3.7-flash", name: "⚡ Gemini 3.7 Flash (اولویت ۱)" },
    { id: "gemini-3.6-flash", name: "⚡ Gemini 3.6 Flash (اولویت ۲)" },
    { id: "gemini-3.5-flash", name: "⚡ Gemini 3.5 Flash (اولویت ۳)" },
    { id: "gemini-3.5-flash-lite", name: "🪶 Gemini 3.5 Flash Lite (اولویت ۴)" },
    { id: "gemini-3.1-flash-lite", name: "🪶 Gemini 3.1 Flash Lite (اولویت ۵)" },
    { id: "models/deep-research-max-preview-04-2026", name: "🚀 Deep Research Max (سرچ عمیق)" },
    { id: "gemini-2.5-flash-lite", name: "⚡ Gemini 2.5 Flash Lite (سرچ سریع)" },
    { id: "gemini-2.5-flash", name: "⚡ Gemini 2.5 Flash (پشتیبان)" },
    { id: "gemini-2.0-flash", name: "⚡ Gemini 2.0 Flash (پشتیبان)" }
  ],

  SYSTEM_PROMPT: `تو «فرامرز» هستی؛ یک رفیق باهوش، صمیمی، کاربلد و مشتی ایرانی.
لحن تو کاملاً خودمانی، دوستانه و در عین حال آگاهانه و محترمانه است.
از اصطلاحات و زبان روزمره فارسی استفاده کن و به هیچ وجه خشک و رباتیک حرف نزن.`,

  MAX_HISTORY_LENGTH: 20,
  MAX_FACTS_LIMIT: 20,
  MEMORY_TTL_SECONDS: 30 * 24 * 60 * 60, // ۳۰ روز
  HISTORY_TTL_SECONDS: 24 * 60 * 60,      // ۲۴ ساعت
  STATE_TTL_SECONDS: 5 * 60               // ۵ دقیقه
};
