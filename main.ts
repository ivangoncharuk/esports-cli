import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";
import { Select } from "https://deno.land/x/cliffy@v0.25.7/prompt/select.ts";
import { Input } from "https://deno.land/x/cliffy@v0.25.7/prompt/input.ts";
import {
  bold,
  cyan,
  green,
  red,
  yellow,
} from "https://deno.land/std@0.203.0/fmt/colors.ts";
import { exists } from "https://deno.land/std@0.203.0/fs/mod.ts";
import { dirname } from "https://deno.land/std@0.203.0/path/mod.ts";

const { API_TOKEN } = config();
const BASE_URL = "https://api.pandascore.co";

if (!API_TOKEN) {
  console.error("API token is missing! Please set it in your .env file.");
  Deno.exit(1);
}

interface Match {
  id: number;
  name: string;
  scheduled_at: string;
  status: string;
  videogame: { name: string };
  league: { name: string };
  tournament: { name: string };
  opponents: {
    opponent: {
      id: number;
      name: string;
      acronym?: string;
      location?: string;
    };
  }[];
}

async function ensureDirectoryExists(filePath: string) {
  const dir = dirname(filePath);
  await Deno.mkdir(dir, { recursive: true });
}

async function saveSnapshot(data: unknown, filename: string = "snapshot.json") {
  const snapshot = {
    lastFetched: new Date().toISOString(),
    data,
  };
  await ensureDirectoryExists(filename);
  await Deno.writeTextFile(filename, JSON.stringify(snapshot, null, 2));
  console.log(`Snapshot saved to ${filename}`);
}

async function fetchEsportsData<T>(
  endpoint: string,
  useSnapshot: boolean = false,
): Promise<{ lastFetched: string; data: T } | null> {
  const snapshotFile = `snapshot_${endpoint.replace("/", "_")}.json`;

  if (useSnapshot && (await exists(snapshotFile))) {
    const snapshot = await Deno.readTextFile(snapshotFile);
    const { lastFetched, data } = JSON.parse(snapshot);
    return { lastFetched, data };
  }

  console.log("Fetching data from API...");
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
    },
  });

  if (!response.ok) {
    console.error(`Error: ${response.status} ${response.statusText}`);
    return null;
  }

  const data = await response.json();
  await saveSnapshot(data, snapshotFile);
  return { lastFetched: new Date().toISOString(), data };
}

async function fetchIfNeeded<T>(
  endpoint: string,
  cooldownMinutes: number = 10,
): Promise<{ lastFetched: string; data: T } | null> {
  const snapshotFile = `snapshot_${endpoint.replace("/", "_")}.json`;

  if (await exists(snapshotFile)) {
    const snapshot = await Deno.readTextFile(snapshotFile);
    const { lastFetched, data } = JSON.parse(snapshot);
    const elapsedMinutes =
      (new Date().getTime() - new Date(lastFetched).getTime()) / 60000;

    if (elapsedMinutes < cooldownMinutes) {
      console.log(
        yellow(`Data is recent (${Math.floor(elapsedMinutes)} minutes ago).`),
      );
      return { lastFetched, data };
    }
  }

  return await fetchEsportsData<T>(endpoint, false);
}


