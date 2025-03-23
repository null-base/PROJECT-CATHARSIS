import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { gameDB } from "../db/gameDB";
import { createCustomGameEmbed } from "../lib/embeds";

// 新規カスタムゲーム募集を作成する関数
export async function createNewCustomGame(client: any, channelId: string) {
  try {
    // チャンネル情報を取得
    const channel = await client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      console.error("有効なテキストチャンネルではありません");
      return null;
    }

    // サーバーID取得
    const serverId = channel.guild.id;

    // ゲームIDはタイムスタンプのみ
    const gameId = Date.now().toString();

    // データベースに新規ゲームを作成
    gameDB.createGame(gameId, serverId, channelId);

    // 参加案内のEmbed作成
    const embed = createCustomGameEmbed(gameId, [], "random");

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
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(laneSelect);
    const selectRowBalance =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        teamBalanceSelect
      );

    // 新しいカスタムゲーム募集メッセージを送信
    const message = await channel.send({
      embeds: [embed],
      components: [buttonRow1, buttonRow2, selectRowLane, selectRowBalance],
    });

    // メッセージIDを保存
    gameDB.updateGameMessage(gameId, message.id);

    return gameId;
  } catch (error) {
    console.error("新規カスタムゲーム作成エラー:", error);
    return null;
  }
}
