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
 * CLI commands for ADR-0030 (gateway operations address, gateway migration)
 * and ADR-0031 (transferable EpochSettings authority).
 *
 * All Solana-only, so — like the prune commands — they are not on the
 * cross-backend `ARIOWrite` interface and use `SolanaARIOWriteable` directly.
 */
import type { SolanaARIOWriteable } from '../../solana/io-writeable.js';
import type { UpdateGatewayMetadataParams } from '../../types/io.js';
import type {
  MigrateGatewayCLIOptions,
  MigrateGatewaysCLIOptions,
  TransferEpochSettingsAuthorityCLIOptions,
  UpdateGatewayMetadataCLIOptions,
  UpdateOperationsAddressCLIOptions,
  WriteActionCLIOptions,
} from '../types.js';
import {
  assertConfirmationPrompt,
  positiveIntegerFromOptions,
  requiredStringFromOptions,
  stringArrayFromOptions,
  stringifyJsonForCLIDisplay,
  writeARIOFromOptions,
} from '../utils.js';

async function solanaWriter(options: WriteActionCLIOptions): Promise<{
  ario: SolanaARIOWriteable;
  signerAddress: string;
}> {
  const { ario, signerAddress } = await writeARIOFromOptions(options);
  return { ario: ario as unknown as SolanaARIOWriteable, signerAddress };
}

/** Parse update-gateway-metadata flags. Exported for tests. */
export function gatewayMetadataFromOptions(
  options: UpdateGatewayMetadataCLIOptions,
): UpdateGatewayMetadataParams {
  const { gatewayAddress, label, note, properties, fqdn, port, protocol } =
    options;

  let parsedPort: number | undefined;
  if (port !== undefined) {
    parsedPort = Number(port);
    if (!Number.isInteger(parsedPort) || parsedPort < 0 || parsedPort > 65535) {
      throw new Error(`Invalid --port: ${port} (must be an integer 0-65535)`);
    }
  }

  let parsedProtocol: 'http' | 'https' | undefined;
  if (protocol !== undefined) {
    if (protocol !== 'http' && protocol !== 'https') {
      throw new Error(
        `Invalid --protocol: ${protocol} (must be http or https)`,
      );
    }
    parsedProtocol = protocol;
  }

  const params: UpdateGatewayMetadataParams = {
    gatewayAddress,
    label,
    note,
    properties,
    fqdn,
    port: parsedPort,
    protocol: parsedProtocol,
  };
  const fields = Object.entries(params).filter(
    ([k, v]) => k !== 'gatewayAddress' && v !== undefined,
  );
  if (fields.length === 0) {
    throw new Error(
      'No metadata provided. Use at least one of --label, --note, --properties, --fqdn, --port, --protocol',
    );
  }
  return params;
}

export async function updateOperationsAddress(
  options: UpdateOperationsAddressCLIOptions,
) {
  const operationsAddress = requiredStringFromOptions(
    options,
    'operationsAddress',
  );
  const { ario, signerAddress } = await solanaWriter(options);

  await assertConfirmationPrompt(
    `Gateway: ${signerAddress}\nNew operations address: ${operationsAddress}\n\n` +
      'This address will be able to update your gateway metadata and spend its ArNS discount.\n' +
      'If your gateway has not been migrated yet, the migration is included in the same transaction.\n' +
      'Are you sure?\n',
    options,
  );

  const result = await ario.updateOperationsAddress({ operationsAddress });
  return {
    updateOperationsAddressResult: result,
    gatewayAddress: signerAddress,
    operationsAddress,
    message: 'Operations address updated successfully',
  };
}

export async function updateGatewayMetadata(
  options: UpdateGatewayMetadataCLIOptions,
) {
  const params = gatewayMetadataFromOptions(options);
  const { ario, signerAddress } = await solanaWriter(options);
  const gatewayAddress = params.gatewayAddress ?? signerAddress;

  await assertConfirmationPrompt(
    `Gateway: ${gatewayAddress}\nSigner: ${signerAddress}\n\nMetadata:\n\n${stringifyJsonForCLIDisplay(params)}\n\nYou are about to update this gateway's metadata.\nAre you sure?\n`,
    options,
  );

  const result = await ario.updateGatewayMetadata(params);
  return {
    updateGatewayMetadataResult: result,
    gatewayAddress,
    message: 'Gateway metadata updated successfully',
  };
}

export async function migrateGateway(options: MigrateGatewayCLIOptions) {
  const gateway = requiredStringFromOptions(options, 'gateway');
  const { ario } = await solanaWriter(options);

  await assertConfirmationPrompt(
    `You are about to migrate gateway ${gateway} to schema 1.2.0 (you pay a small rent top-up).\nAre you sure?\n`,
    options,
  );

  const result = await ario.migrateGateway({ gatewayAddress: gateway });
  return {
    migrateGatewayResult: result,
    gatewayAddress: gateway,
    message: 'Gateway migrated successfully',
  };
}

export async function migrateGateways(options: MigrateGatewaysCLIOptions) {
  const explicit = stringArrayFromOptions(options, 'gateways');
  const batchSize = positiveIntegerFromOptions(options, 'batchSize');
  const { ario } = await solanaWriter(options);

  const gateways = explicit ?? (await ario.getUnmigratedGatewayAddresses());
  if (gateways.length === 0) {
    return { migrated: [], signatures: [], message: 'No gateways to migrate' };
  }

  await assertConfirmationPrompt(
    `You are about to migrate ${gateways.length} gateway(s) to schema 1.2.0` +
      `${batchSize !== undefined ? ` in batches of ${batchSize}` : ''}.\n` +
      'You pay each rent top-up (32 bytes per gateway).\nAre you sure?\n',
    options,
  );

  const result = await ario.migrateGateways({
    gatewayAddresses: gateways,
    batchSize,
  });
  return {
    ...result,
    message: `Migrated ${result.migrated.length} gateway(s)`,
  };
}

export async function transferEpochSettingsAuthority(
  options: TransferEpochSettingsAuthorityCLIOptions,
) {
  const newAuthority = requiredStringFromOptions(options, 'newAuthority');
  const { ario, signerAddress } = await solanaWriter(options);

  await assertConfirmationPrompt(
    `Current EpochSettings authority (signer): ${signerAddress}\nNew EpochSettings authority: ${newAuthority}\n\n` +
      'After this, only the new authority can run epoch admin instructions. This cannot be undone by the current signer.\n' +
      'Are you sure?\n',
    options,
  );

  const result = await ario.transferEpochSettingsAuthority({ newAuthority });
  return {
    transferEpochSettingsAuthorityResult: result,
    previousAuthority: signerAddress,
    newAuthority,
    message: 'EpochSettings authority transferred successfully',
  };
}
