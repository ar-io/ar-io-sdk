/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Delegation balance math.
 *
 * On-chain, `Delegation.amount` is the last-settled principal. Pending rewards
 * are tracked separately via the gateway's per-share accumulator
 * (`Gateway.cumulative_reward_per_token`) and the delegate's snapshot of that
 * accumulator at the last settlement (`Delegation.reward_debt`). The
 * `distribute_epoch` instruction advances the accumulator but does NOT touch
 * per-`Delegation.amount` — that field is updated lazily on the next
 * delegation interaction (or via the permissionless
 * `compound_delegation_rewards` instruction).
 *
 * Off-chain readers (indexers, wallets, the network portal) that want to show
 * a delegate's current balance must therefore compute the live value from the
 * accumulator + reward_debt; reading `Delegation.amount` directly under-reports
 * every epoch of pending rewards.
 *
 * This module mirrors the on-chain `settle_delegate_rewards` math from
 * `programs/ario-gar/src/state/mod.rs` so the SDK can return live values from
 * its read-side methods (`getGatewayDelegates`, `getDelegations`,
 * `getAllDelegates`) without needing an on-chain settlement call.
 *
 * See `INVARIANTS.md` in the contracts repo for the broader stake-pool
 * invariant context.
 */
import { REWARD_PRECISION } from './constants.js';

const U64_MAX = (1n << 64n) - 1n;

/**
 * Compute the live delegation balance: the last-settled principal plus any
 * pending rewards accrued since the last settlement.
 *
 * Mirrors `settle_delegate_rewards` in
 * `programs/ario-gar/src/state/mod.rs` — including the u128 overflow-safe
 * quotient/remainder split and the saturating-to-`u64::MAX` cap at the end —
 * so a value computed here matches what the on-chain instruction would write
 * if it were called right now.
 *
 * @param delegatedStake          - `Delegation.amount` (u64 → number).
 * @param rewardDebt              - `Delegation.reward_debt` (u128 → bigint).
 * @param cumulativeRewardPerToken - `Gateway.cumulative_reward_per_token` (u128 → bigint).
 * @returns The delegate's live balance in mARIO, saturating-capped at `u64::MAX`.
 */
export function computeLiveDelegationBalance({
  delegatedStake,
  rewardDebt,
  cumulativeRewardPerToken,
}: {
  delegatedStake: number;
  rewardDebt: bigint;
  cumulativeRewardPerToken: bigint;
}): number {
  // Fast paths matching the on-chain `if` guards: zero principal or no
  // accumulator delta means no pending rewards to settle.
  if (delegatedStake <= 0 || cumulativeRewardPerToken <= rewardDebt) {
    return delegatedStake;
  }

  const amount = BigInt(delegatedStake);
  const delta = cumulativeRewardPerToken - rewardDebt;

  // Quotient / remainder split mirrors the on-chain `checked_mul ... unwrap_or_else`
  // fallback. BigInt has no native overflow, so we always take the split path
  // for parity; the result is identical either way.
  const quot = delta / REWARD_PRECISION;
  const rem = delta % REWARD_PRECISION;
  const fromQuot = amount * quot; // saturating not needed — BigInt is unbounded
  const fromRem = (amount * rem) / REWARD_PRECISION;
  const pending = fromQuot + fromRem;

  // Saturating cap at u64::MAX to match the on-chain `u64::try_from(...).unwrap_or(u64::MAX)`.
  const live = amount + pending;
  const capped = live > U64_MAX ? U64_MAX : live;
  return Number(capped);
}
