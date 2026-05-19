import type { CustomAppEnv } from "../../config/env";
import { getDatabaseClient } from "../../lib/db";
import {
	buildErrorModalView,
	buildPaidHolidayModalView,
} from "../../views/slack/paid-holiday";
import {
	getPaidHolidayModalContext,
	submitPaidHoliday,
} from "../freee/paid-holiday";
import { getFreeeErrorMessage } from "./utils/freee";

export const handlePaidHolidayModalOpen = async ({
	context,
	payload,
	env,
}: {
	context: { client: import("slack-cloudflare-workers").SlackAPIClient };
	payload: { trigger_id: string; user: { id: string } };
	env: CustomAppEnv;
}) => {
	const userId = payload.user.id;
	try {
		const db = getDatabaseClient(env);

		const modalContext = await getPaidHolidayModalContext(db, env, userId);
		if (!modalContext) {
			console.error("Freee access token not found for user", userId);
			return;
		}

		// Open modal
		await context.client.views.open({
			trigger_id: payload.trigger_id,
			view: buildPaidHolidayModalView({
				companyId: modalContext.companyId,
				employeeId: modalContext.employeeId,
				approvalFlowId: modalContext.approvalFlowId,
			}),
		});
	} catch (e: unknown) {
		const err = e instanceof Error ? e : new Error(String(e));
		console.error("Error handling paid holiday modal open:", err);

		// Specific error string matched from getPaidHolidayModalContext
		if (err.message.includes("申請経路が見つかりませんでした")) {
			try {
				await context.client.chat.postMessage({
					channel: userId,
					text: err.message,
				});
			} catch (msgErr) {
				console.error("Failed to post message:", msgErr);
			}
			return;
		}

		try {
			const errorMessage = getFreeeErrorMessage(e);
			await context.client.views.open({
				trigger_id: payload.trigger_id,
				view: buildErrorModalView(errorMessage),
			});
		} catch (modalErr) {
			console.error("Failed to open error modal:", modalErr);
		}
	}
};

export const handlePaidHolidaySubmission = async ({
	context,
	payload,
	env,
}: {
	context: { client: import("slack-cloudflare-workers").SlackAPIClient };
	payload: {
		user: { id: string };
		view: {
			state: {
				values: Record<
					string,
					Record<
						string,
						{
							value?: string;
							selected_option?: { value: string };
							selected_date?: string;
						}
					>
				>;
			};
			private_metadata: string;
		};
	};
	env: CustomAppEnv;
}) => {
	const userId = payload.user.id;
	const values = payload.view.state.values;

	const leaveType =
		values.leave_type_block?.leave_type_select?.selected_option?.value ?? "";
	const startDate =
		values.start_date_block?.start_date_picker?.selected_date ?? "";
	const endDate = values.end_date_block?.end_date_picker?.selected_date ?? "";
	const reason = values.reason_block?.reason_input?.value ?? "";

	try {
		const metadata = JSON.parse(payload.view.private_metadata);

		const db = getDatabaseClient(env);

		await submitPaidHoliday(db, env, userId, {
			companyId: metadata.companyId,
			employeeId: metadata.employeeId,
			approvalFlowId: metadata.approvalFlowId,
			leaveType,
			startDate,
			endDate,
			reason,
		});

		// Notify user on slack
		await context.client.chat.postMessage({
			channel: userId,
			text: `有給休暇の申請が完了しました。(${startDate} 〜 ${endDate})`,
		});
	} catch (e: unknown) {
		const err = e instanceof Error ? e : new Error(String(e));
		console.error("Error submitting paid holiday request:", err);
		const errorMessage = getFreeeErrorMessage(e);
		await context.client.chat.postMessage({
			channel: userId,
			text: `有給休暇の申請中にエラーが発生しました。\n詳細: ${errorMessage}\n時間を置いて再度お試しください。`,
		});
	}
};
