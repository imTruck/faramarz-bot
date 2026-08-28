export const CONFIG = {
  BOT_NAME: "فرامرز",
  BOT_USERNAME: "faramarz_edited_bot",
  OWNER_ID: 6695218234,
  OWNER_USERNAME: "Bxiqm",

  // سریع‌ترین مدل پیش‌فرض
  FAST_SEARCH_MODEL: "gemini-3.7-flash",

  // زنجیره اولویت دقیق مدل‌ها با سوییچ خودکار (Failover Chain)
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

  // لیست مدل‌های قابل انتخاب در پنل مدیریت
  GEMINI_MODELS: [
    { id: "gemini-3.7-flash", name: "⚡ Gemini 3.7 Flash (اولویت ۱)" },
    { id: "gemini-3.6-flash", name: "⚡ Gemini 3.6 Flash (اولویت ۲)" },
    { id: "gemini-3.5-flash", name: "⚡ Gemini 3.5 Flash (اولویت ۳)" },
    { id: "gemini-3.5-flash-lite", name: "🪶 Gemini 3.5 Flash Lite (اولویت ۴)" },
    { id: "gemini-3.1-flash-lite", name: "🪶 Gemini 3.1 Flash Lite (اولویت ۵)" },
    { id: "gemini-2.5-flash", name: "⚡ Gemini 2.5 Flash (پشتیبان)" },
    { id: "gemini-2.0-flash", name: "⚡ Gemini 2.0 Flash (پشتیبان)" },
    { id: "gemini-1.5-flash", name: "⚡ Gemini 1.5 Flash (پشتیبان)" }
  ],

  // سطوح سه‌گانه تحقیق
  RESEARCH_TIERS: {
    simple: {
      id: "simple",
      title: "⚡ تحقیق ساده",
      model: "gemini-3.7-flash",
      desc: "پاسخ‌های سریع و روزمره"
    },
    strong: {
      id: "strong",
      title: "🔬 تحقیق قوی",
      model: "gemini-3.6-flash",
      desc: "تحلیل مقایسه‌ای و چندمنبعی"
    },
    max: {
      id: "max",
      title: "🚀 تحقیق خیلی قوی",
      model: "gemini-3.5-flash",
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
