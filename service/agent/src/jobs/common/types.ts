/**
 * KVの名前空間のバインディング
 */
export interface KVBinding {
	get(key: string): Promise<string | null>;
	put(
		key: string,
		value: string,
		options?: { expirationTtl?: number },
	): Promise<void>;
	delete(key: string): Promise<void>;
}
