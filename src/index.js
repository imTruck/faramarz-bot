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
        version: "3.0.0-dual-search"
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

    // ۴. پردازش اصلی پیام‌های تلگرام
    if (request.method === "POST") {
      const startTime = Date.now();
      try {
        const update = await request.json();
        const botToken = await storage.getBotToken();

        if (!botToken) {
          return new Response("Missing BOT_TOKEN", { status: 200 });
        }

        // ارسال لاگ ساختاریافته به پیوی مالک
        const sendOwnerLog = async (logText) => {
          try {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: CONFIG.OWNER_ID,
                text: logText
              })
            });
          } catch (e) {}
        };

        const admin = new TelegramAdmin(storage, env);
        const chat = new SmartChat(storage, env);
        const commands = new CommandHandler(storage, env);
        const imageService = new ImageService(storage);
        const groupService = new GroupService(env.KV_STORAGE);

        // ارسال پیام با مدیریت خودکار دکمه‌ها
        const sendTgMessage = async (chatId, text, replyMarkup = null) => {
          const safeText = (text && typeof text === 'string' && text.trim().length > 0) ? text.trim() : "سلام رفیق!";
          const payload = { chat_id: chatId, text: safeText };
          
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
              data = await res.json();

              if (!data.ok) {
                await sendOwnerLog(`❌ خطای ارسال پیام تلگرام:\n• کد: ${data.error_code}\n• علت: ${data.description}`);
                return null;
              }
            }
            return data.result;
          } catch (e) {
            await sendOwnerLog(`❌ خطای شبکه تلگرام: ${e.message}`);
            return null;
          }
        };

        // اکشن تایپینگ
        const targetChatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
        if (targetChatId) {
          fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: targetChatId, action: "typing" })
          }).catch(() => {});
        }

        // پردازش کلیک دکمه‌های اینلاین
        if (update.callback_query) {
          const cb = update.callback_query;
          const data = cb.data;
          const chatId = cb.message.chat.id;
          const userId = cb.from.id;
          const userName = [cb.from.first_name, cb.from.last_name].filter(Boolean).join(" ");
          const userTag = cb.from.username ? `@${cb.from.username}` : "ندارد";

          await sendOwnerLog(`🔘 [کلیک دکمه اینلاین]\n👤 کاربر: ${userName} (${userTag} | ID: ${userId})\n🔘 دکمه: ${data}\n📍 چت: ${chatId}`);

          // انتخاب نوع سرچ (عمیق vs سریع)
          if (data.startsWith("search_mode:")) {
            const mode = data.split(":")[1]; // 'deep' یا 'fast'
            await storage.setState(userId, `waiting_search:${mode}`);

            await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cb.id, text: "حالت سرچ انتخاب شد." })
            });

            const promptMsg = mode === "deep"
              ? `🚀 حالت سرچ طولانی و عمیق انتخاب شد:\nمدل: models/deep-research-max-preview-04-2026\n\nلطفاً موضوع یا سوال پژوهشی خود را ارسال کنید (مهلت: ۵ دقیقه):`
              : `⚡ حالت سرچ سریع و فوری انتخاب شد:\nمدل: gemini-2.5-flash-lite\n\nلطفاً عبارت مورد نظر را برای جستجو ارسال کنید:`;

            await sendTgMessage(chatId, promptMsg);
            return new Response("OK");
          }

          if (data === "search_cancel") {
            await storage.clearState(userId);
            await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cb.id, text: "لغو شد." })
            });
            await sendTgMessage(chatId, "عملیات جستجو لغو شد.");
            return new Response("OK");
          }

          await admin.handleCallback(cb, botToken);
          return new Response("OK");
        }

        const message = update.message;
        if (!message) return new Response("OK");

        const chatId = message.chat.id;
        const userId = message.from.id;
        const chatType = message.chat.type;
        const isGroup = chatType === "group" || chatType === "supergroup";
        const groupTitle = isGroup ? (message.chat.title || "گروه بدون نام") : null;
        
        const senderFullName = [message.from.first_name, message.from.last_name].filter(Boolean).join(" ") || "کاربر";
        const senderUsername = message.from.username ? `@${message.from.username}` : "ندارد";
        const text = message.text || message.caption || "";

        const locationInfo = isGroup 
          ? `👥 گروه: «${groupTitle}» (ID: ${chatId})` 
          : `👤 پیوی شخصی (Chat ID: ${chatId})`;

        storage.saveUserIdentity(message.from).catch(() => {});

        if (isGroup) {
          groupService.trackGroupMember(chatId, message.from).catch(() => {});
          const shouldReply = groupService.shouldRespondInGroup(message, CONFIG.BOT_USERNAME);
          if (!shouldReply) return new Response("OK");
        }

        // استیکر
        if (message.sticker) {
          const reactionEmoji = imageService.getRandomStickerReaction();
          await sendOwnerLog(`🎭 [استیکر]\n👤 ${senderFullName} (${senderUsername} | ID: ${userId})\n📍 ${locationInfo}\n✨ ری‌اکشن: ${reactionEmoji}`);
          
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
            await sendOwnerLog(`⛔ تلاش ورود به پنل ادمین توسط فرد غیرمجاز!\n👤 ${senderFullName} (${senderUsername} | ID: ${userId})\n📍 ${locationInfo}`);
            return new Response("OK");
          }
          await admin.sendAdminPanel(chatId, botToken);
          await sendOwnerLog(`👑 ورود مالک به پنل مدیریت.`);
          return new Response("OK");
        }

        if (text.startsWith("/settoken") && admin.isAdmin(userId)) {
          const parts = text.split(/\s+/);
          if (parts[1]) {
            const masked = await storage.setBotToken(parts[1]);
            await sendTgMessage(chatId, `✅ توکن ذخیره شد: ${masked}`);
            await sendOwnerLog(`🔑 تغییر توکن تلگرام توسط مالک: ${masked}`);
          }
          return new Response("OK");
        }

        if (text.startsWith("/setgemini") && admin.isAdmin(userId)) {
          const parts = text.split(/\s+/);
          if (parts[1]) {
            const masked = await storage.setGeminiKey(parts[1]);
            await sendTgMessage(chatId, `✅ کلید Gemini ذخیره شد: ${masked}`);
            await sendOwnerLog(`🔮 تغییر کلید Gemini توسط مالک: ${masked}`);
          }
          return new Response("OK");
        }

        // دستورات عمومی (/start, /search, /price, ...)
        if (text.startsWith("/")) {
          await sendOwnerLog(`⚙️ [اجرای دستور]\n👤 ${senderFullName} (${senderUsername} | ID: ${userId})\n📍 ${locationInfo}\n⚡ دستور: "${text}"`);
          const handled = await commands.handleCommand(chatId, userId, text, senderFullName, botToken);
          if (handled) return new Response("OK");
        }

        // پردازش حالت سرچ انتخابی (عمیق vs سریع)
        const userState = await storage.getState(userId);
        if (userState && userState.startsWith("waiting_search:")) {
          const searchMode = userState.split(":")[1]; // 'deep' یا 'fast'
          await storage.clearState(userId);

          const modelUsed = searchMode === "deep" ? "models/deep-research-max-preview-04-2026" : "gemini-2.5-flash-lite";
          await sendOwnerLog(`🔍 [شروع جستجوی انتخابی]\n👤 ${senderFullName} (ID: ${userId})\n📍 ${locationInfo}\n🎯 حالت: ${searchMode === 'deep' ? 'عمیق و با جزئیات' : 'سریع و فوری'}\n🔮 مدل: ${modelUsed}\n❓ پرسش: "${text}"`);

          const searchResult = await chat.executeSearchMode(chatId, userId, text, searchMode);
          let responseText = searchResult.text;
          if (searchResult.sources && searchResult.sources.length > 0) {
            responseText += "\n\n📚 منابع:\n" + searchResult.sources.map(s => `• ${s.title}: ${s.url}`).join("\n");
          }

          const sent = await sendTgMessage(chatId, responseText);
          const elapsed = Date.now() - startTime;
          await sendOwnerLog(`✅ [جستجو تکمیل شد]\n📍 ${locationInfo}\n⏱ زمان: ${elapsed}ms\n📩 تحویل: ${sent ? 'موفق' : 'ناموفق'}`);
          return new Response("OK");
        }

        // پردازش تصویر
        if (message.photo && message.photo.length > 0) {
          const photo = message.photo[message.photo.length - 1];
          await sendOwnerLog(`🖼 [دریافت تصویر]\n👤 ${senderFullName} (${senderUsername} | ID: ${userId})\n📍 ${locationInfo}\n💬 کپشن: "${message.caption || 'بدون کپشن'}"`);

          try {
            const { dataUri, prompt } = await imageService.processTelegramPhoto(photo.file_id, message.caption);
            const primaryModel = await storage.getPrimaryModel();
            const analysis = await callVision(dataUri, prompt, { model: primaryModel, storage }, CONFIG.SYSTEM_PROMPT);
            
            await sendTgMessage(chatId, `🖼 تحلیل تصویر:\n\n${analysis}`);
            const elapsed = Date.now() - startTime;
            await sendOwnerLog(`✅ [تحلیل تصویر تکمیل شد]\n📍 ${locationInfo}\n⏱ زمان: ${elapsed}ms`);
          } catch (err) {
            await sendTgMessage(chatId, `⚠️ خطا در پردازش تصویر: ${err.message}`);
            await sendOwnerLog(`❌ خطای Vision: ${err.message}\n📍 ${locationInfo}`);
          }
          return new Response("OK");
        }

        // چت متنی هوشمند (با اولویت مدل‌های Flash)
        if (text) {
          const primaryModel = await storage.getPrimaryModel();
          await sendOwnerLog(`📩 [پیام جدید چت]\n👤 ${senderFullName} (${senderUsername} | ID: ${userId})\n📍 ${locationInfo}\n💬 متن: "${text}"\n⚙️ مدل هدف: ${primaryModel}`);

          const chatResult = await chat.processMessage(chatId, userId, text, senderFullName);
          let replyText = chatResult.text;
          if (chatResult.sources && chatResult.sources.length > 0) {
            replyText += "\n\n📚 منابع:\n" + chatResult.sources.map(s => typeof s === 'string' ? `• ${s}` : `• ${s.title}: ${s.url}`).join("\n");
          }

          const sent = await sendTgMessage(chatId, replyText);
          const elapsed = Date.now() - startTime;

          if (sent) {
            await sendOwnerLog(`✅ [پاسخ چت تحویل شد]\n👤 ${senderFullName} (ID: ${userId})\n📍 ${locationInfo}\n⏱ زمان: ${elapsed}ms\n📝 پیش‌نمایش: "${replyText.slice(0, 70)}..."`);
          } else {
            await sendOwnerLog(`⚠️ [ارسال پاسخ چت ناموفق بود]\n👤 ${senderFullName} (ID: ${userId})\n📍 ${locationInfo}`);
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
