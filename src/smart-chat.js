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

  // اجرای سرچ اختصاصی انتخابی (عمیق با deep-research-max یا سریع با gemini-2.5-flash-lite)
  async executeSearchMode(chatId, userId, query, modeKey = "fast") {
    const searchConfig = CONFIG.SEARCH_MODELS[modeKey] || CONFIG.SEARCH_MODELS.fast;
    const targetModel = searchConfig.model;

    const isDeep = (modeKey === "deep");
    const systemPrompt = isDeep 
      ? `${CONFIG.SYSTEM_PROMPT}\n\nدستور ویژه: این یک جستجوی تحلیلی و عمیق است. با دقت تمام منابع را بررسی کن، پاسخی جامع، دسته‌بندی‌شده و موشکافانه همراه با استناد دقیق ارائه کن.`
      : `${CONFIG.SYSTEM_PROMPT}\n\nدستور ویژه: این یک جستجوی سریع است. نکات کلیدی و اطلاعات مهم را خلاصه، مفید، روان و سریع بیان کن.`;

    const messages = [
      { role: "user", content: `جستجو و بررسی دقیق درباره:\n${query}` }
    ];

    const result = await callAI(messages, { model: targetModel, storage: this.storage }, systemPrompt, true);

    return {
      text: `${searchConfig.title}:\n\n${result.text}`,
      sources: result.sources || []
    };
  }

  // پردازش اصلی پیام چت به صورت تک‌مرحله‌ای با زنجیره مدل‌های Flash
  async processMessage(chatId, userId, userMessage, senderName = "کاربر") {
    this.autoExtractFacts(userId, userMessage).catch(() => {});

    // بررسی سریع قیمت‌ها
    const livePriceCheck = await this.liveInfo.checkQuickTriggers(userMessage);
    if (livePriceCheck.isHandled) {
      return { text: livePriceCheck.response, sources: [] };
    }

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

    let result = { text: "", sources: [] };
    try {
      result = await callAI(messages, {
        model: primaryModel,
        storage: this.storage
      }, dynamicSystemPrompt, true);
    } catch (err) {
      result.text = `رفیق متاسفانه ارتباط با سرور هوش مصنوعی برقرار نشد (${err.message})، دوباره بفرست در خدمتم!`;
    }

    history.push({ role: "user", content: userMessage });
    history.push({ role: "assistant", content: result.text });
    this.storage.saveHistory(chatId, history).catch(() => {});

    return result;
  }
}
