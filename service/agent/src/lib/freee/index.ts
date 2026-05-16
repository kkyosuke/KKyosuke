import { buildAuthFunction } from "./auth";

export interface FreeeConfig {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
}

export function createFreeeClient(config: FreeeConfig) {
	const freee = {
		...buildAuthFunction(config),
	};
	return freee;
}
