import { EVMLog, type Runtime } from "@chainlink/cre-sdk";
import { ConfigType } from "../models";
import { bytesToHex, decodeEventLog, parseAbi } from "viem";

const EVENT_ABI = parseAbi([
  "event CREEvent(address indexed sender, uint256 amount)",
]);

export const onLogTrigger = (runtime: Runtime<ConfigType>, log: EVMLog) => {
  const topics = log.topics.map((topic) => bytesToHex(topic)) as [
    `0x${string}`,
    ...`0x${string}`[],
  ];
  const data = bytesToHex(log.data);

  const decodedLog = decodeEventLog({ abi: EVENT_ABI, data, topics });
  runtime.log(`Event name: ${decodedLog.eventName}`);

  return decodedLog.args;
};
