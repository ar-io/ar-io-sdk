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

import { ANT } from '../../common/ant.js';
import {
  AoArNSPurchaseParams,
  AoBuyRecordParams,
  AoExtendLeaseParams,
  AoIncreaseUndernameLimitParams,
} from '../../types/io.js';
import { CLIWriteOptionsFromAoParams } from '../types.js';
import {
  assertConfirmationPrompt,
  assertEnoughBalanceForArNSPurchase,
  customTagsFromOptions,
  expandTildePath,
  fundFromFromOptions,
  positiveIntegerFromOptions,
  recordTypeFromOptions,
  referrerFromOptions,
  requiredPositiveIntegerFromOptions,
  requiredStringFromOptions,
  stringArrayFromOptions,
  writeARIOFromOptions,
} from '../utils.js';

/**
 * Validates ArNS name format
 */
function validateArNSName(name: string): boolean | string {
  if (!name) {
    return 'ArNS name is required';
  }
  if (name.length < 1 || name.length > 63) {
    return 'ArNS name must be between 1 and 63 characters long';
  }
  if (!/^[a-z0-9_-]+$/.test(name)) {
    return 'ArNS name can only contain lowercase letters, numbers, hyphens, and underscores';
  }
  if (name.startsWith('-') || name.endsWith('-')) {
    return 'ArNS name cannot start or end with a hyphen';
  }
  if (name.startsWith('_') || name.endsWith('_')) {
    return 'ArNS name cannot start or end with an underscore';
  }
  return true;
}

/**
 * Validates lease years
 */
function validateLeaseYears(value: string): boolean | string {
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    return 'Please enter a valid number';
  }
  if (num < 1 || num > 5) {
    return 'Lease years must be between 1 and 5';
  }
  return true;
}

/**
 * Validates undername increase count
 */
function validateIncreaseCount(value: string): boolean | string {
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    return 'Please enter a valid number';
  }
  if (num < 1) {
    return 'Increase count must be at least 1';
  }
  if (num > 10000) {
    return 'Increase count cannot exceed 10,000';
  }
  return true;
}

/**
 * Validates ARIO amount for ArNS purchases
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
 * Validates ANT process ID format
 */
function validateProcessId(processId: string): boolean | string {
  if (!processId) {
    return 'Process ID is required';
  }
  if (processId.length !== 43) {
    return 'Process ID must be exactly 43 characters long';
  }
  if (!/^[A-Za-z0-9_-]+$/.test(processId)) {
    return 'Process ID contains invalid characters. Only alphanumeric, underscore, and dash are allowed';
  }
  return true;
}

/**
 * Handle interactive prompting for buy-record parameters
 */
async function handleBuyRecordInteractivePrompts(
  options: CLIWriteOptionsFromAoParams<AoBuyRecordParams>,
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

  // Prompt for ArNS name if not provided
  if (options.name == null || options.name === '') {
    options.name = await input({
      message: '📝 Enter ArNS name to purchase:',
      validate: validateArNSName,
    });
  }

  // Prompt for record type if not provided
  if (options.type == null || options.type === '') {
    options.type = await select({
      message: '📋 Select record type:',
      choices: [
        { name: 'Lease (temporary ownership)', value: 'lease' },
        { name: 'Permabuy (permanent ownership)', value: 'permabuy' },
      ],
    });
  }

  // Prompt for lease years if type is lease and years not provided
  if (
    options.type === 'lease' &&
    (options.years == null || options.years === '')
  ) {
    const yearsStr = await input({
      message: '⏰ Enter lease duration in years (1-5):',
      validate: validateLeaseYears,
      default: '1',
    });
    options.years = yearsStr;
  }

  // Prompt for payment amount if not provided (for permabuy)
  if (
    options.type === 'permabuy' &&
    (options.quantity == null || options.quantity === '')
  ) {
    const quantityStr = await input({
      message: '💰 Enter payment amount (ARIO):',
      validate: validateARIOAmount,
    });
    options.quantity = quantityStr;
  }

  // Prompt for existing ANT process ID if desired
  if (options.processId == null || options.processId === '') {
    const useExistingANT = await confirm({
      message: '🔗 Do you want to assign this name to an existing ANT process?',
      default: false,
    });

    if (useExistingANT) {
      options.processId = await input({
        message: '🏷️ Enter ANT process ID:',
        validate: validateProcessId,
      });
    }
  }

  // Show purchase summary
  console.log('\n📋 Buy Record Summary:');
  console.log(`   ArNS Name: ${options.name}`);
  console.log(`   Type: ${options.type}`);
  if (
    options.type === 'lease' &&
    options.years != null &&
    options.years !== ''
  ) {
    console.log(`   Lease Duration: ${options.years} year(s)`);
  }
  if (options.quantity != null && options.quantity !== '') {
    console.log(`   Payment Amount: ${options.quantity} ARIO`);
  }
  if (options.processId != null && options.processId !== '') {
    console.log(`   ANT Process ID: ${options.processId}`);
  } else {
    console.log(`   ANT Process: New ANT will be spawned`);
  }
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with purchasing this ArNS record?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('ArNS record purchase cancelled by user');
    }
  }
}

