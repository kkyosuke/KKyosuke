import pkg from "../../package.json" with { type: "json" };

export type ProgressStep = {
	name: string;
	status: "pending" | "in_progress" | "done";
};

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
) => {
	const hasMust = feedbacks.some((f) => f.severity === "🔴 must");
	const hasWant = feedbacks.some((f) => f.severity === "🟡 want");
	const hasMustOrWant = hasMust || hasWant;

	let nextStepsSection = "";
	if (hasMustOrWant) {
		nextStepsSection = "\n**【次のステップ】**\n";
		if (hasMust) {
			nextStepsSection += "- [ ] `🔴 must` の指摘事項を修正する\n";
		}
		if (hasWant) {
			nextStepsSection +=
				"- [ ] `🟡 want` の指摘事項を修正する、または対応を見送る理由を返信する\n";
		}
		nextStepsSection += `- [ ] 再度レビューを依頼する`;
	}

	return { nextStepsSection, hasMustOrWant };
};
