import { z } from "zod";

export const configSchema = z.object({
  schedule: z.string(),
  randomValueApiUrl: z.string(),
  userListApiUrl: z.string(),
  storageContract: z.object({
    address: z.string(),
    chainName: z.string(),
    calculatorConsumerAddress: z.string(),
    gasLimit: z.string(),
  }),
});
export type Config = z.infer<typeof configSchema>;

export interface IUser {
  id: string;
  name: string;
  username: string;
}

export interface IResult {
  randomValue: bigint;
  onChainValue: bigint;
  user: IUser;
  txHash: `0x${string}`;
}
