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
import { existsSync } from 'fs';

import { mARIOToken } from '../../types/token.js';
import {
  CreateVaultCLIOptions,
  ExtendVaultCLIOptions,
  IncreaseVaultCLIOptions,
  JsonSerializable,
  RevokeVaultCLIOptions,
  TransferCLIOptions,
  VaultedTransferCLIOptions,
} from '../types.js';
import {
  assertEnoughMARIOBalance,
  assertLockLengthInRange,
  confirmationPrompt,
  customTagsFromOptions,
  expandTildePath,
  formatARIOWithCommas,
  formatMARIOToARIOWithCommas,
  requiredMARIOFromOptions,
  requiredPositiveIntegerFromOptions,
  requiredStringFromOptions,
  requiredTargetAndQuantityFromOptions,
  writeARIOFromOptions,
} from '../utils.js';

/**
 * Validates Arweave address format
 */
function validateArweaveAddress(address: string): boolean | string {
  if (!address) {
    return 'Address is required';
  }
  if (address.length !== 43) {
    return 'Address must be exactly 43 characters long';
  }
  if (!/^[A-Za-z0-9_-]+$/.test(address)) {
    return 'Address contains invalid characters. Only alphanumeric, underscore, and dash are allowed';
  }
  return true;
}

/**
 * Validates ARIO amount
 */
function validateARIOAmount(value: string): boolean | string {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return 'Please enter a valid number';
  }
  if (num <= 0) {
    return 'Amount must be greater than 0';
  }
  if (num > 1000000) {
    return 'Amount seems unusually large. Please verify this is correct';
  }
  return true;
}

/**
 * Validates wallet file path
 */
function validateWalletFile(filePath: string): boolean | string {
  if (!filePath) {
    return 'Wallet file path is required';
  }

  const expandedPath = expandTildePath(filePath);
  if (!existsSync(expandedPath)) {
    return `Wallet file not found at: ${expandedPath}`;
  }
  if (
    !filePath.endsWith('.json') &&
    !filePath.endsWith('.jwk') &&
    !filePath.endsWith('.txt')
  ) {
    return 'Wallet file should be a .json, .jwk, or .txt file';
  }
  return true;
}

/**
 * Validates private key (basic JSON format check)
 */
function validatePrivateKey(key: string): boolean | string {
  if (!key) {
    return 'Private key is required';
  }
  try {
    JSON.parse(key);
    return true;
  } catch {
    return 'Private key must be valid JSON (stringified JWK)';
  }
}

/**
 * Validates vault ID format
 */
function validateVaultId(vaultId: string): boolean | string {
  if (!vaultId) {
    return 'Vault ID is required';
  }
  if (vaultId.length !== 43) {
    return 'Vault ID must be exactly 43 characters long';
  }
  if (!/^[A-Za-z0-9_-]+$/.test(vaultId)) {
    return 'Vault ID contains invalid characters. Only alphanumeric, underscore, and dash are allowed';
  }
  return true;
}

/**
 * Validates lock length in milliseconds
 */
function validateLockLength(value: string): boolean | string {
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    return 'Please enter a valid number';
  }
  if (num <= 0) {
    return 'Lock length must be greater than 0';
  }
  if (num < 86400000) {
    // 1 day in ms
    return 'Lock length must be at least 1 day (86400000 ms)';
  }
  if (num > 31557600000) {
    // 1 year in ms
    return 'Lock length cannot exceed 1 year (31557600000 ms)';
  }
  return true;
}

/**
 * Validates extend length in milliseconds
 */
function validateExtendLength(value: string): boolean | string {
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    return 'Please enter a valid number';
  }
  if (num <= 0) {
    return 'Extend length must be greater than 0';
  }
  if (num > 31557600000) {
    // 1 year in ms
    return 'Extend length cannot exceed 1 year (31557600000 ms)';
  }
  return true;
}

/**
 * Handle interactive prompting for missing parameters
 */
