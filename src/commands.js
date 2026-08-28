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
        [{ text: "📡 اسکن مدل‌های رایگان" }, { text: "💾 حافظه من" }],
        [{ text: "❓ راهنما" }]
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

    // تابع ارسال پیام کاملاً امن و ضد خطا (Safe Send)
    const sendMessage = async (replyText, replyMarkup = null) => {
      const payload = {
        chat_id: chatId,
        text: replyText,
        reply_markup: replyMarkup
      };

      try {
        let res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, parse_mode: "Markdown" })
        });
        let data = await res.json();
        
        // اگر تلگرام به علت خطای مارک‌داون ریجکت کرد، بدون مارک‌داون بفرست
        if (!data.ok) {
          res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
        }
      } catch (e) {}
    };

    // ۱. دستور /start
    if (cmd === "/start") {
      const welcome = `سلام ${senderName} جان! رفیق، من «${CONFIG.BOT_NAME}» هستم. 😎🤝

هر سوالی داری به زبان کاملاً طبیعی از من بپرس. از وضعیت آب‌وهوا و اخبار گرفته تا قیمت دلار و طلا، تحلیل عکس‌ها، برنامه‌نویسی و تحقیقات عمیق در خدمتم!

🔹 امکانات هوشمند و ویژه:
• 💬 چت صمیمی و باهوش با درک عمیق فارسی
• ⚡ پاسخ‌دهی فوق‌سریع با مدل‌های پیشرفته Gemini Flash
• 📡 کشف خودکار مدل‌های رایگان گوگل با دستور /scan
• 🔬 موتور تحقیق ۳ سطحی (ساده، قوی و عمیق)
• 📊 قیمت‌های لحظه‌ای بازار (دلار، طلا، سکه و کریپتو)
• 🖼 تحلیل تصویر (ارسال عکس با توضیح)

از کیبورد زیر یا منوی دستورات می‌تونی شروع کنی:`;
      await sendMessage(welcome, this.getMainKeyboard());
      return true;
    }

    // ۲. دکمه تحقیق یا دستور /research
    if (cmd === "🔬 تحقیق" || cmd === "/research") {
      const textPrompt = `🔬 بخش تحقیق تخصصی و عمیق فرامرز:

لطفاً سطح تحقیق مورد نظرتان را انتخاب کنید:
• ⚡ ساده: سوال‌های سریع روزمره
• 🔬 قوی: مسائل مقایسه‌ای و تحلیل‌های چندوجهی
• 🚀 خیلی قوی: تحقیق جامع و دانشگاهی`;
      await sendMessage(textPrompt, this.getResearchInlineKeyboard());
      return true;
    }

    // ۳. دستور /price و /rate و دکمه قیمت‌های لحظه‌ای
    if (cmd === "/price" || cmd === "/rate" || cmd === "📊 قیمت‌های لحظه‌ای") {
      const live = await this.liveInfo.checkQuickTriggers("دلار طلا سکه بیتکوین");
      await sendMessage(live.response || "دریافت قیمت‌ها مقدور نشد.");
      return true;
    }

    // ۴. دستور /scan یا دکمه اسکن مدل‌های رایگان
    if (cmd === "/scan" || cmd === "📡 اسکن مدل‌های رایگان" || cmd === "/syncmodels") {
      await sendMessage("⏳ در حال ارتباط با Google AI Studio و اسکن زنده تمامی مدل‌های رایگان...");
      
      const scanResult = await this.scanner.autoDiscoverAndScan();
      if (!scanResult.success) {
        await sendMessage(`❌ خطا در اسکن: ${scanResult.error}`);
        return true;
      }

      let rep = `📡 گزارش اسکن و کشف زنده مدل‌های گوگل:\n`;
      rep += `• مجموع مدل‌های بررسی شده: ${scanResult.totalScanned} مدل\n`;
      rep += `• مدل‌های فعال و رایگان: ${scanResult.freeModels.length} مدل\n\n`;

      if (scanResult.newlyDiscovered.length > 0) {
        rep += `🎉 مدل‌های جدید اضافه شده به ربات:\n`;
        scanResult.newlyDiscovered.forEach(n => {
          rep += `✨ ${n.id}\n`;
        });
        rep += `\n`;
      }

      rep += `🟢 لیست مدل‌های فعال و آماده استفاده:\n`;
      scanResult.freeModels.forEach((m, idx) => {
        rep += `${idx + 1}. ${m.id} — ${m.status}\n`;
      });

      await sendMessage(rep);
      return true;
    }

    // ۵. دستور /models و /models-list
    if (cmd === "/models" || cmd === "/models-list") {
      const active = await this.storage.getPrimaryModel();
      const allModels = await this.modelManager.getAllAvailableModels();

      let rep = `🔮 مدل‌های متصل و آماده استفاده:\n`;
      rep += `• مدل فعال فعلی: ${active}\n\n`;

      allModels.forEach((m, idx) => {
        rep += `${idx + 1}. ${m.name}\nشناسه: ${m.id}\n\n`;
      });

      await sendMessage(rep);
      return true;
    }

    // ۶. دستور /search
    if (cmd === "/search") {
      if (!args) {
        await sendMessage("لطفاً عبارت مورد نظر را وارد کنید:\nمثال: /search هوش مصنوعی");
        return true;
      }
      const results = await this.search.searchDuckDuckGo(args);
      if (results.length === 0) {
        await sendMessage("نتیجه‌ای برای جستجوی شما یافت نشد.");
        return true;
      }
      let rep = `🔍 نتایج جستجو برای: ${args}\n\n`;
      results.forEach((r, i) => {
        rep += `${i + 1}. ${r.title}\n${r.snippet}\n${r.link}\n\n`;
      });
      await sendMessage(rep);
      return true;
    }

    // ۷. دستور /browse
    if (cmd === "/browse") {
      if (!args || !args.startsWith("http")) {
        await sendMessage("لطفاً یک لینک معتبر ارسال کنید:\nمثال: /browse https://fa.wikipedia.org");
        return true;
      }
      const page = await this.browser.fetchAndClean(args);
      await sendMessage(`🌐 ${page.title}\n\n${page.content}`);
      return true;
    }

    // ۸. دستورات حافظه
    if (cmd === "/memory" || cmd === "💾 حافظه من") {
      const memContext = await this.memory.getMemoryContext(userId);
      await sendMessage(`💾 اطلاعات ثبت شده از شما در حافظه من:\n\n${memContext || "هنوز نکته‌ای ثبت نشده است. در چت خودتان را معرفی کنید یا از /remind استفاده کنید."}`);
      return true;
    }

    if (cmd === "/remind") {
      if (!args) {
        await sendMessage("لطفاً نکته مورد نظر را بنویسید:\nمثال: /remind من به یادگیری زبان علاقه دارم");
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

    // ۹. دستور /status
    if (cmd === "/status") {
      const botTokenSet = !!(await this.storage.getBotToken());
      const geminiSet = !!(await this.storage.getGeminiKey());
      const activeModel = await this.storage.getPrimaryModel();

      const rep = `⚡ وضعیت سلامت ربات فرامرز:
• سرویس: Cloudflare Workers (Edge Global)
• توکن ربات: ${botTokenSet ? 'متصل ✅' : 'ناموجود ❌'}
• کلید Gemini: ${geminiSet ? 'فعال ✅' : 'ناموجود ❌'}
• مدل فعال: ${activeModel}`;
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
      const help = `📖 راهنمای دستورات فرامرز:

• /start — شروع کار و بازنشانی کیبورد
• /scan — اسکن و ثبت تمام مدل‌های رایگان گوگل
• /models — لیست تمامی مدل‌های متصل
• /price — مشاهده قیمت‌های لحظه‌ای طلا، ارز و کریپتو
• /research — ورود به بخش تحقیق تخصصی ۳ سطحی
• /search <عبارت> — جستجو در وب
• /browse <آدرس وب> — استخراج متن صفحه اینترنتی
• /memory — مشاهده حافظه من
• /remind <نکته> — افزودن یادآوری به حافظه
• /forget — پاک‌کردن حافظه
• /status — وضعیت سرور و کلیدها
• /clear — پاکسازی تاریخچه مکالمه

👑 دستورات ویژه مالک:
• /admin — ورود به پنل مدیریت
• /settoken <توکن> — تنظیم فوری توکن تلگرام
• /setgemini <کلید> — تنظیم فوری کلید جمینای`;
      await sendMessage(help);
      return true;
    }

    return false;
  }
}
