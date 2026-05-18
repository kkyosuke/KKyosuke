import { Hono } from "hono";
import type { CustomAppEnv } from "../config/env";
import {
	handleFreeeAuthCallback,
	handleFreeeAuthRedirect,
	handleFreeeAuthStart,
} from "../jobs/freee/auth";

export const freeeApp = new Hono<{
	Bindings: CustomAppEnv;
}>();

freeeApp.get("/auth/start", handleFreeeAuthStart);
freeeApp.get("/auth", handleFreeeAuthRedirect);
freeeApp.get("/auth/callback", handleFreeeAuthCallback);
