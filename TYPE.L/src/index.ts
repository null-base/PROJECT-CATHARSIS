import {
  ActivityType,
  Client,
  GatewayIntentBits,
  REST,
  Routes,
} from "discord.js";
import * as commands from "./commands";
import { interactionCreate } from "./events/interactionCreate";
import { DISCORD_TOKEN } from "./lib/config";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);
  client.user?.setPresence({
    activities: [{ name: "League of Legends", type: ActivityType.Playing }],
    status: "online",
  });

  // コマンド登録
  const commandData = Object.values(commands).map((cmd) => cmd.data);
  new REST({ version: "10" })
    .setToken(DISCORD_TOKEN)
    .put(Routes.applicationCommands(client.user!.id), { body: commandData })
    .then(() => console.log("✅ コマンド登録完了"))
    .catch(console.error);
});

client.on("interactionCreate", interactionCreate);
client.login(DISCORD_TOKEN);
