import { RiotAPI } from "./riotApi";

/**
 * チーム分け方法の表示名を取得する関数
 */
export function getMethodName(method: string): string {
  const methodNames: Record<string, string> = {
    random: "ランダム",
    winrate: "勝率バランス",
    level: "レベル均等",
    rank: "ランク均等",
    lane: "レーン実力",
  };

  return methodNames[method] || "ランダム";
}

/**
 * ゲームの経過時間をフォーマットする関数
 */
export function formatGameTime(seconds: number): string {
  if (!seconds || seconds < 0) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

/**
 * Riot APIで最近の試合を取得するためのラッパー関数
 * (APIにまだ実装されていない可能性があるため追加)
 */
export async function getRecentMatches(
  region: string,
  puuid: string,
  count: number = 5
) {
  try {
    return await RiotAPI.getRecentMatches(puuid, region, count);
  } catch (error) {
    console.error("最近の試合取得エラー:", error);
    return [];
  }
}
