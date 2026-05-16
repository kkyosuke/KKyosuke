import { Hono } from "hono";
import { handleFreeeAuthRedirect, handleFreeeAuthCallback } from "../jobs/freee/auth";

export const freeeApp = new Hono<{ Bindings: Record<string, string | undefined> }>();

freeeApp.get("/auth", handleFreeeAuthRedirect);
freeeApp.get("/auth/callback", handleFreeeAuthCallback);

