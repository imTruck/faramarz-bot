import { CONFIG } from './config.js';

// کش درون‌حافظه‌ای جهت پایداری در صورتی که بایندینگ KV متصل نشده باشد
if (!globalThis.__MEMORY_STORE__) {
  globalThis.__MEMORY_STORE__ = new Map();
}

export class StorageService {
  constructor(env) {
    this.kv = env?.KV_STORAGE || null;
    this.env = env || {};
    this.mem = globalThis.__MEMORY_STORE__;
  }

  // دریافت توکن تلگرام با اولویت اول KV، سپس حافظه داخلی و سپس متغیرهای محیطی
  async getBotToken() {
    if (this.kv) {
      try {
        const token = await this.kv.get("bot:token");
        if (token && token.trim() !== "") return token.trim();
      } catch (e) {}
    }
    if (this.mem.has("bot:token")) {
      return this.mem.get("bot:token");
    }
    const envToken = this.env.BOT_TOKEN || 
                     this.env.TELEGRAM_BOT_TOKEN || 
                     this.env.TELEGRAM_TOKEN || 
                     this.env.TOKEN || 
                     this.env.bot_token ||
                     this.env.telegram_bot_token;
    return envToken ? String(envToken).trim() : null;
  }

  // دریافت کلید Gemini
  async getGeminiKey() {
    if (this.kv) {
      try {
        const key = await this.kv.get("gemini:key");
        if (key && key.trim() !== "") return key.trim();
      } catch (e) {}
    }
    if (this.mem.has("gemini:key")) {
      return this.mem.get("gemini:key");
    }
    const envKey = this.env.GEMINI_API_KEY || 
                   this.env.GEMINI_KEY || 
                   this.env.GEMINI || 
                   this.env.gemini_api_key ||
                   this.env.gemini_key;
    return envKey ? String(envKey).trim() : null;
  }

  // دریافت مدل پیش‌فرض/فعال
  async getPrimaryModel() {
    if (this.kv) {
      try {
        const model = await this.kv.get("config:primary_model");
        if (model && model.trim() !== "") return model.trim();
      } catch (e) {}
    }
    if (this.mem.has("config:primary_model")) {
      return this.mem.get("config:primary_model");
    }
    return this.env.DEFAULT_GEMINI_MODEL || CONFIG.GEMINI_MODELS[0].id;
  }

  // تنظیم کلید Gemini
  async setGeminiKey(key) {
    const cleanKey = key.trim();
    this.mem.set("gemini:key", cleanKey);
    if (this.kv) {
      try {
        if (cleanKey.toLowerCase() === "off") {
          await this.kv.delete("gemini:key");
          this.mem.delete("gemini:key");
          return "حذف شد";
        }
        await this.kv.put("gemini:key", cleanKey);
      } catch (e) {}
    }
    return cleanKey.slice(0, 6) + "..." + cleanKey.slice(-4);
  }

  // تنظیم توکن تلگرام (با نرمال‌سازی خودکار و حذف پیشوند bot اضافی)
  async setBotToken(token) {
    let cleanToken = token.trim().replace(/^bot/i, "").trim();
    this.mem.set("bot:token", cleanToken);
    if (this.kv) {
      try {
        if (cleanToken.toLowerCase() === "off") {
          await this.kv.delete("bot:token");
          this.mem.delete("bot:token");
          return "حذف شد";
        }
        await this.kv.put("bot:token", cleanToken);
      } catch (e) {}
    }
    return cleanToken.slice(0, 6) + "..." + cleanToken.slice(-4);
  }

  // مدیریت تاریخچه پیام‌ها
  async getHistory(chatId) {
    if (this.kv) {
      try {
        const raw = await this.kv.get(`history:${chatId}`);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
    }
    return this.mem.get(`history:${chatId}`) || [];
  }

  async saveHistory(chatId, history) {
    const trimmed = history.slice(-CONFIG.MAX_HISTORY_LENGTH);
    this.mem.set(`history:${chatId}`, trimmed);
    if (this.kv) {
      try {
        await this.kv.put(`history:${chatId}`, JSON.stringify(trimmed), {
          expirationTtl: CONFIG.HISTORY_TTL_SECONDS
        });
      } catch (e) {}
    }
  }

  async clearHistory(chatId) {
    this.mem.delete(`history:${chatId}`);
    if (this.kv) {
      try {
        await this.kv.delete(`history:${chatId}`);
      } catch (e) {}
    }
  }

  // مدیریت وضعیت موقت کاربر (State)
  async setState(userId, state) {
    this.mem.set(`state:${userId}`, state);
    if (this.kv) {
      try {
        await this.kv.put(`state:${userId}`, state, {
          expirationTtl: CONFIG.STATE_TTL_SECONDS
        });
      } catch (e) {}
    }
  }

  async getState(userId) {
    if (this.kv) {
      try {
        const s = await this.kv.get(`state:${userId}`);
        if (s) return s;
      } catch (e) {}
    }
    return this.mem.get(`state:${userId}`) || null;
  }

  async clearState(userId) {
    this.mem.delete(`state:${userId}`);
    if (this.kv) {
      try {
        await this.kv.delete(`state:${userId}`);
      } catch (e) {}
    }
  }

  // ذخیره و دریافت کاربران
  async saveUserIdentity(user) {
    if (!user?.id) return;
    const key = `user-identity:${user.id}`;
    const payload = {
      id: user.id,
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      username: user.username ? `@${user.username}` : "ندارد",
      last_seen: new Date().toISOString()
    };
    this.mem.set(key, payload);
    if (this.kv) {
      try {
        await this.kv.put(key, JSON.stringify(payload));
      } catch (e) {}
    }
  }

  async listUsers(limit = 50) {
    if (this.kv) {
      try {
        const list = await this.kv.list({ prefix: "user-identity:", limit });
        const users = [];
        for (const key of list.keys) {
          const data = await this.kv.get(key.name);
          if (data) users.push(JSON.parse(data));
        }
        if (users.length > 0) return users;
      } catch (e) {}
    }
    const memUsers = [];
    for (const [k, v] of this.mem.entries()) {
      if (k.startsWith("user-identity:")) memUsers.push(v);
    }
    return memUsers;
  }

  // لاگ‌ها
  async addLog(message) {
    const logItem = { time: new Date().toISOString(), message };
    const cur = this.mem.get("system:logs") || [];
    cur.push(logItem);
    this.mem.set("system:logs", cur.slice(-50));

    if (this.kv) {
      try {
        const logsRaw = await this.kv.get("system:logs");
        const logs = logsRaw ? JSON.parse(logsRaw) : [];
        logs.push(logItem);
        await this.kv.put("system:logs", JSON.stringify(logs.slice(-50)), {
          expirationTtl: 7 * 24 * 60 * 60
        });
      } catch (e) {}
    }
  }

  async getLogs() {
    if (this.kv) {
      try {
        const logsRaw = await this.kv.get("system:logs");
        if (logsRaw) return JSON.parse(logsRaw);
      } catch (e) {}
    }
    return this.mem.get("system:logs") || [];
  }

  async clearLogs() {
    this.mem.delete("system:logs");
    if (this.kv) {
      try {
        await this.kv.delete("system:logs");
      } catch (e) {}
    }
  }
}
