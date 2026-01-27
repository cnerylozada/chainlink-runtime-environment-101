import {
  cre,
  decodeJson,
  HTTPCapability,
  HTTPPayload,
  Runner,
  type Runtime,
} from "@chainlink/cre-sdk";
import { ConfigType, configSchema, createMarketSchema } from "./models";

const onHttpTrigger = (
  runtime: Runtime<ConfigType>,
  payload: HTTPPayload,
): string => {
  if (!payload.input || !payload.input.length) {
    runtime.log(`Error: Empty request payload`);
    return "Error: Empty request payload";
  }
  const inputData = createMarketSchema.safeParse(decodeJson(payload.input));
  if (!inputData.success) {
    return "Error: invalid model";
  }
  const { data } = inputData;
  runtime.log(`inputData: ${data.question}`);

  return "Success";
};

const initWorkflow = (config: ConfigType) => {
  const httpTrigger = new HTTPCapability();

  return [
    cre.handler(
      httpTrigger.trigger({
        authorizedKeys: [
          {
            type: "KEY_TYPE_ECDSA_EVM",
            publicKey: config.authorizedEVMAddress,
          },
        ],
      }),
      onHttpTrigger,
    ),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<ConfigType>({ configSchema });
  await runner.run(initWorkflow);
}

main();
