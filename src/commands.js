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
        [{ text: "🔍 سرچ و تحقیق" }, { text: "📊 قیمت‌های لحظه‌ای" }],
        [{ text: "📡 اسکن مدل‌های رایگان" }, { text: "💾 حافظه من" }],
        [{ text: "❓ راهنما" }]
      ],
      resize_keyboard: true
    };
  }

  // ارسال منوی انتخاب نوع سرچ (عمیق vs سریع)
  getSearchModeKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🚀 سرچ طولانی و با جزئیات (عمیق)", callback_data: "search_mode:deep" }
        ],
        [
          { text: "⚡ سرچ سریع و فوری (خلاصه)", callback_data: "search_mode:fast" }
        ],
        [
          { text: "❌ انصراف", callback_data: "search_cancel" }
        ]
      ]
    };
  }

  // پردازش دستورات
  async handleCommand(chatId, userId, text, senderName, botToken) {
    const parts = text.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(" ");

    // تابع ارسال پیام کاملاً امن و ضد خطا
    const sendMessage = async (replyText, replyMarkup = null) => {
      const payload = { chat_id: chatId, text: replyText };
      if (replyMarkup && typeof replyMarkup === 'object') {
        payload.reply_markup = replyMarkup;
      }

      try {
        let res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, parse_mode: "Markdown" })
        });
        let data = await res.json();
        
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

🔹 امکانات هوشمند:
• 💬 چت هوشمند با زنجیره مدل‌های Gemini Flash
• 🔍 سرچ دوگانه: سرچ عمیق و با جزئیات (Deep Research Max) یا سرچ سریع (Gemini Flash Lite)
• 📊 قیمت‌های لحظه‌ای بازار (دلار، طلا، سکه، کریپتو)
• 📡 اسکن و همگام‌سازی زنده مدل‌های رایگان گوگل
• 🖼 تحلیل و ترجمه تصاویر

از کیبورد زیر یا منوی دستورات شروع کن:`;
      await sendMessage(welcome, this.getMainKeyboard());
      return true;
    }

    // ۲. دکمه سرچ و تحقیق یا دستور /search و /research
    if (cmd === "🔍 سرچ و تحقیق" || cmd === "🔬 تحقیق" || cmd === "/search" || cmd === "/research") {
      const promptText = `🔍 چه نوع سرچ یا تحقیقی مد نظرتان است؟

۱. 🚀 سرچ طولانی و با جزئیات (عمیق)
مدل: models/deep-research-max-preview-04-2026
کاربرد: بررسی جامع، تحلیل موشکافانه و استخراج کامل منابع وب

۲. ⚡ سرچ سریع و فوری (خلاصه)
مدل: gemini-2.5-flash-lite
کاربرد: پاسخ فوق‌سریع در چند ثانیه و نکات کلیدی با منابع

