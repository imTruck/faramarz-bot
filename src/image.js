export class ImageService {
  constructor(storage) {
    this.storage = storage;
  }

  // دانلود تصویر از تلگرام و تبدیل به Data URI Base64
  async processTelegramPhoto(fileId, promptText = "") {
    const botToken = await this.storage.getBotToken();
    if (!botToken) throw new Error("توکن تلگرام موجود نیست.");

    // ۱. دریافت مسیر فایل
    const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    if (!fileData.ok || !fileData.result?.file_path) {
      throw new Error("دریافت اطلاعات فایل از تلگرام ناموفق بود.");
    }

    const filePath = fileData.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

    // ۲. دانلود باینری
    const imgRes = await fetch(downloadUrl);
    if (!imgRes.ok) throw new Error("دانلود فایل تصویر ناموفق بود.");

    const arrayBuffer = await imgRes.arrayBuffer();

    // بررسی سقف ۲۰ مگابایت
    if (arrayBuffer.byteLength > 20 * 1024 * 1024) {
      throw new Error("⚠️ حجم فایل بیش از سقف مجاز ۲۰ مگابایت است.");
    }

    // ۳. تبدیل به Base64 در حافظه Edge Worker
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Image = btoa(binary);

    // تشخیص MimeType بر اساس پسوند فایل
    let mimeType = "image/jpeg";
    if (filePath.endsWith(".png")) mimeType = "image/png";
    else if (filePath.endsWith(".webp")) mimeType = "image/webp";
    else if (filePath.endsWith(".gif")) mimeType = "image/gif";

    const dataUri = `data:${mimeType};base64,${base64Image}`;

    return {
      dataUri,
      prompt: promptText || "این تصویر را به دقت بررسی و تمام متون، جزئیات و نکات داخل آن را به زبان فارسی روان و صمیمی توضیح بده."
    };
  }

  // انتخاب ری‌اکشن رندوم برای استیکرها بدون مصرف منابع پردازشی
  getRandomStickerReaction() {
    const reactions = ["👍", "🙃", "🤝", "😅", "🔥", "❤️"];
    return reactions[Math.floor(Math.random() * reactions.length)];
  }
}
