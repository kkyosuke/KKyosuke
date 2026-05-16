import type { ReviewContext } from "../../lib/llm/review";

export const buildReviewPrompt = (context: ReviewContext): string =>
	`
${context.instruction}

## 【出力テンプレートの参考情報】
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
`.trim();
