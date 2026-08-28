import { CONFIG } from './config.js';

export class StorageService {
  constructor(env) {
    this.kv = env.KV_STORAGE;
    this.env = env;
  }

  // دریافت توکن تلگرام با اولویت اول KV و سپس ENV
  async getBotToken() {
    if (this.kv) {
      const token = await this.kv.get("bot:token");
      if (token && token.trim() !== "") return token.trim();
    }
    return this.env?.BOT_TOKEN ? this.env.BOT_TOKEN.trim() : null;
  }

  // دریافت کلید Gemini با اولویت اول KV و سپس ENV
  async getGeminiKey() {
    if (this.kv) {
      const key = await this.kv.get("gemini:key");
      if (key && key.trim() !== "") return key.trim();
    }
    return this.env?.GEMINI_API_KEY ? this.env.GEMINI_API_KEY.trim() : null;
  }

  // دریافت مدل پیش‌فرض/فعال
  async getPrimaryModel() {
    if (this.kv) {
      const model = await this.kv.get("config:primary_model");
      if (model && model.trim() !== "") return model.trim();
    }
    return this.env?.DEFAULT_GEMINI_MODEL || CONFIG.GEMINI_MODELS[0].id;
  }

  // تنظیم کلید Gemini
  async setGeminiKey(key) {
    if (!this.kv) return "خطا: KV متصل نیست";
    if (key.toLowerCase() === "off") {
      await this.kv.delete("gemini:key");
      return "کلید اختصاصی Gemini حذف شد و به حالت env برگشت.";
    }
    await this.kv.put("gemini:key", key.trim());
    return key.slice(0, 6) + "..." + key.slice(-4);
  }

  // تنظیم توکن تلگرام
  async setBotToken(token) {
    if (!this.kv) return "خطا: KV متصل نیست";
    if (token.toLowerCase() === "off") {
      await this.kv.delete("bot:token");
      return "توکن تلگرام از KV حذف شد.";
    }
    await this.kv.put("bot:token", token.trim());
    return token.slice(0, 6) + "..." + token.slice(-4);
  }

  // مدیریت تاریخچه پیام‌ها
  async getHistory(chatId) {
    if (!this.kv) return [];
    const raw = await this.kv.get(`history:${chatId}`);
    return raw ? JSON.parse(raw) : [];
  }

  async saveHistory(chatId, history) {
    if (!this.kv) return;
    const trimmed = history.slice(-CONFIG.MAX_HISTORY_LENGTH);
    await this.kv.put(`history:${chatId}`, JSON.stringify(trimmed), {
      expirationTtl: CONFIG.HISTORY_TTL_SECONDS
    });
  }

  async clearHistory(chatId) {
    if (!this.kv) return;
    await this.kv.delete(`history:${chatId}`);
  }

  // مدیریت وضعیت موقت کاربر (State)
  async setState(userId, state) {
    if (!this.kv) return;
    await this.kv.put(`state:${userId}`, state, {
      expirationTtl: CONFIG.STATE_TTL_SECONDS
    });
  }

  async getState(userId) {
    if (!this.kv) return null;
    return await this.kv.get(`state:${userId}`);
  }

  async clearState(userId) {
    if (!this.kv) return;
    await this.kv.delete(`state:${userId}`);
  }

  // ذخیره و دریافت کاربران
  async saveUserIdentity(user) {
    if (!this.kv || !user?.id) return;
    const key = `user-identity:${user.id}`;
    const payload = {
      id: user.id,
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      username: user.username ? `@${user.username}` : "ندارد",
      last_seen: new Date().toISOString()
    };
    await this.kv.put(key, JSON.stringify(payload));
  }

  async listUsers(limit = 50) {
    if (!this.kv) return [];
    const list = await this.kv.list({ prefix: "user-identity:", limit });
    const users = [];
    for (const key of list.keys) {
      const data = await this.kv.get(key.name);
      if (data) users.push(JSON.parse(data));
    }
    return users;
  }

  // لاگ‌ها
  async addLog(message) {
    if (!this.kv) return;
    const logsRaw = await this.kv.get("system:logs");
    const logs = logsRaw ? JSON.parse(logsRaw) : [];
    logs.push({ time: new Date().toISOString(), message });
    const trimmed = logs.slice(-50);
    await this.kv.put("system:logs", JSON.stringify(trimmed), {
      expirationTtl: 7 * 24 * 60 * 60
    });
  }

  async getLogs() {
    if (!this.kv) return [];
    const logsRaw = await this.kv.get("system:logs");
    return logsRaw ? JSON.parse(logsRaw) : [];
  }

  async clearLogs() {
    if (!this.kv) return;
    await this.kv.delete("system:logs");
  }
}
