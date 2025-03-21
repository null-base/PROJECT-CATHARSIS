import { EmbedBuilder, version as discordjsVersion } from "discord.js";

const BOT_VERSION = "0.0.0";

export const aboutCommand = {
  data: {
    name: "about",
    description: "BOTについての詳細情報を表示します",
  },

  execute: async (interaction: any) => {
    // 統計情報を収集
    const guilds = interaction.client.guilds.cache.size;
    const uptime = formatUptime(interaction.client.uptime);
    const users = interaction.client.guilds.cache.reduce(
      (acc: any, guild: { memberCount: any }) => acc + guild.memberCount,
      0
    );

    // 起動時間をフォーマット
    const botStartTime = new Date(
      Date.now() - interaction.client.uptime!
    ).toLocaleString("ja-JP");

    const embed = new EmbedBuilder()
      .setColor(0x7289da)
      .setTitle("PROJECT-CATHARSIS")
      .setDescription(
        "TYPE.Lは、League of Legendsのカスタムゲーム管理を支援するための多機能Botです。\n" +
          "チーム分けやプレイヤー情報の管理、戦績確認などの機能を提供します。"
      )
      .setThumbnail(
        interaction.client.user.displayAvatarURL({ dynamic: true, size: 512 })
      )
      .addFields(
        {
          name: "🛠️ バージョン",
          value: `v${BOT_VERSION}`,
          inline: true,
        },
        {
          name: "📊 統計情報",
          value: `サーバー数: ${guilds}\nユーザー数: ${users}\n稼働時間: ${uptime}`,
          inline: true,
        },
        {
          name: "👨‍💻 開発者",
          value:
            "[null先生](https://twitter.com/null_sensei)\n" +
            "[null-base.com](https://null-base.com)",
          inline: true,
        },
        {
          name: "🔧 使用技術",
          value: `Discord.js v${discordjsVersion}\nBun ${Bun.version}\nTypeScript`,
          inline: true,
        },
        {
          name: "🔗 リンク",
          value:
            "[サポートサーバー](https://discord.gg/wNgbkdXq6M)\n" +
            "[GitHub](https://github.com/null-base)\n" +
            "[ウェブサイト](https://null-base.com)",
          inline: true,
        },
        {
          name: "📅 最終起動",
          value: botStartTime,
          inline: true,
        }
      )
      .setFooter({
        text: "Powered by @null_sensei • null-base.com",
        iconURL:
          "https://cdn.discordapp.com/avatars/834055392727269387/953d512ef19ef1e915fe733fa637b67e.webp",
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

// 稼働時間のフォーマット関数
function formatUptime(ms: number | null): string {
  if (!ms) return "不明";

  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor(((seconds % 86400) % 3600) / 60);
  const secs = ((seconds % 86400) % 3600) % 60;

  let uptime = "";
  if (days > 0) uptime += `${days}日 `;
  if (hours > 0) uptime += `${hours}時間 `;
  if (minutes > 0) uptime += `${minutes}分 `;
  uptime += `${secs}秒`;

  return uptime;
}

export default aboutCommand;
