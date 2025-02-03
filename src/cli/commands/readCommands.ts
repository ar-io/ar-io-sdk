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
  AoArNSNameData,
  AoDelegation,
  AoGatewayDelegateWithAddress,
  AoGatewayVault,
  AoGetCostDetailsParams,
} from '../../types/io.js';
import { mARIOToken } from '../../types/token.js';
import {
  AddressAndNameCLIOptions,
  AddressAndVaultIdCLIOptions,
  AddressCLIOptions,
  CLIOptionsFromAoParams,
  EpochCLIOptions,
  GetTokenCostCLIOptions,
  GlobalCLIOptions,
  NameCLIOptions,
  PaginationAddressCLIOptions,
  PaginationCLIOptions,
} from '../types.js';
import {
  addressFromOptions,
  epochInputFromOptions,
  formatARIOWithCommas,
  fundFromFromOptions,
  getTokenCostParamsFromOptions,
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

export async function listAllDelegatesCLICommand(o: PaginationCLIOptions) {
  const delegates = await readARIOFromOptions(o).getAllDelegates(
    paginationParamsFromOptions(o),
  );
  return delegates.items.length ? delegates : { message: 'No delegates found' };
}

export async function getGatewayDelegates(o: AddressCLIOptions) {
  const address = requiredAddressFromOptions(o);
  const result = await readARIOFromOptions(o).getGatewayDelegates({
    address,
    ...paginationParamsFromOptions<
      AddressCLIOptions,
      AoGatewayDelegateWithAddress
    >(o),
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
    ...paginationParamsFromOptions<PaginationAddressCLIOptions, AoDelegation>(
      o,
    ),
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
    ...paginationParamsFromOptions<PaginationAddressCLIOptions, string>(o),
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
    paginationParamsFromOptions<PaginationCLIOptions, AoArNSNameData>(o),
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
  return (
    result ?? { message: `No prescribed observers found for epoch ${epoch}` }
  );
}

export async function getPrescribedNames(o: EpochCLIOptions) {
  const epoch = epochInputFromOptions(o);
  const result = await readARIOFromOptions(o).getPrescribedNames(
    epochInputFromOptions(o),
  );
  return result ?? { message: `No prescribed names found for epoch ${epoch}` };
}

export async function getTokenCost(o: GetTokenCostCLIOptions) {
  const tokenCost = await readARIOFromOptions(o).getTokenCost(
    getTokenCostParamsFromOptions(o),
  );

  const output = {
    mARIOTokenCost: tokenCost,
    message: `The cost of the provided action is ${formatARIOWithCommas(
      new mARIOToken(tokenCost).toARIO(),
    )} ARIO`,
  };
  return output;
}

export async function getCostDetails(
  o: GlobalCLIOptions & CLIOptionsFromAoParams<AoGetCostDetailsParams>,
) {
  const costDetails = await readARIOFromOptions(o).getCostDetails({
    ...getTokenCostParamsFromOptions(o),
    fundFrom: fundFromFromOptions(o),
  });

  const output = {
    ...costDetails,
    message: `The cost of the provided action is ${formatARIOWithCommas(
      new mARIOToken(costDetails.tokenCost).toARIO(),
    )} ARIO${
      costDetails.fundingPlan && costDetails.fundingPlan.shortfall > 0
        ? `. Insufficient funds for action. There is a shortfall of ${formatARIOWithCommas(new mARIOToken(costDetails.fundingPlan.shortfall).toARIO())} ARIO`
        : ''
    }`,
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
    ...paginationParamsFromOptions<PaginationAddressCLIOptions, AoGatewayVault>(
      o,
    ),
  });

  return result.items?.length
    ? result
    : {
        message: `No vaults found for gateway ${address}`,
      };
}

export async function getAllGatewayVaults(o: PaginationCLIOptions) {
  const result = await readARIOFromOptions(o).getAllGatewayVaults(
    paginationParamsFromOptions(o),
  );

  return result.items?.length
    ? result
    : {
        message: `No vaults found`,
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