async function handleInteractivePrompts(
  options: TransferCLIOptions,
): Promise<void> {
  const { input, confirm, select } = await import('@inquirer/prompts');

  // Prompt for wallet/private key if not provided
  if (
    (options.walletFile == null || options.walletFile === '') &&
    (options.privateKey == null || options.privateKey === '')
  ) {
    const walletChoice = await select({
      message: '🔑 How would you like to provide your wallet?',
      choices: [
        { name: 'Wallet file path (.json, .jwk)', value: 'file' },
        { name: 'Private key (stringified JWK)', value: 'key' },
      ],
    });

    if (walletChoice === 'file') {
      const walletPath = await input({
        message: '📁 Enter wallet file path:',
        validate: validateWalletFile,
      });
      options.walletFile = expandTildePath(walletPath);
    } else {
      options.privateKey = await input({
        message: '🔐 Enter private key (stringified JWK):',
        validate: validatePrivateKey,
      });
    }
  }

  // Prompt for target address if not provided
  if (options.target == null || options.target === '') {
    options.target = await input({
      message: '📝 Enter target address:',
      validate: validateArweaveAddress,
    });
  }

  // Prompt for quantity if not provided
  if (options.quantity == null || options.quantity === '') {
    const quantityStr = await input({
      message: '💰 Enter amount to transfer (ARIO):',
      validate: validateARIOAmount,
    });
    options.quantity = quantityStr;
  }

  // Show transfer summary
  console.log('\n📋 Transfer Summary:');
  console.log(`   Target: ${options.target}`);
  console.log(`   Amount: ${options.quantity} ARIO`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with this transfer?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Transfer cancelled by user');
    }
  }
}

/**
 * Handle interactive prompting for vaulted transfer parameters
 */
async function handleVaultedTransferInteractivePrompts(
  options: VaultedTransferCLIOptions,
): Promise<void> {
  const { input, confirm, select } = await import('@inquirer/prompts');

  // Prompt for wallet/private key if not provided
  if (
    (options.walletFile == null || options.walletFile === '') &&
    (options.privateKey == null || options.privateKey === '')
  ) {
    const walletChoice = await select({
      message: '🔑 How would you like to provide your wallet?',
      choices: [
        { name: 'Wallet file path (.json, .jwk)', value: 'file' },
        { name: 'Private key (stringified JWK)', value: 'key' },
      ],
    });

    if (walletChoice === 'file') {
      const walletPath = await input({
        message: '📁 Enter wallet file path:',
        validate: validateWalletFile,
      });
      options.walletFile = expandTildePath(walletPath);
    } else {
      options.privateKey = await input({
        message: '🔐 Enter private key (stringified JWK):',
        validate: validatePrivateKey,
      });
    }
  }

  // Prompt for recipient address if not provided
  if (options.recipient == null || options.recipient === '') {
    options.recipient = await input({
      message: '📝 Enter recipient address:',
      validate: validateArweaveAddress,
    });
  }

  // Prompt for quantity if not provided
  if (options.quantity == null || options.quantity === '') {
    const quantityStr = await input({
      message: '💰 Enter amount to transfer (ARIO):',
      validate: validateARIOAmount,
    });
    options.quantity = quantityStr;
  }

  // Prompt for lock length if not provided
  if (options.lockLengthMs == null || options.lockLengthMs === '') {
    const lockLengthStr = await input({
      message:
        '⏰ Enter lock length in milliseconds (minimum 86400000 = 1 day):',
      validate: validateLockLength,
    });
    options.lockLengthMs = lockLengthStr;
  }

  // Prompt for revokable if not explicitly set
  if (options.revokable === undefined) {
    options.revokable = await confirm({
      message: '🔄 Should this vaulted transfer be revokable by you?',
      default: false,
    });
  }

  // Show vaulted transfer summary
  console.log('\n📋 Vaulted Transfer Summary:');
  console.log(`   Recipient: ${options.recipient}`);
  console.log(`   Amount: ${options.quantity} ARIO`);
  console.log(
    `   Lock Length: ${options.lockLengthMs} ms (${Math.round(Number(options.lockLengthMs) / 86400000)} days)`,
  );
  console.log(`   Revokable: ${options.revokable ? 'Yes' : 'No'}`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with this vaulted transfer?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Vaulted transfer cancelled by user');
    }
  }
}

