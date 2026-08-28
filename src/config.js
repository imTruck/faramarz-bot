export const CONFIG = {
  BOT_NAME: "فرامرز",
  BOT_USERNAME: "faramarz_edited_bot",
  OWNER_ID: 6695218234,
  OWNER_USERNAME: "Bxiqm",

  // سریع‌ترین مدل پیش‌فرض برای پردازش و سنتز جستجوها
  FAST_SEARCH_MODEL: "gemini-2.5-flash",

  // ۱۶ مدل پایه و پیش‌فرض Gemini
  GEMINI_MODELS: [
    { id: "gemini-2.5-flash", name: "⚡ Gemini 2.5 Flash (فوق‌سریع & پیش‌فرض)" },
    { id: "gemini-2.5-pro", name: "🧠 Gemini 2.5 Pro" },
    { id: "gemini-2.0-flash", name: "⚡ Gemini 2.0 Flash" },
    { id: "gemini-2.0-flash-lite", name: "🪶 Gemini 2.0 Flash Lite (کم‌مصرف)" },
    { id: "gemini-1.5-pro", name: "🏛 Gemini 1.5 Pro" },
    { id: "gemini-1.5-flash", name: "⚡ Gemini 1.5 Flash" },
    { id: "deep-research-pro-preview-12-2025", name: "🔬 Deep Research Pro (12-2025)" },
    { id: "deep-research-max-preview-04-2026", name: "🚀 Deep Research Max (04-2026)" },
    { id: "deep-research-lite-preview", name: "🧪 Deep Research Lite" },
    { id: "antigravity-alpha-01", name: "🌌 Antigravity Agent Core" },
    { id: "robotics-er-v1", name: "🤖 Robotics ER v1" },
    { id: "robotics-er-v2-pro", name: "🦾 Robotics ER v2 Pro" },
    { id: "robotics-er-spatial", name: "📐 Robotics Spatial" },
    { id: "gemma-2-27b-it", name: "💎 Gemma 2 27B IT" },
    { id: "gemma-2-9b-it", name: "💎 Gemma 2 9B IT" },
    { id: "gemma-3-preview", name: "🔮 Gemma 3 Preview" }
  ],

  // سطوح سه‌گانه تحقیق
  RESEARCH_TIERS: {
    simple: {
      id: "simple",
      title: "⚡ تحقیق ساده",
      model: "gemini-2.5-flash",
      desc: "سوال‌های معمولی، سریع و روزمره"
    },
    strong: {
      id: "strong",
      title: "🔬 تحقیق قوی",
      model: "deep-research-pro-preview-12-2025",
      desc: "تحلیل مقایسه‌ای و پردازش نیمه‌پیچیده"
    },
    max: {
      id: "max",
      title: "🚀 تحقیق خیلی قوی",
      model: "deep-research-max-preview-04-2026",
      desc: "عمیق، دقیق و استنادی جامع"
    }
  },

  SYSTEM_PROMPT: `تو «فرامرز» هستی؛ یک رفیق باهوش، صمیمی، کاربلد و مشتی ایرانی.
لحن تو کاملاً خودمانی، دوستانه و در عین حال آگاهانه و محترمانه است.
از اصطلاحات و زبان روزمره فارسی استفاده کن و به هیچ وجه خشک و رباتیک حرف نزن.
قوانین کلیدی:
۱. اگر کاربر سوالی پرسید که به اطلاعات زنده روز (نرخ ارز، طلا، سکه، اخبار جدید یا رویدادها) نیاز دارد، فوراً عبارت [[SEARCH:عبارت جستجو]] را در پاسخت قرار بده تا سیستم با سریع‌ترین مدل هوشمند جستجو کند.
۲. اگر کاربر خود یا ترجیحاتش را معرفی کرد، آن‌ها را به یاد بسپار.
۳. در گروه‌ها، شوخ‌طبع، باصفا و یاری‌رسان باش و به نام دوستان توجه کن.`,

  MAX_HISTORY_LENGTH: 20,
  MAX_FACTS_LIMIT: 20,
  MEMORY_TTL_SECONDS: 30 * 24 * 60 * 60, // ۳۰ روز
  HISTORY_TTL_SECONDS: 24 * 60 * 60,      // ۲۴ ساعت
  STATE_TTL_SECONDS: 5 * 60               // ۵ دقیقه
};
