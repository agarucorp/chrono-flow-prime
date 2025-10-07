# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/63e8de82-4263-4b7c-8403-5b6381e72d2c

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/63e8de82-4263-4b7c-8403-5b6381e72d2c) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (Authentication & Database)

## Supabase Setup

This project uses Supabase for authentication and database. To run this project locally:

1. Create a Supabase account at [https://supabase.com](https://supabase.com)
2. Create a new project
3. Create a `.env` file in the root directory with:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. Get your credentials from Project Settings > API

For detailed setup instructions, see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

## MCP (Model Context Protocol) Integration

This project supports MCP integration for enhanced AI-assisted development with Cursor/Claude.

### Quick Start MCP

**Windows:**
```bash
scripts\mcp-quickstart.bat
```

**Mac/Linux:**
```bash
bash scripts/mcp-quickstart.sh
```

Or install manually:
```bash
npm run mcp:install
```

### Verify MCP Configuration

```bash
npm run verify:mcp
```

### Documentation

- [MCP_SUPABASE_SETUP.md](./MCP_SUPABASE_SETUP.md) - Complete MCP setup guide
- [MCP_CREDENTIALS.md](./MCP_CREDENTIALS.md) - Required credentials information
- [cursor-mcp-config.example.json](./cursor-mcp-config.example.json) - Configuration template

### What does MCP do?

MCP allows Claude/Cursor to:
- Query and modify your Supabase database directly
- Create tables, policies, and functions
- Execute SQL queries through natural language
- Manage your database schema during development

⚠️ **Security Note:** MCP is for development only. Never use service role keys in production.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/63e8de82-4263-4b7c-8403-5b6381e72d2c) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
