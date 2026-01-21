import {
  ConsensusAggregationByFields,
  consensusMedianAggregation,
  cre,
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

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
});

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
  return userSchema.parse(bodyText);
};

const onCronTrigger = (runtime: Runtime<Config>): { randomValue: bigint } => {
  runtime.log("Hello world! Workflow triggered.");

  const randomValue = runtime
    .runInNodeMode(fetchRandomValue, consensusMedianAggregation())()
    .result();
  runtime.log(
    `Successfully fetched and aggregated math result: ${randomValue}`,
  );

  return { randomValue };
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
