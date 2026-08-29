export class ImageService {
  constructor(storage) {
    this.storage = storage;
  }

  // دانلود تصویر از تلگرام و تبدیل به Data URI Base64 با سرعت فوق‌العاده
  async processTelegramPhoto(fileId, promptText = "") {
    const botToken = await this.storage.getBotToken();
    if (!botToken) throw new Error("توکن تلگرام موجود نیست.");

    // ۱. دریافت مسیر فایل از سرور تلگرام
    const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    if (!fileData.ok || !fileData.result?.file_path) {
      throw new Error(`دریافت اطلاعات تصویر ناموفق بود: ${fileData.description || 'نامشخص'}`);
    }

    const filePath = fileData.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

    // ۲. دانلود باینری تصویر
    const imgRes = await fetch(downloadUrl);
    if (!imgRes.ok) throw new Error("دانلود فایل تصویر از سرور تلگرام ناموفق بود.");

    const arrayBuffer = await imgRes.arrayBuffer();

    // بررسی سقف ۲۰ مگابایت
    if (arrayBuffer.byteLength > 20 * 1024 * 1024) {
      throw new Error("حجم فایل تصویر بیش از سقف ۲۰ مگابایت است.");
    }

    // ۳. تبدیل به Base64 با روش فوق‌سریع بدون ایجاد گلوگاه حافظه
    let base64Image = "";
    if (typeof Buffer !== "undefined") {
      base64Image = Buffer.from(arrayBuffer).toString("base64");
    } else {
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      }
      base64Image = btoa(binary);
    }

    // ۴. تعیین نوع دقیق فایل (MIME Type)
    let mimeType = "image/jpeg";
    const lowerPath = filePath.toLowerCase();
    if (lowerPath.endsWith(".png")) mimeType = "image/png";
    else if (lowerPath.endsWith(".webp")) mimeType = "image/webp";
    else if (lowerPath.endsWith(".gif")) mimeType = "image/gif";
    else if (lowerPath.endsWith(".heic")) mimeType = "image/heic";

    const dataUri = `data:${mimeType};base64,${base64Image}`;

    return {
      dataUri,
      prompt: promptText || "این تصویر را با دقت کامل بررسی کن. تمام متون، جزئیات، اعداد، نکات مهم و بخش‌های موجود در تصویر را به زبان فارسی روان و صمیمی توضیح بده."
    };
  }

  // انتخاب ری‌اکشن استیکرها
  getRandomStickerReaction() {
    const reactions = ["👍", "🙃", "🤝", "😅", "🔥", "❤️"];
    return reactions[Math.floor(Math.random() * reactions.length)];
  }
}
