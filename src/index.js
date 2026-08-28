import { StorageService } from './storage.js';
import { SmartChat } from './smart-chat.js';
import { TelegramAdmin } from './telegram-admin.js';
import { CommandHandler } from './commands.js';
import { ImageService } from './image.js';
import { GroupService } from './group.js';
import { CONFIG } from './config.js';
import { renderAdminDashboard } from './admin-html.js';
import { callVision } from './api.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const storage = new StorageService(env);
    const contentType = request.headers.get("content-type") || "";

    // ۱. مسیر تشخیصی سلامت (/debug)
    if (url.pathname === "/debug") {
      let kvWorking = false;
      try {
        if (env.KV_STORAGE) {
          await env.KV_STORAGE.put("debug:ping", "pong", { expirationTtl: 60 });
          const val = await env.KV_STORAGE.get("debug:ping");
          kvWorking = (val === "pong");
        }
      } catch (e) {
        kvWorking = false;
      }

      const botToken = await storage.getBotToken();
      const geminiKey = await storage.getGeminiKey();
      const primaryModel = await storage.getPrimaryModel();
      const logs = await storage.getLogs();

      let tgWebhookInfo = null;
      if (botToken) {
        try {
          const whRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
          tgWebhookInfo = await whRes.json();
        } catch (e) {
          tgWebhookInfo = { error: e.message };
        }
      }

      return new Response(JSON.stringify({
        status: "Online",
        timestamp: new Date().toISOString(),
        bindings: {
          kv_storage_bound: !!env.KV_STORAGE,
          kv_read_write_verified: kvWorking,
          has_bot_token: !!botToken,
          has_gemini_key: !!geminiKey,
          primary_model: primaryModel
        },
        telegram_webhook: tgWebhookInfo,
        recent_logs: logs.slice(-15),
        version: "2.7.0-detail-logger"
      }, null, 2), {
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // ۲. مسیر داشبورد وب
    if ((url.pathname === "/admin" || url.pathname === "/setup" || url.pathname === "/") && request.method === "GET") {
      let kvWorking = false;
      try {
        if (env.KV_STORAGE) {
          await env.KV_STORAGE.put("debug:test", "1", { expirationTtl: 60 });
          kvWorking = true;
        }
      } catch (e) {}

      const hasToken = !!(await storage.getBotToken());
      const hasGemini = !!(await storage.getGeminiKey());
      const primaryModel = await storage.getPrimaryModel();

      const html = renderAdminDashboard({ primaryModel, hasToken, hasGemini, kvWorking });
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // ۳. فرم ذخیره کلیدها
    if ((url.pathname === "/setup" || contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) && request.method === "POST") {
      try {
        const formData = await request.formData();
        let botTokenInput = formData.get("bot_token")?.trim() || "";
        let geminiKeyInput = formData.get("gemini_key")?.trim() || "";

        let message = "";
        if (botTokenInput) {
          const cleanToken = botTokenInput.replace(/^bot/i, "").trim();
          await storage.setBotToken(cleanToken);
          const webhookUrl = `${url.origin}/`;
          await fetch(`https://api.telegram.org/bot${cleanToken}/setWebhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: webhookUrl })
          });
          message += `✅ توکن تلگرام و وِبهوک فعال شدند.<br>`;
        }

        if (geminiKeyInput) {
          await storage.setGeminiKey(geminiKeyInput);
          message += `✅ کلید Gemini ذخیره شد.<br>`;
        }

        const hasToken = !!(await storage.getBotToken());
        const hasGemini = !!(await storage.getGeminiKey());
        const primaryModel = await storage.getPrimaryModel();

        const html = renderAdminDashboard({
          primaryModel,
          hasToken: hasToken || !!botTokenInput,
          hasGemini: hasGemini || !!geminiKeyInput,
          kvWorking: true,
          message: message + "🎉 ربات آماده است."
        });

        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      } catch (err) {
        return new Response(`خطا: ${err.message}`, { status: 500 });
      }
    }

    // ۴. پردازش اصلی پیام‌های تلگرام با سیستم لاگ فوق‌العاده جزئی
    if (request.method === "POST") {
      try {
        const update = await request.json();
        const botToken = await storage.getBotToken();

        if (!botToken) {
          return new Response("Missing BOT_TOKEN", { status: 200 });
        }

        // تابع ارسال لاگ زنده به پیوی مالک
        const sendOwnerLog = async (logText) => {
          try {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: CONFIG.OWNER_ID,
                text: `📋 [لاگ فرامرز]\n${logText}`
              })
            });
          } catch (e) {}
        };

        const admin = new TelegramAdmin(storage, env);
        const chat = new SmartChat(storage, env);
        const commands = new CommandHandler(storage, env);
        const imageService = new ImageService(storage);
        const groupService = new GroupService(env.KV_STORAGE);

        // تابع ارسال پیام به تلگرام با گزارش دقیق خطا در صورت عدم موفقیت
        const sendTgMessage = async (chatId, text, replyMarkup = null) => {
          const safeText = (text && typeof text === 'string' && text.trim().length > 0) ? text.trim() : "سلام رفیق! پیام دریافت شد ولی خروجی متنی تولید نشد.";
          const payload = { chat_id: chatId, text: safeText, reply_markup: replyMarkup };

          try {
            let res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...payload, parse_mode: "Markdown" })
            });

            let data = await res.json();
            if (!data.ok) {
              // تلاش مجدد بدون مارک‌داون
              res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
              });
              data = await res.json();

              if (!data.ok) {
                await sendOwnerLog(`❌ خطای قطعی ارسال تلگرام:\nکد: ${data.error_code}\nپیام: ${data.description}\nمتن پیام ارسالی: "${safeText.slice(0, 100)}..."`);
                return null;
              }
            }
            return data.result;
          } catch (e) {
            await sendOwnerLog(`❌ خطای شبکه در ارسال پیام: ${e.message}`);
            return null;
          }
        };

        // اکشن در حال تایپ
        const targetChatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
        if (targetChatId) {
          fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: targetChatId, action: "typing" })
          }).catch(() => {});
        }

        // پردازش دکمه‌های اینلاین
        if (update.callback_query) {
          const cb = update.callback_query;
          const data = cb.data;
          const chatId = cb.message.chat.id;
          const userId = cb.from.id;

          await sendOwnerLog(`🔘 دکمه کلیک شد: ${data} (توسط کاربر: ${userId})`);

          if (data.startsWith("research_tier:")) {
            const tier = data.split(":")[1];
            await storage.setState(userId, `waiting_research:${tier}`);

            await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cb.id, text: "سطح تحقیق انتخاب شد." })
            });

            await sendTgMessage(chatId, `🔬 سطح تحقیق انتخاب شد: ${tier}\n\nلطفاً سوال پژوهشی خود را ارسال کنید:`);
            return new Response("OK");
          }

          if (data === "research_cancel") {
            await storage.clearState(userId);
            await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cb.id, text: "لغو شد." })
            });
            await sendTgMessage(chatId, "عملیات تحقیق لغو شد.");
            return new Response("OK");
          }

          await admin.handleCallback(cb, botToken);
          return new Response("OK");
        }

        const message = update.message;
        if (!message) return new Response("OK");

        const chatId = message.chat.id;
        const userId = message.from.id;
        const isGroup = message.chat.type === "group" || message.chat.type === "supergroup";
        const senderName = message.from.first_name || "رفیق";
        const text = message.text || message.caption || "";

        storage.saveUserIdentity(message.from).catch(() => {});

        if (isGroup) {
          groupService.trackGroupMember(chatId, message.from).catch(() => {});
          const shouldReply = groupService.shouldRespondInGroup(message, CONFIG.BOT_USERNAME);
          if (!shouldReply) return new Response("OK");
        }

        // استیکر
        if (message.sticker) {
          const reactionEmoji = imageService.getRandomStickerReaction();
          await fetch(`https://api.telegram.org/bot${botToken}/setMessageReaction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: message.message_id,
              reaction: [{ type: "emoji", emoji: reactionEmoji }]
            })
          });
          return new Response("OK");
        }

        // دستورات ادمین
        if (text.startsWith("/admin")) {
          if (!admin.isAdmin(userId)) {
            await sendTgMessage(chatId, "⛔ دسترسی غیرمجاز.");
            return new Response("OK");
          }
          await admin.sendAdminPanel(chatId, botToken);
          return new Response("OK");
        }

        if (text.startsWith("/settoken") && admin.isAdmin(userId)) {
          const parts = text.split(/\s+/);
          if (parts[1]) {
            const masked = await storage.setBotToken(parts[1]);
            await sendTgMessage(chatId, `✅ توکن ذخیره شد: ${masked}`);
          }
          return new Response("OK");
        }

        if (text.startsWith("/setgemini") && admin.isAdmin(userId)) {
          const parts = text.split(/\s+/);
          if (parts[1]) {
            const masked = await storage.setGeminiKey(parts[1]);
            await sendTgMessage(chatId, `✅ کلید Gemini ذخیره شد: ${masked}`);
          }
          return new Response("OK");
        }

        // دستورات عمومی (/start, /price, /help, ...)
        if (text.startsWith("/")) {
          await sendOwnerLog(`⚙️ اجرای دستور: "${text}" توسط ${senderName}`);
          const handled = await commands.handleCommand(chatId, userId, text, senderName, botToken);
          if (handled) return new Response("OK");
        }

        // چت متنی هوشمند
        if (text) {
          await sendOwnerLog(`🧠 شروع تولید پاسخ هوش مصنوعی برای: "${text}"`);

          const chatResult = await chat.processMessage(chatId, userId, text, senderName);
          let replyText = chatResult.text;
          if (chatResult.sources && chatResult.sources.length > 0) {
            replyText += "\n\n📚 منابع:\n" + chatResult.sources.map(s => typeof s === 'string' ? `• ${s}` : `• ${s.title}: ${s.url}`).join("\n");
          }

          await sendOwnerLog(`📝 متن پاسخ آماده شد (${replyText.length} کاراکتر):\n"${replyText.slice(0, 80)}..."`);

          const sent = await sendTgMessage(chatId, replyText);
          if (sent) {
            await sendOwnerLog(`✅ پاسخ با موفقیت در چت تحویل داده شد (Message ID: ${sent.message_id})`);
          }
        }

        return new Response("OK");
      } catch (error) {
        await storage.addLog(`Webhook error: ${error.message}`);
        return new Response(`Error: ${error.message}`, { status: 200 });
      }
    }

    return new Response("🤖 Faramarz Telegram Bot Worker is Active.", { status: 200 });
  }
};
