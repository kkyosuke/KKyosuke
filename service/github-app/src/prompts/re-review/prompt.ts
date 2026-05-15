import type { ReReviewContext } from "../../lib/llm/re-review";

export const buildReReviewPrompt = (context: ReReviewContext): string => `
${context.instruction}

## 【出力テンプレートの参考情報】
${context.template}

---
以下が対象の Pull Request の情報です。

## PR タイトル
${context.title}

## PR 概要
${context.body || "なし"}


## 最新の変更差分 (Diff)
\`\`\`diff
${context.diff}
\`\`\`
`.trim();
