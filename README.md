# 🤖 ربات تلگرام هوشمند فرامرز (Faramarz)

ربات تلگرام تمام‌عیار، صمیمی و هوشمند بر بستر **Cloudflare Workers (Edge Serverless)**، پایگاه داده **Cloudflare KV Storage** و هوش مصنوعی **Google Gemini / Deep Research**.

---

## 🌟 قابلیت‌های اصلی

- ⚡ **استقرار ۱۰۰٪ سرورلس:** اجرای بدون وقفه در شبکه لبه Cloudflare بدون نیاز به سرور مجازی.
- 💬 **هسته چت طبیعی و صمیمی:** مجهز به درک عمیق زبان فارسی و لحن رفاقتی فرامرز.
- 🔍 **موتور جستجوی ترکیبی ۳ لایه:**
  1. **Google Grounding (v1beta):** سرچ رسمی گوگل با استناد به منابع معتبر.
  2. **Live Info:** نرخ‌های لحظه‌ای بازار ایران از TGJU (دلار، طلا، سکه) + کریپتو از CoinGecko.
  3. **DuckDuckGo HTML:** جستجوی متنی وب بدون نیاز به کلید API.
- 🔬 **حالت تحقیق تخصصی ۳ سطحی:**
  - ⚡ تحقیق ساده (`gemini-2.5-flash`)
  - 🔬 تحقیق قوی (`deep-research-pro-preview-12-2025`)
  - 🚀 تحقیق خیلی قوی (`deep-research-max-preview-04-2026`)
- 💾 **حافظه بلندمدت پایدار:** استخراج خودکار فکت‌ها و ذخیره با انقضای ۳۰ روزه در KV.
- 🖼 **پردازش تصویر (Vision):** OCR، ترجمه و تحلیل تصاویر.
- 👑 **پنل مدیریت درون‌برنامه‌ای تلگرام:** ویژه مالک ربات (`6695218234`).
- 🔄 **تغییر بی‌درنگ کلیدها:** پشتیبانی از `/settoken` و `/setgemini` بدون نیاز به ریبیلد.

---

## 🚀 راهنمای سریع راه‌اندازی و استقرار

### ۱. ساخت KV Namespace در Cloudflare
دستور زیر را در ترمینال اجرا کنید:
```bash
npx wrangler kv:namespace create "KV_STORAGE"
```
سپس آیدی تولید شده را در فایل `wrangler.toml` قرار دهید:
```toml
[[kv_namespaces]]
binding = "KV_STORAGE"
id = "YOUR_KV_NAMESPACE_ID"
```

### ۲. اتصال ریپازیتوری GitHub به Cloudflare Workers (CI/CD)
1. مخزن را به اکانت گیت‌هاب خود Push کنید.
2. در داشبورد Cloudflare به بخش **Workers & Pages** بروید.
3. گزینه **Create Application -> Pages / Workers -> Connect to Git** را انتخاب کنید.
4. ریپازیتوری `faramarz-bot` را انتخاب کرده و تنظیمات را ذخیره کنید:
   - **Build Command:** `npm run build`
   - **Deploy Command:** `npx wrangler deploy`

### ۳. تنظیم متغیرها (Secrets)
در بخش **Settings -> Variables and Secrets** ورکر:
- `BOT_TOKEN`: توکن تلگرام دریافتی از BotFather
- `GEMINI_API_KEY`: کلید API گوگل از Google AI Studio

### ۴. فعال‌سازی Webhook تلگرام
آدرس زیر را در مرورگر باز کنید (آدرس ورکر خود را جایگزین کنید):
```text
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_WORKER_SUBDOMAIN>.workers.dev/
```

### ۵. تست سلامت سیستم
برای بررسی اتصالات، آدرس زیر را باز کنید:
```text
https://<YOUR_WORKER_SUBDOMAIN>.workers.dev/debug
```

---

## 📜 لایسنس
توسعه یافته تحت لایسنس MIT.
