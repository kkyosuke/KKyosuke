import type { SlackEdgeAppEnv } from "slack-cloudflare-workers";
import { SlackApp } from "slack-cloudflare-workers";
import { heyCommandAck, heyCommandLazy } from "../jobs/slack/commands";

export function createSlackApp(
	env: SlackEdgeAppEnv,
): SlackApp<SlackEdgeAppEnv> {
	const app = new SlackApp({ env });

	app.command("/hey-cf-workers", heyCommandAck, heyCommandLazy);

	return app;
}
