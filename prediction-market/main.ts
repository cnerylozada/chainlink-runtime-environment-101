import {
  cre,
  EVMClient,
  getNetwork,
  handler,
  hexToBase64,
  HTTPCapability,
  Runner,
} from "@chainlink/cre-sdk";
import { ConfigType, configSchema } from "./models";
import { keccak256, toBytes } from "viem";
import { onHttpTrigger } from "./callbacks/httpTrigger";
import { onLogTrigger } from "./callbacks/evmLogTrigger";

const initWorkflow = (config: ConfigType) => {
  const httpTrigger = new HTTPCapability();

  const { chainName, marketConsumerAddress } = config.evm;
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: chainName,
    isTestnet: true,
  });
  if (!network) throw new Error(`Network not found`);

  const evmClient = new EVMClient(network.chainSelector.selector);
  const creEventHash = keccak256(toBytes("CREEvent(address,uint256)"));

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
    handler(
      evmClient.logTrigger({
        addresses: [hexToBase64(marketConsumerAddress)],
        topics: [{ values: [creEventHash] }],
        confidence: "CONFIDENCE_LEVEL_FINALIZED",
      }),
      onLogTrigger,
    ),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<ConfigType>({ configSchema });
  await runner.run(initWorkflow);
}

main();
