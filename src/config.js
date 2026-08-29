export const CONFIG = {
  BOT_NAME: "فرامرز",
  BOT_USERNAME: "faramarz_edited_bot",
  OWNER_ID: 6695218234,
  OWNER_USERNAME: "Bxiqm",

  // زنجیره اولویت دقیق مدل‌های چت (چیدمان درخواستی شما)
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

  // مدل‌های اختصاصی تحقیق عمیق و گزارش جامع
  DEEP_RESEARCH_MODELS: [
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
    "gemini-2.5-flash"
  ],

  SYSTEM_PROMPT: `تو «فرامرز» هستی؛ یک رفیق باهوش، صمیمی، کاربلد و مشتی ایرانی.
لحن تو کاملاً خودمانی، دوستانه و در عین حال آگاهانه و محترمانه است.
از اصطلاحات و زبان روزمره فارسی استفاده کن و به هیچ وجه خشک و رباتیک حرف نزن.
در ارائه توضیحات و آموزش‌ها منظم، روان و جذاب باش.`,

  MAX_HISTORY_LENGTH: 20,
  MAX_FACTS_LIMIT: 20,
  MEMORY_TTL_SECONDS: 30 * 24 * 60 * 60, // ۳۰ روز
  HISTORY_TTL_SECONDS: 24 * 60 * 60,      // ۲۴ ساعت
  STATE_TTL_SECONDS: 10 * 60              // ۱۰ دقیقه
};
