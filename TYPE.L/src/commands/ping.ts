import { EmbedBuilder } from "discord.js";
import { createErrorEmbed } from "../lib/embeds";

export const pingCommand = {
  data: {
    name: "ping",
    description: "Pingをチェック",
  },

  execute: async (interaction: any) => {
    try {
      const start = Date.now();
      const latency = interaction.client.ws.ping;
      const apiLatency = Date.now() - start;

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("🏓 Pong!")
        .setFooter({
          text: "Power by @null_sensei • null-base.com",
          iconURL:
            "https://cdn.discordapp.com/avatars/834055392727269387/953d512ef19ef1e915fe733fa637b67e.webp",
        })
        .addFields(
          { name: "📡 WebSocket Ping", value: `${latency}ms`, inline: true },
          { name: "⚡ API Latency", value: `${apiLatency}ms`, inline: true }
        );

      await interaction.reply({
        embeds: [embed],
      });
    } catch (error) {
      await interaction.reply({
        embeds: [createErrorEmbed("Pingの取得に失敗しました")],
      });
    }
  },
};

export default pingCommand;