/**
 * Handle interactive prompting for upgrade-record parameters
 */
async function handleUpgradeRecordInteractivePrompts(
  options: CLIWriteOptionsFromAoParams<AoArNSPurchaseParams>,
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

  // Prompt for ArNS name if not provided
  if (options.name == null || options.name === '') {
    options.name = await input({
      message: '📝 Enter ArNS name to upgrade to permabuy:',
      validate: validateArNSName,
    });
  }

  // Show upgrade summary
  console.log('\n📋 Upgrade Record Summary:');
  console.log(`   ArNS Name: ${options.name}`);
  console.log(`   Action: Upgrade lease to permabuy (permanent ownership)`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with upgrading this ArNS record to permabuy?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('ArNS record upgrade cancelled by user');
    }
  }
}

/**
 * Handle interactive prompting for extend-lease parameters
 */
async function handleExtendLeaseInteractivePrompts(
  options: CLIWriteOptionsFromAoParams<AoExtendLeaseParams>,
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

  // Prompt for ArNS name if not provided
  if (options.name == null || options.name === '') {
    options.name = await input({
      message: '📝 Enter ArNS name to extend lease:',
      validate: validateArNSName,
    });
  }

  // Prompt for lease extension years if not provided
  if (options.years == null || options.years === '') {
    const yearsStr = await input({
      message: '⏰ Enter lease extension duration in years (1-5):',
      validate: validateLeaseYears,
      default: '1',
    });
    options.years = yearsStr;
  }

  // Show extend lease summary
  console.log('\n📋 Extend Lease Summary:');
  console.log(`   ArNS Name: ${options.name}`);
  console.log(`   Extension Duration: ${options.years} year(s)`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: `Proceed with extending the lease for ${options.name} by ${options.years} year(s)?`,
      default: false,
    });

    if (!confirmed) {
      throw new Error('ArNS lease extension cancelled by user');
    }
  }
}

/**
 * Handle interactive prompting for increase-undername-limit parameters
 */
async function handleIncreaseUndernameLimitInteractivePrompts(
  options: CLIWriteOptionsFromAoParams<AoIncreaseUndernameLimitParams>,
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

  // Prompt for ArNS name if not provided
  if (options.name == null || options.name === '') {
    options.name = await input({
      message: '📝 Enter ArNS name to increase undername limit:',
      validate: validateArNSName,
    });
  }

  // Prompt for increase count if not provided
  if (options.increaseCount == null || options.increaseCount === '') {
    const increaseCountStr = await input({
      message: '🔢 Enter number of undernames to add to the limit (1-10000):',
      validate: validateIncreaseCount,
      default: '10',
    });
    options.increaseCount = increaseCountStr;
  }

  // Show increase undername limit summary
  console.log('\n📋 Increase Undername Limit Summary:');
  console.log(`   ArNS Name: ${options.name}`);
  console.log(
    `   Increase Count: ${options.increaseCount} additional undernames`,
  );
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: `Proceed with increasing undername limit for ${options.name} by ${options.increaseCount}?`,
      default: false,
    });

    if (!confirmed) {
      throw new Error('Undername limit increase cancelled by user');
    }
  }
}

/**
 * Handle interactive prompting for request-primary-name parameters
 */
async function handleRequestPrimaryNameInteractivePrompts(
  options: CLIWriteOptionsFromAoParams<AoArNSPurchaseParams>,
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

  // Prompt for ArNS name if not provided
  if (options.name == null || options.name === '') {
    options.name = await input({
      message: '📝 Enter ArNS name to request as primary name:',
      validate: validateArNSName,
    });
  }

  // Show request primary name summary
  console.log('\n📋 Request Primary Name Summary:');
  console.log(`   ArNS Name: ${options.name}`);
  console.log(`   Action: Request this name as your primary name`);
  console.log(`   Note: This request must be approved by the name owner`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: `Proceed with requesting ${options.name} as your primary name?`,
      default: false,
    });

    if (!confirmed) {
      throw new Error('Primary name request cancelled by user');
    }
  }
}

/**
 * Handle interactive prompting for set-primary-name parameters
 */
