// bot.js — DG-DEV Media URL Generator Bot v2.2 (Final Fixed)
const servers = [
  { cloudName: "wwb8ifud", uploadPreset: "dg_dev" },
  { cloudName: "rakvvolf", uploadPreset: "dg_dev1" },
  { cloudName: "v2dlq2nx", uploadPreset: "dg_dev2" },
  { cloudName: "dxctmzctl", uploadPreset: "Dg_project" }
];

const START_IMAGE =
  "https://res.cloudinary.com/wwb8ifud/image/upload/v1794841366/yvfhco7nv1ecnmknneik.jpg";

const START_CAPTION = `<b>╭━━━『 DG-DEV BOT 』━━━╮</b>

✦ <b>Ultra Fast Media Uploader</b> ✦
━━━━━━━━━━━━━━━━━━━━

⚡ ᴘᴏᴡᴇʀꜰᴜʟ ᴍᴜʟᴛɪ-ꜱᴇʀᴠᴇʀ ɴᴇᴛᴡᴏʀᴋ
🚀 ʙʟᴀᴢɪɴɢ ꜰᴀꜱᴛ ᴜᴘʟᴏᴀᴅ
🖼️ ɪᴍᴀɢᴇ • ᴠɪᴅᴇᴏ • ᴀᴜᴅɪᴏ • ꜰɪʟᴇ
📦 ʙᴜʟᴋ ᴜᴘʟᴏᴀᴅ ꜱᴜᴘᴘᴏʀᴛ
🔗 ᴅɪʀᴇᴄᴛ ᴜʀʟ ɢᴇɴᴇʀᴀᴛᴏʀ
📋 ᴏɴᴇ-ᴄʟɪᴄᴋ ᴄᴏᴘʏ
⚡ ꜱᴘᴇᴇᴅ ᴛᴇꜱᴛ ʙᴜɪʟᴛ-ɪɴ
📁 ᴏʀɪɢɪɴᴀʟ ꜰɪʟᴇɴᴀᴍᴇ ᴘʀᴇꜱᴇʀᴠᴇᴅ

<b>╰━━━━━━━━━━━━━━━━━━━━╯</b>

📤 <b>Send any Image, Video, Audio or Document</b> and I'll convert it to a direct URL instantly!

⚡ <i>Send multiple files at once — each file gets its own link!</i>
📎 <i>Tip: Send files as Documents to keep the original filename.</i>`;

/* ---------- Helpers ---------- */
function esc(text) {
  if (text === undefined || text === null) return "";
  return String(text).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function formatBytes(bytes) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)} ${units[i]}`;
}

function buildPublicId(fileName) {
  let name = (fileName || "file").trim();
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx > 0) name = name.slice(0, dotIdx);
  name = name
    .replace(/[\\/:*?"<>|\x00-\x1F]+/g, "")
    .replace(/\s+/g, "_")
    .trim();
  if (!name) name = "file";
  if (name.length > 180) name = name.slice(0, 180);
  return name;
}

async function tgApi(token, method, payload) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.log(`tgApi ${method} error:`, err.message);
    return { ok: false };
  }
}

async function sendTelegramMessage(chatId, text, token, extra = {}) {
  return tgApi(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra
  });
}

async function sendChatAction(chatId, action, token) {
  try {
    await tgApi(token, "sendChatAction", { chat_id: chatId, action });
  } catch (_) {}
}

/* ---------- Cloudinary Multi-Server Upload (Fixed for Unsigned) ---------- */
async function uploadToCloudinary(fileBuffer, mimeType, fileName) {
  const publicId = buildPublicId(fileName);
  let lastError = "Unknown error";

  for (let i = 0; i < servers.length; i++) {
    const server = servers[i];
    try {
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: mimeType });
      formData.append("file", blob, fileName || "file");
      formData.append("upload_preset", server.uploadPreset);
      
      // 🔑 public_id එක විතරක් යවනවා (Cloudinary unsigned වලට මේකට අවසර දෙනවා)
      formData.append("public_id", publicId);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${server.cloudName}/auto/upload`,
        { method: "POST", body: formData }
      );

      const data = await response.json();

      if (response.ok && data.secure_url) {
        return {
          url: data.secure_url,
          serverUsed: `Server ${i + 1}`,
          resourceType: data.resource_type,
          bytes: data.bytes,
          format: data.format,
          publicId: data.public_id
        };
      }

      const msg = data.error?.message || "";
      if (/already exists/i.test(msg)) {
        lastError = `"${fileName}" already exists on the server.`;
        console.log(`Server ${i + 1} collision → trying next…`);
        continue;
      }

      lastError = msg || `Server ${i + 1} rejected`;
      console.log(`Server ${i + 1} error:`, lastError);
    } catch (err) {
      lastError = err.message;
      console.log(`Server ${i + 1} failed → trying next…`, err.message);
    }
  }

  throw new Error(lastError);
}

