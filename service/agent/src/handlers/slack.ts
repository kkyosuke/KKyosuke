import type { SlackEdgeAppEnv } from "slack-cloudflare-workers";
import { SlackApp } from "slack-cloudflare-workers";
import { appHomeOpened } from "../jobs/slack/app-home";
import { handleAttendanceAction } from "../jobs/slack/attendance-action";
import { heyCommandAck, heyCommandLazy } from "../jobs/slack/hey-cf-workers";
import { routeMentionEvent } from "../jobs/slack/router";
import {
	summaryShortcutAck,
	summaryShortcutLazy,
} from "../jobs/slack/save-summary";

import type { CustomAppEnv } from "../config/env";

export function createSlackApp(env: CustomAppEnv): SlackApp<CustomAppEnv> {
	const app = new SlackApp({ env });

	app.command("/hey-cf-workers", heyCommandAck, heyCommandLazy);

	app.shortcut("save-summary", summaryShortcutAck, summaryShortcutLazy);

	app.event("app_home_opened", appHomeOpened);
	app.event("app_mention", routeMentionEvent);

	app.action("freee_link_action", async () => {
		// ボタンに `url` が設定されているため、ブラウザは自動的に開きます。
		// ここでは単にアクションを受け取ったことを処理（実質的に何もしない）するだけでOKです。
	});

	app.action(
		"freee_clock_in_office",
		handleAttendanceAction("clock_in", "clock_in_office"),
	);
	app.action(
		"freee_clock_in_remote",
		handleAttendanceAction("clock_in", "clock_in_remote"),
	);
	app.action(
		"freee_clock_in_other",
		handleAttendanceAction("clock_in", "clock_in_other"),
	);
	app.action("freee_clock_out", handleAttendanceAction("clock_out"));
	app.action("freee_break_begin", handleAttendanceAction("break_begin"));
	app.action("freee_break_end", handleAttendanceAction("break_end"));

	return app;
}
