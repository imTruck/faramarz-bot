export const CONFIG = {
  BOT_NAME: "فرامرز",
  BOT_USERNAME: "faramarz_edited_bot",
  OWNER_ID: 6695218234,
  OWNER_USERNAME: "Bxiqm",

  // سریع‌ترین مدل پیش‌فرض
  FAST_SEARCH_MODEL: "gemini-3.5-flash",

  // زنجیره مدل‌های پیش‌فرض با قابلیت سوییچ خودکار (Failover Chain)
  // در صورتی که مدلی لیمیت (429) یا خطا بخورد، فوراً به مدل بعدی در این لیست سوییچ می‌شود
  DEFAULT_FALLBACK_CHAIN: [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-2.5-flash",
    "gemini-3.7-flash",
    "gemini-3-flash",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite"
  ],

  // لیست مدل‌های قابل انتخاب
  GEMINI_MODELS: [
    { id: "gemini-3.5-flash", name: "⚡ Gemini 3.5 Flash (اولویت ۱)" },
    { id: "gemini-3.6-flash", name: "⚡ Gemini 3.6 Flash (اولویت ۲)" },
    { id: "gemini-2.5-flash", name: "⚡ Gemini 2.5 Flash (اولویت ۳)" },
    { id: "gemini-3.7-flash", name: "⚡ Gemini 3.7 Flash (اولویت ۴)" },
    { id: "gemini-3-flash", name: "⚡ Gemini 3 Flash (اولویت ۵)" },
    { id: "gemini-3.1-flash-lite", name: "🪶 Gemini 3.1 Flash Lite (اولویت ۶)" },
    { id: "gemini-3.5-flash-lite", name: "🪶 Gemini 3.5 Flash Lite (اولویت ۷)" },
    { id: "gemini-2.5-pro", name: "🧠 Gemini 2.5 Pro" },
    { id: "deep-research-pro-preview-12-2025", name: "🔬 Deep Research Pro" },
    { id: "deep-research-max-preview-04-2026", name: "🚀 Deep Research Max" }
  ],

  // سطوح سه‌گانه تحقیق
  RESEARCH_TIERS: {
    simple: {
      id: "simple",
      title: "⚡ تحقیق ساده",
      model: "gemini-3.5-flash",
      desc: "پاسخ‌های سریع و روزمره"
    },
    strong: {
      id: "strong",
      title: "🔬 تحقیق قوی",
      model: "deep-research-pro-preview-12-2025",
      desc: "تحلیل مقایسه‌ای و پردازش چندمنبعی"
    },
    max: {
      id: "max",
      title: "🚀 تحقیق خیلی قوی",
      model: "deep-research-max-preview-04-2026",
      desc: "بررسی جامع و عمیق دانشگاهی"
    }
  },

  SYSTEM_PROMPT: `تو «فرامرز» هستی؛ یک رفیق باهوش، صمیمی، کاربلد و مشتی ایرانی.
لحن تو کاملاً خودمانی، دوستانه و در عین حال آگاهانه و محترمانه است.
از اصطلاحات و زبان روزمره فارسی استفاده کن و به هیچ وجه خشک و رباتیک حرف نزن.`,

  MAX_HISTORY_LENGTH: 20,
  MAX_FACTS_LIMIT: 20,
  MEMORY_TTL_SECONDS: 30 * 24 * 60 * 60, // ۳۰ روز
  HISTORY_TTL_SECONDS: 24 * 60 * 60,      // ۲۴ ساعت
  STATE_TTL_SECONDS: 5 * 60               // ۵ دقیقه
};