/**
 * Handle interactive prompting for revoke vault parameters
 */
async function handleRevokeVaultInteractivePrompts(
  options: RevokeVaultCLIOptions,
): Promise<void> {
  const { input, confirm, select } = await import('@inquirer/prompts');

  // Prompt for wallet/private key if not provided
  if (
    (options.walletFile == null || options.walletFile === '') &&
    (options.privateKey == null || options.privateKey === '')
  ) {
    const walletChoice = await select({
      message: '🔑 How would you like to provide your wallet?',
      choices: [
        { name: 'Wallet file path (.json, .jwk)', value: 'file' },
        { name: 'Private key (stringified JWK)', value: 'key' },
      ],
    });

    if (walletChoice === 'file') {
      const walletPath = await input({
        message: '📁 Enter wallet file path:',
        validate: validateWalletFile,
      });
      options.walletFile = expandTildePath(walletPath);
    } else {
      options.privateKey = await input({
        message: '🔐 Enter private key (stringified JWK):',
        validate: validatePrivateKey,
      });
    }
  }

  // Prompt for vault ID if not provided
  if (options.vaultId == null || options.vaultId === '') {
    options.vaultId = await input({
      message: '🏦 Enter vault ID to revoke:',
      validate: validateVaultId,
    });
  }

  // Prompt for recipient address if not provided
  if (options.recipient == null || options.recipient === '') {
    options.recipient = await input({
      message: '📝 Enter recipient address (vault owner):',
      validate: validateArweaveAddress,
    });
  }

  // Show revoke vault summary
  console.log('\n📋 Revoke Vault Summary:');
  console.log(`   Vault ID: ${options.vaultId}`);
  console.log(`   Recipient: ${options.recipient}`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with revoking this vault?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Vault revocation cancelled by user');
    }
  }
}

/**
 * Handle interactive prompting for create vault parameters
 */
async function handleCreateVaultInteractivePrompts(
  options: CreateVaultCLIOptions,
): Promise<void> {
  const { input, confirm, select } = await import('@inquirer/prompts');

  // Prompt for wallet/private key if not provided
  if (
    (options.walletFile == null || options.walletFile === '') &&
    (options.privateKey == null || options.privateKey === '')
  ) {
    const walletChoice = await select({
      message: '🔑 How would you like to provide your wallet?',
      choices: [
        { name: 'Wallet file path (.json, .jwk)', value: 'file' },
        { name: 'Private key (stringified JWK)', value: 'key' },
      ],
    });

    if (walletChoice === 'file') {
      const walletPath = await input({
        message: '📁 Enter wallet file path:',
        validate: validateWalletFile,
      });
      options.walletFile = expandTildePath(walletPath);
    } else {
      options.privateKey = await input({
        message: '🔐 Enter private key (stringified JWK):',
        validate: validatePrivateKey,
      });
    }
  }

  // Prompt for quantity if not provided
  if (options.quantity == null || options.quantity === '') {
    const quantityStr = await input({
      message: '💰 Enter amount to vault (ARIO):',
      validate: validateARIOAmount,
    });
    options.quantity = quantityStr;
  }

  // Prompt for lock length if not provided
  if (options.lockLengthMs == null || options.lockLengthMs === '') {
    const lockLengthStr = await input({
      message:
        '⏰ Enter lock length in milliseconds (minimum 86400000 = 1 day):',
      validate: validateLockLength,
    });
    options.lockLengthMs = lockLengthStr;
  }

  // Show create vault summary
  console.log('\n📋 Create Vault Summary:');
  console.log(`   Amount: ${options.quantity} ARIO`);
  console.log(
    `   Lock Length: ${options.lockLengthMs} ms (${Math.round(Number(options.lockLengthMs) / 86400000)} days)`,
  );
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with creating this vault?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Vault creation cancelled by user');
    }
  }
}

/**
 * Handle interactive prompting for extend vault parameters
 */
