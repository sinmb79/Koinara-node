import assert from "node:assert/strict";
import test from "node:test";
import { hasActiveRewardClaimed } from "../src/chain/claimStatus.js";

test("hasActiveRewardClaimed returns false when the contract reader is unavailable", async () => {
  const claimed = await hasActiveRewardClaimed({}, 8, "0x1234");
  assert.equal(claimed, false);
});

test("hasActiveRewardClaimed returns the on-chain reader result", async () => {
  const claimed = await hasActiveRewardClaimed(
    {
      activeRewardClaimed: async (epoch: number, wallet: string) =>
        epoch === 8 && wallet === "0xabc"
    },
    8,
    "0xabc"
  );

  assert.equal(claimed, true);
});
