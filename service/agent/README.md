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
