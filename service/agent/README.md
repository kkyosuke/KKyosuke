# Agent

## Prerequisites

This project requires `cloudflared` to be installed.

```bash
brew install cloudflare/cloudflare/cloudflared
```

## Development

Start the local development server:

```bash
bun run dev
```

In a separate terminal, start the cloudflared tunnel to expose your local server to a public URL:

```bash
cloudflared tunnel run --token <token>
```

## Database Migrations

To apply database changes to the local development environment:

```bash
bunx wrangler d1 migrations apply ai_kyosuke --local
```

To apply database changes to the production (Cloudflare) environment:

```bash
bunx wrangler d1 migrations apply ai_kyosuke --remote
```
