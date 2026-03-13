# Discord Bot Commission - @selfloved

i sold this "Bot Project" before.
but they never paid me so its public now

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Edit/Create `.env` file with:
```env
DISCORD_TOKEN=token
MONGODB_URI=databaseurl
DISCORD_CLIENT_ID=clientid
OWNER_ID=discord_ownerid
```

3. Start the bot:
```bash
node index.js
```

## Commands

Use `prefix-help` in Discord to see all available commands.

## File Structure

```
commands/        - Bot commands
config/          - Configuration
events/          - Event handlers
icons/           - Used icons
database/models/ - Database models
handlers/        - Command handlers
utils/           - Utilities
migrations/      - Extra migrations
index.js         - Main file
```