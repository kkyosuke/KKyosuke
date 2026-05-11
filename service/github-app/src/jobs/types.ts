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
	execute: (ctx: CommandContext) => Promise<void>;
}
