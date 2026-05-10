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
