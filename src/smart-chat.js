import { CONFIG } from './config.js';
import { MemoryService } from './memory.js';
import { GeminiSearchService } from './gemini-search.js';
import { LiveInfoService } from './live-info.js';
import { SearchService } from './search.js';
import { callAI } from './api.js';

export class SmartChat {
  constructor(storage, env) {
    this.storage = storage;
    this.env = env;
    this.memory = new MemoryService(storage.kv);
    this.geminiSearch = new GeminiSearchService(storage);
    this.liveInfo = new LiveInfoService();
    this.webSearch = new SearchService();
  }

  // استخراج خودکار فکت‌ها و اطلاعات هویتی
  async autoExtractFacts(userId, text) {
    if (!text) return;
    
    // استخراج نام
    const nameMatch = text.match(/(?:من|اسمم|نامم)\s+([آ-یa-zA-Z]+)\s+(?:هستم|هست|بودم)/);
    if (nameMatch && nameMatch[1]) {
      await this.memory.updateProfile(userId, { name: nameMatch[1].trim() });
    }

    // استخراج شهر
    const cityMatch = text.match(/(?:من\s+)?(?:اهل|ساکن|توی)\s+([آ-یa-zA-Z]+)\s+(?:هستم|زندگی\s+می‌کنم)/);
    if (cityMatch && cityMatch[1]) {
      await this.memory.updateProfile(userId, { city: cityMatch[1].trim() });
    }

    // استخراج شغل یا تخصص
    const jobMatch = text.match(/(?:من\s+)?(?:شغلم|کارم)\s+([آ-یa-zA-Z\s]+)\s+(?:هست|است|می‌کنم)/);
    if (jobMatch && jobMatch[1]) {
      await this.memory.updateProfile(userId, { job: jobMatch[1].trim() });
    }
  }

  // اجرای درخواست در حالت تحقیق تخصصی ۳ سطحی
  async executeResearch(chatId, userId, question, tierKey = "simple") {
    const tier = CONFIG.RESEARCH_TIERS[tierKey] || CONFIG.RESEARCH_TIERS.simple;
    const model = tier.model;

    // لایه ۱ جستجو با Grounding
    const grounding = await this.geminiSearch.searchWithGrounding(question, model);
    let sources = [];

    if (grounding.success && grounding.text) {
      sources = grounding.sources || [];
      return {
        text: `🔬 **گزارش ${tier.title}:**\n\n${grounding.text}`,
        sources
      };
    }

    // Fallback به جستجوی وب معمولی در صورت خطا
    const ddgResults = await this.webSearch.searchDuckDuckGo(question);
    const searchContext = ddgResults.map(r => `• عنوان: ${r.title}\nشرح: ${r.snippet}\nلینک: ${r.link}`).join("\n\n");
    sources = ddgResults.map(r => ({ title: r.title, url: r.link }));

    const synthesisMessages = [
      { role: "user", content: `تحقیق جامع و دقیق درباره سوال زیر:\n${question}` },
      { role: "system", content: `نتایج جستجو و منابع مستند:\n${searchContext}\n\nلطفاً پاسخی ساختاریافته، تحلیلی و مستند به زبان فارسی بنویس.` }
    ];

    const response = await callAI(synthesisMessages, {
      model: CONFIG.GEMINI_MODELS[0].id,
      storage: this.storage
    }, CONFIG.SYSTEM_PROMPT);

    return {
      text: `🔬 **گزارش ${tier.title}:**\n\n${response}`,
      sources
    };
  }

  // پردازش اصلی پیام متنی
  async processMessage(chatId, userId, userMessage, senderName = "کاربر") {
    // ۱. استخراج اطلاعات هویتی
    await this.autoExtractFacts(userId, userMessage);

    // ۲. بررسی سریع قیمت‌های زنده بازار (بدون مصرف توکن هوش مصنوعی)
    const livePriceCheck = await this.liveInfo.checkQuickTriggers(userMessage);
    if (livePriceCheck.isHandled) {
      return { text: livePriceCheck.response, sources: [] };
    }

    // ۳. بارگذاری تاریخچه و حافظه بلندمدت
    const history = await this.storage.getHistory(chatId);
    const userMemory = await this.memory.getMemoryContext(userId);

    // ۴. ساخت System Prompt شخصی‌سازی شده
    const dynamicSystemPrompt = `${CONFIG.SYSTEM_PROMPT}

[اطلاعات حافظه بلندمدت این کاربر (${senderName})]:
${userMemory || "هنوز اطلاعات مشخصی ثبت نشده است."}

راهنمای پروتکل جستجو: اگر برای پاسخ به اطلاعات به‌روز روزمره، نرخ‌های جدید، یا اخبار احتیاج داری، عبارت [[SEARCH:عبارت جستجو]] را خروجی بده تا سیستم سرچ کند.`;

    const messages = [
      ...history,
      { role: "user", content: `${senderName}: ${userMessage}` }
    ];

    // ۵. فراخوانی مدل فعال
    const primaryModel = await this.storage.getPrimaryModel();
    let aiResponse = "";
    try {
      aiResponse = await callAI(messages, {
        model: primaryModel,
        storage: this.storage
      }, dynamicSystemPrompt);
    } catch (err) {
      // استفاده از Fallback در صورت خطای لیمیت
      aiResponse = `رفیق متاسفانه یه لحظه خطای سروری پیش اومد (${err.message})، ولی من در خدمتم!`;
    }

    // ۶. بررسی پروتکل جستجوی خودکار [[SEARCH:...]]
    const searchMatch = aiResponse.match(/\[\[SEARCH:(.+?)\]\]/);
    let sources = [];

    if (searchMatch) {
      const query = searchMatch[1].trim();
      let searchContext = "";

      // لایه ۱: Gemini Grounding
      const geminiResult = await this.geminiSearch.searchWithGrounding(query, primaryModel);
      if (geminiResult.success && geminiResult.text) {
        searchContext = geminiResult.text;
        sources = geminiResult.sources || [];
      } else {
        // لایه ۳: DuckDuckGo Fallback
        const ddgResults = await this.webSearch.searchDuckDuckGo(query);
        searchContext = ddgResults.map(r => `عنوان: ${r.title}\nشرح: ${r.snippet}\nلینک: ${r.link}`).join("\n\n");
        sources = ddgResults.map(r => ({ title: r.title, url: r.link }));
      }

      // فراخوانی مجدد جهت تولید پاسخ طبیعی نهایی با داده‌های جستجو
      const synthesisMessages = [
        ...messages,
        { role: "assistant", content: `درخواست جستجو: ${query}` },
        { role: "system", content: `نتایج به‌دست آمده:\n${searchContext}\n\nحالا با لحن رفاقتی فرامرز جواب کاربر رو کامل و روان بده و اصلاً تگ سرچ رو تکرار نکن.` }
      ];

      aiResponse = await callAI(synthesisMessages, {
        model: primaryModel,
        storage: this.storage
      }, dynamicSystemPrompt);
    }

    // ۷. ذخیره در تاریخچه
    history.push({ role: "user", content: userMessage });
    history.push({ role: "assistant", content: aiResponse });
    await this.storage.saveHistory(chatId, history);

    return { text: aiResponse, sources };
  }
}
