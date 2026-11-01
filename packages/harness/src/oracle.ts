import type { NearAccount } from 'near-workspaces';

/** On-chain oracle: `ft_balance_of` read as base-unit bigint (docs/ATTACK-BATTERY.md §A1-cap-race). */
export async function balanceOf(ft: NearAccount, accountId: string): Promise<bigint> {
  const raw = (await ft.view('ft_balance_of', { account_id: accountId })) as string;
  return BigInt(raw);
}