async function handleExtendVaultInteractivePrompts(
  options: ExtendVaultCLIOptions,
): Promise<void> {
  const { input, confirm, select } = await import('@inquirer/prompts');

  // Prompt for wallet/private key if not provided
  if (
    (options.walletFile == null || options.walletFile === '') &&
    (options.privateKey == null || options.privateKey === '')
  ) {
    const walletChoice = await select({
      message: '🔑 How would you like to provide your wallet?',
      choices: [
        { name: 'Wallet file path (.json, .jwk)', value: 'file' },
        { name: 'Private key (stringified JWK)', value: 'key' },
      ],
    });

    if (walletChoice === 'file') {
      const walletPath = await input({
        message: '📁 Enter wallet file path:',
        validate: validateWalletFile,
      });
      options.walletFile = expandTildePath(walletPath);
    } else {
      options.privateKey = await input({
        message: '🔐 Enter private key (stringified JWK):',
        validate: validatePrivateKey,
      });
    }
  }

  // Prompt for vault ID if not provided
  if (options.vaultId == null || options.vaultId === '') {
    options.vaultId = await input({
      message: '🏦 Enter vault ID to extend:',
      validate: validateVaultId,
    });
  }

  // Prompt for extend length if not provided
  if (options.extendLengthMs == null || options.extendLengthMs === '') {
    const extendLengthStr = await input({
      message: '⏰ Enter extend length in milliseconds:',
      validate: validateExtendLength,
    });
    options.extendLengthMs = extendLengthStr;
  }

  // Show extend vault summary
  console.log('\n📋 Extend Vault Summary:');
  console.log(`   Vault ID: ${options.vaultId}`);
  console.log(
    `   Extend Length: ${options.extendLengthMs} ms (${Math.round(Number(options.extendLengthMs) / 86400000)} days)`,
  );
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with extending this vault?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Vault extension cancelled by user');
    }
  }
}

/**
 * Handle interactive prompting for increase vault parameters
 */
async function handleIncreaseVaultInteractivePrompts(
  options: IncreaseVaultCLIOptions,
): Promise<void> {
  const { input, confirm, select } = await import('@inquirer/prompts');

  // Prompt for wallet/private key if not provided
  if (
    (options.walletFile == null || options.walletFile === '') &&
    (options.privateKey == null || options.privateKey === '')
  ) {
    const walletChoice = await select({
      message: '🔑 How would you like to provide your wallet?',
      choices: [
        { name: 'Wallet file path (.json, .jwk)', value: 'file' },
        { name: 'Private key (stringified JWK)', value: 'key' },
      ],
    });

    if (walletChoice === 'file') {
      const walletPath = await input({
        message: '📁 Enter wallet file path:',
        validate: validateWalletFile,
      });
      options.walletFile = expandTildePath(walletPath);
    } else {
      options.privateKey = await input({
        message: '🔐 Enter private key (stringified JWK):',
        validate: validatePrivateKey,
      });
    }
  }

  // Prompt for vault ID if not provided
  if (options.vaultId == null || options.vaultId === '') {
    options.vaultId = await input({
      message: '🏦 Enter vault ID to increase:',
      validate: validateVaultId,
    });
  }

  // Prompt for quantity if not provided
  if (options.quantity == null || options.quantity === '') {
    const quantityStr = await input({
      message: '💰 Enter amount to add to vault (ARIO):',
      validate: validateARIOAmount,
    });
    options.quantity = quantityStr;
  }

  // Show increase vault summary
  console.log('\n📋 Increase Vault Summary:');
  console.log(`   Vault ID: ${options.vaultId}`);
  console.log(`   Amount to Add: ${options.quantity} ARIO`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with increasing this vault?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Vault increase cancelled by user');
    }
  }
}

