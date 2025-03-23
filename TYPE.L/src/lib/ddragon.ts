import axios from "axios";

let cachedVersion = "";
let cachedChampions: Record<string, any> = {}; // チャンピオンデータのキャッシュ
let championIdMap: Record<number, string> = {}; // 数値ID→キー名マッピング

export const getLatestVersion = async () => {
  if (!cachedVersion) {
    const response = await axios.get(
      "https://ddragon.leagueoflegends.com/api/versions.json"
    );
    cachedVersion = response.data[0];
  }
  return cachedVersion;
};

export const getProfileIconUrl = async (iconId: number) => {
  try {
    const version = await getLatestVersion();
    return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${iconId}.png`;
  } catch (error) {
    return "https://static.wikia.nocookie.net/leagueoflegends/images/6/6b/Teamfight_Tactics_icon.png";
  }
};

/**
 * チャンピオンデータを取得する
 * @returns チャンピオンデータのオブジェクト
 */
export const getChampionsData = async () => {
  try {
    // キャッシュが存在する場合はそれを返す
    if (Object.keys(cachedChampions).length > 0) {
      return cachedChampions;
    }

    // 最新バージョンを取得
    const version = await getLatestVersion();

    // チャンピオンデータを取得
    const response = await axios.get(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/ja_JP/champion.json`
    );

    // データをキャッシュ
    cachedChampions = response.data.data;

    // 数値IDからキー名へのマッピングを作成
    for (const champKey in cachedChampions) {
      const champion = cachedChampions[champKey];
      championIdMap[parseInt(champion.key)] = champKey;
    }

    return cachedChampions;
  } catch (error) {
    console.error("チャンピオンデータの取得に失敗:", error);
    return {};
  }
};

/**
 * チャンピオンIDからチャンピオン名を取得する
 * @param championId 数値または文字列のチャンピオンID
 * @returns チャンピオン名（日本語）
 */
export const getChampionNameById = async (
  championId: number | string
): Promise<string> => {
  try {
    await getChampionsData(); // データが取得済みか確認

    if (typeof championId === "number" || !isNaN(Number(championId))) {
      // 数値IDの場合
      const numericId =
        typeof championId === "string" ? parseInt(championId) : championId;
      const champKey = championIdMap[numericId];

      if (!champKey) {
        return "不明なチャンピオン";
      }

      return cachedChampions[champKey]?.name || "不明なチャンピオン";
    } else {
      // キー名（文字列ID）の場合
      return (
        cachedChampions[championId as string]?.name || "不明なチャンピオン"
      );
    }
  } catch (error) {
    console.error("チャンピオン名の取得に失敗:", error);
    return "不明なチャンピオン";
  }
};

/**
 * チャンピオンIDからアイコン画像URLを取得する
 * @param championId 数値または文字列のチャンピオンID
 * @returns チャンピオンアイコンのURL
 */
export const getChampionIconUrl = async (
  championId: number | string
): Promise<string> => {
  try {
    await getChampionsData(); // データが取得済みか確認
    const version = await getLatestVersion();

    let champKey = "";

    if (typeof championId === "number" || !isNaN(Number(championId))) {
      // 数値IDの場合
      const numericId =
        typeof championId === "string" ? parseInt(championId) : championId;
      champKey = championIdMap[numericId];
    } else {
      // キー名（文字列ID）の場合
      champKey = championId as string;
    }

    if (!champKey) {
      return "https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Aatrox_0.jpg";
    }

    return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champKey}.png`;
  } catch (error) {
    console.error("チャンピオンアイコンの取得に失敗:", error);
    return "https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Aatrox_0.jpg";
  }
};
