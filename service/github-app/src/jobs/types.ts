export interface CommandContext {
	env: Record<string, string | undefined>;
	installationId: number;
	owner: string;
	repo: string;
	issueNumber: number; // PR or Issue number
	commentBody: string; // 実際のコメント全文
}

export interface CommandJob {
	name: string;
	triggerWords: string[]; // このコマンドが反応するキーワード
	priority?: number; // 判定の優先順位（大きいほど優先）
	execute: (ctx: CommandContext) => Promise<void>;
}
