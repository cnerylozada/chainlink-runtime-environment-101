import {
  ConsensusAggregationByFields,
  consensusMedianAggregation,
  cre,
  identical,
  NodeRuntime,
  Runner,
  type Runtime,
} from "@chainlink/cre-sdk";
import { z } from "zod";

const configSchema = z.object({
  schedule: z.string(),
  randomValueApiUrl: z.string(),
  userListApiUrl: z.string(),
});
type Config = z.infer<typeof configSchema>;

interface User {
  id: string;
  name: string;
  username: string;
}

const fetchRandomValue = (nodeRuntime: NodeRuntime<Config>) => {
  const httpClient = new cre.capabilities.HTTPClient();

  const request = {
    url: nodeRuntime.config.randomValueApiUrl,
    method: "GET" as const,
  };
  const response = httpClient.sendRequest(nodeRuntime, request).result();

  const bodyText = new TextDecoder().decode(response.body);
  return BigInt(bodyText.trim());
};

const fethUserById = (nodeRuntime: NodeRuntime<Config>) => {
  const httpClient = new cre.capabilities.HTTPClient();

  const request = {
    url: nodeRuntime.config.userListApiUrl + "/1",
    method: "GET" as const,
  };
  const response = httpClient.sendRequest(nodeRuntime, request).result();

  const bodyText = new TextDecoder().decode(response.body);
  return JSON.parse(bodyText) as User;
};

const onCronTrigger = (
  runtime: Runtime<Config>,
): { randomValue: bigint; user: User } => {
  runtime.log("Hello world! Workflow triggered.");

  const randomValue = runtime
    .runInNodeMode(fetchRandomValue, consensusMedianAggregation<bigint>())()
    .result();

  const user = runtime
    .runInNodeMode(
      fethUserById,
      ConsensusAggregationByFields<User>({
        id: identical,
        name: identical,
        username: identical,
      }),
    )()
    .result();

  return { randomValue, user };
};

const initWorkflow = (config: Config) => {
  const cron = new cre.capabilities.CronCapability();

  return [
    cre.handler(cron.trigger({ schedule: config.schedule }), onCronTrigger),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}

main();
