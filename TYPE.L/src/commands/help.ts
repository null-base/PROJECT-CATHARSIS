import {
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { addStandardFooter } from "../lib/embedHelper";
import { createErrorEmbed } from "../lib/embeds";

export const helpCommand = {
  data: {
    name: "help",
    description: "ボットのコマンド一覧と使い方を表示",
    options: [
      {
        name: "command",
        description: "詳細を表示するコマンド",
        type: 3, // STRING
        required: false,
        choices: [
          { name: "register", value: "register" },
          { name: "profile", value: "profile" },
          { name: "balance", value: "balance" },
          { name: "history", value: "history" },
          { name: "stats", value: "stats" },
          { name: "about", value: "about" },
          { name: "カスタムゲームガイド", value: "custom" },
        ],
      },
    ],
  },

  execute: async (interaction: any) => {
    const commandName = interaction.options.getString("command");

    await interaction.deferReply();

    try {
      if (commandName) {
        // 特定のコマンドの詳細ヘルプを表示
        const helpEmbed = await getCommandHelpEmbed(
          commandName,
          interaction.client
        );
        return await interaction.editReply({ embeds: [helpEmbed] });
      } else {
        // 一般的なヘルプを表示
        const generalHelpEmbed = await createGeneralHelpEmbed(
          interaction.client
        );

        // コマンド選択メニューを追加
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("help_select")
          .setPlaceholder("詳細情報を表示するコマンドを選択")
          .addOptions([
            new StringSelectMenuOptionBuilder()
              .setLabel("register")
              .setDescription("Riot IDの登録方法")
              .setValue("register")
              .setEmoji("📝"),
            new StringSelectMenuOptionBuilder()
              .setLabel("profile")
              .setDescription("プレイヤープロフィールの表示")
              .setValue("profile")
              .setEmoji("👤"),
            new StringSelectMenuOptionBuilder()
              .setLabel("balance")
              .setDescription("カスタムゲーム作成とチーム分け")
              .setValue("balance")
              .setEmoji("⚖️"),
            new StringSelectMenuOptionBuilder()
              .setLabel("history")
              .setDescription("過去の試合履歴の表示")
              .setValue("history")
              .setEmoji("🕒"),
            new StringSelectMenuOptionBuilder()
              .setLabel("stats")
              .setDescription("カスタムゲーム統計の確認")
              .setValue("stats")
              .setEmoji("📊"),
            new StringSelectMenuOptionBuilder()
              .setLabel("カスタムゲームガイド")
              .setDescription("カスタムゲームの機能と使い方")
              .setValue("custom")
              .setEmoji("🎮"),
          ]);

        const row =
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            selectMenu
          );

        return await interaction.editReply({
          embeds: [generalHelpEmbed],
          components: [row],
        });
      }
    } catch (error) {
      console.error("ヘルプ表示エラー:", error);
      return await interaction.editReply({
        embeds: [
          createErrorEmbed("ヘルプ情報の表示中にエラーが発生しました。"),
        ],
      });
    }
  },

  // セレクトメニューのハンドラ
  handleHelpSelect: async (interaction: any) => {
    const commandName = interaction.values[0];

    await interaction.deferUpdate();

    try {
      const helpEmbed = await getCommandHelpEmbed(
        commandName,
        interaction.client
      );
      await interaction.editReply({ embeds: [helpEmbed] });
    } catch (error) {
      console.error("ヘルプ選択エラー:", error);
      await interaction.followUp({
        embeds: [
          createErrorEmbed("コマンド情報の表示中にエラーが発生しました。"),
        ],
        ephemeral: true,
      });
    }
  },
};

// 一般的なヘルプメッセージを作成
async function createGeneralHelpEmbed(client: any): Promise<EmbedBuilder> {
  const embed = new EmbedBuilder()
    .setColor(0x7289da)
    .setTitle("TYPE.L Bot ヘルプ")
    .setDescription(
      "League of Legendsのカスタムゲーム管理を支援するBotです。以下のコマンドが使用できます。"
    )
    .addFields(
      {
        name: "🔰 はじめに",
        value:
          "`/register` - Riot IDを登録して機能を利用できるようにします\n`/profile` - 登録したプレイヤーの情報を表示します\n`/about` - BOTについての情報を表示します",
        inline: false,
      },
      {
        name: "🎮 カスタムゲーム",
        value:
          "`/balance` - カスタムゲーム募集画面を作成します\nゲーム募集画面から参加登録、チーム分け、試合追跡などが行えます",
        inline: false,
      },
      {
        name: "📊 統計・履歴",
        value:
          "`/history` - 最近の試合結果を表示します\n`/stats` - カスタムゲームの統計情報を表示します",
        inline: false,
      },
      {
        name: "💡 詳細ヘルプ",
        value:
          "各コマンドの詳細は、下のメニューから確認するか、`/help command:コマンド名` で確認できます",
        inline: false,
      }
    );

  // サムネイルとしてボットのアイコンを表示
  embed.setThumbnail(
    client.user.displayAvatarURL({ dynamic: true, size: 128 })
  );

  // 標準フッターを追加
  return await addStandardFooter(embed, client);
}

