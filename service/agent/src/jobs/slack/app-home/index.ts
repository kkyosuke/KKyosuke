import type { SlackApp, SlackEdgeAppEnv, AnyHomeTabBlock } from "slack-cloudflare-workers";
import { buildWelcomeBlocks } from "./welcome";
import { buildAttendanceBlocks, type AttendanceState } from "./attendance";

export const appHomeOpened = async ({
	context,
	payload,
}: Parameters<Parameters<SlackApp<SlackEdgeAppEnv>["event"]>[1]>[0]) => {
	const p = payload as { user?: string; event?: { user?: string } };
	const userId = p.user || p.event?.user || "";

	// TODO: D1データベースから連携状態を取得し、freee APIから現在の打刻状態を取得する
	// UI確認用に仮のステータスを指定しています。
	// "not_linked" | "not_clocked_in" | "clocked_in" | "on_break" に変更してUIを確認できます。
	const mockState: AttendanceState = "not_clocked_in";

	const blocks: AnyHomeTabBlock[] = [
		...buildWelcomeBlocks(),
		...buildAttendanceBlocks(mockState),
		{
			type: "divider",
		},
		{
			type: "context",
			elements: [
				{
					type: "plain_text",
					text: "This is a sample home tab powered by slack-cloudflare-workers",
					emoji: true,
				},
			],
		},
	];

	await context.client.views.publish({
		user_id: userId,
		view: {
			type: "home",
			blocks,
		},
	});
};
