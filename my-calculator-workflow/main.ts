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
  hexToBase64,
} from "@chainlink/cre-sdk";
import {
  encodeFunctionData,
  decodeFunctionResult,
  zeroAddress,
  Address,
  bytesToHex,
  encodeAbiParameters,
  parseAbiParameters,
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

const updateCalculatorResult = (
  runtime: Runtime<Config>,
  evmClient: EVMClient,
  data: { offchainValue: bigint; onchainValue: bigint; finalResult: bigint },
) => {
  const { offchainValue, onchainValue, finalResult } = data;
  const reportData = encodeAbiParameters(
    parseAbiParameters(
      "uint256 offchainValue, int256 onchainValue, uint256 finalResult",
    ),
    [offchainValue, onchainValue, finalResult],
  );
  const reportResponse = runtime
    .report({
      encodedPayload: hexToBase64(reportData),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  const { calculatorConsumerAddress, gasLimit } =
    runtime.config.storageContract;
  const writeReportResult = evmClient
    .writeReport(runtime, {
      receiver: calculatorConsumerAddress,
      report: reportResponse,
      gasConfig: {
        gasLimit,
      },
    })
    .result();

  const txHash = bytesToHex(writeReportResult.txHash || new Uint8Array(32));
  return txHash;
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

  const txHash = updateCalculatorResult(runtime, evmClient, {
    offchainValue: randomValue,
    onchainValue: value,
    finalResult: randomValue + value,
  });

  return { randomValue, onChainValue: value, user, txHash };
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
