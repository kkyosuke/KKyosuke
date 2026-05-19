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

/**
 * freeeの人事労務で設定されている「有給休暇」の申請経路ID
 * 参照: 部門役職データ連携を利用した申請経路はAPIから取得・操作できない制限があるため、固定値を指定しています。
 */
const FREEE_APPROVAL_FLOW_ID = 1388164;

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
							selected_time?: string;
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
	const targetDate =
		values.target_date_block?.target_date_picker?.selected_date ?? "";
	const startTime =
		values.start_time_block?.start_time_picker?.selected_time ?? "";
	const endTime = values.end_time_block?.end_time_picker?.selected_time ?? "";
	const reason = values.reason_block?.reason_input?.value ?? "";

	try {
		const metadata = JSON.parse(payload.view.private_metadata);

		const db = getDatabaseClient(env);

		await submitPaidHoliday(db, env, userId, {
			companyId: metadata.companyId,
			employeeId: metadata.employeeId,
			approvalFlowId: FREEE_APPROVAL_FLOW_ID,
			leaveType,
			targetDate,
			startTime,
			endTime,
			reason,
		});

		// Notify user on slack
		await context.client.chat.postMessage({
			channel: userId,
			text: `有給休暇の申請が完了しました。(${targetDate})`,
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
