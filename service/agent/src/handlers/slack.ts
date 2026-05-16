import type { SlackEdgeAppEnv } from "slack-cloudflare-workers";
import { SlackApp } from "slack-cloudflare-workers";
import { heyCommandAck, heyCommandLazy } from "../jobs/slack/commands";
import { appHomeOpened } from "../jobs/slack/events";

export function createSlackApp(
	env: SlackEdgeAppEnv,
): SlackApp<SlackEdgeAppEnv> {
	const app = new SlackApp({ env });

	app.command("/hey-cf-workers", heyCommandAck, heyCommandLazy);

	app.event("app_home_opened", appHomeOpened);

	return app;
}
