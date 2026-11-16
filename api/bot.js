const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');
const FormData = require('form-data');

const bot = new Telegraf(process.env.BOT_TOKEN);

// ඔයාගේ Cloudinary සර්වර් 4
const servers = [
  { cloudName: "wwb8ifud", uploadPreset: "dg_dev" },
  { cloudName: "rakvvolf", uploadPreset: "dg_dev1" },
  { cloudName: "v2dlq2nx", uploadPreset: "dg_dev2" },
  { cloudName: "dxctmzctl", uploadPreset: "Dg_project" }
];

// සර්වර් හරහා ස්වයංක්‍රීයව මාරු වෙමින් (Fallback) අප්ලෝඩ් කිරීමේ ෆන්ෂන් එක
async function uploadToCloudinaryWithFallback(fileBuffer, mimeType) {
  for (let i = 0; i < servers.length; i++) {
    const server = servers[i];
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, { filename: 'file', contentType: mimeType });
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

// /start කමාන්ඩ් එකට පිළිතුරු
bot.start((ctx) => {
  ctx.reply(
    "👋 Welcome to DG-DEV Media URL Generator Bot!\n\n" +
    "📤 Send me any Image, Video, or Audio files (single or multiple at once), and I will generate direct URLs for you using our multi-server network!"
  );
});

// ෆයිල් හෝ ෆොටෝ ලැබුනු විට ක්‍රියාත්මක වීම (Multiple files ද ඇතුළුව)
bot.on(['photo', 'video', 'audio', 'document'], async (ctx) => {
  let fileId = null;
  let mimeType = 'application/octet-stream';

  if (ctx.message.photo) {
    // Photos වල වැඩිම resolution එක තෝරාගැනීම
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    fileId = photo.file_id;
    mimeType = 'image/jpeg';
  } else if (ctx.message.video) {
    fileId = ctx.message.video.file_id;
    mimeType = ctx.message.video.mime_type || 'video/mp4';
  } else if (ctx.message.audio) {
    fileId = ctx.message.audio.file_id;
    mimeType = ctx.message.audio.mime_type || 'audio/mpeg';
  } else if (ctx.message.document) {
    fileId = ctx.message.document.file_id;
    mimeType = ctx.message.document.mime_type || 'application/octet-stream';
  }

  if (!fileId) return ctx.reply("❌ Please send a valid image, video, or audio file.");

  const processingMsg = await ctx.reply("⏳ Downloading and uploading to DG-DEV Servers...");

  try {
    // Telegram වලින් ෆයිල් ලින්ක් එක ලබාගැනීම
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const fileRes = await fetch(fileLink);
    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // සර්වර් හරහා අප්ලෝඩ් කිරීම
    const result = await uploadToCloudinaryWithFallback(buffer, mimeType);

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      processingMsg.message_id,
      undefined,
      `✅ **Upload Successful!**\n\n` +
      `🌐 **Server:** ${result.serverUsed}\n` +
      `🔗 **Direct URL:**\n\`${result.url}\``,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      processingMsg.message_id,
      undefined,
      `❌ Upload failed: ${error.message}`
    );
  }
});

// Vercel සඳහා Webhook Export කිරීම
module.exports = async (req, res) => {
  if (req.method === 'POST') {
    await bot.handleUpdate(req.body);
    res.status(200).json({ status: 'ok' });
  } else {
    res.status(200).send('DG-DEV Bot is running successfully!');
  }
};
