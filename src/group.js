import { CONFIG } from './config.js';

export class GroupService {
  constructor(kv) {
    this.kv = kv;
    // دیکشنری اسامی مستعار و فینگلیش رایج
    this.nicknames = {
      "mamad": "محمد",
      "mammad": "محمد",
      "ali": "علی",
      "hosein": "حسین",
      "hossein": "حسین",
      "reza": "رضا",
      "amir": "امیر",
      "mahdi": "مهدی",
      "mehdi": "مهدی",
      "saeed": "سعید",
      "hasan": "حسن",
      "hassan": "حسن",
      "farshi": "فرشید",
      "fari": "فرامرز",
      "faramarz": "فرامرز"
    };
  }

  // بررسی شرایط پاسخ‌دهی در گروه‌ها
  shouldRespondInGroup(message, botId) {
    const text = (message.text || message.caption || "").toLowerCase();
    
    // ۱. منشن یوزرنیم ربات
    if (text.includes(`@${CONFIG.BOT_USERNAME.toLowerCase()}`)) {
      return true;
    }

    // ۲. صدا زدن نام‌های فرامرز
    const triggers = ["فرامرز", "faramarz", "فرامرزجان", "فرامرز جان", "فری", "fari"];
    for (const t of triggers) {
      if (text.includes(t)) return true;
    }

    // ۳. ریپلای شدن به پیام‌های خود ربات
    if (message.reply_to_message) {
      const repliedFrom = message.reply_to_message.from;
      if (repliedFrom && (repliedFrom.id === botId || repliedFrom.username === CONFIG.BOT_USERNAME)) {
        return true;
      }
    }

    return false;
  }

  // ثبت و نگهداری کانتکست اعضای گروه
  async trackGroupMember(groupId, user) {
    if (!this.kv || !user?.id) return;
    const key = `group-members:${groupId}`;
    const raw = await this.kv.get(key);
    let members = raw ? JSON.parse(raw) : [];

    const existingIndex = members.findIndex(m => m.id === user.id);
    const memberData = {
      id: user.id,
      name: user.first_name || "کاربر",
      username: user.username ? `@${user.username}` : "",
      last_active: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      members[existingIndex] = memberData;
    } else {
      members.push(memberData);
      if (members.length > 50) members.shift(); // نگهداری ۵۰ کاربر اخیر
    }

    await this.kv.put(key, JSON.stringify(members), {
      expirationTtl: CONFIG.MEMORY_TTL_SECONDS
    });
  }

  // نرمال‌سازی نام مستعار
  resolveNickname(name) {
    if (!name) return "رفیق";
    const lower = name.toLowerCase().trim();
    return this.nicknames[lower] || name;
  }
}
