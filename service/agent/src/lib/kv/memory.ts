import type { KVClient } from "./index";

interface MemoryEntry {
	value: string;
	expiresAt: number | null;
}

const store = new Map<string, MemoryEntry>();

export function getMemoryKVClient(): KVClient {
	return {
		async get(key: string) {
			const entry = store.get(key);
			if (!entry) return null;

			if (entry.expiresAt && Date.now() > entry.expiresAt) {
				store.delete(key);
				return null;
			}

			return entry.value;
		},
		async put(
			key: string,
			value: string,
			options?: { expirationTtl?: number },
		) {
			let expiresAt = null;
			if (options?.expirationTtl) {
				// expirationTtl is in seconds
				expiresAt = Date.now() + options.expirationTtl * 1000;
			}
			store.set(key, { value, expiresAt });
		},
		async delete(key: string) {
			store.delete(key);
		},
	};
}
