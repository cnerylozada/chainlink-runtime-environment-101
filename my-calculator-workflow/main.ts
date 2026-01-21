import {
  EVMClient,
  consensusMedianAggregation,
  Runner,
  type NodeRuntime,
  type Runtime,
  getNetwork,
  LAST_FINALIZED_BLOCK_NUMBER,
  encodeCallMsg,
  ConsensusAggregationByFields,
  identical,
  cre,
} from "@chainlink/cre-sdk";
import {
  encodeFunctionData,
  decodeFunctionResult,
  zeroAddress,
  Address,
  bytesToHex,
} from "viem";
import { Storage } from "../contracts/abi/Storage";
import { Config, configSchema, IUser, IResult } from "./models";

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
  return JSON.parse(bodyText) as IUser;
};

const onCronTrigger = (runtime: Runtime<Config>): IResult => {
  runtime.log("Hello world! Workflow triggered.");

  const randomValue = runtime
    .runInNodeMode(fetchRandomValue, consensusMedianAggregation<bigint>())()
    .result();

  const user = runtime
    .runInNodeMode(
      fethUserById,
      ConsensusAggregationByFields<IUser>({
        id: identical,
        name: identical,
        username: identical,
      }),
    )()
    .result();

  const { address, chainName } = runtime.config.storageContract;
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: chainName,
    isTestnet: true,
  });
  if (!network) {
    throw new Error(`Unknown chain name`);
  }
  const getValueContractFunction = encodeFunctionData({
    abi: Storage,
    functionName: "getValue",
  });

  const evmClient = new EVMClient(network.chainSelector.selector);
  const getValueContractCall = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: address as Address,
        data: getValueContractFunction,
      }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    })
    .result();

  const value = decodeFunctionResult({
    abi: Storage,
    functionName: "getValue",
    data: bytesToHex(getValueContractCall.data),
  });

  return { randomValue, onChainValue: value, user };
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
