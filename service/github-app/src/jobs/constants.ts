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
