export async function hasActiveRewardClaimed(
  rewardDistributor: unknown,
  epoch: number,
  wallet: string
): Promise<boolean> {
  const reader = (rewardDistributor as { activeRewardClaimed?: unknown }).activeRewardClaimed;
  if (typeof reader !== "function") {
    return false;
  }

  return Boolean(
    await (reader as (epoch: number, wallet: string) => Promise<boolean>).call(
      rewardDistributor,
      epoch,
      wallet
    )
  );
}
