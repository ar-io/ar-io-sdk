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
 * The ArNS gateway-operator discount, mirrored from ario-arns
 * `pricing.rs` (`try_apply_gateway_discount` / `apply_gateway_operator_discount`).
 *
 * The program applies the discount only when the purchase carries the
 * gateway's PDA (as `remaining_accounts[0]`, or the first
 * `discount_account_count` accounts on the `_from_funding_plan` variants).
 * When that account is present but the gateway does NOT qualify, the program
 * rejects the whole purchase rather than charging full price — so a client
 * must attach it only when every check below passes.
 *
 * All arithmetic is integer, exactly as on chain.
 */
import type { Address } from '@solana/kit';

import {
  type Gateway as GarGatewayAccount,
  GatewayStatus,
} from '@ar.io/solana-contracts/gar';
import type { Intent } from '../types/io.js';
import { isOperationsAddressSet } from './deserialize.js';

/** `GATEWAY_DISCOUNT_MIN_TENURE` — 180 days, in seconds. */
export const GATEWAY_DISCOUNT_MIN_TENURE_SECONDS = 15_552_000n;
/** Minimum `(1 + passed) * 1e6 / (1 + total)` — a 90% pass rate. */
export const GATEWAY_DISCOUNT_MIN_PASS_RATE = 900_000n;
/** `GATEWAY_OPERATOR_DISCOUNT_PCT` — 20%, scaled by 1e6. */
export const GATEWAY_OPERATOR_DISCOUNT_PCT = 200_000n;
const SCALE = 1_000_000n;
const DEFAULT_ADDRESS = '11111111111111111111111111111111';

/**
 * Intents whose on-chain instructions accept the discount. Primary-name fees
 * are charged by ario-core, which has no discount path.
 */
export const OPERATOR_DISCOUNT_INTENTS: ReadonlySet<Intent> = new Set<Intent>([
  'Buy-Name',
  'Buy-Record',
  'Extend-Lease',
  'Increase-Undername-Limit',
  'Upgrade-Name',
]);

/** `cost - cost * 20% / 1e6`, floored exactly as `apply_gateway_operator_discount`. */
export function applyGatewayOperatorDiscount(cost: bigint): bigint {
  return cost - (cost * GATEWAY_OPERATOR_DISCOUNT_PCT) / SCALE;
}

export type GatewayDiscountIneligibility =
  | 'not-authorised'
  | 'not-joined'
  | 'tenure'
  | 'performance';

/**
 * Why `signer` cannot claim the discount through `gateway`, or `undefined` if
 * it can. Same checks, same order, as `try_apply_gateway_discount`.
 *
 * The signer may be the operator or, once the gateway is at schema 1.2.0, its
 * non-zero operations address (ADR-0030, `Gateway::authorises`). Below 1.2.0
 * the decoded `operationsAddress` is stale tail bytes and is ignored.
 */
export function gatewayDiscountIneligibility(
  gateway: GarGatewayAccount,
  signer: Address,
  nowSeconds: bigint,
): GatewayDiscountIneligibility | undefined {
  const operationsAddress =
    isOperationsAddressSet(gateway.version) &&
    gateway.operationsAddress !== DEFAULT_ADDRESS
      ? gateway.operationsAddress
      : undefined;
  if (signer !== gateway.operator && signer !== operationsAddress) {
    return 'not-authorised';
  }
  if (gateway.status !== GatewayStatus.Joined) return 'not-joined';
  // A start in the future gives a negative elapsed time, which fails the
  // tenure check here exactly as the i64 `saturating_sub` does on chain.
  const elapsed = nowSeconds - gateway.startTimestamp;
  if (elapsed < GATEWAY_DISCOUNT_MIN_TENURE_SECONDS) return 'tenure';
  const passRate =
    ((1n + BigInt(gateway.stats.passedEpochs)) * SCALE) /
    (1n + BigInt(gateway.stats.totalEpochs));
  if (passRate < GATEWAY_DISCOUNT_MIN_PASS_RATE) return 'performance';
  return undefined;
}

export function describeGatewayDiscountIneligibility(
  reason: GatewayDiscountIneligibility,
): string {
  switch (reason) {
    case 'not-authorised':
      return 'the signer is neither its operator nor its operations address';
    case 'not-joined':
      return 'it is not joined';
    case 'tenure':
      return 'it has been running for less than 180 days';
    case 'performance':
      return 'its epoch pass rate is below 90%';
  }
}
