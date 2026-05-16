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

import { getDatabaseClient } from "../lib/db";
import { recordAttendance } from "../jobs/freee/attendance";
import { publishHomeView } from "../jobs/slack/app-home";
import { notifyAttendanceToSlack } from "../jobs/slack/attendance-notification";

export interface CustomAppEnv extends SlackEdgeAppEnv {
	AI_KYOSUKE_DB: D1Database;
}

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

	const handleAttendanceAction = (type: "clock_in" | "clock_out" | "break_begin" | "break_end") => async ({ context, payload, env }: any) => {
		const userId = payload.user.id;
		try {
			const db = getDatabaseClient(env as any);
			await recordAttendance(db, userId, env as any, type);
			await publishHomeView(userId, env as any);
			await notifyAttendanceToSlack(context.client, userId, type);
		} catch (e: any) {
			console.error(`Freee attendance error (${type}):`, e);
			// Ideally post an ephemeral message to the user here
		}
	};

	app.action("freee_clock_in_office", handleAttendanceAction("clock_in"));
	app.action("freee_clock_in_remote", handleAttendanceAction("clock_in"));
	app.action("freee_clock_in_other", handleAttendanceAction("clock_in"));
	app.action("freee_clock_out", handleAttendanceAction("clock_out"));
	app.action("freee_break_begin", handleAttendanceAction("break_begin"));
	app.action("freee_break_end", handleAttendanceAction("break_end"));

	return app;
}