export async function transferCLICommand(options: TransferCLIOptions) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('🚀 Interactive ARIO Transfer\n');
    await handleInteractivePrompts(options);
    console.log('\n⏳ Processing transfer...');
  }

  const { target, arioQuantity } =
    requiredTargetAndQuantityFromOptions(options);
  const { ario, signerAddress } = writeARIOFromOptions(options);

  if (!options.skipConfirmation && !options.interactive) {
    await assertEnoughMARIOBalance({
      ario,
      address: signerAddress,
      mARIOQuantity: arioQuantity.toMARIO(),
    });

    const confirm = await confirmationPrompt(
      `Are you sure you want to transfer ${formatARIOWithCommas(arioQuantity)} ARIO to ${target}?`,
    );
    if (!confirm) {
      return { message: 'Transfer aborted by user' };
    }
  }

  const result = await ario.transfer(
    {
      target,
      qty: arioQuantity.toMARIO().valueOf(),
    },
    customTagsFromOptions(options),
  );

  const output = {
    senderAddress: signerAddress,
    transferResult: result,
    message: `Successfully transferred ${formatARIOWithCommas(arioQuantity)} ARIO to ${target}`,
  };

  return output;
}

export async function vaultedTransferCLICommand(
  o: VaultedTransferCLIOptions,
): Promise<JsonSerializable> {
  // Handle interactive mode
  if (o.interactive) {
    console.log('🚀 Interactive Vaulted Transfer\n');
    await handleVaultedTransferInteractivePrompts(o);
    console.log('\n⏳ Processing vaulted transfer...');
  }
  const mARIOQuantity = requiredMARIOFromOptions(o, 'quantity');
  const recipient = requiredStringFromOptions(o, 'recipient');
  const { ario, signerAddress } = writeARIOFromOptions(o);
  const lockLengthMs = requiredPositiveIntegerFromOptions(o, 'lockLengthMs');
  assertLockLengthInRange(lockLengthMs);

  if (!o.skipConfirmation && !o.interactive) {
    await assertEnoughMARIOBalance({
      ario,
      address: signerAddress,
      mARIOQuantity,
    });

    const confirm = await confirmationPrompt(
      `Are you sure you want transfer ${formatMARIOToARIOWithCommas(mARIOQuantity)} ARIO to ${recipient}, locked in a ${o.revokable ? '' : 'non-'}revokable vault for ${lockLengthMs}ms?`,
    );
    if (!confirm) {
      return { message: 'Transfer aborted by user' };
    }
  }

  const result = await ario.vaultedTransfer(
    {
      recipient,
      quantity: mARIOQuantity,
      lockLengthMs,
      revokable: o.revokable,
    },
    customTagsFromOptions(o),
  );

  const output = {
    senderAddress: signerAddress,
    transferResult: result,
    message: `Successfully vaulted transferred ${formatMARIOToARIOWithCommas(mARIOQuantity)} ARIO to ${recipient}`,
  };

  return output;
}

export async function revokeVaultCLICommand(
  o: RevokeVaultCLIOptions,
): Promise<JsonSerializable> {
  // Handle interactive mode
  if (o.interactive) {
    console.log('🚀 Interactive Vault Revocation\n');
    await handleRevokeVaultInteractivePrompts(o);
    console.log('\n⏳ Processing vault revocation...');
  }
  const { ario, signerAddress } = writeARIOFromOptions(o);
  const vaultId = requiredStringFromOptions(o, 'vaultId');
  const recipient = requiredStringFromOptions(o, 'recipient');

  if (!o.skipConfirmation && !o.interactive) {
    const vault = await ario.getVault({ vaultId, address: recipient });

    const confirm = await confirmationPrompt(
      `Are you sure you want to revoke vault with id ${vaultId} from ${recipient} with balance ${formatARIOWithCommas(
        new mARIOToken(vault.balance).toARIO(),
      )} ARIO?`,
    );
    if (!confirm) {
      return { message: 'Revoke aborted by user' };
    }
  }

  const result = await ario.revokeVault(
    {
      vaultId,
      recipient,
    },
    customTagsFromOptions(o),
  );

  const output = {
    senderAddress: signerAddress,
    transferResult: result,
    message: `Successfully revoked vault with id ${vaultId}`,
  };

  return output;
}

