import type { ModalView } from "slack-cloudflare-workers";

export function buildPaidHolidayModalView({
	companyId,
	employeeId,
	selectedType = "full",
}: {
	companyId: number;
	employeeId: number;
	selectedType?: string;
}): ModalView {
	const blocks: any[] = [
		{
			type: "input",
			block_id: "leave_type_block",
			dispatch_action: true,
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
				initial_option: (() => {
					switch (selectedType) {
						case "half":
							return { text: { type: "plain_text", text: "半休" }, value: "half" };
						case "morning_off":
							return { text: { type: "plain_text", text: "午前休" }, value: "morning_off" };
						case "afternoon_off":
							return { text: { type: "plain_text", text: "午後休" }, value: "afternoon_off" };
						case "hour":
							return { text: { type: "plain_text", text: "時間休" }, value: "hour" };
						default:
							return { text: { type: "plain_text", text: "全休" }, value: "full" };
					}
				})(),
			},
			label: {
				type: "plain_text",
				text: "休暇種別",
			},
		},
		{
			type: "input",
			block_id: "target_date_block",
			element: {
				type: "datepicker",
				action_id: "target_date_picker",
				placeholder: {
					type: "plain_text",
					text: "対象日を選択",
				},
			},
			label: {
				type: "plain_text",
				text: "日付",
			},
		},
	];

	if (selectedType === "hour") {
		blocks.push(
			{
				type: "input",
				block_id: "start_time_block",
				element: {
					type: "timepicker",
					action_id: "start_time_picker",
					placeholder: {
						type: "plain_text",
						text: "開始時間を選択",
					},
				},
				label: {
					type: "plain_text",
					text: "開始時間",
				},
			},
			{
				type: "input",
				block_id: "end_time_block",
				element: {
					type: "timepicker",
					action_id: "end_time_picker",
					placeholder: {
						type: "plain_text",
						text: "終了時間を選択",
					},
				},
				label: {
					type: "plain_text",
					text: "終了時間",
				},
			}
		);
	}

	blocks.push({
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
	});

	return {
		type: "modal",
		callback_id: "freee_paid_holiday_modal",
		private_metadata: JSON.stringify({
			companyId,
			employeeId,
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
		blocks,
	};
}

export function buildErrorModalView(errorMessage: string): ModalView {
	return {
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
	};
}
