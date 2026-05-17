import type { AnyHomeTabBlock } from "slack-cloudflare-workers";
import { getFreeeConfig, resolveEnv } from "../../../config/env";
import { getUserTokenByType } from "../../../datasource/db/userToken";
import type { DBClient } from "../../../lib/db";
import { createFreeeClient } from "../../../lib/freee/index";
import { ensureFreeeAccessToken } from "../../freee/utils/token";

export type AttendanceState =
	| "not_linked"
	| "not_clocked_in"
	| "clocked_in"
	| "on_break"
	| "clocked_out";

export async function buildAttendanceBlocks(
	db: DBClient,
	userId: string,
	env: Record<string, string | undefined>,
): Promise<AnyHomeTabBlock[]> {
	const freeeToken = await getUserTokenByType(
		db,
		userId,
		"freee",
		"refresh_token",
	);

	let state: AttendanceState = "not_linked";

	if (freeeToken) {
		state = "not_clocked_in"; // default if linked
		const accessToken = await ensureFreeeAccessToken(db, env, userId);
		if (accessToken) {
			try {
				const config = getFreeeConfig(env as any);
				const freee = createFreeeClient(config);

				const me = await freee.hr.getMe(accessToken);
				const company = me.companies?.[0];
				if (company) {
					const typesRes = await freee.hr.getAvailableTimeClockTypes(
						accessToken,
						company.employee_id,
						company.id,
					);
					const available = typesRes.available_types;
					const baseDate = typesRes.base_date;

					const clocks = await freee.hr.getTimeClocks(
						accessToken,
						company.employee_id,
						company.id,
						baseDate,
						baseDate,
					);
					const todayClocks = clocks.filter((c) => c.date === baseDate);
					const lastClock =
						todayClocks.length > 0 ? todayClocks[todayClocks.length - 1] : null;

					if (available.includes("break_end")) {
						state = "on_break";
					} else if (lastClock && lastClock.type === "clock_out") {
						state = "clocked_out";
					} else if (
						available.includes("clock_out") ||
						available.includes("break_begin")
					) {
						state = "clocked_in";
					} else if (available.includes("clock_in")) {
						state = "not_clocked_in";
					}
				}
			} catch (e) {
				console.error("Failed to fetch freee attendance state", e);
			}
		}
	}

	const blocks: AnyHomeTabBlock[] = [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: "freee 打刻",
				emoji: true,
			},
		},
	];

	if (state === "not_linked") {
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: "freee人事労務と連携して、ここから直接打刻できるようにしましょう！",
			},
			accessory: {
				type: "button",
				text: {
					type: "plain_text",
					text: "freeeと連携する",
					emoji: true,
				},
				value: "link_freee",
				action_id: "freee_link_action",
				style: "primary",
				url: `${resolveEnv(env).APP_URL || "http://localhost:3000"}/freee/auth/start?user_id=${userId}`,
			},
		});
		return blocks;
	}

	// 連携済みの場合
	if (state === "not_clocked_in") {
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: "現在の状態: *未出勤*",
			},
		});
		blocks.push({
			type: "actions",
			elements: [
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "出社【本社】",
						emoji: true,
					},
					value: "clock_in_office",
					action_id: "freee_clock_in_office",
					style: "primary",
				},
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "出社【リモート】",
						emoji: true,
					},
					value: "clock_in_remote",
					action_id: "freee_clock_in_remote",
				},
			],
		});
	} else if (state === "clocked_in") {
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: "現在の状態: *出勤中*",
			},
		});
		blocks.push({
			type: "actions",
			elements: [
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "休憩",
						emoji: true,
					},
					value: "break_begin",
					action_id: "freee_break_begin",
				},
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "退勤",
						emoji: true,
					},
					value: "clock_out",
					action_id: "freee_clock_out",
					style: "danger",
				},
			],
		});
	} else if (state === "on_break") {
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: "現在の状態: *休憩中*",
			},
		});
		blocks.push({
			type: "actions",
			elements: [
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "再開",
						emoji: true,
					},
					value: "break_end",
					action_id: "freee_break_end",
					style: "primary",
				},
			],
		});
	} else if (state === "clocked_out") {
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: "現在の状態: *退勤済*\n\n今日も一日お疲れさまでした。",
			},
		});
	}

	return blocks;
}
