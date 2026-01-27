import { z } from "zod";

export const configSchema = z.object({ authorizedEVMAddress: z.string() });
export type ConfigType = z.infer<typeof configSchema>;

export const createMarketSchema = z.object({ question: z.string() });
