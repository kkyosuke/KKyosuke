import { buildAuthFunction } from "./auth";
import {
	getAvailableTimeClockTypes,
	getMe,
	getTimeClocks,
	postTimeClock,
} from "./hr";

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
