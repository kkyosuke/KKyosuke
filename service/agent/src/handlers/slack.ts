import { SlackApp } from "slack-cloudflare-workers";
import type { CustomAppEnv } from "../config/env";
import { appHomeOpened } from "../jobs/slack/app-home";
import { handleAttendanceAction } from "../jobs/slack/attendance-action";
import { heyCommandAck, heyCommandLazy } from "../jobs/slack/hey-cf-workers";
import {
	handleLeaveTypeSelect,
	handlePaidHolidayModalOpen,
	handlePaidHolidaySubmission,
} from "../jobs/slack/paid-holiday-action";
import { routeMentionEvent } from "../jobs/slack/router";
import {
	summaryShortcutAck,
	summaryShortcutLazy,
} from "../jobs/slack/save-summary";
import {
	handleAutoReviewEnabledChange,
	handleLogLevelChange,
	handleModelChange,
	handleReportModelChange,
} from "../jobs/slack/settings-action";

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

	app.action("freee_apply_paid_holiday_open", async (args) => {
		return handlePaidHolidayModalOpen(args);
	});

	app.view("freee_paid_holiday_modal", async (args) => {
		return handlePaidHolidaySubmission(args);
	});

	app.action("leave_type_select", async (args) => {
		// @ts-expect-error slack-cloudflare-workers generic payload types
		return handleLeaveTypeSelect(args);
	});

	app.action("settings_pr_review_model_changed", async (args) => {
		return handleModelChange(args);
	});
	app.action("settings_report_model_changed", async (args) => {
		return handleReportModelChange(args);
	});
	app.action("settings_pr_review_auto_enabled_changed", async (args) => {
		return handleAutoReviewEnabledChange(args);
	});

	app.action("settings_log_level_changed", async (args) => {
		return handleLogLevelChange(args);
	});

	return app;
}
