import type { AnyHomeTabBlock } from "slack-cloudflare-workers";
import type { CustomAppEnv } from "../../../config/env";
import { SettingsManager } from "../../../config/settings";
import { getGithubApp } from "../../../lib/github";
import { AVAILABLE_MODELS } from "../../../lib/llm/cost";

export const buildSettingsBlocks = async (
	userId: string,
	env: CustomAppEnv,
): Promise<AnyHomeTabBlock[]> => {
	const slackToken = env.SLACK_BOT_TOKEN;
	if (!slackToken) {
		return [];
	}

	try {
		const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
			headers: {
				Authorization: `Bearer ${slackToken}`,
			},
		});

		const data = (await res.json()) as {
			ok: boolean;
			user?: { is_primary_owner?: boolean };
		};
		if (!data.ok || !data.user?.is_primary_owner) {
			return []; // プライマリーオーナー以外には何も表示しない
		}

		const settings = new SettingsManager(env);

		// 設定マネージャーから現在の設定を取得
		let defaultModel = await settings.getReviewModel();
		if (
			!AVAILABLE_MODELS.includes(
				defaultModel as (typeof AVAILABLE_MODELS)[number],
			)
		) {
			defaultModel = AVAILABLE_MODELS[0];
		}

		let reportModel = await settings.getReportModel();
		if (
			!AVAILABLE_MODELS.includes(
				reportModel as (typeof AVAILABLE_MODELS)[number],
			)
		) {
			reportModel = AVAILABLE_MODELS[0];
		}

		const autoReviewEnabled = await settings.isAutoReviewEnabled();
		const logLevel = await settings.getLogLevel();

		// ステータス確認
		let githubStatus = "❌ エラー";
		try {
			const app = getGithubApp(env);
			const { data } = await app.octokit.rest.apps.getAuthenticated();
			if (data?.id) {
				githubStatus = "✅ 正常";
			}
		} catch (e) {
			console.error("GitHub App status check failed:", e);
		}

		let llmStatus = "❌ 未設定";
		if (settings.anthropicApiKey) {
			llmStatus = settings.anthropicApiKey.startsWith("sk-ant-")
				? "✅ 正常"
				: "⚠️ フォーマット不正";
		}

		let d1Status = "❌ エラー";
		try {
			if (settings.database) {
				await settings.database.prepare("SELECT 1").first();
				d1Status = "✅ 正常";
			} else {
				d1Status = "❌ 未設定 (バインディングなし)";
			}
		} catch (e) {
			console.error("D1 Database status check failed:", e);
		}

		const logOptionMap: Record<string, string> = {
			debug: "Debug",
			info: "Info",
			warn: "Warn",
			error: "Error",
		};
		const currentLogLabel = logOptionMap[logLevel] || "Info";

		const modelOptions = AVAILABLE_MODELS.map((m) => ({
			text: { type: "plain_text" as const, text: m },
			value: m,
		}));

		return [
			{
				type: "header",
				text: {
					type: "plain_text",
					text: "⚙️ システム設定・運用ステータス",
					emoji: true,
				},
			},
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: "🛑 *自動レビューの全体ON/OFF*\nメンテナンス時などにレビュー発火を一時停止します。",
				},
				accessory: {
					type: "checkboxes",
					action_id: "settings_pr_review_auto_enabled_changed",
					options: [
						{
							text: {
								type: "mrkdwn",
								text: "自動レビューを有効にする",
							},
							value: "enabled",
						},
					],
					...(autoReviewEnabled
						? {
								initial_options: [
									{
										text: {
											type: "mrkdwn",
											text: "自動レビューを有効にする",
										},
										value: "enabled",
									},
								],
							}
						: {}),
				},
			},
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: "🤖 *AIモデル (Review / Report)*",
				},
			},
			{
				type: "actions",
				elements: [
					{
						type: "static_select",
						action_id: "settings_pr_review_model_changed",
						placeholder: {
							type: "plain_text",
							text: "Reviewモデル",
						},
						initial_option: {
							text: { type: "plain_text", text: defaultModel },
							value: defaultModel,
						},
						options: modelOptions,
					},
					{
						type: "static_select",
						action_id: "settings_report_model_changed",
						placeholder: {
							type: "plain_text",
							text: "Reportモデル",
						},
						initial_option: {
							text: { type: "plain_text", text: reportModel },
							value: reportModel,
						},
						options: modelOptions,
					},
				],
			},
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: "📝 *ログレベル*",
				},
			},
			{
				type: "actions",
				elements: [
					{
						type: "static_select",
						action_id: "settings_log_level_changed",
						placeholder: {
							type: "plain_text",
							text: "ログレベル",
						},
						initial_option: {
							text: {
								type: "plain_text",
								text: currentLogLabel,
							},
							value: logLevel,
						},
						options: [
							{ text: { type: "plain_text", text: "Debug" }, value: "debug" },
							{ text: { type: "plain_text", text: "Info" }, value: "info" },
							{ text: { type: "plain_text", text: "Warn" }, value: "warn" },
							{ text: { type: "plain_text", text: "Error" }, value: "error" },
						],
					},
				],
			},
			{
				type: "context",
				elements: [
					{
						type: "mrkdwn",
						text: `🐙 *GitHub*: ${githubStatus}  |  🧠 *LLM*: ${llmStatus}  |  🗄️ *D1*: ${d1Status}`,
					},
				],
			},
		];
	} catch (e) {
		console.error("Failed to fetch user info for settings blocks:", e);
		return [];
	}
};
