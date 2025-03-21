import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { gameDB } from "../db/gameDB";
import { createCustomGameEmbed, createErrorEmbed } from "../lib/embeds";

export const balanceCommand = {
  data: {
    name: "balance",
    description: "カスタムゲームの参加管理とチーム分け",
    options: [
      {
        name: "track",
        description: "進行中のカスタムゲームを追跡（ゲームID入力）",
        type: 3,
        required: false,
      },
    ],
  },

  execute: async (interaction: any) => {
    await interaction.deferReply();

    try {
      const trackId = interaction.options.getString("track");

      // 追跡IDが指定されている場合はトラッキング処理
      if (trackId) {
        const game = gameDB.getGame(trackId);

        if (!game) {
          return await interaction.editReply({
            embeds: [
              createErrorEmbed(`ゲームID: ${trackId} が見つかりません。`),
            ],
          });
        }

        const participants = gameDB.getParticipants(trackId);

        if (participants.length === 0) {
          return await interaction.editReply({
            embeds: [createErrorEmbed("このゲームには参加者がいません。")],
          });
        }

        await interaction.editReply({
          content: "🔍 ゲームの追跡を開始しました...",
        });

        return;
      }

      // 新規ゲームの作成
      const gameId = `GAME_${Date.now()}`;
      gameDB.createGame(gameId, interaction.channelId);

      // 参加案内のEmbed作成
      const embed = createCustomGameEmbed(gameId, []);

      // ボタンとセレクトメニューを作成
      const joinButton = new ButtonBuilder()
        .setCustomId(`join_${gameId}`)
        .setLabel("参加する")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✅");

      const leaveButton = new ButtonBuilder()
        .setCustomId(`leave_${gameId}`)
        .setLabel("退出する")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌");

      const voiceJoinButton = new ButtonBuilder()
        .setCustomId(`voice_${gameId}`)
        .setLabel("VC参加者を追加")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🎤");

      const balanceTeamButton = new ButtonBuilder()
        .setCustomId(`balance_${gameId}`)
        .setLabel("チーム分け")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⚖️");

      const trackGameButton = new ButtonBuilder()
        .setCustomId(`track_${gameId}`)
        .setLabel("ゲーム追跡")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🔍");

      // 既存のボタン作成部分に終了ボタンを追加
      const endGameButton = new ButtonBuilder()
        .setCustomId(`end_${gameId}`)
        .setLabel("ゲーム終了")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🏁");

      const laneSelect = new StringSelectMenuBuilder()
        .setCustomId(`lane_${gameId}`)
        .setPlaceholder("希望レーンを選択")
        .addOptions([
          new StringSelectMenuOptionBuilder()
            .setLabel("TOP")
            .setValue("TOP")
            .setEmoji("↖️"),
          new StringSelectMenuOptionBuilder()
            .setLabel("JUNGLE")
            .setValue("JUNGLE")
            .setEmoji("🌳"),
          new StringSelectMenuOptionBuilder()
            .setLabel("MID")
            .setValue("MID")
            .setEmoji("➡️"),
          new StringSelectMenuOptionBuilder()
            .setLabel("BOTTOM")
            .setValue("BOTTOM")
            .setEmoji("↘️"),
          new StringSelectMenuOptionBuilder()
            .setLabel("SUPPORT")
            .setValue("SUPPORT")
            .setEmoji("🛡️"),
          new StringSelectMenuOptionBuilder()
            .setLabel("FILL")
            .setValue("FILL")
            .setEmoji("🔄"),
        ]);

      const buttonRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        joinButton,
        leaveButton,
        voiceJoinButton
      );
      // ボタン行の更新（buttonRow2に追加）
      const buttonRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        balanceTeamButton,
        trackGameButton,
        endGameButton
      );
      const selectRow =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          laneSelect
        );

      const reply = await interaction.editReply({
        embeds: [embed],
        components: [buttonRow1, buttonRow2, selectRow],
      });

      // メッセージIDを保存
      gameDB.updateGameMessage(gameId, reply.id);
    } catch (error) {
      console.error("バランシングエラー:", error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed("カスタムゲーム処理中にエラーが発生しました"),
        ],
      });
    }
  },
};

export default balanceCommand;