export async function createVaultCLICommand(
  o: CreateVaultCLIOptions,
): Promise<JsonSerializable> {
  // Handle interactive mode
  if (o.interactive) {
    console.log('🚀 Interactive Vault Creation\n');
    await handleCreateVaultInteractivePrompts(o);
    console.log('\n⏳ Processing vault creation...');
  }
  const mARIOQuantity = requiredMARIOFromOptions(o, 'quantity');
  const { ario, signerAddress } = writeARIOFromOptions(o);
  const lockLengthMs = requiredPositiveIntegerFromOptions(o, 'lockLengthMs');
  assertLockLengthInRange(lockLengthMs);

  if (!o.skipConfirmation && !o.interactive) {
    await assertEnoughMARIOBalance({
      ario,
      address: signerAddress,
      mARIOQuantity,
    });

    const confirm = await confirmationPrompt(
      `Are you sure you want to create a vault with ${formatMARIOToARIOWithCommas(mARIOQuantity)} ARIO, locked for ${lockLengthMs}ms?`,
    );
    if (!confirm) {
      return { message: 'Vault creation aborted by user' };
    }
  }

  const result = await ario.createVault(
    {
      quantity: mARIOQuantity,
      lockLengthMs,
    },
    customTagsFromOptions(o),
  );

  const output = {
    senderAddress: signerAddress,
    transferResult: result,
    message: `Successfully created vault with ${formatMARIOToARIOWithCommas(mARIOQuantity)} ARIO`,
  };

  return output;
}

export async function extendVaultCLICommand(o: ExtendVaultCLIOptions) {
  // Handle interactive mode
  if (o.interactive) {
    console.log('🚀 Interactive Vault Extension\n');
    await handleExtendVaultInteractivePrompts(o);
    console.log('\n⏳ Processing vault extension...');
  }
  const { ario, signerAddress } = writeARIOFromOptions(o);
  const vaultId = requiredStringFromOptions(o, 'vaultId');
  const extendLengthMs = requiredPositiveIntegerFromOptions(
    o,
    'extendLengthMs',
  );
  assertLockLengthInRange(extendLengthMs, false);

  if (!o.skipConfirmation && !o.interactive) {
    const vault = await ario.getVault({ vaultId, address: signerAddress });

    const confirm = await confirmationPrompt(
      `Are you sure you want to extend vault with id ${vaultId} for ${extendLengthMs}ms with balance ${formatARIOWithCommas(
        new mARIOToken(vault.balance).toARIO(),
      )} ARIO?`,
    );
    if (!confirm) {
      return { message: 'Vault extension aborted by user' };
    }
  }

  const result = await ario.extendVault(
    {
      vaultId,
      extendLengthMs,
    },
    customTagsFromOptions(o),
  );

  const output = {
    senderAddress: signerAddress,
    transferResult: result,
    message: `Successfully extended vault with id ${vaultId}`,
  };

  return output;
}

export async function increaseVaultCLICommand(o: IncreaseVaultCLIOptions) {
  // Handle interactive mode
  if (o.interactive) {
    console.log('🚀 Interactive Vault Increase\n');
    await handleIncreaseVaultInteractivePrompts(o);
    console.log('\n⏳ Processing vault increase...');
  }
  const mARIOQuantity = requiredMARIOFromOptions(o, 'quantity');
  const { ario, signerAddress } = writeARIOFromOptions(o);
  const vaultId = requiredStringFromOptions(o, 'vaultId');

  if (!o.skipConfirmation && !o.interactive) {
    const vault = await ario.getVault({ vaultId, address: signerAddress });

    const confirm = await confirmationPrompt(
      `Are you sure you want to increase vault with id ${vaultId} by ${formatMARIOToARIOWithCommas(mARIOQuantity)} ARIO with balance ${formatARIOWithCommas(
        new mARIOToken(vault.balance).toARIO(),
      )} ARIO?`,
    );
    if (!confirm) {
      return { message: 'Vault increase aborted by user' };
    }
  }

  const result = await ario.increaseVault(
    {
      vaultId,
      quantity: mARIOQuantity,
    },
    customTagsFromOptions(o),
  );

  const output = {
    senderAddress: signerAddress,
    transferResult: result,
    message: `Successfully increased vault with id ${vaultId} by ${formatMARIOToARIOWithCommas(mARIOQuantity)} ARIO`,
  };

  return output;
}
