import type { ThreadEvaluationContext } from "../../lib/llm/thread";

export const buildThreadPrompt = (context: ThreadEvaluationContext): string => `
${context.instruction}

---
以下が対象のコメントスレッドと最新のコード差分です。

## コメントスレッド
${context.threadComments}

## 最新のコード差分 (Diff)
\`\`\`diff
${context.diff}
\`\`\`
`.trim();