/* ---------- Media Detection ---------- */
function detectMedia(message) {
  if (message.photo) {
    const p = message.photo[message.photo.length - 1];
    return {
      fileId: p.file_id,
      mimeType: "image/jpeg",
      fileName: "image.jpg",
      kind: "image",
      emoji: "🖼️",
      label: "Image",
      action: "upload_photo"
    };
  }
  if (message.video) {
    return {
      fileId: message.video.file_id,
      mimeType: message.video.mime_type || "video/mp4",
      fileName: message.video.file_name || "video.mp4",
      kind: "video",
      emoji: "🎬",
      label: "Video",
      action: "upload_video"
    };
  }
  if (message.audio) {
    return {
      fileId: message.audio.file_id,
      mimeType: message.audio.mime_type || "audio/mpeg",
      fileName: message.audio.file_name || "audio.mp3",
      kind: "audio",
      emoji: "🎵",
      label: "Audio",
      action: "upload_document"
    };
  }
  if (message.voice) {
    return {
      fileId: message.voice.file_id,
      mimeType: message.voice.mime_type || "audio/ogg",
      fileName: "voice.ogg",
      kind: "voice",
      emoji: "🎤",
      label: "Voice",
      action: "upload_document"
    };
  }
  if (message.document) {
    return {
      fileId: message.document.file_id,
      mimeType: message.document.mime_type || "application/octet-stream",
      fileName: message.document.file_name || "document",
      kind: "document",
      emoji: "📄",
      label: "File",
      action: "upload_document"
    };
  }
  return null;
}

