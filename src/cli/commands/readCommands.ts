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
import {
  intentsUsingYears,
  isValidIntent,
  validIntents,
} from '../../types/io.js';
import { mARIOToken } from '../../types/token.js';
import {
  AddressAndNameCLIOptions,
  AddressAndVaultIdCLIOptions,
  AddressCLIOptions,
  EpochCLIOptions,
  GetTokenCostCLIOptions,
  NameCLIOptions,
  PaginationAddressCLIOptions,
  PaginationCLIOptions,
} from '../types.js';
import {
  addressFromOptions,
  epochInputFromOptions,
  formatARIOWithCommas,
  paginationParamsFromOptions,
  readARIOFromOptions,
  requiredAddressFromOptions,
  requiredStringFromOptions,
} from '../utils.js';

export async function getGateway(o: AddressCLIOptions) {
  const address = requiredAddressFromOptions(o);
  const gateway = await readARIOFromOptions(o).getGateway({
    address,
  });
  return gateway ?? { message: `No gateway found for address ${address}` };
}

export async function listGateways(o: PaginationCLIOptions) {
  const gateways = await readARIOFromOptions(o).getGateways(
    paginationParamsFromOptions(o),
  );
  return gateways.items.length ? gateways : { message: 'No gateways found' };
}

export async function getGatewayDelegates(o: AddressCLIOptions) {
  const address = requiredAddressFromOptions(o);
  const result = await readARIOFromOptions(o).getGatewayDelegates({
    address,
    ...paginationParamsFromOptions(o),
  });

  return result.items?.length
    ? result
    : {
        message: `No delegates found for gateway ${address}`,
      };
}

export async function getDelegations(o: PaginationAddressCLIOptions) {
  const address = requiredAddressFromOptions(o);
  const result = await readARIOFromOptions(o).getDelegations({
    address,
    ...paginationParamsFromOptions(o),
  });

  return result.items?.length
    ? result
    : {
        message: `No delegations found for address ${address}`,
      };
}

export async function getAllowedDelegates(o: PaginationAddressCLIOptions) {
  const address = requiredAddressFromOptions(o);
  const result = await readARIOFromOptions(o).getAllowedDelegates({
    address,
    ...paginationParamsFromOptions(o),
  });

  return result.items?.length
    ? result
    : {
        message: `No allow list found for gateway delegate ${address}`,
      };
}

export async function getArNSRecord(o: NameCLIOptions) {
  const name = requiredStringFromOptions(o, 'name');
  return (
    (await readARIOFromOptions(o).getArNSRecord({
      name,
    })) ?? { message: `No record found for name ${name}` }
  );
}

export async function listArNSRecords(o: PaginationCLIOptions) {
  const records = await readARIOFromOptions(o).getArNSRecords(
    paginationParamsFromOptions(o),
  );
  return records.items.length ? records : { message: 'No records found' };
}

export async function getArNSReservedName(o: NameCLIOptions) {
  const name = requiredStringFromOptions(o, 'name');
  return (
    (await readARIOFromOptions(o).getArNSReservedName({
      name,
    })) ?? { message: `No reserved name found for name ${name}` }
  );
}

export async function listArNSReservedNames(o: PaginationCLIOptions) {
  const reservedNames = await readARIOFromOptions(o).getArNSReservedNames(
    paginationParamsFromOptions(o),
  );
  return reservedNames.items.length
    ? reservedNames
    : { message: 'No reserved names found' };
}

export async function getArNSReturnedName(o: NameCLIOptions) {
  const name = requiredStringFromOptions(o, 'name');
  const result = await readARIOFromOptions(o).getArNSReturnedName({ name });
  return result ?? { message: `No returned name found for name ${name}` };
}

export async function listArNSReturnedNames(o: PaginationCLIOptions) {
  const returnedNames = await readARIOFromOptions(o).getArNSReturnedNames(
    paginationParamsFromOptions(o),
  );
  return returnedNames.items.length
    ? returnedNames
    : { message: 'No returned names found' };
}

export async function getEpoch(o: EpochCLIOptions) {
  const epoch = await readARIOFromOptions(o).getEpoch(epochInputFromOptions(o));
  return epoch ?? { message: `No epoch found for provided input` };
}

export async function getPrescribedObservers(o: EpochCLIOptions) {
  const epoch = epochInputFromOptions(o);
  const result = await readARIOFromOptions(o).getPrescribedObservers(epoch);
  return result?.length
    ? result
    : { message: `No prescribed observers found for epoch ${epoch}` };
}

export async function getPrescribedNames(o: EpochCLIOptions) {
  const epoch = epochInputFromOptions(o);
  const result = await readARIOFromOptions(o).getPrescribedNames(
    epochInputFromOptions(o),
  );
  return result?.length
    ? result
    : { message: `No prescribed names found for epoch ${epoch}` };
}

export async function getTokenCost(o: GetTokenCostCLIOptions) {
  o.intent ??= 'Buy-Record';
  o.type ??= 'lease';

  if (!isValidIntent(o.intent)) {
    throw new Error(
      `Invalid intent. Valid intents are: ${validIntents.join(', ')}`,
    );
  }

  if (o.type !== 'lease' && o.type !== 'permabuy') {
    throw new Error(`Invalid type. Valid types are: lease, permabuy`);
  }

  if (
    o.type === 'lease' &&
    intentsUsingYears.includes(o.intent) &&
    o.years === undefined
  ) {
    throw new Error('Years is required for lease type');
  }

  const tokenCost = await readARIOFromOptions(o).getTokenCost({
    type: o.type,
    quantity: o.quantity !== undefined ? +o.quantity : undefined,
    years: o.years !== undefined ? +o.years : undefined,
    intent: o.intent,
    name: requiredStringFromOptions(o, 'name'),
  });

  const output = {
    mIOTokenCost: tokenCost,
    message: `The cost of the provided action is ${formatARIOWithCommas(
      new mARIOToken(tokenCost).toARIO(),
    )} ARIO`,
  };
  return output;
}

export async function getPrimaryName(o: AddressAndNameCLIOptions) {
  const address = addressFromOptions(o);
  const name = o.name;

  const params =
    name !== undefined
      ? { name }
      : address !== undefined
        ? { address }
        : undefined;
  if (params === undefined) {
    throw new Error('Either --address or --name is required');
  }

  const result = await readARIOFromOptions(o).getPrimaryName(params);
  return (
    result ?? {
      message: `No primary name found`,
    }
  );
}

export async function getGatewayVaults(o: PaginationAddressCLIOptions) {
  const address = requiredAddressFromOptions(o);
  const result = await readARIOFromOptions(o).getGatewayVaults({
    address,
    ...paginationParamsFromOptions(o),
  });

  return result.items?.length
    ? result
    : {
        message: `No vaults found for gateway ${address}`,
      };
}

export async function getVault(o: AddressAndVaultIdCLIOptions) {
  return readARIOFromOptions(o)
    .getVault({
      address: requiredAddressFromOptions(o),
      vaultId: requiredStringFromOptions(o, 'vaultId'),
    })
    .then(
      (r) =>
        r ?? {
          message: `No vault found for provided address and vault ID`,
        },
    );
}
