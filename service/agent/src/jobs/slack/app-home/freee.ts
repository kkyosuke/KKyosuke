import type { AnyHomeTabBlock } from "slack-cloudflare-workers";
import type { CustomAppEnv } from "../../../config/env";
import { getFreeeConfig, resolveEnv } from "../../../config/env";
import { getUserTokenByType } from "../../../datasource/db/userToken";
import type { DBClient } from "../../../lib/db";
import { createFreeeClient } from "../../../lib/freee/index";
import { ensureFreeeAccessToken } from "../../freee/utils/token";

import { getFreeeErrorMessage } from "../utils/freee";

export type AttendanceState =
	| "unknown"
	| "not_clocked_in"
	| "clocked_in"
	| "on_break"
	| "clocked_out";

export async function buildFreeeBlocks(
	db: DBClient,
	userId: string,
	env: Partial<CustomAppEnv>,
): Promise<AnyHomeTabBlock[]> {
	const blocks: AnyHomeTabBlock[] = [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: "freee",
				emoji: true,
			},
		},
	];

	// 1. DBからトークン取得 (連携の有無を確認)
	const freeeToken = await getUserTokenByType(
		db,
		userId,
		"freee",
		"refresh_token",
	);
	const isLinked = !!freeeToken;

	// 連携されていない場合は連携画面を表示してreturn
	if (!isLinked) {
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

	// 2. アクセストークン取得 などセットアップ
	let accessToken: string | null = null;
	try {
		accessToken = await ensureFreeeAccessToken(db, env, userId);
	} catch (e) {
		// 503エラーなどの場合
		console.warn("Failed to fetch freee access token", e);
		const errorMessage = getFreeeErrorMessage(e);
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: "⚠️ *freeeとの通信中にエラーが発生しました*\n一時的な障害やメンテナンス中の可能性があります。時間をおいてから再度お試しください。",
			},
		});
		blocks.push({
			type: "context",
			elements: [
				{
					type: "plain_text",
					text: `詳細: ${errorMessage}`,
					emoji: true,
				},
			],
		});
		return blocks;
	}

	// トークンの取得失敗や更新失敗(400, 401など)でnullが返ってきた場合
	if (!accessToken) {
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: "⚠️ *freeeの連携が無効になっています*\nお手数ですが、再度連携を行ってください。",
			},
			accessory: {
				type: "button",
				text: {
					type: "plain_text",
					text: "再連携する",
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

	// 3. トークンが有効であれば、打刻状態の取得処理を行う
	let attendanceState: AttendanceState = "not_clocked_in"; // default
	try {
		const config = getFreeeConfig(env);
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
				attendanceState = "on_break";
			} else if (lastClock && lastClock.type === "clock_out") {
				attendanceState = "clocked_out";
			} else if (
				available.includes("clock_out") ||
				available.includes("break_begin")
			) {
				attendanceState = "clocked_in";
			} else if (available.includes("clock_in")) {
				attendanceState = "not_clocked_in";
			}
		}
	} catch (e) {
		console.warn("Failed to fetch freee attendance state", e);
		const errorMessage = getFreeeErrorMessage(e);
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: "⚠️ *freeeとの通信中にエラーが発生しました*\n打刻状態の取得に失敗しました。時間をおいてから再度お試しください。",
			},
		});
		blocks.push({
			type: "context",
			elements: [
				{
					type: "plain_text",
					text: `詳細: ${errorMessage}`,
					emoji: true,
				},
			],
		});
		return blocks;
	}

	// 4. 打刻のUI処理
	if (attendanceState === "not_clocked_in") {
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
	} else if (attendanceState === "clocked_in") {
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
	} else if (attendanceState === "on_break") {
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
	} else if (attendanceState === "clocked_out") {
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: "現在の状態: *退勤済*\n\n今日も一日お疲れさまでした。",
			},
		});
	}

	// 5. 有給申請の処理
	blocks.push(
		{
			type: "divider",
		},
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: "休暇申請",
			},
			accessory: {
				type: "button",
				text: {
					type: "plain_text",
					text: "有給休暇を申請する",
					emoji: true,
				},
				value: "apply_paid_holiday",
				action_id: "freee_apply_paid_holiday_open",
			},
		},
	);

	return blocks;
}