function timeSince(lastFetched: string): string {
  const now = new Date();
  const last = new Date(lastFetched);
  const diffMs = now.getTime() - last.getTime();

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}hr${minutes}m`;
}

// async function displayUpcomingMatches() {
//   const matches: Match[] = await fetchEsportsData("/matches/upcoming", true);
//   if (matches) {
//     console.log(bold(green("\nUpcoming Matches:\n")));
//     matches.forEach((match) => {
//       console.log(
//         `${bold(yellow(match.name))} - ${
//           new Date(match.scheduled_at).toLocaleString()
//         }`,
//       );
//     });
//   }
// }

function filterByGame(matches: Match[], game: string): Match[] {
  return matches.filter((match) =>
    match.videogame.name.toLowerCase() === game.toLowerCase()
  );
}

function filterByLeague(matches: Match[], league: string): Match[] {
  return matches.filter((match) =>
    match.league.name.toLowerCase().includes(league.toLowerCase())
  );
}

function filterLiveMatches(matches: Match[]): Match[] {
  return matches.filter((match) => match.status === "live");
}

function searchMatches(matches: Match[], query: string): Match[] {
  return matches.filter((match) =>
    match.name.toLowerCase().includes(query.toLowerCase())
  );
}

function displayMatchDetails(match: Match): void {
  console.log(bold(green(`\nMatch: ${match.name}`)));
  console.log(`${bold("Game:")} ${cyan(match.videogame.name)}`);
  console.log(`${bold("League:")} ${yellow(match.league.name)}`);
  console.log(`${bold("Tournament:")} ${yellow(match.tournament.name)}`);
  console.log(
    `${bold("Scheduled At:")} ${new Date(match.scheduled_at).toLocaleString()}`,
  );

  console.log(bold("\nTeams:"));
  match.opponents.forEach((team, index) => {
    console.log(
      `${index + 1}. ${cyan(team.opponent.name)} ${
        team.opponent.acronym ? `(${yellow(team.opponent.acronym)})` : ""
      } ${team.opponent.location ? `- ${green(team.opponent.location)}` : ""}`,
    );
  });
}

async function matchListMenu(matches: Match[]) {
  const options = matches.map((match) => ({
    name: `${match.name} (${new Date(match.scheduled_at).toLocaleString()})`,
    value: match.id.toString(), // Store match ID as a string
  }));

  // Use "go_back" instead of null for the "Go Back" option
  const selectedId = await Select.prompt({
    message: "Select a match to view details:",
    options: [...options, { name: "Go Back", value: "go_back" }],
  });

  if (selectedId === "go_back") {
    return; // Return to the previous menu
  }

  const selectedMatch = matches.find((match) =>
    match.id.toString() === selectedId
  );
  if (selectedMatch) {
    displayMatchDetails(selectedMatch);
    console.log("\n");
  }
}

async function mainMenu() {
  const response = await fetchEsportsData<Match[]>("/matches/upcoming", true);

  if (!response || !response.data || response.data.length === 0) {
    console.log(red("No matches found."));
    return;
  }

  const { lastFetched, data: matches } = response;
  const elapsedTime = timeSince(lastFetched);

  console.log(
    bold(
      green(
        `\nLast Fetch: ${
          new Date(lastFetched).toLocaleString()
        } (${elapsedTime} ago)`,
      ),
    ),
  );

  const action = await Select.prompt({
    message: "Select an action:",
    options: [
      "Fetch New Data",
      "Filter by Game",
      "Filter by League",
      "View Live Matches",
      "Search Matches",
      "View All Matches",
      "Exit",
    ],
  });

  switch (action) {
    // deno-lint-ignore no-case-declarations
    case "Fetch New Data":
      const cooldownMinutes = 10; // Set the desired cooldown time here
      console.log("Checking if data fetch is needed...");
      const newResponse = await fetchIfNeeded<Match[]>("/matches/upcoming", cooldownMinutes);
      
      if (newResponse) {
        console.log(green("New data fetched and snapshot updated."));
      } else {
        console.log(red("Cooldown active. Data fetch skipped."));
      }
      break;
    

    case "Filter by Game": {
      const game = await Input.prompt(
        "Enter the game name (e.g., Counter-Strike):",
      );
      const filteredMatches = filterByGame(matches, game);
      if (filteredMatches.length > 0) {
        await matchListMenu(filteredMatches);
      } else {
        console.log(red(`\nNo matches found for "${game}".`));
      }
      break;
    }

    case "Filter by League": {
      const league = await Input.prompt("Enter the league name:");
      const filteredMatches = filterByLeague(matches, league);
      if (filteredMatches.length > 0) {
        await matchListMenu(filteredMatches);
      } else {
        console.log(red(`\nNo matches found for league "${league}".`));
      }
      break;
    }
    case "Search Matches": {
      const query = await Input.prompt("Enter part of the match name:");
      const searchResults = searchMatches(matches, query);
      if (searchResults.length > 0) {
        await matchListMenu(searchResults);
      } else {
        console.log(red(`\nNo matches found for "${query}".`));
      }
      break;
    }
    case "View Live Matches": {
      const liveMatches = filterLiveMatches(matches);
      if (liveMatches.length > 0) {
        await matchListMenu(liveMatches);
      } else {
        console.log(red("\nNo live matches currently available."));
      }
      break;
    }
    case "View All Matches":
      await matchListMenu(matches);
      break;

    case "Exit":
      console.log("Goodbye!");
      return;
  }

  await mainMenu(); // Loop back to the main menu
}

async function main() {
  await mainMenu();
}

main();
