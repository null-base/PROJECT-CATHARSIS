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
  },

  execute: async (interaction: any) => {
    await interaction.deferReply();

    try {
      // 新規ゲームの作成
      const gameId = `GAME_${Date.now()}`;
      // デフォルトでランダム方式
      const balanceMethod = "random";

      // ゲーム作成時にバランス方法も指定
      gameDB.createGame(gameId, interaction.channelId, balanceMethod);

      // 参加案内のEmbed作成（バランス方法も渡す）
      const embed = createCustomGameEmbed(gameId, [], balanceMethod);

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
            .setEmoji("<:Top_icon:1352993574903484437>"),
          new StringSelectMenuOptionBuilder()
            .setLabel("JUNGLE")
            .setValue("JUNGLE")
            .setEmoji("<:Jungle_icon:1352993613210058874>"),
          new StringSelectMenuOptionBuilder()
            .setLabel("MID")
            .setValue("MID")
            .setEmoji("<:Middle_icon:1352993654003859516>"),
          new StringSelectMenuOptionBuilder()
            .setLabel("BOTTOM")
            .setValue("BOTTOM")
            .setEmoji("<:Bottom_icon:1352993685738094593>"),
          new StringSelectMenuOptionBuilder()
            .setLabel("SUPPORT")
            .setValue("SUPPORT")
            .setEmoji("<:Support_icon:1352993718596272168>"),
          new StringSelectMenuOptionBuilder()
            .setLabel("FILL")
            .setValue("FILL")
            .setEmoji("<:All_roles_icon:1352993499850608650>"),
        ]);

      // チーム分け方法選択メニューを追加
      const teamBalanceSelect = new StringSelectMenuBuilder()
        .setCustomId(`balancemethod_${gameId}`)
        .setPlaceholder("チーム分け方法を選択")
        .addOptions([
          new StringSelectMenuOptionBuilder()
            .setLabel("ランダム")
            .setValue("random")
            .setDescription("完全にランダムでチームを分けます")
            .setEmoji("🎲"),
          new StringSelectMenuOptionBuilder()
            .setLabel("勝率バランス")
            .setValue("winrate")
            .setDescription(
              "過去の勝率を考慮してバランスの取れたチームを作ります"
            )
            .setEmoji("📊"),
          new StringSelectMenuOptionBuilder()
            .setLabel("レベル均等")
            .setValue("level")
            .setDescription("サモナーレベルが均等になるようチームを分けます")
            .setEmoji("📈"),
          new StringSelectMenuOptionBuilder()
            .setLabel("ランク均等")
            .setValue("rank")
            .setDescription("ランクが均等になるようチームを分けます")
            .setEmoji("🏆"),
          new StringSelectMenuOptionBuilder()
            .setLabel("レーン実力")
            .setValue("lane")
            .setDescription("レーン別の実力を考慮してチームを分けます")
            .setEmoji("🛣️"),
        ]);

      const buttonRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        joinButton,
        leaveButton,
        voiceJoinButton
      );
      const buttonRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        balanceTeamButton,
        trackGameButton,
        endGameButton
      );
      const selectRowLane =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          laneSelect
        );
      const selectRowBalance =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          teamBalanceSelect
        );

      const reply = await interaction.editReply({
        embeds: [embed],
        components: [buttonRow1, buttonRow2, selectRowLane, selectRowBalance],
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
