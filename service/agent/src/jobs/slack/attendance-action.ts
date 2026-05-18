import { getDatabaseClient } from "../../lib/db";
import { recordAttendance } from "../freee/attendance";
import { publishHomeView } from "./app-home";
import { notifyAttendanceToSlack } from "./attendance-notification";

import type { CustomAppEnv } from "../../config/env";

export const handleAttendanceAction =
	(
		type: "clock_in" | "clock_out" | "break_begin" | "break_end",
		notificationType?: string,
	) =>
	async ({
		context,
		payload,
		env,
	}: {
		context: { client: import("slack-cloudflare-workers").SlackAPIClient };
		payload: { user: { id: string } };
		env: CustomAppEnv;
	}) => {
		const userId = payload.user.id;
		try {
			const db = getDatabaseClient(env);
			await recordAttendance(db, userId, env, type);
			await publishHomeView(userId, env);
			await notifyAttendanceToSlack(
				context.client,
				userId,
				notificationType || type,
			);
		} catch (e: unknown) {
			const err = e instanceof Error ? e : new Error(String(e));
			console.error(`Freee attendance error (${type}):`, err);
			// Ideally post an ephemeral message to the user here
		}
	};
