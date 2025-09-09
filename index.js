// index.js
import { Client, GatewayIntentBits } from "npm:discord.js@14.14.1";
import googleTrends from "npm:google-trends-api@4.9.2";
import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.17.0";

// 環境変数 (Deno Deploy の Dashboard で設定してください)
const DISCORD_TOKEN = Deno.env.get("DISCORD_TOKEN");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const CHANNEL_ID = "1116735137594474577";

// Discordクライアント
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// Gemini API
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// ネガティブ判定
async function isNegativeTrend(trend) {
  const prompt = `次の話題がネガティブ（事件・事故・不幸・批判など）かどうかを「YES」か「NO」で答えてください。\n話題: "${trend}"`;
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().toUpperCase();
    return text.includes("YES");
  } catch (e) {
    console.error("Gemini API error:", e);
    return false;
  }
}

// トレンド取得＆投稿
async function postGoogleTrends() {
  try {
    const trends = await googleTrends.dailyTrends({ geo: "JP" });

    const json = JSON.parse(trends);
    const trendList = json.default.trendingSearchesDays[0].trendingSearches || [];

    for (const trend of trendList) {
      const title = trend.title.query;
      const image = trend.image?.imageUrl || null;

      const negative = await isNegativeTrend(title);
      if (negative) {
        console.log(`Skipped (negative): ${title}`);
        continue;
      }

      const channel = await client.channels.fetch(CHANNEL_ID);
      if (!channel) return;

      await channel.send({
        content: `From Google Trends\n${title}\nMade in _rec877_\n${image ? image : ""}`,
      });

      break; // 1件だけ投稿
    }
  } catch (e) {
    console.error("Error fetching trends:", e);
  }
}

// Bot準備完了
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ✅ 2分ごとに実行 (Deno Deploy の cron)
Deno.cron("GoogleTrends", "0 * * * *", async () => {
  await postGoogleTrends();
});

await client.login(DISCORD_TOKEN);
