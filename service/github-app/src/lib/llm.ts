import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

export interface ReviewContext {
	title: string;
	body: string | null;
	diff: string;
	comments: string;
	instruction: string;
	template: string;
}

export async function generateCodeReview(
	env: Record<string, string | undefined>,
	context: ReviewContext,
): Promise<string> {
	const anthropic = createAnthropic({
		apiKey: env.ANTHROPIC_API_KEY || "",
	});

	const model = anthropic("claude-haiku-4-5");

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
