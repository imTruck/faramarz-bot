import { CONFIG } from './config.js';
import { MemoryService } from './memory.js';
import { LiveInfoService } from './live-info.js';
import { SearchService } from './search.js';
import { BrowserService } from './browser.js';
import { ApiScanner } from './api-scanner.js';
import { ModelManager } from './model-manager.js';

export class CommandHandler {
  constructor(storage, env) {
    this.storage = storage;
    this.env = env;
    this.memory = new MemoryService(storage.kv);
    this.liveInfo = new LiveInfoService();
    this.search = new SearchService();
    this.browser = new BrowserService();
    this.scanner = new ApiScanner(storage);
    this.modelManager = new ModelManager(storage);
  }

  // کیبورد پیش‌فرض اصلی ربات
  getMainKeyboard() {
    return {
      keyboard: [
        [{ text: "🔬 تحقیق" }, { text: "📊 قیمت‌های لحظه‌ای" }],
        [{ text: "💾 حافظه من" }, { text: "❓ راهنما" }]
      ],
      resize_keyboard: true
    };
  }

  // ارسال منوی سطوح تحقیق
  getResearchInlineKeyboard() {
    return {
      inline_keyboard: [
        [{ text: "⚡ تحقیق ساده (سریع)", callback_data: "research_tier:simple" }],
        [{ text: "🔬 تحقیق قوی (تحلیلی)", callback_data: "research_tier:strong" }],
        [{ text: "🚀 تحقیق خیلی قوی (عمیق و جامع)", callback_data: "research_tier:max" }],
        [{ text: "❌ انصراف", callback_data: "research_cancel" }]
      ]
    };
  }

