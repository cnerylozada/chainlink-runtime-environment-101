import { z } from "zod";

export const configSchema = z.object({
  authorizedEVMAddress: z.string(),
  evm: z.object({
    marketConsumerAddress: z.string(),
    chainName: z.string(),
    gasLimit: z.string(),
  }),
});
export type ConfigType = z.infer<typeof configSchema>;

export const createMarketSchema = z.object({
  name: z.string(),
  age: z.number().int().positive(),
});
export type CreateMarketSchemaType = z.infer<typeof createMarketSchema>;
