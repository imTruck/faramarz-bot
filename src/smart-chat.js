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

  // تشخیص هوشمند قصد تحقیق/سرچ و استخراج خودکار موضوع
  detectSearchIntent(text) {
    if (!text) return null;
    const clean = text.trim();

    // الگوهای رایج درخواست تحقیق در زبان فارسی
    // مثال: "راجب قاسم سلیمانی تحقیق کن"، "درباره هوش مصنوعی سرچ کن"، "تحقیق کن درباره بیتکوین"
    const patterns = [
      /(?:راجب|درباره|در\s+مورد|درخصوص)\s+(.+?)\s+(?:تحقیق\s+کن|سرچ\s+کن|جستجو\s+کن|بگو|توضیح\s+بده|اطلاعات\s+بده)/i,
      /(?:تحقیق\s+کن|سرچ\s+کن|جستجو\s+کن)\s+(?:راجب|درباره|در\s+مورد)\s+(.+)/i,
      /(?:تحقیق\s+کن|سرچ\s+کن|جستجو\s+کن)\s+(?:رو|روی|درمورد)\s+(.+)/i,
      /(?:تحقیق|سرچ|جستجو)\s+(?:درباره|راجب|در\s+مورد)\s+(.+)/i
    ];

    for (const pattern of patterns) {
      const match = clean.match(pattern);
      if (match && match[1]) {
        return match[1].replace(/[؟!.,،]+/g, "").trim();
      }
    }

    // اگر پیام مستقیماً با "تحقیق" یا "سرچ" شروع شد
    if (/^(?:تحقیق|سرچ|جستجو)\s+(.+)/i.test(clean)) {
      const match = clean.match(/^(?:تحقیق|سرچ|جستجو)\s+(.+)/i);
      if (match && match[1]) return match[1].trim();
    }

    return null;
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

  // اجرای سرچ با مدل انتخابی کاربر
  async executeSearchMode(chatId, userId, query, modeKey = "fast") {
    const isDeep = (modeKey === "deep");
    const targetModel = isDeep 
      ? "models/deep-research-max-preview-04-2026" 
      : "gemini-2.5-flash-lite";

    const title = isDeep 
      ? "🚀 گزارش تحقیق عمیق و جامع (Deep Research Max)" 
      : "⚡ گزارش تحقیق سریع (Gemini 2.5 Flash Lite)";

    const systemPrompt = isDeep 
      ? `${CONFIG.SYSTEM_PROMPT}\n\nدستور ویژه: این یک تحقیق عمیق و موشکافانه است. تمام جوانب موضوع، حقایق کلیدی، پیشینه، آمارها و تحلیل‌های مرتبط را به همراه مراجع کامل بنویس.`
      : `${CONFIG.SYSTEM_PROMPT}\n\nدستور ویژه: این یک تحقیق سریع است. نکات مهم، خلاصه ماجرا و اطلاعات اساسی را روان، صمیمی و سریع بنویس.`;

    const messages = [
      { role: "user", content: `تحقیق و بررسی کامل درباره موضوع زیر:\n${query}` }
    ];

    const result = await callAI(messages, { model: targetModel, storage: this.storage }, systemPrompt, true);

    return {
      title,
      text: `${title}:\n\n${result.text}`,
      sources: result.sources || [],
      modelUsed: result.modelUsed || targetModel
    };
  }

  // پردازش اصلی چت متنی عادی با زنجیره اولویت Flash
  async processMessage(chatId, userId, userMessage, senderName = "کاربر") {
    this.autoExtractFacts(userId, userMessage).catch(() => {});

    // پاسخ به قیمت‌ها
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
