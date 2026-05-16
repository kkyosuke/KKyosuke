import { buildAuthFunction } from "./auth";
import { getMe, postTimeClock, getAvailableTimeClockTypes, getTimeClocks } from "./hr";

export interface FreeeConfig {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
}

export function createFreeeClient(config: FreeeConfig) {
	const freee = {
		...buildAuthFunction(config),
		hr: {
			getMe,
			postTimeClock,
			getAvailableTimeClockTypes,
			getTimeClocks,
		},
	};
	return freee;
}