یکی از گزینه‌های زیر را انتخاب کنید:`;
      await sendMessage(promptText, this.getSearchModeKeyboard());
      return true;
    }

    // ۳. دستور /price و دکمه قیمت‌های لحظه‌ای
    if (cmd === "/price" || cmd === "/rate" || cmd === "📊 قیمت‌های لحظه‌ای") {
      const live = await this.liveInfo.checkQuickTriggers("دلار طلا سکه بیتکوین");
      await sendMessage(live.response || "دریافت قیمت‌ها مقدور نشد.");
      return true;
    }

    // ۴. دستور /scan
    if (cmd === "/scan" || cmd === "📡 اسکن مدل‌های رایگان" || cmd === "/syncmodels") {
      await sendMessage("⏳ در حال اسکن زنده مدل‌های Google AI Studio...");
      
      const scanResult = await this.scanner.autoDiscoverAndScan();
      if (!scanResult.success) {
        await sendMessage(`❌ خطا در اسکن: ${scanResult.error}`);
        return true;
      }

      let rep = `📡 گزارش اسکن مدل‌های فعال:\n`;
      rep += `• مجموع مدل‌های بررسی شده: ${scanResult.totalScanned} مدل\n`;
      rep += `• مدل‌های فعال و رایگان: ${scanResult.freeModels.length} مدل\n\n`;

      if (scanResult.newlyDiscovered.length > 0) {
        rep += `🎉 مدل‌های جدید اضافه شده به ربات:\n`;
        scanResult.newlyDiscovered.forEach(n => {
          rep += `✨ ${n.id}\n`;
        });
        rep += `\n`;
      }

      rep += `🟢 لیست مدل‌های فعال:\n`;
      scanResult.freeModels.forEach((m, idx) => {
        rep += `${idx + 1}. ${m.id} — ${m.status}\n`;
      });

      await sendMessage(rep);
      return true;
    }

    // ۵. دستور /models
    if (cmd === "/models" || cmd === "/models-list") {
      const active = await this.storage.getPrimaryModel();
      const allModels = await this.modelManager.getAllAvailableModels();

      let rep = `🔮 مدل‌های چت و سرچ فعال:\n`;
      rep += `• مدل اصلی فعال: ${active}\n`;
      rep += `• مدل سرچ عمیق: models/deep-research-max-preview-04-2026\n`;
      rep += `• مدل سرچ سریع: gemini-2.5-flash-lite\n\n`;

      allModels.forEach((m, idx) => {
        rep += `${idx + 1}. ${m.name}\nشناسه: ${m.id}\n\n`;
      });

      await sendMessage(rep);
      return true;
    }

    // ۶. دستور /browse
    if (cmd === "/browse") {
      if (!args || !args.startsWith("http")) {
        await sendMessage("لطفاً یک لینک معتبر ارسال کنید:\nمثال: /browse https://fa.wikipedia.org");
        return true;
      }
      const page = await this.browser.fetchAndClean(args);
      await sendMessage(`🌐 ${page.title}\n\n${page.content}`);
      return true;
    }

    // ۷. دستورات حافظه
    if (cmd === "/memory" || cmd === "💾 حافظه من") {
      const memContext = await this.memory.getMemoryContext(userId);
      await sendMessage(`💾 اطلاعات ثبت شده از شما در حافظه من:\n\n${memContext || "هنوز نکته‌ای ثبت نشده است. در چت خودتان را معرفی کنید یا از /remind استفاده کنید."}`);
      return true;
    }

    if (cmd === "/remind") {
      if (!args) {
        await sendMessage("لطفاً نکته مورد نظر را بنویسید:\nمثال: /remind من برنامه‌نویس هستم");
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

    // ۸. دستور /status
    if (cmd === "/status") {
      const botTokenSet = !!(await this.storage.getBotToken());
      const geminiSet = !!(await this.storage.getGeminiKey());
      const activeModel = await this.storage.getPrimaryModel();

      const rep = `⚡ وضعیت سلامت ربات فرامرز:
• سرویس: Cloudflare Workers
• توکن ربات: ${botTokenSet ? 'متصل ✅' : 'ناموجود ❌'}
• کلید Gemini: ${geminiSet ? 'فعال ✅' : 'ناموجود ❌'}
• مدل اصلی چت: ${activeModel}
• موتور سرچ عمیق: deep-research-max
• موتور سرچ سریع: gemini-2.5-flash-lite`;
      await sendMessage(rep);
      return true;
    }

    // ۹. دستور /clear
    if (cmd === "/clear") {
      await this.storage.clearHistory(chatId);
      await sendMessage("🧹 تاریخچه مکالمه این چت پاک شد.");
      return true;
    }

    // ۱۰. دستور /help
    if (cmd === "/help" || cmd === "❓ راهنما") {
      const help = `📖 راهنمای دستورات فرامرز:

• /start — شروع کار و بازنشانی کیبورد
• /search — منوی انتخاب سرچ عمیق (Deep Research) یا سرچ سریع
• /scan — اسکن و ثبت تمام مدل‌های رایگان گوگل
• /models — لیست تمامی مدل‌های متصل
• /price — مشاهده قیمت‌های لحظه‌ای بازار
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
