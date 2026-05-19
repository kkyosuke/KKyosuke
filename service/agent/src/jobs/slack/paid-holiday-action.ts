import type { CustomAppEnv } from "../../config/env";
import { getFreeeConfig } from "../../config/env";
import { getDatabaseClient } from "../../lib/db";
import { createFreeeClient } from "../../lib/freee";
import type { PaidHolidayRequest } from "../../lib/freee/hr";
import { ensureFreeeAccessToken } from "../freee/utils/token";
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
		const accessToken = await ensureFreeeAccessToken(db, env, userId);
		if (!accessToken) {
			console.error("Freee access token not found for user", userId);
			return;
		}

		const config = getFreeeConfig(env);
		const freee = createFreeeClient(config);

		const me = await freee.hr.getMe(accessToken);
		const company = me.companies?.[0];
		if (!company) {
			console.error("User has no company in freee");
			return;
		}

		// Fetch approval flows to get the default one
		const flows = await freee.hr.getApprovalFlows(accessToken, company.id);
		if (flows.length === 0) {
			console.error("No approval flows found");
			await context.client.chat.postMessage({
				channel: userId,
				text: "申請経路が見つかりませんでした。freee人事労務の設定をご確認ください。",
			});
			return;
		}

		const defaultFlow = flows[0];
		if (!defaultFlow) {
			console.error("No approval flows found (undefined)");
			await context.client.chat.postMessage({
				channel: userId,
				text: "申請経路が見つかりませんでした。freee人事労務の設定をご確認ください。",
			});
			return;
		}

		// Open modal
		await context.client.views.open({
			trigger_id: payload.trigger_id,
			view: {
				type: "modal",
				callback_id: "freee_paid_holiday_modal",
				private_metadata: JSON.stringify({
					companyId: company.id,
					employeeId: company.employee_id,
					approvalFlowId: defaultFlow.id,
				}),
				title: {
					type: "plain_text",
					text: "有給休暇申請",
				},
				submit: {
					type: "plain_text",
					text: "申請する",
				},
				close: {
					type: "plain_text",
					text: "キャンセル",
				},
				blocks: [
					{
						type: "input",
						block_id: "leave_type_block",
						element: {
							type: "static_select",
							action_id: "leave_type_select",
							placeholder: {
								type: "plain_text",
								text: "休暇種別を選択してください",
							},
							options: [
								{ text: { type: "plain_text", text: "全休" }, value: "full" },
								{ text: { type: "plain_text", text: "半休" }, value: "half" },
								{
									text: { type: "plain_text", text: "午前休" },
									value: "morning_off",
								},
								{
									text: { type: "plain_text", text: "午後休" },
									value: "afternoon_off",
								},
								{ text: { type: "plain_text", text: "時間休" }, value: "hour" },
							],
							initial_option: {
								text: { type: "plain_text", text: "全休" },
								value: "full",
							},
						},
						label: {
							type: "plain_text",
							text: "休暇種別",
						},
					},
					{
						type: "input",
						block_id: "start_date_block",
						element: {
							type: "datepicker",
							action_id: "start_date_picker",
							placeholder: {
								type: "plain_text",
								text: "開始日を選択",
							},
						},
						label: {
							type: "plain_text",
							text: "開始日",
						},
					},
					{
						type: "input",
						block_id: "end_date_block",
						element: {
							type: "datepicker",
							action_id: "end_date_picker",
							placeholder: {
								type: "plain_text",
								text: "終了日を選択",
							},
						},
						label: {
							type: "plain_text",
							text: "終了日",
						},
					},
					{
						type: "input",
						block_id: "reason_block",
						optional: true,
						element: {
							type: "plain_text_input",
							action_id: "reason_input",
							multiline: true,
						},
						label: {
							type: "plain_text",
							text: "理由 (任意)",
						},
					},
				],
			},
		});
	} catch (e: unknown) {
		const err = e instanceof Error ? e : new Error(String(e));
		console.error("Error handling paid holiday modal open:", err);

		try {
			const errorMessage = getFreeeErrorMessage(e);
			await context.client.views.open({
				trigger_id: payload.trigger_id,
				view: {
					type: "modal",
					title: {
						type: "plain_text",
						text: "エラーが発生しました",
					},
					close: {
						type: "plain_text",
						text: "閉じる",
					},
					blocks: [
						{
							type: "section",
							text: {
								type: "mrkdwn",
								text: "freee APIとの通信中にエラーが発生しました。\nメンテナンス中、または一時的な障害の可能性があります。\nしばらく時間をおいてから再度お試しください。",
							},
						},
						{
							type: "context",
							elements: [
								{
									type: "plain_text",
									text: `詳細: ${errorMessage}`,
									emoji: true,
								},
							],
						},
					],
				},
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
		const accessToken = await ensureFreeeAccessToken(db, env, userId);
		if (!accessToken) {
			console.error("Freee access token not found for user", userId);
			return;
		}

		const config = getFreeeConfig(env);
		const freee = createFreeeClient(config);

		await freee.hr.postPaidHolidayRequest(accessToken, {
			company_id: metadata.companyId,
			applicant_id: metadata.employeeId,
			approval_flow_id: metadata.approvalFlowId,
			values: {
				type: leaveType as PaidHolidayRequest["values"]["type"],
				start_date: startDate,
				end_date: endDate,
				reason: reason,
			},
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
