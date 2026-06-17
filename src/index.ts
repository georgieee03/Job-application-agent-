import { assertHandshakeRequiredFiles, config } from "./config.js";
import { bootstrapAuth, runApplyFlow } from "./handshake.js";
import { runListingsSearch } from "./jobs/search.js";
import { loadProfile } from "./profile.js";

async function main(): Promise<void> {
  const command = process.argv[2];

  if (command === "auth") {
    await bootstrapAuth();
    return;
  }

  if (command === "apply") {
    assertHandshakeRequiredFiles();
    const profile = await loadProfile(config.handshake.profilePath);
    await runApplyFlow(profile);
    return;
  }

  if (command === "search") {
    await runListingsSearch();
    return;
  }

  console.error("Usage: npm run auth | npm run apply | npm run search");
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
