import {
  ActionRowBuilder,
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
    await interaction.deferReply();

    try {
      const riotId = interaction.fields.getTextInputValue("riotId");
      const tagline = interaction.fields.getTextInputValue("tagline");

      // PUUIDの取得（ここで404エラーが発生する可能性がある）
      let puuid;
      try {
        puuid = await RiotAPI.getPuuid(riotId, tagline);
      } catch (apiError: any) {
        // APIからのエラーを詳細に処理
        if (apiError.response && apiError.response.status === 404) {
          return await interaction.editReply({
            embeds: [
              createErrorEmbed(
                `プレイヤー「${riotId}#${tagline}」が見つかりません。名前とタグラインを確認してください。`
              ),
            ],
          });
        } else if (apiError.response) {
          console.error(
            "APIエラー:",
            apiError.response.status,
            apiError.response.data
          );
          return await interaction.editReply({
            embeds: [
              createErrorEmbed(
                `Riot APIエラー (${apiError.response.status}): ${
                  apiError.response.data.status?.message || "不明なエラー"
                }`
              ),
            ],
          });
        } else {
          // ネットワークエラーなど
          console.error("APIリクエストエラー:", apiError);
          throw apiError; // 一般エラーとして再スロー
        }
      }

      const region = RiotAPI.detectRegionFromPuuid(puuid);

      let summonerData;
      try {
        summonerData = await RiotAPI.getSummonerData(region, puuid);
      } catch (apiError: any) {
        if (apiError.response && apiError.response.status === 404) {
          return await interaction.editReply({
            embeds: [
              createErrorEmbed(
                `サモナー情報が見つかりません。Riot IDが正しいか確認してください。`
              ),
            ],
          });
        }
        throw apiError;
      }

      let rankData;
      try {
        rankData = await RiotAPI.getRankData(region, summonerData.puuid);
      } catch (apiError: any) {
        // ランクデータがなくても続行可能
        console.warn("ランクデータ取得エラー:", apiError);
        rankData = [];
      }

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
        profile_icon_id: summonerData.profileIconId || 0,
      };

      savePlayer(playerData);
      await interaction.editReply({
        embeds: [createRegisterEmbed(playerData)],
      });
    } catch (error) {
      console.error("登録エラー:", error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed(
            "登録処理中にエラーが発生しました。しばらく経ってからもう一度お試しください。"
          ),
        ],
      });
    }
  },
  execute: async (interaction: any) => {
    await interaction.showModal(createRegisterModal());
  },
};

const createRegisterModal = () => {
  return new ModalBuilder()
    .setCustomId("registerModal")
    .setTitle("プレイヤー登録")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("riotId")
          .setLabel("ゲーム名")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("tagline")
          .setLabel("タグライン（例: JP1）")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
};

export default registerCommand;