/* ---------- Core Media Handler ---------- */
async function handleMedia(message, BOT_TOKEN) {
  const chatId = message.chat.id;
  const media = detectMedia(message);
  if (!media) return;

  const startedAt = Date.now();
  const userCaption = message.caption ? esc(message.caption) : "";

  sendChatAction(chatId, media.action, BOT_TOKEN);

  const statusRes = await sendTelegramMessage(
    chatId,
    `${media.emoji} <b>ᴜᴘʟᴏᴀᴅɪɴɢ ${media.label.toUpperCase()}…</b>\n\n` +
      `📦 <b>ꜰɪʟᴇ:</b> <code>${esc(media.fileName)}</code>\n` +
      `⏳ <i>Connecting to fastest server…</i>`,
    BOT_TOKEN
  );
  const statusId = statusRes?.result?.message_id;

  try {
    const fileData = await tgApi(BOT_TOKEN, "getFile", { file_id: media.fileId });
    if (!fileData.ok) throw new Error("Failed to get file from Telegram");

    const filePath = fileData.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

    const mediaRes = await fetch(downloadUrl);
    if (!mediaRes.ok) throw new Error("Failed to download file");
    const arrayBuffer = await mediaRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadToCloudinary(buffer, media.mimeType, media.fileName);

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);
    const sizeStr = formatBytes(result.bytes);

    const lastSegment = result.url.split("/").pop();

    const successText =
      `✅ <b>ᴜᴘʟᴏᴀᴅ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟ!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${media.emoji} <b>ᴛʏᴘᴇ:</b> ${media.label}\n` +
      `📦 <b>ꜰɪʟᴇ:</b> <code>${esc(lastSegment)}</code>\n` +
      (sizeStr ? `📏 <b>ꜱɪᴢᴇ:</b> <code>${sizeStr}</code>\n` : "") +
      `🌐 <b>ꜱᴇʀᴠᴇʀ:</b> ${result.serverUsed}\n` +
      `⚡ <b>ꜱᴘᴇᴇᴅ:</b> <code>${elapsed}s</code>\n` +
      (userCaption ? `📝 <b>ᴄᴀᴘᴛɪᴏɴ:</b> ${userCaption}\n` : "") +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🔗 <b>ᴅɪʀᴇᴄᴛ ᴜʀʟ:</b>\n` +
      `<code>${esc(result.url)}</code>\n\n` +
      `<i>👇 Tap Copy to grab the URL.</i>`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📋 Copy URL", copy_text: { text: result.url } },
          { text: "🌐 Open Link", url: result.url }
        ]
      ]
    };

    let edited = false;
    if (statusId) {
      const editRes = await tgApi(BOT_TOKEN, "editMessageText", {
        chat_id: chatId,
        message_id: statusId,
        text: successText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: keyboard
      });
      edited = editRes.ok;
    }
    if (!edited) {
      await sendTelegramMessage(chatId, successText, BOT_TOKEN, { reply_markup: keyboard });
    }
  } catch (error) {
    const errText =
      `❌ <b>ᴜᴘʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ!</b>\n\n` +
      `${media.emoji} <b>ꜰɪʟᴇ:</b> <code>${esc(media.fileName)}</code>\n` +
      `⚠️ <b>ᴇʀʀᴏʀ:</b> ${esc(error.message)}\n\n` +
      `<i>Tip: If the filename already exists, rename the file and try again.</i>`;

    if (statusId) {
      const editRes = await tgApi(BOT_TOKEN, "editMessageText", {
        chat_id: chatId,
        message_id: statusId,
        text: errText,
        parse_mode: "HTML"
      });
      if (!editRes.ok) await sendTelegramMessage(chatId, errText, BOT_TOKEN);
    } else {
      await sendTelegramMessage(chatId, errText, BOT_TOKEN);
    }
  }
}

/* ---------- Webhook Handler ---------- */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("DG-DEV Bot is running successfully!");
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.error("BOT_TOKEN not set");
    return res.status(200).json({ status: "missing token" });
  }

  const update = req.body || {};

  try {
    if (!update.message) return res.status(200).json({ status: "ok" });

    const message = update.message;
    const chatId = message.chat.id;
    const text = message.text || "";

    // ---- /start ----
    if (text === "/start" || text.startsWith("/start ")) {
      sendChatAction(chatId, "typing", BOT_TOKEN);

      const photoRes = await tgApi(BOT_TOKEN, "sendPhoto", {
        chat_id: chatId,
        photo: START_IMAGE,
        caption: START_CAPTION,
        parse_mode: "HTML"
      });

      if (!photoRes.ok) {
        await sendTelegramMessage(chatId, START_CAPTION, BOT_TOKEN);
      }
      return res.status(200).json({ status: "ok" });
    }

    // ---- /help ----
    if (text === "/help") {
      await sendTelegramMessage(
        chatId,
        `📖 <b>ʜᴏᴡ ᴛᴏ ᴜꜱᴇ ᴅɢ-ᴅᴇᴠ ʙᴏᴛ</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `1️⃣ Send any <b>Image</b>, <b>Video</b>, <b>Audio</b>, or <b>Document</b>\n` +
          `2️⃣ Wait a few seconds ⏳\n` +
          `3️⃣ Tap <b>📋 Copy URL</b> button\n\n` +
          `📦 <b>Bulk Upload:</b> Send multiple files at once — every file gets its own link!\n\n` +
          `📁 <b>Filename Tip:</b> The URL keeps your original filename.\n` +
          `If you want the exact original name for photos, send them as <b>Documents</b>.\n\n` +
          `⚡ <b>Multi-Server:</b> 4 Cloudinary servers = max speed & 99.9% uptime.`,
        BOT_TOKEN
      );
      return res.status(200).json({ status: "ok" });
    }

    // ---- Media ----
    if (
      message.photo ||
      message.video ||
      message.audio ||
      message.voice ||
      message.document
    ) {
      await handleMedia(message, BOT_TOKEN);
    }
  } catch (err) {
    console.error("Handler error:", err);
  }

  return res.status(200).json({ status: "ok" });
      }
