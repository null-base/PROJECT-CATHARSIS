import {
  ActivityType,
  Client,
  GatewayIntentBits,
  REST,
  Routes,
} from "discord.js";
import * as commands from "./commands";
import { interactionCreate } from "./events/interactionCreate";
import { DEV_GUILD_IDS, DISCORD_TOKEN } from "./lib/config";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);
  client.user?.setPresence({
    activities: [{ name: "League of Legends", type: ActivityType.Playing }],
    status: "dnd",
  });

  // REST APIインスタンスの作成
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  try {
    // デバッグコマンドを除く通常のコマンドリスト
    const normalCommands = Object.values(commands)
      .filter((cmd) => cmd.data.name !== "debug")
      .map((cmd) => cmd.data);

    // 通常のコマンドはグローバルに登録
    console.log("✅ 標準コマンドをグローバルに登録中...");
    await rest.put(Routes.applicationCommands(client.user!.id), {
      body: normalCommands,
    });
    console.log("✅ 標準コマンド登録完了");

    // デバッグコマンドは開発サーバーのみに登録
    if (DEV_GUILD_IDS.length > 0) {
      const debugCommand = commands.debugCommand.data;

      for (const guildId of DEV_GUILD_IDS) {
        console.log(`✅ デバッグコマンドをサーバー ${guildId} に登録中...`);
        await rest.put(
          Routes.applicationGuildCommands(client.user!.id, guildId),
          {
            body: [debugCommand],
          }
        );
        console.log(`✅ デバッグコマンドをサーバー ${guildId} に登録完了`);
      }
    } else {
      console.log(
        "⚠️ 開発サーバーIDが設定されていないため、デバッグコマンドは登録されませんでした"
      );
    }
  } catch (error) {
    console.error("コマンド登録中にエラーが発生しました:", error);
  }
});

client.on("interactionCreate", interactionCreate);
client.login(DISCORD_TOKEN);
