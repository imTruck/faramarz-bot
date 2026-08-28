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
        version: "2.0.0-cloudflare-esm"
      }, null, 2), {
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // ۲. مسیر صفحه راه‌اندازی و داشبورد تحت وب (/admin یا /setup یا /)
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

    // ۳. پردازش فرم ذخیره خودکار کلیدها و ست کردن اتوماتیک وِبهوک (POST /setup)
    if ((url.pathname === "/setup" || url.pathname === "/admin" || url.pathname === "/") && request.method === "POST") {
      try {
        const formData = await request.formData();
        let botTokenInput = formData.get("bot_token")?.trim() || "";
        let geminiKeyInput = formData.get("gemini_key")?.trim() || "";

        let message = "";
        let isSuccess = true;

        if (botTokenInput) {
          // نرمال‌سازی توکن و حذف کاراکترها یا کلمه bot اضافی
          const cleanToken = botTokenInput.replace(/^bot/i, "").trim();
          await storage.setBotToken(cleanToken);

          // فعال‌سازی خودکار وِبهوک تلگرام از طریق متد استاندارد POST
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
              if (webhookData.description === "Not Found") {
                message += `❌ <b>خطای تلگرام:</b> توکن وارد شده نامعتبر است یا در BotFather وجود ندارد (فرمت صحیح: <code>123456:ABC-DEF...</code>).<br>`;
              } else {
                message += `⚠️ توکن ذخیره شد ولی تلگرام پاسخ داد: <code>${webhookData.description}</code><br>`;
              }
            }
          } catch (netErr) {
            message += `⚠️ خطا در برقراری ارتباط با سرور تلگرام: ${netErr.message}<br>`;
          }
        }

        if (geminiKeyInput) {
          await storage.setGeminiKey(geminiKeyInput);
          message += `✅ کلید Gemini API با موفقیت ذخیره شد!<br>`;
        }

        if (isSuccess) {
          message += `🎉 <b>تبریک! ربات فرامرز اکنون آماده است. وارد تلگرام شوید و دستور /start را بفرستید.</b>`;
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
        return new Response(`خطا در ذخیره اطلاعات: ${err.message}`, { status: 500 });
      }
    }

    // ۴. پردازش درخواست‌های Webhook تلگرام (POST /)
    if (request.method === "POST") {
      try {
        const update = await request.json();
        const botToken = await storage.getBotToken();

        if (!botToken) {
          return new Response("Missing BOT_TOKEN in Storage or Environment", { status: 200 });
        }

        const admin = new TelegramAdmin(storage, env);
        const chat = new SmartChat(storage, env);
        const commands = new CommandHandler(storage, env);
        const imageService = new ImageService(storage);
        const groupService = new GroupService(env.KV_STORAGE);

        // ارسال پیام به تلگرام
        const sendTgMessage = async (chatId, text, replyMarkup = null, parseMode = "Markdown") => {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text,
              parse_mode: parseMode,
              reply_markup: replyMarkup
            })
          });
        };

        // --- پردازش Callback Queries (دکمه‌های اینلاین) ---
        if (update.callback_query) {
          const cb = update.callback_query;
          const data = cb.data;
          const chatId = cb.message.chat.id;
          const userId = cb.from.id;

          // بررسی انتخاب سطح تحقیق
          if (data.startsWith("research_tier:")) {
            const tier = data.split(":")[1];
            await storage.setState(userId, `waiting_research:${tier}`);

            await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cb.id, text: "سطح تحقیق انتخاب شد." })
            });

            await sendTgMessage(chatId, `🔬 **سطح تحقیق انتخاب شد:** \`${tier}\`\n\nلطفاً سوال یا موضوع پژوهشی خود را در پیام بعدی ارسال کنید (مهلت: ۵ دقیقه):`);
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

          // پردازش پنل ادمین
          await admin.handleCallback(cb, botToken);
          return new Response("OK");
        }

        const message = update.message;
        if (!message) return new Response("OK");

        const chatId = message.chat.id;
        const userId = message.from.id;
        const isGroup = message.chat.type === "group" || message.chat.type === "supergroup";
        const senderName = message.from.first_name || "رفیق";

        // ثبت اطلاعات هویتی کاربر
        await storage.saveUserIdentity(message.from);

        // مدیریت گروه‌ها: فیلتر پیام‌ها
        if (isGroup) {
          await groupService.trackGroupMember(chatId, message.from);
          const shouldReply = groupService.shouldRespondInGroup(message, CONFIG.BOT_USERNAME);
          if (!shouldReply) {
            return new Response("OK");
          }
        }

        // --- بررسی استیکر (ارسال Reaction بدون بار پردازشی) ---
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

        // --- دستورات ویژه مالک (Admin Only) ---
        if (text.startsWith("/admin")) {
          if (!admin.isAdmin(userId)) {
            await sendTgMessage(chatId, "⛔ **دسترسی غیرمجاز:** این بخش منحصراً برای مالک ربات است.");
            return new Response("OK");
          }
          await admin.sendAdminPanel(chatId, botToken);
          return new Response("OK");
        }

        if (text.startsWith("/settoken")) {
          if (!admin.isAdmin(userId)) return new Response("OK");
          const parts = text.split(/\s+/);
          if (!parts[1]) {
            await sendTgMessage(chatId, "فرمت: `/settoken <توکن>` یا `/settoken off`");
            return new Response("OK");
          }
          const masked = await storage.setBotToken(parts[1]);
          await sendTgMessage(chatId, `✅ **توکن ربات به‌روزرسانی شد:** \`${masked}\``);
          return new Response("OK");
        }

        if (text.startsWith("/setgemini")) {
          if (!admin.isAdmin(userId)) return new Response("OK");
          const parts = text.split(/\s+/);
          if (!parts[1]) {
            await sendTgMessage(chatId, "فرمت: `/setgemini <کلید>` یا `/setgemini off`");
            return new Response("OK");
          }
          const masked = await storage.setGeminiKey(parts[1]);
          await sendTgMessage(chatId, `✅ **کلید Gemini به‌روزرسانی شد:** \`${masked}\``);
          return new Response("OK");
        }

        // --- بررسی وضعیت کاربر (State - مثلاً تحقیق ۳ سطحی) ---
        const userState = await storage.getState(userId);
        if (userState && userState.startsWith("waiting_research:")) {
          const tier = userState.split(":")[1];
          await storage.clearState(userId);

          await sendTgMessage(chatId, "🔬 **در حال تحقیق و بررسی عمیق منابع... لطفاً چند لحظه صبر کنید.**");

          const researchResult = await chat.executeResearch(chatId, userId, text, tier);
          let responseText = researchResult.text;
          if (researchResult.sources && researchResult.sources.length > 0) {
            responseText += "\n\n📚 **منابع و مراجع:**\n" + researchResult.sources.map(s => `• [${s.title}](${s.url})`).join("\n");
          }

          await sendTgMessage(chatId, responseText);
          return new Response("OK");
        }

        // --- بررسی پردازش تصویر (Photo) ---
        if (message.photo && message.photo.length > 0) {
          const photo = message.photo[message.photo.length - 1];
          await sendTgMessage(chatId, "🖼 در حال دریافت و تحلیل تصویر...");

          try {
            const { dataUri, prompt } = await imageService.processTelegramPhoto(photo.file_id, message.caption);
            const primaryModel = await storage.getPrimaryModel();
            const analysis = await callVision(dataUri, prompt, { model: primaryModel, storage }, CONFIG.SYSTEM_PROMPT);
            await sendTgMessage(chatId, `🖼 **تحلیل تصویر:**\n\n${analysis}`);
          } catch (err) {
            await sendTgMessage(chatId, `⚠️ خطا در پردازش تصویر: ${err.message}`);
          }
          return new Response("OK");
        }

        // --- بررسی دستورات استاندارد (/start, /price, ...) ---
        if (text.startsWith("/")) {
          const handled = await commands.handleCommand(chatId, userId, text, senderName, botToken);
          if (handled) return new Response("OK");
        }

        // --- چت متنی هوشمند با پروتکل جستجو و حافظه ---
        if (text) {
          const chatResult = await chat.processMessage(chatId, userId, text, senderName);
          let replyText = chatResult.text;
          if (chatResult.sources && chatResult.sources.length > 0) {
            replyText += "\n\n📚 **منابع:**\n" + chatResult.sources.map(s => typeof s === 'string' ? `• ${s}` : `• [${s.title}](${s.url})`).join("\n");
          }

          await sendTgMessage(chatId, replyText);
        }

        return new Response("OK");
      } catch (error) {
        return new Response(`Error: ${error.message}`, { status: 500 });
      }
    }

    return new Response("🤖 Faramarz Telegram Bot Worker is Active. Webhook Endpoint is Ready.", { status: 200 });
  }
};
