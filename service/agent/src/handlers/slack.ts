import type { D1Database } from "@cloudflare/workers-types";
import type { SlackEdgeAppEnv } from "slack-cloudflare-workers";
import { SlackApp } from "slack-cloudflare-workers";
import { appHomeOpened } from "../jobs/slack/app-home";
import { heyCommandAck, heyCommandLazy } from "../jobs/slack/hey-cf-workers";
import { routeMentionEvent } from "../jobs/slack/router";
import {
	summaryShortcutAck,
	summaryShortcutLazy,
} from "../jobs/slack/save-summary";

export interface CustomAppEnv extends SlackEdgeAppEnv {
	AI_KYOSUKE_DB: D1Database;
}

export function createSlackApp(env: CustomAppEnv): SlackApp<CustomAppEnv> {
	const app = new SlackApp({ env });

	app.command("/hey-cf-workers", heyCommandAck, heyCommandLazy);

	app.shortcut("save-summary", summaryShortcutAck, summaryShortcutLazy);

	app.event("app_home_opened", appHomeOpened);
	app.event("app_mention", routeMentionEvent);

	return app;
}
