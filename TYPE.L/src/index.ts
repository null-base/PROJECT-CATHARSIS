import {
  ActivityType,
  Client,
  GatewayIntentBits,
  REST,
  Routes,
} from "discord.js";
import * as commands from "./commands";
import { interactionCreate } from "./events/interactionCreate";
import {
  DEV_GUILD_IDS,
  DISCORD_TOKEN,
  IS_DEVELOPMENT,
  MAINTENANCE_MODE,
} from "./lib/config";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);

  // 環境情報をログ出力
  if (IS_DEVELOPMENT) {
    console.log("🛠️ 開発環境で起動中");
  } else {
    console.log("🚀 本番環境で起動中");
  }

  // メンテナンスモードの場合はステータスを変更
  if (MAINTENANCE_MODE) {
    client.user?.setPresence({
      activities: [{ name: "🔧 メンテナンス中", type: ActivityType.Custom }],
      status: "dnd",
    });
    console.log("⚠️ メンテナンスモードで起動しました");
  } else {
    client.user?.setPresence({
      activities: [{ name: "League of Legends", type: ActivityType.Playing }],
      status: "dnd",
    });
  }

  // REST APIインスタンスの作成
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  try {
    // メンテナンスモード時はデバッグコマンドのみ登録
    if (MAINTENANCE_MODE) {
      console.log("🔧 メンテナンスモード: デバッグコマンドのみ登録中...");

      // 通常のコマンドをクリア
      await rest.put(Routes.applicationCommands(client.user!.id), {
        body: [],
      });
      console.log("✅ 通常のコマンドをクリア完了");

      // デバッグコマンドのみ開発サーバーに登録
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
      }
    } else {
      // 通常モード: 全コマンド登録
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
    }
  } catch (error) {
    console.error("コマンド登録中にエラーが発生しました:", error);
  }
});

client.on("interactionCreate", interactionCreate);
client.login(DISCORD_TOKEN);