  // پردازش دستورات
  async handleCommand(chatId, userId, text, senderName, botToken) {
    const parts = text.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(" ");

    const sendMessage = async (replyText, replyMarkup = null, parseMode = "Markdown") => {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: replyText,
          parse_mode: parseMode,
          reply_markup: replyMarkup
        })
      });
    };

    // ۱. دستور /start
    if (cmd === "/start") {
      const welcome = `سلام ${senderName} جان! رفیق، من **«${CONFIG.BOT_NAME}»** هستم. 😎🤝

هر سوالی داری به زبان کاملاً طبیعی از من بپرس. از وضعیت آب‌وهوا و اخبار گرفته تا قیمت دلار و طلا، تحلیل عکس‌ها، برنامه‌نویسی و تحقیقات عمیق در خدمتم!

🔹 **امکانات ویژه:**
• 💬 **چت صمیمی و باهوش:** با حافظه پایدار و درک متون فارسی
• 🔬 **موتور تحقیق ۳ سطحی:** با کلیک روی دکمه تحقیق
• 📊 **قیمت‌های لحظه‌ای:** دلار، طلا، سکه و کریپتو
• 🖼 **تحلیل تصویر:** ارسال عکس با کپشن برای توضیح و OCR
• 🔍 **جستجوی وب خودکار:** استخراج منابع معتبر و لینک‌ها

از کیبورد زیر یا منوی دستورات می‌تونی شروع کنی:`;
      await sendMessage(welcome, this.getMainKeyboard());
      return true;
    }

    // ۲. دکمه تحقیق یا دستور /research
    if (cmd === "🔬 تحقیق" || cmd === "/research") {
      const textPrompt = `🔬 **بخش تحقیق تخصصی و عمیق فرامرز:**

لطفاً سطح تحقیق مورد نظرتان را انتخاب کنید:
• **⚡ ساده:** سوال‌های سریع روزمره با مدل سریع
• **🔬 قوی:** مسائل مقایسه‌ای و تحلیل‌های چندوجهی
• **🚀 خیلی قوی:** تحقیق جامع، دانشگاهی و استنادی`;
      await sendMessage(textPrompt, this.getResearchInlineKeyboard());
      return true;
    }

    // ۳. دستور /price و /rate و دکمه قیمت‌های لحظه‌ای
    if (cmd === "/price" || cmd === "/rate" || cmd === "📊 قیمت‌های لحظه‌ای") {
      const live = await this.liveInfo.checkQuickTriggers("دلار طلا سکه بیتکوین");
      await sendMessage(live.response || "دریافت قیمت‌ها مقدور نشد.");
      return true;
    }

    // ۴. دستور /search
    if (cmd === "/search") {
      if (!args) {
        await sendMessage("لطفاً عبارت مورد نظر را وارد کنید:\nمثال: `/search هوش مصنوعی در سال ۲۰۲۶`");
        return true;
      }
      const results = await this.search.searchDuckDuckGo(args);
      if (results.length === 0) {
        await sendMessage("نتیجه‌ای برای جستجوی شما یافت نشد.");
        return true;
      }
      let rep = `🔍 **نتایج جستجو برای:** \`${args}\`\n\n`;
      results.forEach((r, i) => {
        rep += `${i + 1}. [${r.title}](${r.link})\n${r.snippet}\n\n`;
      });
      await sendMessage(rep);
      return true;
    }

    // ۵. دستور /browse
    if (cmd === "/browse") {
      if (!args || !args.startsWith("http")) {
        await sendMessage("لطفاً یک لینک معتبر ارسال کنید:\nمثال: `/browse https://fa.wikipedia.org`");
        return true;
      }
      const page = await this.browser.fetchAndClean(args);
      await sendMessage(`🌐 **${page.title}**\n\n${page.content}`);
      return true;
    }

    // ۶. دستورات حافظه (/memory, /remind, /forget)
    if (cmd === "/memory" || cmd === "💾 حافظه من") {
      const memContext = await this.memory.getMemoryContext(userId);
      await sendMessage(`💾 **اطلاعات ثبت شده از شما در حافظه من:**\n\n${memContext || "هنوز نکته‌ای در حافظه ثبت نشده است. کافیست در چت خودتان را معرفی کنید یا از دستور /remind استفاده کنید."}`);
      return true;
    }

    if (cmd === "/remind") {
      if (!args) {
        await sendMessage("لطفاً نکته مورد نظر را بنویسید:\nمثال: `/remind من به یادگیری زبان علاقه دارم`");
        return true;
      }
      await this.memory.addFact(userId, args);
      await sendMessage("✅ این نکته در حافظه من ثبت شد رفیق!");
      return true;
    }

    if (cmd === "/forget") {
      await this.memory.clearUserMemory(userId);
      await this.storage.clearHistory(chatId);
      await sendMessage("🧹 تمام اطلاعات حافظه و تاریخچه پیام‌های شما با موفقیت پاک شد.");
      return true;
    }

    // ۷. دستور /scan
    if (cmd === "/scan") {
      await sendMessage("⏳ در حال اسکن وضعیت مدل‌های متصل...");
      const scanResult = await this.scanner.scanAll(CONFIG.GEMINI_MODELS);
      if (!scanResult.success) {
        await sendMessage(`خطا: ${scanResult.error}`);
        return true;
      }
      let rep = "📡 **گزارش وضعیت مدل‌ها:**\n\n";
      scanResult.results.forEach(r => {
        rep += `• \`${r.model}\`: ${r.message}\n`;
      });
      await sendMessage(rep);
      return true;
    }

    // ۸. دستور /models و /models-list
    if (cmd === "/models" || cmd === "/models-list") {
      const active = await this.storage.getPrimaryModel();
      let rep = `🔮 **مدل‌های پشتیبانی شده:**\nمدل فعال فعلی: \`${active}\`\n\n`;
      CONFIG.GEMINI_MODELS.forEach((m, idx) => {
        rep += `${idx + 1}. **${m.name}**\nشناسه: \`${m.id}\`\n\n`;
      });
      await sendMessage(rep);
      return true;
    }

    // ۹. دستور /status
    if (cmd === "/status") {
      const botTokenSet = !!(await this.storage.getBotToken());
      const geminiSet = !!(await this.storage.getGeminiKey());
      const activeModel = await this.storage.getPrimaryModel();

      const rep = `⚡ **وضعیت سلامت ربات فرامرز:**
• سرویس: Cloudflare Workers (Edge Global)
• پایگاه داده: Cloudflare KV Storage
• توکن ربات: ${botTokenSet ? 'متصل ✅' : 'ناموجود ❌'}
• کلید Gemini: ${geminiSet ? 'فعال ✅' : 'ناموجود ❌'}
• مدل اصلی فعال: \`${activeModel}\``;
      await sendMessage(rep);
      return true;
    }

    // ۱۰. دستور /clear
    if (cmd === "/clear") {
      await this.storage.clearHistory(chatId);
      await sendMessage("🧹 تاریخچه مکالمه این چت پاک شد.");
      return true;
    }

    // ۱۱. دستور /help و دکمه راهنما
    if (cmd === "/help" || cmd === "❓ راهنما") {
      const help = `📖 **راهنمای جامع دستورات فرامرز:**

• /start — شروع کار و بازنشانی کیبورد
• /price یا /rate — مشاهده قیمت‌های لحظه‌ای بازار
• /research — ورود به بخش تحقیق تخصصی ۳ سطحی
• /search <عبارت> — جستجو در وب
• /browse <آدرس وب> — استخراج متن صفحه اینترنتی
• /memory — مشاهده موارد ثبت‌شده در حافظه
• /remind <نکته> — افزودن یادآوری به حافظه
• /forget — پاک‌کردن کامل حافظه و تاریخچه
• /scan — اسکن و تست وضعیت ارتباط با مدل‌ها
• /models — لیست تمام مدل‌های جمینای
• /status — وضعیت سرور و کلیدها
• /clear — پاکسازی تاریخچه مکالمه جاری

👑 **دستورات ویژه مالک:**
• /admin — ورود به پنل اینلاین مدیریت
• /settoken <توکن> — تنظیم فوری توکن تلگرام در KV
• /setgemini <کلید> — تنظیم فوری کلید جمینای در KV`;
      await sendMessage(help);
      return true;
    }

    return false;
  }
}
