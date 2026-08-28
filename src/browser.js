export class BrowserService {
  async fetchAndClean(url) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });
      if (!res.ok) {
        return { title: "خطای دسترسی", content: `دریافت صفحه با خطای HTTP ${res.status} مواجه شد.` };
      }

      const html = await res.text();

      // حذف بخش‌های اضافه و غیرمتنی
      let clean = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
        .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, "")
        .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
        .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "");

      // استخراج تایتل
      const titleMatch = clean.match(/<title[^>]*>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "صفحه وب";

      // استخراج متن اصلی
      const text = clean
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3000);

      return {
        title,
        content: text || "محتوای متنی مناسبی برای استخراج یافت نشد."
      };
    } catch (e) {
      return {
        title: "خطا در ارتباط",
        content: `امکان باز کردن آدرس وجود ندارد: ${e.message}`
      };
    }
  }
}
