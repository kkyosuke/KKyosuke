import type { AnyHomeTabBlock } from "slack-cloudflare-workers";
import type { DBClient } from "../../../lib/db";
import { getUserTokenByType } from "../../../datasource/db/userToken";

import { resolveEnv, getFreeeConfig } from "../../../config/env";
import { ensureFreeeAccessToken } from "../../freee/utils/token";
import { createFreeeClient } from "../../../lib/freee/index";

export type AttendanceState = "not_linked" | "not_clocked_in" | "clocked_in" | "on_break";

export async function buildAttendanceBlocks(
	db: DBClient,
	userId: string,
	env: Record<string, string | undefined>,
): Promise<AnyHomeTabBlock[]> {
	const freeeToken = await getUserTokenByType(db, userId, "freee", "refresh_token");

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
					const typesRes = await freee.hr.getAvailableTimeClockTypes(accessToken, company.employee_id, company.id);
					const available = typesRes.available_types;

					if (available.includes("clock_in")) {
						state = "not_clocked_in";
					} else if (available.includes("clock_out")) {
						if (available.includes("break_end")) {
							state = "on_break";
						} else {
							state = "clocked_in";
						}
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
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "出社【その他】",
						emoji: true,
					},
					value: "clock_in_other",
					action_id: "freee_clock_in_other",
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
						text: "終了",
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
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "終了",
						emoji: true,
					},
					value: "clock_out",
					action_id: "freee_clock_out",
					style: "danger",
				},
			],
		});
	}

	return blocks;
}
