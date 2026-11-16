const servers = [
  { cloudName: "wwb8ifud", uploadPreset: "dg_dev" },
  { cloudName: "rakvvolf", uploadPreset: "dg_dev1" },
  { cloudName: "v2dlq2nx", uploadPreset: "dg_dev2" },
  { cloudName: "dxctmzctl", uploadPreset: "Dg_project" }
];

// බිල්ට්-ඉන් Fetch මගින් සර්වර් හරහා අප්ලෝඩ් කිරීම (Fallback සමඟ)
async function uploadToCloudinary(fileBuffer, mimeType, fileName) {
  for (let i = 0; i < servers.length; i++) {
    const server = servers[i];
    try {
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: mimeType });
      formData.append('file', blob, fileName || 'file');
      formData.append('upload_preset', server.uploadPreset);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${server.cloudName}/auto/upload`,
        {
          method: 'POST',
          body: formData
        }
      );

      const data = await response.json();
      if (response.ok && data.secure_url) {
        return { url: data.secure_url, serverUsed: `Server ${i + 1}` };
      }
    } catch (err) {
      console.log(`Server ${i + 1} failed, trying next...`);
    }
  }
  throw new Error('All servers are currently busy or failed.');
}

async function sendTelegramMessage(chatId, text, token) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'Markdown' })
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('DG-DEV Bot is running successfully!');
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const update = req.body;

  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text;

    if (text === '/start') {
      await sendTelegramMessage(
        chatId,
        "👋 Welcome to DG-DEV Media URL Generator Bot!\n\n📤 Send me any Image, Video, or Audio files, and I will generate direct URLs using our multi-server network!",
        BOT_TOKEN
      );
      return res.status(200).json({ status: 'ok' });
    }

    let fileId = null;
    let fileName = 'file';
    let mimeType = 'application/octet-stream';

    if (update.message.photo) {
      const photo = update.message.photo[update.message.photo.length - 1];
      fileId = photo.file_id;
      mimeType = 'image/jpeg';
      fileName = 'image.jpg';
    } else if (update.message.video) {
      fileId = update.message.video.file_id;
      mimeType = update.message.video.mime_type || 'video/mp4';
      fileName = update.message.video.file_name || 'video.mp4';
    } else if (update.message.audio) {
      fileId = update.message.audio.file_id;
      mimeType = update.message.audio.mime_type || 'audio/mpeg';
      fileName = update.message.audio.file_name || 'audio.mp3';
    } else if (update.message.document) {
      fileId = update.message.document.file_id;
      mimeType = update.message.document.mime_type || 'application/octet-stream';
      fileName = update.message.document.file_name || 'document';
    }

    if (fileId) {
      try {
        // Telegram ਤੋਂ File Path ලබාගැනීම
        const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
        const fileData = await fileRes.json();

        if (fileData.ok) {
          const filePath = fileData.result.file_path;
          const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
          
          const mediaRes = await fetch(downloadUrl);
          const arrayBuffer = await mediaRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const result = await uploadToCloudinary(buffer, mimeType, fileName);

          await sendTelegramMessage(
            chatId,
            `✅ **Upload Successful!**\n\n🌐 **Server:** ${result.serverUsed}\n🔗 **Direct URL:**\n\`${result.url}\``,
            BOT_TOKEN
          );
        } else {
          await sendTelegramMessage(chatId, "❌ Failed to fetch file from Telegram.", BOT_TOKEN);
        }
      } catch (error) {
        await sendTelegramMessage(chatId, `❌ Upload failed: ${error.message}`, BOT_TOKEN);
      }
    }
  }

  return res.status(200).json({ status: 'ok' });
}
