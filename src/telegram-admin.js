import { CONFIG } from './config.js';
import { LiveInfoService } from './live-info.js';
import { MemoryService } from './memory.js';
import { ModelManager } from './model-manager.js';

export class TelegramAdmin {
  constructor(storage, env) {
    this.storage = storage;
    this.env = env;
    this.liveInfo = new LiveInfoService();
    this.memory = new MemoryService(storage.kv);
    this.modelManager = new ModelManager(storage);
  }

  // بررسی سطح دسترسی مالک
  isAdmin(userId) {
    return Number(userId) === CONFIG.OWNER_ID;
  }

  // ارسال پنل اصلی ادمین
  async sendAdminPanel(chatId, botToken) {
    const primaryModel = await this.storage.getPrimaryModel();
    const fastSearch = await this.modelManager.getFastSearchModel();

    const keyboard = {
      inline_keyboard: [
        [
          { text: "💰 قیمت‌های لحظه‌ای", callback_data: "adm_prices" },
          { text: "👥 کاربران ربات", callback_data: "adm_users" }
        ],
        [
          { text: "🔮 انتخاب مدل Gemini", callback_data: "adm_models" },
          { text: "💾 مدیریت حافظه‌ها", callback_data: "adm_memory" }
        ],
        [
          { text: "⚙️ تنظیمات و مشخصات", callback_data: "adm_settings" },
          { text: "📈 لاگ‌های سیستم", callback_data: "adm_logs" }
        ],
        [
          { text: "📡 اسکن و همگام‌سازی مدل‌های جدید", callback_data: "adm_scan_sync" }
        ]
      ]
    };

    const text = `👑 **پنل مدیریت فرامرز (Cloudflare Workers)**

• **مدل فعال چت:** \`${primaryModel}\`
• **مدل سریع سرچ:** \`${fastSearch}\`
• **وضعیت سرور:** آنلاین (Edge Network)
• **شناسه مالک:** \`${CONFIG.OWNER_ID}\`

برای مدیریت بخش‌های مختلف از دکمه‌های زیر استفاده کنید:`;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        reply_markup: keyboard
      })
    });
  }

  // پردازش رویدادهای کلیک روی دکمه‌های اینلاین
  async handleCallback(callbackQuery, botToken) {
    const userId = callbackQuery.from.id;
    if (!this.isAdmin(userId)) {
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQuery.id,
          text: "⛔ دسترسی غیرمجاز!",
          show_alert: true
        })
      });
      return;
    }

    const data = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;
    const chatId = callbackQuery.message.chat.id;

    // ۱. منوی انتخاب مدل‌های Gemini (شامل مدل‌های پیش‌فرض + مدل‌های کشف‌شده)
    if (data === "adm_models") {
      const currentModel = await this.storage.getPrimaryModel();
      const allAvailable = await this.modelManager.getAllAvailableModels();

      const buttons = allAvailable.map(m => ([{
        text: (m.id === currentModel ? "✅ " : "") + m.name,
        callback_data: `set_model:${m.id}`
      }]));

      buttons.push([{ text: "🔙 بازگشت به منوی اصلی", callback_data: "adm_main" }]);

      await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: `🔮 **انتخاب مدل هوش مصنوعی:**\nمدل فعال: \`${currentModel}\`\nتعداد کل مدل‌های در دسترس: ${allAvailable.length}\n\nبرای تغییر، روی مدل مورد نظر کلیک کنید:`,
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: buttons }
        })
      });
      return;
    }

    // تغییر مدل
    if (data.startsWith("set_model:")) {
      const selected = data.split(":")[1];
      if (this.storage.kv) {
        await this.storage.kv.put("config:primary_model", selected);
      }
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQuery.id,
          text: `مدل پیش‌فرض با موفقیت تغییر کرد به: ${selected}`,
          show_alert: true
        })
      });
      return this.handleCallback({ ...callbackQuery, data: "adm_models" }, botToken);
    }

    // ۲. نمایش قیمت‌ها
    if (data === "adm_prices") {
      const live = await this.liveInfo.checkQuickTriggers("قیمت دلار طلا کریپتو");
      const keyboard = {
        inline_keyboard: [
          [{ text: "🔄 تازه‌سازی قیمت‌ها", callback_data: "adm_prices" }],
          [{ text: "🔙 بازگشت", callback_data: "adm_main" }]
        ]
      };

      await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: live.response || "خطا در دریافت قیمت‌ها",
          parse_mode: "Markdown",
          reply_markup: keyboard
        })
      });
      return;
    }

    // ۳. لیست کاربران
    if (data === "adm_users") {
      const users = await this.storage.listUsers(20);
      let text = `👥 **لیست کاربران اخیر (${users.length} نفر):**\n\n`;
      if (users.length === 0) {
        text += "هنوز کاربری ثبت نشده است.";
      } else {
        users.forEach((u, i) => {
          text += `${i + 1}. **${u.first_name}** | \`${u.id}\` | ${u.username}\n`;
        });
      }

      await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 بازگشت", callback_data: "adm_main" }]]
          }
        })
      });
      return;
    }

    // ۴. لاگ‌های سیستم
    if (data === "adm_logs") {
      const logs = await this.storage.getLogs();
      let text = `📈 **لاگ‌های سیستم (${logs.length} رویداد اخیر):**\n\n`;
      if (logs.length === 0) {
        text += "هیچ خطایی یا رویدادی ثبت نشده است.";
      } else {
        logs.slice(-10).forEach(l => {
          text += `• \`${l.time.slice(11, 19)}\`: ${l.message}\n`;
        });
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: "🗑 پاک‌کردن لاگ‌ها", callback_data: "adm_clear_logs" }],
          [{ text: "🔙 بازگشت", callback_data: "adm_main" }]
        ]
      };

      await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: "Markdown",
          reply_markup: keyboard
        })
      });
      return;
    }

    // پاک کردن لاگ‌ها
    if (data === "adm_clear_logs") {
      await this.storage.clearLogs();
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQuery.id,
          text: "تمام لاگ‌ها پاک شدند.",
          show_alert: true
        })
      });
      return this.handleCallback({ ...callbackQuery, data: "adm_logs" }, botToken);
    }

    // ۵. تنظیمات
    if (data === "adm_settings") {
      const token = await this.storage.getBotToken();
      const geminiKey = await this.storage.getGeminiKey();

      const text = `⚙️ **تنظیمات و متغیرها:**

• **نام ربات:** ${CONFIG.BOT_NAME}
• **یوزرنیم:** @${CONFIG.BOT_USERNAME}
• **توکن فعلی:** \`${token ? token.slice(0, 6) + '...' + token.slice(-4) : 'تنظیم نشده'}\`
• **کلید جمینای:** \`${geminiKey ? geminiKey.slice(0, 6) + '...' + geminiKey.slice(-4) : 'تنظیم نشده'}\`

برای تغییر توکن از \`/settoken <توکن>\` و کلید جمینای از \`/setgemini <کلید>\` استفاده کنید.`;

      await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 بازگشت", callback_data: "adm_main" }]]
          }
        })
      });
      return;
    }

    // بازگشت به منوی اصلی
    if (data === "adm_main") {
      await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId })
      });
      await this.sendAdminPanel(chatId, botToken);
    }
  }
}
