import { getDatabaseClient } from "../../lib/db";
import { recordAttendance } from "../freee/attendance";
import { publishHomeView } from "./app-home";
import { notifyAttendanceToSlack } from "./attendance-notification";

export const handleAttendanceAction =
	(
		type: "clock_in" | "clock_out" | "break_begin" | "break_end",
		notificationType?: string,
	) =>
	async ({ context, payload, env }: any) => {
		const userId = payload.user.id;
		try {
			const db = getDatabaseClient(env as any);
			await recordAttendance(db, userId, env as any, type);
			await publishHomeView(userId, env as any);
			await notifyAttendanceToSlack(
				context.client,
				userId,
				notificationType || type,
			);
		} catch (e: any) {
			console.error(`Freee attendance error (${type}):`, e);
			// Ideally post an ephemeral message to the user here
		}
	};
