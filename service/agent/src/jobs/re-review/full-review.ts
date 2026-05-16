import {
	calculateCost,
	generateReReview,
	REVIEW_MODEL_NAME,
} from "../../lib/llm";
import { getNextStepsSection } from "../constants";

/**
 * LLMを使用してPR全体の再レビューを実行します。
 *
 * @param env - 環境変数
 * @param pr - PR情報
 * @param diff - 差分情報
 * @param finalInstruction - レビュー用のプロンプト指示
 * @param template - レポートのテンプレート
 * @param botName - ボット名
 * @param hasUnresolvedBotThreads - 未解決のボットスレッドがあるかどうか
 * @returns 再レビューの結果とコスト
 */
export async function performFullReReview(
	env: Record<string, string | undefined>,
	pr: { title: string; body: string | null },
	diff: string,
	finalInstruction: string,
	template: string,
	hasUnresolvedBotThreads: boolean,
) {
	const { output: result, usage: reReviewUsage } = await generateReReview(env, {
		title: pr.title,
		body: pr.body,
		diff: diff,
		instruction: finalInstruction,
		template: template,
	});

	const cost = calculateCost(reReviewUsage, REVIEW_MODEL_NAME);

	const newFeedbacks = result.newFeedback.slice(0, 10);
	const generalNewFeedback = newFeedbacks.filter(
		(f) => !(f.path && f.path !== "-" && f.line > 0),
	);

	let newFeedbackSection = "### 🚨 新たな懸念点\n\nなし\n";
	if (generalNewFeedback.length > 0) {
		newFeedbackSection =
			"### 🚨 新たな懸念点\n\n| 対象 (ファイル等) | 該当行 | 指摘理由 | 対応度 | 概要 |\n| :--- | :--- | :--- | :--- | :--- |\n";
		newFeedbackSection += `${generalNewFeedback
			.map(
				(f) =>
					`| ${f.path} | ${f.line > 0 ? f.line : "-"} | ${f.reason} | ${f.severity} | ${f.summary} |`,
			)
			.join("\n")}\n`;
	}

	const nextSteps = getNextStepsSection(newFeedbacks, hasUnresolvedBotThreads);
	const nextStepsSection = nextSteps.nextStepsSection;
	const requiresAction = nextSteps.requiresAction;

	let summarySection = "### 📝 サマリ\n\nなし\n";
	if (result.summary && result.summary.length > 0) {
		summarySection =
			"### 📝 サマリ\n\n" +
			result.summary.map((s) => `- ${s}`).join("\n") +
			"\n";
	}

	let resolvedAndHandoffSection = "### 💡 解決項目と申し送り\n\nなし\n";
	if (result.resolvedAndHandoff && result.resolvedAndHandoff.length > 0) {
		resolvedAndHandoffSection =
			"### 💡 解決項目と申し送り\n\n" +
			result.resolvedAndHandoff.map((i) => `- ${i}`).join("\n") +
			"\n";
	}

	return {
		cost,
		newFeedbacks,
		nextStepsSection,
		summarySection,
		resolvedAndHandoffSection,
		newFeedbackSection,
		overallStatus: result.overallStatus,
		requiresAction,
	};
}