async function handleSetPrimaryNameInteractivePrompts(
  options: CLIWriteOptionsFromAoParams<AoArNSPurchaseParams>,
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

  // Prompt for ArNS name if not provided
  if (options.name == null || options.name === '') {
    options.name = await input({
      message: '📝 Enter ArNS name to set as your primary name:',
      validate: validateArNSName,
    });
  }

  // Show set primary name summary
  console.log('\n📋 Set Primary Name Summary:');
  console.log(`   ArNS Name: ${options.name}`);
  console.log(`   Action: Set this name as your primary name`);
  console.log(`   Note: You must own this name to set it as primary`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: `Proceed with setting ${options.name} as your primary name?`,
      default: false,
    });

    if (!confirmed) {
      throw new Error('Set primary name cancelled by user');
    }
  }
}

export async function buyRecordCLICommand(
  o: CLIWriteOptionsFromAoParams<AoBuyRecordParams>,
) {
  // Handle interactive mode
  if (o.interactive) {
    console.log('🚀 Interactive ArNS Record Purchase\n');
    await handleBuyRecordInteractivePrompts(o);
    console.log('\n⏳ Processing record purchase...');
  }

  const { ario, signerAddress } = writeARIOFromOptions(o);
  const name = requiredStringFromOptions(o, 'name');
  const type = recordTypeFromOptions(o);
  const years = positiveIntegerFromOptions(o, 'years');
  const fundFrom = fundFromFromOptions(o);
  const referrer = referrerFromOptions(o);
  const processId = o.processId;

  if (!o.skipConfirmation && !o.interactive) {
    const existingRecord = await ario.getArNSRecord({
      name,
    });
    if (existingRecord !== undefined) {
      throw new Error(`ArNS Record ${name} is already owned`);
    }

    await assertEnoughBalanceForArNSPurchase({
      ario,
      address: signerAddress,
      costDetailsParams: {
        intent: 'Buy-Name',
        type,
        name,
        years,
        fundFrom,
        fromAddress: signerAddress,
      },
    });

    // assert spawn new ant with module id
    let antSpawnConfirmation = '';
    if (processId === undefined) {
      const { moduleId, version } = await ANT.versions.getLatestANTVersion();
      antSpawnConfirmation = `Note: A new ANT process will be spawned with module ${moduleId} (v${version}) and assigned to this name.`;
    }

    await assertConfirmationPrompt(
      `Are you sure you want to ${type} the record ${name}? ${antSpawnConfirmation}`,
      o,
    );
  }

  return ario.buyRecord(
    {
      name: requiredStringFromOptions(o, 'name'),
      processId,
      type,
      years,
      fundFrom: fundFromFromOptions(o),
      paidBy: stringArrayFromOptions(o, 'paidBy'),
      referrer,
    },
    customTagsFromOptions(o),
  );
}

export async function upgradeRecordCLICommand(
  o: CLIWriteOptionsFromAoParams<AoArNSPurchaseParams>,
) {
  // Handle interactive mode
  if (o.interactive) {
    console.log('🚀 Interactive ArNS Record Upgrade\n');
    await handleUpgradeRecordInteractivePrompts(o);
    console.log('\n⏳ Processing record upgrade...');
  }

  const name = requiredStringFromOptions(o, 'name');
  const { ario, signerAddress } = writeARIOFromOptions(o);
  const fundFrom = fundFromFromOptions(o);
  const referrer = referrerFromOptions(o);

  if (!o.skipConfirmation && !o.interactive) {
    const existingRecord = await ario.getArNSRecord({
      name,
    });
    if (existingRecord === undefined) {
      throw new Error(`ArNS Record ${name} does not exist`);
    }
    if (existingRecord.type === 'permabuy') {
      throw new Error(`ArNS Record ${name} is already a permabuy`);
    }
    await assertEnoughBalanceForArNSPurchase({
      ario,
      address: signerAddress,
      costDetailsParams: {
        intent: 'Upgrade-Name',
        name,
        fundFrom,
        fromAddress: signerAddress,
      },
    });

    await assertConfirmationPrompt(
      `Are you sure you want to upgrade the lease of ${name} to a permabuy?`,
      o,
    );
  }
  return ario.upgradeRecord({
    name,
    fundFrom,
    paidBy: stringArrayFromOptions(o, 'paidBy'),
    referrer,
  });
}