// 特定コマンドの詳細ヘルプを取得
async function getCommandHelpEmbed(
  commandName: string,
  client: any
): Promise<EmbedBuilder> {
  let embed = new EmbedBuilder();

  switch (commandName) {
    case "register":
      embed
        .setColor(0x4caf50)
        .setTitle("📝 登録コマンド")
        .setDescription("League of Legendsのアカウントを登録します")
        .addFields(
          {
            name: "使い方",
            value: "`/register` - 登録用フォームが表示されます",
            inline: false,
          },
          {
            name: "登録方法",
            value:
              "1. Riot ID (例: `プレイヤー名`) を入力\n2. タグライン (例: `JP1`) を入力\n3. 送信して登録完了",
            inline: false,
          },
          {
            name: "注意点",
            value:
              "- 正確なRiot IDとタグラインを入力してください\n- アカウントが見つからない場合はエラーが表示されます\n- 登録したアカウントは `/unregister` で削除できます",
            inline: false,
          }
        );
      break;

    case "profile":
      embed
        .setColor(0x2196f3)
        .setTitle("👤 プロフィールコマンド")
        .setDescription("登録したアカウントの情報を表示します")
        .addFields(
          {
            name: "使い方",
            value: "`/profile` - 自分のプロフィールを表示",
            inline: false,
          },
          {
            name: "表示内容",
            value:
              "- サモナーレベル\n- ランク情報（ソロ/デュオ、フレックス）\n- 最近のマッチのチャンピオン\n- 勝率など",
            inline: false,
          },
          {
            name: "注意点",
            value:
              "プロフィールを表示するには `/register` コマンドで登録が必要です",
            inline: false,
          }
        );
      break;

    case "balance":
      embed
        .setColor(0xffc107)
        .setTitle("⚖️ バランスコマンド")
        .setDescription("カスタムゲーム募集とチーム分けを行います")
        .addFields(
          {
            name: "使い方",
            value: "`/balance` - カスタムゲーム募集画面を作成",
            inline: false,
          },
          {
            name: "主な機能",
            value:
              "- **参加する** - ゲームに参加登録\n- **退出する** - ゲームから退出\n- **VC参加者を追加** - 通話中のメンバーをまとめて追加\n- **チーム分け** - 参加者をチームに振り分け\n- **ゲーム追跡** - 実際の対戦を監視\n- **ゲーム終了** - 募集を終了",
            inline: false,
          },
          {
            name: "チーム分け方法",
            value:
              "- **ランダム** - 完全にランダムで分ける\n- **勝率バランス** - 勝率を考慮してバランス良く\n- **レベル均等** - サモナーレベルを均等に\n- **ランク均等** - ランクを考慮して均等に\n- **レーン実力** - レーン別の実力を考慮",
            inline: false,
          }
        );
      break;

    case "history":
      embed
        .setColor(0x9c27b0)
        .setTitle("🕒 履歴コマンド")
        .setDescription("最近のゲーム履歴を表示します")
        .addFields(
          {
            name: "使い方",
            value: "`/history` - 最近の試合履歴を表示",
            inline: false,
          },
          {
            name: "表示内容",
            value:
              "- 直近5試合の結果\n- 使用チャンピオン\n- KDA統計\n- CS数\n- 試合時間など",
            inline: false,
          },
          {
            name: "注意点",
            value: "履歴を表示するには `/register` コマンドで登録が必要です",
            inline: false,
          }
        );
      break;

    case "stats":
      embed
        .setColor(0xff5722)
        .setTitle("📊 統計コマンド")
        .setDescription("カスタムゲームの統計情報を表示します")
        .addFields(
          {
            name: "使い方",
            value:
              "`/stats player [user]` - プレイヤーの統計\n`/stats server` - サーバー全体の統計\n`/stats history [count]` - 最近のゲーム履歴",
            inline: false,
          },
          {
            name: "プレイヤー統計",
            value:
              "- 試合数、勝敗数、勝率\n- KDA統計\n- よく使うチャンピオン情報",
            inline: false,
          },
          {
            name: "サーバー統計",
            value: "- 総ゲーム数\n- チーム別勝率\n- 最近のゲーム履歴",
            inline: false,
          }
        );
      break;

    case "about":
      embed
        .setColor(0x607d8b)
        .setTitle("ℹ️ Aboutコマンド")
        .setDescription("BOTについての情報を表示します")
        .addFields(
          {
            name: "使い方",
            value: "`/about` - BOT情報を表示",
            inline: false,
          },
          {
            name: "表示内容",
            value: "- バージョン\n- 開発者情報\n- 関連リンク",
            inline: false,
          }
        );
      break;

    case "custom":
      embed
        .setColor(0x8bc34a)
        .setTitle("🎮 カスタムゲーム機能ガイド")
        .setDescription("カスタムゲーム管理機能の詳しい使い方")
        .addFields(
          {
            name: "基本的な流れ",
            value:
              "1. `/balance` コマンドでゲーム募集画面を作成\n2. プレイヤーが「参加する」ボタンで参加登録\n3. レーン選択で希望ポジションを設定\n4. 「チーム分け」ボタンでチームを決定\n5. 実際にゲームを開始したら「ゲーム追跡」ボタンで監視\n6. ゲーム終了後に結果が自動表示される",
            inline: false,
          },
          {
            name: "ゲーム追跡機能",
            value:
              "- 参加者のアクティブゲームを検出して監視\n- リアルタイムの試合情報を表示\n- 終了後に自動で結果を表示",
            inline: false,
          },
          {
            name: "結果の保存",
            value:
              "- ゲーム結果は統計情報として保存される\n- `/stats` コマンドで過去の統計を確認可能\n- サーバー全体やプレイヤー個人の統計を表示",
            inline: false,
          }
        );
      break;

    default:
      embed
        .setColor(0x7289da)
        .setTitle("❓ ヘルプ")
        .setDescription(
          "コマンドが見つかりませんでした。`/help` で全体の一覧を確認してください。"
        );
  }

  // 標準フッターを追加
  return await addStandardFooter(embed, client);
}

export default helpCommand;
