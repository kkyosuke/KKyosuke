import type { LanguageModelUsage } from "ai";

/**
 * レビューに使用するLLMのモデル名
 */
export const DEFAULT_REVIEW_MODEL_NAME = "claude-haiku-4-5";

type PricingRates = {
	baseInput: number;
	cacheWrites5m: number;
	cacheReads: number;
	output: number;
};

export const AVAILABLE_MODELS = [
	"claude-haiku-4-5",
	"claude-sonnet-4-5",
	"claude-opus-4-6",
] as const;

const MODEL_PRICING: Record<string, PricingRates> = {
	"claude-haiku-4-5": {
		baseInput: 1.0,
		cacheWrites5m: 1.25,
		cacheReads: 0.1,
		output: 5.0,
	},
	"claude-sonnet-4-5": {
		baseInput: 3.0,
		cacheWrites5m: 3.75,
		cacheReads: 0.3,
		output: 15.0,
	},
	"claude-opus-4-6": {
		baseInput: 5.0,
		cacheWrites5m: 6.25,
		cacheReads: 0.5,
		output: 25.0,
	},
};

/**
 * トークン使用量からLLMのコストを計算します。
 */
export const calculateCost = (
	usage: LanguageModelUsage,
	modelName: string,
): number => {
	const fallback = MODEL_PRICING["claude-haiku-4-5"] as PricingRates;
	const rates = MODEL_PRICING[modelName] ?? fallback; // Fallback to Haiku

	const cacheWrites = usage.inputTokenDetails?.cacheWriteTokens || 0;
	const cacheReads = usage.inputTokenDetails?.cacheReadTokens || 0;
	const baseTokens =
		usage.inputTokenDetails?.noCacheTokens ??
		(usage.inputTokens || 0) - cacheWrites - cacheReads;
	const outputTokens = usage.outputTokens || 0;

	const cost =
		(baseTokens / 1_000_000) * rates.baseInput +
		(cacheWrites / 1_000_000) * rates.cacheWrites5m +
		(cacheReads / 1_000_000) * rates.cacheReads +
		(outputTokens / 1_000_000) * rates.output;

	return cost;
};