export async function extendLeaseCLICommand(
  o: CLIWriteOptionsFromAoParams<AoExtendLeaseParams>,
) {
  // Handle interactive mode
  if (o.interactive) {
    console.log('🚀 Interactive ArNS Lease Extension\n');
    await handleExtendLeaseInteractivePrompts(o);
    console.log('\n⏳ Processing lease extension...');
  }

  const name = requiredStringFromOptions(o, 'name');
  const years = requiredPositiveIntegerFromOptions(o, 'years');
  const fundFrom = fundFromFromOptions(o);
  const referrer = referrerFromOptions(o);
  const { ario, signerAddress } = writeARIOFromOptions(o);

  if (!o.skipConfirmation && !o.interactive) {
    const existingRecord = await ario.getArNSRecord({
      name,
    });
    if (existingRecord === undefined) {
      throw new Error(`ArNS Record ${name} does not exist`);
    }
    if (existingRecord.type === 'permabuy') {
      throw new Error(
        `ArNS Record ${name} is a permabuy and cannot be extended`,
      );
    }

    await assertEnoughBalanceForArNSPurchase({
      ario: ario,
      address: signerAddress,
      costDetailsParams: {
        intent: 'Extend-Lease',
        name,
        years,
        fundFrom,
        fromAddress: signerAddress,
      },
    });
    await assertConfirmationPrompt(
      `Are you sure you want to extend the lease of ${name} by ${years}?`,
      o,
    );
  }
  return ario.extendLease(
    {
      name,
      years,
      paidBy: stringArrayFromOptions(o, 'paidBy'),
      referrer,
    },
    customTagsFromOptions(o),
  );
}

export async function increaseUndernameLimitCLICommand(
  o: CLIWriteOptionsFromAoParams<AoIncreaseUndernameLimitParams>,
) {
  // Handle interactive mode
  if (o.interactive) {
    console.log('🚀 Interactive Undername Limit Increase\n');
    await handleIncreaseUndernameLimitInteractivePrompts(o);
    console.log('\n⏳ Processing undername limit increase...');
  }

  const name = requiredStringFromOptions(o, 'name');
  const increaseCount = requiredPositiveIntegerFromOptions(o, 'increaseCount');
  const fundFrom = fundFromFromOptions(o);
  const referrer = referrerFromOptions(o);
  const { ario, signerAddress } = writeARIOFromOptions(o);

  if (!o.skipConfirmation && !o.interactive) {
    const existingRecord = await ario.getArNSRecord({
      name,
    });
    if (existingRecord === undefined) {
      throw new Error(`ArNS Record ${name} does not exist`);
    }

    await assertEnoughBalanceForArNSPurchase({
      ario,
      address: signerAddress,
      costDetailsParams: {
        intent: 'Increase-Undername-Limit',
        name,
        quantity: increaseCount,
        fundFrom,
        fromAddress: signerAddress,
      },
    });

    await assertConfirmationPrompt(
      `Are you sure you want to increase the undername limit of ${name} by ${increaseCount}?`,
      o,
    );
  }

  return ario.increaseUndernameLimit(
    {
      name,
      increaseCount,
      paidBy: stringArrayFromOptions(o, 'paidBy'),
      referrer,
    },
    customTagsFromOptions(o),
  );
}

export async function requestPrimaryNameCLICommand(
  o: CLIWriteOptionsFromAoParams<AoArNSPurchaseParams>,
) {
  // Handle interactive mode
  if (o.interactive) {
    console.log('🚀 Interactive Primary Name Request\n');
    await handleRequestPrimaryNameInteractivePrompts(o);
    console.log('\n⏳ Processing primary name request...');
  }

  const { ario, signerAddress } = writeARIOFromOptions(o);
  const fundFrom = fundFromFromOptions(o);
  const referrer = referrerFromOptions(o);
  const name = requiredStringFromOptions(o, 'name');

  if (!o.skipConfirmation && !o.interactive) {
    await assertEnoughBalanceForArNSPurchase({
      ario,
      address: signerAddress,
      costDetailsParams: {
        intent: 'Primary-Name-Request',
        name,
        fromAddress: signerAddress,
        fundFrom,
      },
    });

    await assertConfirmationPrompt(
      `Are you sure you want to request the primary name ${name}?`,
      o,
    );
  }

  const { result } = await ario.requestPrimaryName(
    {
      name,
      fundFrom,
      paidBy: stringArrayFromOptions(o, 'paidBy'),
      referrer,
    },
    customTagsFromOptions(o),
  );

  if (result?.request === undefined) {
    throw new Error('Failed to request primary name for name ' + name);
  }

  return result.request;
}

export async function setPrimaryNameCLICommand(
  o: CLIWriteOptionsFromAoParams<AoArNSPurchaseParams>,
) {
  // Handle interactive mode
  if (o.interactive) {
    console.log('🚀 Interactive Set Primary Name\n');
    await handleSetPrimaryNameInteractivePrompts(o);
    console.log('\n⏳ Processing set primary name...');
  }

  const { ario, signerAddress } = writeARIOFromOptions(o);
  const name = requiredStringFromOptions(o, 'name');
  const fundFrom = fundFromFromOptions(o);
  const referrer = referrerFromOptions(o);

  if (!o.skipConfirmation && !o.interactive) {
    await assertConfirmationPrompt(
      `Are you sure you want to set the primary name ${name} for address ${signerAddress}?`,
      o,
    );
  }

  return ario.setPrimaryName({ name, fundFrom, referrer });
}
