import { EmbedBuilder } from "discord.js";
import { BOT_DEVELOPER_ID, BOT_DEVELOPER_NAME, BOT_WEBSITE } from "./config";

/**
 * すべてのEmbedに統一されたフッターを設定します
 * @param embed 装飾するEmbedBuilder
 * @param client Discord Client (ユーザー情報取得に必要)
 * @returns フッターが設定されたEmbedBuilder
 */
export async function addStandardFooter(
  embed: EmbedBuilder,
  client: any
): Promise<EmbedBuilder> {
  try {
    // 開発者情報を取得（キャッシュから取得できない場合はAPIを呼び出す）
    const developer =
      client.users.cache.get(BOT_DEVELOPER_ID) ||
      (await client.users.fetch(BOT_DEVELOPER_ID).catch(() => null));

    const footerText = `Powered by @${BOT_DEVELOPER_NAME} • ${BOT_WEBSITE}`;

    if (developer) {
      // 開発者のアバターURLを使用
      const iconURL = developer.displayAvatarURL({ dynamic: true });
      embed.setFooter({ text: footerText, iconURL });
    } else {
      // 開発者情報が取得できない場合はテキストのみ
      embed.setFooter({ text: footerText });
    }

    return embed;
  } catch (error) {
    // エラー時は基本的なフッターだけ設定
    console.error("フッター設定エラー:", error);
    return embed.setFooter({
      text: `Powered by ${BOT_WEBSITE}`,
    });
  }
}

/**
 * 標準フッターを持つ新しいEmbedBuilderを作成します
 * @param client Discord Client
 * @param color 色コード (デフォルト: 0x7289da)
 * @returns フッター付きのEmbedBuilder
 */
export async function createStandardEmbed(
  client: any,
  color = 0x7289da
): Promise<EmbedBuilder> {
  const embed = new EmbedBuilder().setColor(color);
  return await addStandardFooter(embed, client);
}
