import axios from "axios";
import { RIOT_API_KEY, routingRegionMap } from "./config";

export const RiotAPI = {
  async getPuuid(riotId: string, tag: string): Promise<string> {
    const response = await axios.get(
      `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
        riotId
      )}/${encodeURIComponent(tag)}`,
      { headers: { "X-Riot-Token": RIOT_API_KEY } }
    );
    return response.data.puuid;
  },

  async getGamenameTagline(puuid: string): Promise<any> {
    const response = await axios.get(
      `https://asia.api.riotgames.com//riot/account/v1/accounts/by-puuid/${puuid}`,
      { headers: { "X-Riot-Token": RIOT_API_KEY } }
    );
    return response.data;
  },

  detectRegionFromPuuid(puuid: string): string {
    const regionMap: Record<string, string> = {
      NA: "na1",
      BR: "br1",
      EUW: "euw1",
      EUNE: "eun1",
      JP: "jp1",
      KR: "kr",
      LAN: "la1",
      LAS: "la2",
      OCE: "oc1",
      TR: "tr1",
      RU: "ru",
    };
    return regionMap[puuid.substring(0, 2).toUpperCase()] || "jp1";
  },

  async getSummonerData(region: string, puuid: string): Promise<any> {
    const response = await axios.get(
      `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
      { headers: { "X-Riot-Token": RIOT_API_KEY } }
    );
    return response.data;
  },

  async getRankData(region: string, puuid: string): Promise<any[]> {
    const response = await axios.get(
      `https://${region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`,
      { headers: { "X-Riot-Token": RIOT_API_KEY } }
    );
    return response.data;
  },

  async getMatchHistory(puuid: string, region: string): Promise<string[]> {
    const routingRegion = routingRegionMap[region];
    const response = await axios.get(
      `https://${routingRegion}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=15`,
      { headers: { "X-Riot-Token": RIOT_API_KEY } }
    );
    return response.data;
  },

  async getMatchDetails(matchId: string, region: string): Promise<any> {
    const routingRegion = routingRegionMap[region] || region;
    if (!routingRegion) {
      throw new Error(`Invalid region: ${region}`);
    }

    const url = `https://${routingRegion}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
    console.log(`[RiotAPI] マッチ詳細取得: ${url}`);

    const response = await axios.get(url, {
      headers: { "X-Riot-Token": RIOT_API_KEY },
    });
    return response.data;
  },

  // 現在のアクティブゲーム情報を取得
  async getActiveGame(region: string, puuid: string): Promise<any> {
    const endpoint = `https://${region}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`;
    const response = await axios.get(endpoint, {
      headers: { "X-Riot-Token": RIOT_API_KEY },
    });
    return response.data;
  },

  // getRecentMatchesメソッドを修正
  async getRecentMatches(
    puuid: string,
    region: string,
    count: number = 5
  ): Promise<string[]> {
    const routingRegion = routingRegionMap[region] || region;
    const url = `https://${routingRegion}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}`;
    console.log(`[RiotAPI] 最近のマッチ取得: ${url}`);

    const response = await axios.get(url, {
      headers: { "X-Riot-Token": RIOT_API_KEY },
    });
    return response.data;
  },
};
