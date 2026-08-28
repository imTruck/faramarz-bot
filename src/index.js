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

    // ۱. مسیر تشخیصی سلامت و وضعیت دقیق وِبهوک تلگرام (/debug)
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
        version: "2.3.0-animated-edge"
      }, null, 2), {
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // ۲. مسیر صفحه راه‌اندازی و داشبورد تحت وب (GET /setup یا GET /admin یا GET /)
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

    // ۳. پردازش فرم تحت وب راه‌اندازی (POST /setup)
    if ((url.pathname === "/setup" || contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) && request.method === "POST") {
      try {
        const formData = await request.formData();
        let botTokenInput = formData.get("bot_token")?.trim() || "";
        let geminiKeyInput = formData.get("gemini_key")?.trim() || "";

        let message = "";
        let isSuccess = true;

        if (botTokenInput) {
          const cleanToken = botTokenInput.replace(/^bot/i, "").trim();
          await storage.setBotToken(cleanToken);

          const webhookUrl = `${url.origin}/`;
          const tgWebhookUrl = `https://api.telegram.org/bot${cleanToken}/setWebhook`;
          
          try {
            const webhookRes = await fetch(tgWebhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: webhookUrl })
            });
            const webhookData = await webhookRes.json();

            if (webhookData.ok) {
              message += `✅ توکن تلگرام ذخیره شد و <b>وبهوک تلگرام با موفقیت ست گردید</b>!<br>`;
            } else {
              isSuccess = false;
              message += `⚠️ خطا در ست کردن وبهوک تلگرام: <code>${webhookData.description}</code><br>`;
            }
          } catch (netErr) {
            message += `⚠️ خطا در ارتباط با تلگرام: ${netErr.message}<br>`;
          }
        }

        if (geminiKeyInput) {
          await storage.setGeminiKey(geminiKeyInput);
          message += `✅ کلید Gemini API با موفقیت ذخیره شد!<br>`;
        }

        if (isSuccess) {
          message += `🎉 <b>تبریک! ربات فرامرز آماده است. وارد تلگرام شوید و دستور /start را بفرستید.</b>`;
        }

        const hasToken = !!(await storage.getBotToken());
        const hasGemini = !!(await storage.getGeminiKey());
        const primaryModel = await storage.getPrimaryModel();

        const html = renderAdminDashboard({
          primaryModel,
          hasToken: hasToken || !!botTokenInput,
          hasGemini: hasGemini || !!geminiKeyInput,
          kvWorking: !!env.KV_STORAGE || true,
          message
        });

        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      } catch (err) {
        return new Response(`خطا: ${err.message}`, { status: 500 });
      }
    }

    // ۴. پردازش اصلی پیام‌های Webhook تلگرام (JSON POST)
    if (request.method === "POST") {
      try {
        const update = await request.json();
        const botToken = await storage.getBotToken();

        if (!botToken) {
          return new Response("Missing BOT_TOKEN", { status: 200 });
        }

        const admin = new TelegramAdmin(storage, env);
        const chat = new SmartChat(storage, env);
        const commands = new CommandHandler(storage, env);
        const imageService = new ImageService(storage);
        const groupService = new GroupService(env.KV_STORAGE);

        // ارسال اکشن در حال تایپ
        const sendTyping = (chatId) => {
          fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, action: "typing" })
          }).catch(() => {});
        };

        // ارسال پیام ساده جدید
        const sendTgMessage = async (chatId, text, replyMarkup = null, parseMode = "Markdown") => {
          const payload = { chat_id: chatId, text, reply_markup: replyMarkup };
          if (parseMode) payload.parse_mode = parseMode;

          let res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          let data = await res.json();
          if (!data.ok) {
            delete payload.parse_mode;
            res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            data = await res.json();
          }
          return data.result;
        };

        // ویرایش پیام اولیه با انیمیشن و پاسخ نهایی (Edit Message)
        const editTgMessage = async (chatId, messageId, text, replyMarkup = null, parseMode = "Markdown") => {
          const payload = {
            chat_id: chatId,
            message_id: messageId,
            text,
            reply_markup: replyMarkup
          };
          if (parseMode) payload.parse_mode = parseMode;

          let res = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          let data = await res.json();
          if (!data.ok) {
            // تلاش مجدد بدون مارک‌داون
            delete payload.parse_mode;
            res = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            data = await res.json();

            // اگر ویرایش ممکن نبود (مثلاً متن بیش از سقف تلگرام)، پیام جدید بفرست
            if (!data.ok) {
              await sendTgMessage(chatId, text, replyMarkup, null);
            }
          }
        };

        // --- پردازش Callback Queries (دکمه‌های اینلاین) ---
        if (update.callback_query) {
          const cb = update.callback_query;
          const data = cb.data;
          const chatId = cb.message.chat.id;
          const userId = cb.from.id;

          if (data.startsWith("research_tier:")) {
            const tier = data.split(":")[1];
            await storage.setState(userId, `waiting_research:${tier}`);

            await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cb.id, text: "سطح تحقیق انتخاب شد." })
            });

            await sendTgMessage(chatId, `🔬 **سطح تحقیق انتخاب شد:** \`${tier}\`\n\nلطفاً سوال یا موضوع پژوهشی خود را ارسال کنید (مهلت: ۵ دقیقه):`);
            return new Response("OK");
          }

          if (data === "research_cancel") {
            await storage.clearState(userId);
            await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cb.id, text: "عملیات لغو شد." })
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

        const text = message.text || message.caption || "";

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
            await sendTgMessage(chatId, `✅ توکن ربات ذخیره شد: \`${masked}\``);
          }
          return new Response("OK");
        }

        if (text.startsWith("/setgemini") && admin.isAdmin(userId)) {
          const parts = text.split(/\s+/);
          if (parts[1]) {
            const masked = await storage.setGeminiKey(parts[1]);
            await sendTgMessage(chatId, `✅ کلید Gemini ذخیره شد: \`${masked}\``);
          }
          return new Response("OK");
        }

        // بررسی حالت تحقیق با انیمیشن انتظار زنده
        const userState = await storage.getState(userId);
        if (userState && userState.startsWith("waiting_research:")) {
          const tier = userState.split(":")[1];
          await storage.clearState(userId);
          sendTyping(chatId);

          // ارسال پیام انتظار اولیه با انیمیشن
          const waitMsg = await sendTgMessage(chatId, "🔬 *فرامرز در حال تحقیق و بررسی عمیق منابع است...* ⏳");
          const waitMsgId = waitMsg?.message_id;

          const researchResult = await chat.executeResearch(chatId, userId, text, tier);
          let responseText = researchResult.text;
          if (researchResult.sources && researchResult.sources.length > 0) {
            responseText += "\n\n📚 **منابع:**\n" + researchResult.sources.map(s => `• [${s.title}](${s.url})`).join("\n");
          }

          if (waitMsgId) {
            await editTgMessage(chatId, waitMsgId, responseText);
          } else {
            await sendTgMessage(chatId, responseText);
          }
          return new Response("OK");
        }

        // پردازش تصویر همراه با انیمیشن تحلیل
        if (message.photo && message.photo.length > 0) {
          sendTyping(chatId);
          const waitMsg = await sendTgMessage(chatId, "🖼 *فرامرز در حال بررسی و تحلیل دقیق تصویره...* ✨");
          const waitMsgId = waitMsg?.message_id;

          const photo = message.photo[message.photo.length - 1];
          try {
            const { dataUri, prompt } = await imageService.processTelegramPhoto(photo.file_id, message.caption);
            const primaryModel = await storage.getPrimaryModel();
            const analysis = await callVision(dataUri, prompt, { model: primaryModel, storage }, CONFIG.SYSTEM_PROMPT);
            
            const finalImageResponse = `🖼 **تحلیل تصویر:**\n\n${analysis}`;
            if (waitMsgId) {
              await editTgMessage(chatId, waitMsgId, finalImageResponse);
            } else {
              await sendTgMessage(chatId, finalImageResponse);
            }
          } catch (err) {
            const errorMsg = `⚠️ خطا در پردازش تصویر: ${err.message}`;
            if (waitMsgId) {
              await editTgMessage(chatId, waitMsgId, errorMsg);
            } else {
              await sendTgMessage(chatId, errorMsg);
            }
          }
          return new Response("OK");
        }

        // دستورات استاندارد
        if (text.startsWith("/")) {
          const handled = await commands.handleCommand(chatId, userId, text, senderName, botToken);
          if (handled) return new Response("OK");
        }

        // --- چت متنی هوشمند با انیمیشن زنده و تبدیل آنی به جواب نهایی ---
        sendTyping(chatId);

        if (text) {
          // ۱. ارسال پیام موقت انیمیشنی
          const waitMsg = await sendTgMessage(chatId, "💭 *فرامرز در حال تفکره...* ⚡");
          const waitMsgId = waitMsg?.message_id;

          // ۲. تولید پاسخ با هوش مصنوعی و زنجیره ۷ مدل
          const chatResult = await chat.processMessage(chatId, userId, text, senderName);
          let replyText = chatResult.text;
          if (chatResult.sources && chatResult.sources.length > 0) {
            replyText += "\n\n📚 **منابع:**\n" + chatResult.sources.map(s => typeof s === 'string' ? `• ${s}` : `• [${s.title}](${s.url})`).join("\n");
          }

          // ۳. تبدیل همان پیام اولیه به پاسخ نهایی به صورت کاملاً نرم و پویا
          if (waitMsgId) {
            await editTgMessage(chatId, waitMsgId, replyText);
          } else {
            await sendTgMessage(chatId, replyText);
          }
        }

        return new Response("OK");
      } catch (error) {
        return new Response(`Error: ${error.message}`, { status: 200 });
      }
    }

    return new Response("🤖 Faramarz Telegram Bot Worker is Active.", { status: 200 });
  }
};
