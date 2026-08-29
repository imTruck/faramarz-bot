import { CONFIG } from './config.js';
import { MemoryService } from './memory.js';
import { LiveInfoService } from './live-info.js';
import { ModelManager } from './model-manager.js';
import { callAI } from './api.js';

export class SmartChat {
  constructor(storage, env) {
    this.storage = storage;
    this.env = env;
    this.memory = new MemoryService(storage.kv);
    this.liveInfo = new LiveInfoService();
    this.modelManager = new ModelManager(storage);
  }

  // مسیریاب معنایی هوشمند: تشخیص خودکار نیاز به اطلاعات زنده وب
  needsLiveWebSearch(text) {
    if (!text) return false;
    const clean = text.trim();

    // ۱. کلمات نشان‌دهنده زمان حال، رویدادهای زنده، قیمت، اخبار یا تحقیق
    const liveKeywords = [
      "امروز", "دیروز", "دیشب", "جدیدترین", "آخرین", "اخبار", "خبر",
      "قیمت", "نرخ", "تورم", "سکه", "طلا", "دلار", "بیتکوین", "ارز دیجیتال",
      "آب و هوا", "هواشناسی", "بارش", "دما",
      "رئیس جمهور", "وزیر", "مجلس", "انتخابات", "جنگ", "فوتبال", "نتیجه بازی",
      "تحقیق", "سرچ", "جستجو", "پژوهش", "کیست", "چیست", "کجاست"
    ];

    const hasLiveKeyword = liveKeywords.some(kw => clean.includes(kw));
    const isQuestion = clean.includes("؟") || clean.includes("?") || /^(کی|چی|کجا|چرا|چگونه|چطور|آیا)\s+/i.test(clean);

    return hasLiveKeyword || isQuestion;
  }

  // استخراج فکت‌های هویتی در جریان چت
  async autoExtractFacts(userId, text) {
    if (!text) return;
    const nameMatch = text.match(/(?:من|اسمم|نامم)\s+([آ-یa-zA-Z]+)\s+(?:هستم|هست|بودم)/);
    if (nameMatch && nameMatch[1]) {
      await this.memory.updateProfile(userId, { name: nameMatch[1].trim() });
    }
    const cityMatch = text.match(/(?:من\s+)?(?:اهل|ساکن|توی)\s+([آ-یa-zA-Z]+)\s+(?:هستم|زندگی\s+می‌کنم)/);
    if (cityMatch && cityMatch[1]) {
      await this.memory.updateProfile(userId, { city: cityMatch[1].trim() });
    }
  }

  // تولید گزارش عمیق، ساختاریافته و تحلیلی با مدل Gemini Pro
  async executeDeepReport(chatId, userId, query) {
    const deepPrompt = `${CONFIG.SYSTEM_PROMPT}

دستور ویژه تولید گزارش جامع و دانشگاهی (Deep Research Mode):
درباره موضوع «${query}»، یک گزارش عمیق، موشکافانه، ساختاریافته و همه‌جانبه آماده کن.
قالب‌بندی و الزامات پاسخ:
۱. مقدمه و تعریف کلیدی موضوع
۲. پیشینه، تاریخچه و ریشه‌ها
۳. تحلیل ابعاد اصلی و نکات مهم (با بولت‌پوینت‌های دقیق)
۴. جدول مقایسه‌ای یا آماری (در صورت ارتباط با موضوع)
۵. پیامدها، آینده و نتیجه‌گیری کاربردی
۶. لحن خودمانی ولی بسیار آگاهانه و معتبر
از جستجوی وب برای درج اطلاعات دقیق و مراجع استفاده کن.`;

    const messages = [
      { role: "user", content: `تولید تحقیق و گزارش عمیق و جامع درباره: ${query}` }
    ];

    const primaryProModel = CONFIG.DEEP_RESEARCH_MODELS[0];
    const result = await callAI(messages, { model: primaryProModel, storage: this.storage }, deepPrompt, true);

    return {
      title: `🚀 گزارش تحلیلی و عمیق فرامرز: «${query}»`,
      text: `🚀 **تحقیق و گزارش عمیق درباره «${query}»:**\n\n${result.text}`,
      sources: result.sources || [],
      modelUsed: result.modelUsed || primaryProModel
    };
  }

  // پردازش اصلی مکالمه با پاسخ فوق‌سریع و منبع‌یابی خودکار
  async processMessage(chatId, userId, userMessage, senderName = "کاربر") {
    this.autoExtractFacts(userId, userMessage).catch(() => {});

    // پاسخ آنی به قیمت‌ها از کش
    const livePriceCheck = await this.liveInfo.checkQuickTriggers(userMessage);
    if (livePriceCheck.isHandled) {
      return { text: livePriceCheck.response, sources: [], shouldShowDeepButton: false };
    }

    const [history, userMemory, primaryModel] = await Promise.all([
      this.storage.getHistory(chatId),
      this.memory.getMemoryContext(userId),
      this.storage.getPrimaryModel()
    ]);

    const recentHistory = history.slice(-6);

    const dynamicSystemPrompt = `${CONFIG.SYSTEM_PROMPT}

[کانتکست و مشخصات کاربر (${senderName})]:
${userMemory || "ندارد"}`;

    const messages = [
      ...recentHistory,
      { role: "user", content: `${senderName}: ${userMessage}` }
    ];

    // بررسی هوشمند نیاز به ابزار سرچ در چت
    const enableSearch = this.needsLiveWebSearch(userMessage);

    let result = { text: "", sources: [] };
    try {
      result = await callAI(messages, {
        model: primaryModel,
        storage: this.storage
      }, dynamicSystemPrompt, enableSearch);
    } catch (err) {
      result.text = `رفیق متاسفانه ارتباط با سرور هوش مصنوعی برقرار نشد (${err.message})، دوباره بفرست در خدمتم!`;
    }

    history.push({ role: "user", content: userMessage });
    history.push({ role: "assistant", content: result.text });
    this.storage.saveHistory(chatId, history).catch(() => {});

    // اگر پیام بیش از ۲ کلمه بود، امکان ساخت تحقیق عمیق فعال می‌شود
    const shouldShowDeepButton = userMessage.trim().split(/\s+/).length >= 2 && !userMessage.startsWith("/");

    return {
      text: result.text,
      sources: result.sources || [],
      shouldShowDeepButton,
      query: userMessage
    };
  }
}
