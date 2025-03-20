import axios from "axios";

let cachedVersion = "";

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
