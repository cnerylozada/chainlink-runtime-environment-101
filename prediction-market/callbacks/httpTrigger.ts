import {
  decodeJson,
  EVMClient,
  EVMLog,
  getNetwork,
  hexToBase64,
  HTTPPayload,
  type Runtime,
} from "@chainlink/cre-sdk";
import {
  ConfigType,
  createMarketSchema,
  CreateMarketSchemaType,
} from "../models";
import { bytesToHex, encodeAbiParameters, parseAbiParameters } from "viem";

const createNewMarket = (
  runtime: Runtime<ConfigType>,
  evmClient: EVMClient,
  inputData: CreateMarketSchemaType,
) => {
  const { question } = inputData;
  const reportData = encodeAbiParameters(parseAbiParameters("string"), [
    question,
  ]);

  const reportResponse = runtime
    .report({
      encodedPayload: hexToBase64(reportData),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  const { gasLimit, marketConsumerAddress } = runtime.config.evm;
  const writeReportResult = evmClient
    .writeReport(runtime, {
      receiver: marketConsumerAddress,
      report: reportResponse,
      gasConfig: {
        gasLimit,
      },
    })
    .result();
  runtime.log("Waiting for write report response");

  const txHash = bytesToHex(writeReportResult.txHash || new Uint8Array());
  runtime.log(`View transaction at https://sepolia.etherscan.io/tx/${txHash}`);
  return txHash;
};

export const onHttpTrigger = (
  runtime: Runtime<ConfigType>,
  payload: HTTPPayload,
): string => {
  if (!payload.input || !payload.input.length)
    throw new Error(`Empty request payload`);

  const inputData = createMarketSchema.safeParse(decodeJson(payload.input));
  if (!inputData.success) throw new Error(`Invalid model`);
  runtime.log(`input: ${inputData.data}`);

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: runtime.config.evm.chainName,
    isTestnet: true,
  });
  if (!network) throw new Error(`Unknown chain`);

  const evmClient = new EVMClient(network.chainSelector.selector);
  // const txHash = createNewMarket(runtime, evmClient, inputData.data);
  // runtime.log(`txHash: ${txHash}`);

  return "Success";
};
