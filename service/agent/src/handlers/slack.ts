import { SlackApp } from "slack-cloudflare-workers";
import type { CustomAppEnv } from "../config/env";
import { appHomeOpened } from "../jobs/slack/app-home";
import { heyCommandAck, heyCommandLazy } from "../jobs/slack/hey-cf-workers";
import { routeMentionEvent } from "../jobs/slack/router";
import {
	handleAutoReviewEnabledChange,
	handleLogLevelChange,
	handleModelChange,
} from "../jobs/slack/settings-action";

export function createSlackApp(env: CustomAppEnv): SlackApp<CustomAppEnv> {
	const app = new SlackApp({ env });

	app.command("/hey-cf-workers", heyCommandAck, heyCommandLazy);

	app.event("app_home_opened", appHomeOpened);
	app.event("app_mention", routeMentionEvent);

	app.action("settings_pr_review_model_changed", async (args) => {
		return handleModelChange(args);
	});

	app.action("settings_pr_review_auto_enabled_changed", async (args) => {
		return handleAutoReviewEnabledChange(args);
	});

	app.action("settings_log_level_changed", async (args) => {
		return handleLogLevelChange(args);
	});

	return app;
}
