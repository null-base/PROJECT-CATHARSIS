import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { savePlayer } from "../db";
import { createErrorEmbed, createRegisterEmbed } from "../lib/embeds";
import { RiotAPI } from "../lib/riotApi";
import type { PlayerData } from "../types/types";

export const registerCommand = {
  data: {
    name: "register",
    description: "Riot IDでプレイヤー登録",
  },

  handleModalSubmit: async (interaction: any) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const riotId = interaction.fields.getTextInputValue("riotId");
      const tagline = interaction.fields.getTextInputValue("tagline");

      const puuid = await RiotAPI.getPuuid(riotId, tagline);
      const region = RiotAPI.detectRegionFromPuuid(puuid);
      const summonerData = await RiotAPI.getSummonerData(region, puuid);
      const rankData = await RiotAPI.getRankData(region, summonerData.puuid);

      const soloRank = rankData.find(
        (d: any) => d.queueType === "RANKED_SOLO_5x5"
      );
      const flexRank = rankData.find(
        (d: any) => d.queueType === "RANKED_FLEX_SR"
      );

      const playerData: PlayerData = {
        user_id: interaction.user.id,
        puuid,
        riot_id: riotId,
        tagline,
        region,
        solo_tier: soloRank?.tier || "UNRANKED",
        solo_division: soloRank?.rank || "",
        solo_lp: soloRank?.leaguePoints || 0,
        flex_tier: flexRank?.tier || "UNRANKED",
        flex_division: flexRank?.rank || "",
        flex_lp: flexRank?.leaguePoints || 0,
        level: summonerData.summonerLevel,
      };

      savePlayer(playerData);
      await interaction.editReply({
        embeds: [createRegisterEmbed(playerData)],
      });
    } catch (error) {
      console.log(error);
      await interaction.editReply({
        embeds: [createErrorEmbed("登録に失敗しました")],
        ephemeral: true,
      });
    }
  },
  execute: async (interaction: any) => {
    await interaction.showModal(createRegisterModal());
  },
};

const createRegisterModal = () => {
  return new ModalBuilder()
    .setCustomId("registerModal") // IDを明示的に設定
    .setTitle("プレイヤー登録")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("riotId")
          .setLabel("Riot ID（ユーザー名）")
          .setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("tagline")
          .setLabel("タグライン（例: KR1）")
          .setStyle(TextInputStyle.Short)
      )
    );
};

export default registerCommand;
