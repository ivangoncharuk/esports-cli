# eSports CLI

A command-line interface (CLI) for exploring esports match data, powered by the PandaScore API. This tool fetches, filters, and displays match information on live and upcoming esports events.


## Features

- **Fetch and Cache Data**: Fetch match data from the PandaScore API and store it locally for offline access.
- **View Match Details**: Display detailed information about matches, including teams, game, league, and tournament.
- **Filters**:
  - By Game (e.g., "Counter-Strike").
  - By League (e.g., "LCS").
  - Live Matches.
  - Search by Match Name.
- **Snapshots**: Automatically save match data to avoid repeated API calls.
- **Interactive Menus**: Navigate match lists and options with a user-friendly CLI interface.


## Getting Started

### Prerequisites
- [Deno](https://deno.land/) installed on your system.
- A [PandaScore](https://pandascore.co/) API key stored in a `.env` file:
  ```env
  API_TOKEN=your_api_key_here
  ```

### Installation
Clone the repository and navigate to the project directory:
```bash
git clone <repo-url>
cd sports-cli
```

### Run the CLI
Start the CLI in development mode:
```bash
deno task dev
```


## How to Use

1. Run the CLI to access the main menu.
2. Select an action (e.g., filter by game, view live matches).
3. Use interactive prompts to explore match data.


## License

This project is licensed under the [MIT License](LICENSE).
