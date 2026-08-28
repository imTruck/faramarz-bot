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

  // استخراج نام و فکت‌ها
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

  // اجرای تحقیق ۳ سطحی
  async executeResearch(chatId, userId, question, tierKey = "simple") {
    const tier = CONFIG.RESEARCH_TIERS[tierKey] || CONFIG.RESEARCH_TIERS.simple;
    const model = tier.model;

    const messages = [
      { role: "user", content: `تحقیق جامع و دقیق درباره سوال زیر همراه با ذکر منابع معتبر:\n${question}` }
    ];

    const result = await callAI(messages, { model, storage: this.storage }, CONFIG.SYSTEM_PROMPT, true);

    return {
      text: `🔬 **گزارش ${tier.title}:**\n\n${result.text}`,
      sources: result.sources || []
    };
  }

  // پردازش اصلی پیام چت به صورت تک‌مرحله‌ای و فوق‌سریع
  async processMessage(chatId, userId, userMessage, senderName = "کاربر") {
    // ۱. استخراج اطلاعات هویتی
    this.autoExtractFacts(userId, userMessage).catch(() => {});

    // ۲. پاسخ آنی به قیمت‌ها از کش (کمتر از ۱۰ میلی‌ثانیه)
    const livePriceCheck = await this.liveInfo.checkQuickTriggers(userMessage);
    if (livePriceCheck.isHandled) {
      return { text: livePriceCheck.response, sources: [] };
    }

    // ۳. بارگذاری تاریخچه (محدود به ۶ پیام آخر جهت کاهش چشمگیر تأخیر)
    const [history, userMemory, primaryModel] = await Promise.all([
      this.storage.getHistory(chatId),
      this.memory.getMemoryContext(userId),
      this.storage.getPrimaryModel()
    ]);

    const recentHistory = history.slice(-6);

    const dynamicSystemPrompt = `${CONFIG.SYSTEM_PROMPT}

[کانتکست کاربر (${senderName})]:
${userMemory || "ندارد"}`;

    const messages = [
      ...recentHistory,
      { role: "user", content: `${senderName}: ${userMessage}` }
    ];

    // ۴. فراخوانی تک‌مرحله‌ای هوش مصنوعی همراه با Google Grounding خودکار
    let result = { text: "", sources: [] };
    try {
      result = await callAI(messages, {
        model: primaryModel,
        storage: this.storage
      }, dynamicSystemPrompt, true);
    } catch (err) {
      result.text = `رفیق متاسفانه یک لحظه ارتباط با سرور هوش مصنوعی قطع شد (${err.message})، دوباره بفرست در خدمتم!`;
    }

    // ۵. ذخیره در تاریخچه
    history.push({ role: "user", content: userMessage });
    history.push({ role: "assistant", content: result.text });
    this.storage.saveHistory(chatId, history).catch(() => {});

    return result;
  }
}
