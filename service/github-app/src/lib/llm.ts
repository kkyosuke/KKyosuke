import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export interface ReviewContext {
	title: string;
	body: string | null;
	diff: string;
	comments: string;
	instruction: string;
	template: string;
}

export async function generateCodeReview(context: ReviewContext): Promise<string> {
	// ローカルテスト用にモックを返す処理
	if (process.env.USE_MOCK_LLM === "true") {
		console.log("[LLM] Mock mode is enabled. Returning mock response...");
		// API通信を模倣するため、わざと2秒待機
		await new Promise((resolve) => setTimeout(resolve, 2000));
		return `## 評価スコア

**総合評価: Good**

| 評価観点 | スコア (各10点満点) | コメント（任意） |
| :--- | :--- | :--- |
| 機能の正確性・バグのリスク | 10 / 10 | モックのため評価をスキップ |

## サマリ

(これは \`USE_MOCK_LLM=true\` によるモックのレビュー結果です)
全体的に問題ありません。LGTM！

## 指摘点一覧

| 指摘理由 | 対応度 | 概要 |
| :--- | :--- | :--- |
| モック | Nits | これはモックデータです。 |`;
	}

	// ここでモデルを切り替えることが可能です（例: openai('gpt-4o')）
	const model = google("gemini-2.5-pro");

	const prompt = `
${context.instruction}

## 【出力テンプレート】
${context.template}

---
以下が対象の Pull Request の情報です。

## PR タイトル
${context.title}

## PR 概要
${context.body || "なし"}

## コメント履歴
${context.comments || "なし"}

## 変更差分 (Diff)
\`\`\`diff
${context.diff}
\`\`\`
`;

	const { text } = await generateText({
		model,
		prompt,
	});

	return text;
}
