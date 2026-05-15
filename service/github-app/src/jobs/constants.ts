import pkg from "../../package.json" with { type: "json" };

export type ProgressStep = {
	name: string;
	status: "pending" | "in_progress" | "done";
};

// 再度レビュー依頼のトリガー条件（特殊条件）
export const RE_REVIEW_TRIGGER_TEXT = "再度レビューを依頼する";
export const RE_REVIEW_CHECKBOX_UNCHECKED = `- [ ] ${RE_REVIEW_TRIGGER_TEXT}`;
export const RE_REVIEW_CHECKBOX_COMPLETED = `- 再度レビュー依頼済み (完了)`;
export const RE_REVIEW_CHECKBOX_CHECKED_PATTERN = new RegExp(`-\\s*\\[[xX]\\]\\s*${RE_REVIEW_TRIGGER_TEXT}`, "g");
export const RE_REVIEW_CHECKBOX_CHECKED_PATTERN_SINGLE = new RegExp(`-\\s*\\[[xX]\\]\\s*${RE_REVIEW_TRIGGER_TEXT}`);
export const RE_REVIEW_CHECKBOX_UNCHECKED_PATTERN_SINGLE = new RegExp(`-\\s*\\[\\s*\\]\\s*${RE_REVIEW_TRIGGER_TEXT}`);


export const getInProgressComment = (
	title: string,
	steps: ProgressStep[],
	modelName?: string,
) => {
	const stepsText = steps
		.map((s) => {
			switch (s.status) {
				case "done":
					return `> - [x] ${s.name}`;
				case "in_progress":
					return `> - [ ] 🔄 ${s.name}`;
				case "pending":
					return `> - [ ] ⏳ ${s.name}`;
				default:
					return "";
			}
		})
		.filter(Boolean)
		.join("\n");

	const modelInfo = modelName ? `> model: ${modelName}\n` : "";

	return `> [!NOTE]\n> 🔍 **${title}**\n> 現在処理を実行中です。完了まで少々お待ちください！\n> \n${stepsText}\n> \n${modelInfo}> version: ${pkg.version}`;
};

export const MAX_REVIEW_THREADS = 100;
export const MAX_COMMENTS_PER_THREAD = 50;

export const getNextStepsSection = (
	feedbacks: Array<{ severity: string }>,
	botName: string,
	hasUnresolvedThreads: boolean = false,
) => {
	const hasMust = feedbacks.some((f) => f.severity === "🔴 must");
	const hasWant = feedbacks.some((f) => f.severity === "🟡 want");
	const hasQ = feedbacks.some((f) => f.severity === "💬 Q");
	const hasMustOrWantOrQ = hasMust || hasWant || hasQ;

	const requiresAction = hasMustOrWantOrQ || hasUnresolvedThreads;

	let nextStepsSection = "";
	if (requiresAction) {
		nextStepsSection = "> [!IMPORTANT]\n> **【次のステップ】**\n";
		if (hasUnresolvedThreads) {
			nextStepsSection +=
				"> - [ ] 過去の未解決のコメント（スレッド）を確認し、返信して再評価を依頼する\n";
		}
		if (hasMust) {
			nextStepsSection += "> - [ ] `🔴 must` の指摘事項を修正する\n";
		}
		if (hasWant) {
			nextStepsSection +=
				"> - [ ] `🟡 want` の指摘事項を修正する、または対応を見送る理由を返信する\n";
		}
		if (hasQ) {
			nextStepsSection +=
				"> - [ ] `💬 Q` の質問に回答する\n";
		}
		nextStepsSection += `> ${RE_REVIEW_CHECKBOX_UNCHECKED}\n\n`;
	}

	return { nextStepsSection, requiresAction };
};

export const getUnresolvedThreadsSkippedReport = () => {
	let nextStepsSection = "> [!IMPORTANT]\n> **【次のステップ】**\n";
	nextStepsSection +=
		"> - [ ] 過去の未解決のコメント（スレッド）を確認し、返信して再評価を依頼する\n";
	nextStepsSection += `> ${RE_REVIEW_CHECKBOX_UNCHECKED}\n\n`;

	return {
		overallStatus: "⚠️ 未解決のコメントがあります",
		summarySection:
			"### 📝 サマリ\n\n- 未解決のコメント（スレッド）が残っています。各コメントに対応（コード修正とスレッドへの返信）してから、再度レビューを依頼してください。\n",
		nextStepsSection,
		requiresAction: true,
	};
};
