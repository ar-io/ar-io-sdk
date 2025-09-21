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

import {
  AoANTSetBaseNameRecordParams,
  AoANTSetUndernameRecordParams,
} from '../../types/ant.js';
import {
  ANTStateCLIOptions,
  CLIWriteOptionsFromAoAntParams,
} from '../types.js';
import {
  antRecordMetadataFromOptions,
  arioProcessIdFromOptions,
  assertConfirmationPrompt,
  booleanFromOptions,
  customTagsFromOptions,
  defaultTtlSecondsCLI,
  expandTildePath,
  readARIOFromOptions,
  requiredStringArrayFromOptions,
  requiredStringFromOptions,
  stringArrayFromOptions,
  writeANTFromOptions,
} from '../utils.js';

/**
 * Validates Arweave process ID or address format
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
 * Validates Arweave transaction ID format
 */
function validateTransactionId(txId: string): boolean | string {
  if (!txId) {
    return 'Transaction ID is required';
  }
  if (txId.length !== 43) {
    return 'Transaction ID must be exactly 43 characters long';
  }
  if (!/^[A-Za-z0-9_-]+$/.test(txId)) {
    return 'Transaction ID contains invalid characters. Only alphanumeric, underscore, and dash are allowed';
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
 * Validates ANT undername format
 */
function validateUndername(undername: string): boolean | string {
  if (!undername) {
    return 'Undername is required';
  }
  if (undername.length === 0) {
    return 'Undername cannot be empty';
  }
  if (undername.length > 32) {
    return 'Undername cannot be longer than 32 characters';
  }
  if (!/^[a-z0-9\-_]+$/.test(undername)) {
    return 'Undername can only contain lowercase letters, numbers, hyphens, and underscores';
  }
  if (undername.startsWith('-') || undername.endsWith('-')) {
    return 'Undername cannot start or end with a hyphen';
  }
  return true;
}

/**
 * Validates ANT ticker format
 */
function validateTicker(ticker: string): boolean | string {
  if (!ticker) {
    return 'Ticker is required';
  }
  if (ticker.length < 1 || ticker.length > 12) {
    return 'Ticker must be between 1 and 12 characters long';
  }
  if (!/^[A-Z0-9]+$/.test(ticker)) {
    return 'Ticker can only contain uppercase letters and numbers';
  }
  return true;
}

/**
 * Validates ANT name format
 */
function validateAntName(name: string): boolean | string {
  if (!name) {
    return 'Name is required';
  }
  if (name.length === 0) {
    return 'Name cannot be empty';
  }
  if (name.length > 64) {
    return 'Name cannot be longer than 64 characters';
  }
  return true;
}

/**
 * Validates ANT description format
 */
function validateDescription(description: string): boolean | string {
  if (!description) {
    return 'Description is required';
  }
  if (description.length === 0) {
    return 'Description cannot be empty';
  }
  if (description.length > 512) {
    return 'Description cannot be longer than 512 characters';
  }
  return true;
}

/**
 * Validates TTL seconds
 */
function validateTtlSeconds(ttl: string): boolean | string {
  const num = parseInt(ttl, 10);
  if (isNaN(num)) {
    return 'TTL must be a valid number';
  }
  if (num < 0) {
    return 'TTL cannot be negative';
  }
  if (num > 31536000) {
    // 1 year in seconds
    return 'TTL cannot exceed 1 year (31536000 seconds)';
  }
  return true;
}

/**
 * Validates keywords array
 */
function validateKeywords(keywords: string): boolean | string {
  if (!keywords) {
    return 'Keywords are required (comma-separated)';
  }
  const keywordArray = keywords.split(',').map((k) => k.trim());
  if (keywordArray.length === 0) {
    return 'At least one keyword is required';
  }
  if (keywordArray.length > 10) {
    return 'Cannot have more than 10 keywords';
  }
  for (const keyword of keywordArray) {
    if (keyword.length === 0) {
      return 'Keywords cannot be empty';
    }
    if (keyword.length > 32) {
      return 'Each keyword cannot be longer than 32 characters';
    }
  }
  return true;
}

/**
 * Handle interactive prompting for spawn ANT parameters
 */
async function handleSpawnAntInteractivePrompts(
  options: ANTStateCLIOptions,
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

  // Prompt for ANT name if not provided
  if (options.name == null || options.name === '') {
    options.name = await input({
      message: '📝 Enter ANT name:',
      validate: validateAntName,
    });
  }

  // Prompt for ANT ticker if not provided
  if (options.ticker == null || options.ticker === '') {
    options.ticker = await input({
      message: '🏷️ Enter ANT ticker (uppercase letters and numbers only):',
      validate: validateTicker,
    });
  }

  // Prompt for ANT description if not provided
  if (options.description == null || options.description === '') {
    options.description = await input({
      message: '📄 Enter ANT description:',
      validate: validateDescription,
    });
  }

  // Prompt for keywords if not provided
  if (!options.keywords || options.keywords.length === 0) {
    const keywordsStr = await input({
      message: '🏷️ Enter keywords (comma-separated):',
      validate: validateKeywords,
    });
    options.keywords = keywordsStr.split(',').map((k) => k.trim());
  }

  // Prompt for controllers if not provided
  if (!options.controllers || options.controllers.length === 0) {
    const addControllers = await confirm({
      message: '👥 Would you like to add additional controllers?',
      default: false,
    });

    if (addControllers) {
      const controllersStr = await input({
        message: '👥 Enter controller addresses (comma-separated):',
        validate: (value) => {
          if (!value) return true; // Optional
          const addresses = value.split(',').map((a) => a.trim());
          for (const addr of addresses) {
            const validation = validateArweaveAddress(addr);
            if (validation !== true) {
              return `Invalid controller address "${addr}": ${validation}`;
            }
          }
          return true;
        },
      });
      options.controllers = controllersStr.split(',').map((a) => a.trim());
    }
  }

  // Prompt for TTL if not provided
  if (options.ttlSeconds == null || options.ttlSeconds === '') {
    const ttlStr = await input({
      message: '⏰ Enter TTL in seconds (leave empty for default):',
      validate: (value) => {
        if (!value) return true; // Use default
        return validateTtlSeconds(value);
      },
    });
    if (ttlStr != null && ttlStr !== '') {
      options.ttlSeconds = ttlStr;
    }
  }

  // Prompt for module if not provided
  if (options.module == null || options.module === '') {
    const useCustomModule = await confirm({
      message: '🔧 Would you like to specify a custom ANT module?',
      default: false,
    });

    if (useCustomModule) {
      options.module = await input({
        message: '🔧 Enter module ID:',
        validate: validateProcessId,
      });
    }
  }

  // Show spawn ANT summary
  console.log('\n📋 Spawn ANT Summary:');
  console.log(`   Name: ${options.name}`);
  console.log(`   Ticker: ${options.ticker}`);
  console.log(`   Description: ${options.description}`);
  console.log(`   Keywords: ${options.keywords?.join(', ')}`);
  if (options.controllers && options.controllers.length > 0) {
    console.log(`   Controllers: ${options.controllers.join(', ')}`);
  }
  if (options.ttlSeconds != null && options.ttlSeconds !== '') {
    console.log(`   TTL: ${options.ttlSeconds} seconds`);
  }
  if (options.module != null && options.module !== '') {
    console.log(`   Module: ${options.module}`);
  }
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with spawning this ANT?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('ANT spawn cancelled by user');
    }
  }
}

/**
 * CLI command for spawning an ANT process with interactive support
 */
export async function spawnAntCLICommand(options: ANTStateCLIOptions) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('🚀 Interactive ANT Spawn\n');
    await handleSpawnAntInteractivePrompts(options);
    console.log('\n⏳ Processing ANT spawn...');
  }

  // Import spawnANT and required utilities
  const { spawnANT } = await import('../../node/index.js');
  const {
    getANTStateFromOptions,
    requiredAoSignerFromOptions,
    getLoggerFromOptions,
  } = await import('../utils.js');

  const state = getANTStateFromOptions(options);
  const antProcessId = await spawnANT({
    state,
    signer: requiredAoSignerFromOptions(options),
    logger: getLoggerFromOptions(options),
    ...(options.module !== undefined ? { module: options.module } : {}),
  });

  return {
    processId: antProcessId,
    state,
    message: `Spawned ANT process with process ID ${antProcessId}`,
  };
}

/**
 * Handle interactive prompting for transfer ANT ownership parameters
 */
async function handleTransferAntOwnershipInteractivePrompts(
  options: CLIWriteOptionsFromAoAntParams<{ target: string }>,
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

  // Prompt for process ID if not provided
  if (options.processId == null || options.processId === '') {
    options.processId = await input({
      message: '🔧 Enter ANT process ID:',
      validate: validateProcessId,
    });
  }

  // Prompt for target address if not provided
  if (options.target == null || options.target === '') {
    options.target = await input({
      message: '📝 Enter target address (new owner):',
      validate: validateArweaveAddress,
    });
  }

  // Show transfer ownership summary
  console.log('\n📋 Transfer ANT Ownership Summary:');
  console.log(`   ANT Process ID: ${options.processId}`);
  console.log(`   New Owner: ${options.target}`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message:
        'Proceed with transferring ANT ownership? This action cannot be undone.',
      default: false,
    });

    if (!confirmed) {
      throw new Error('ANT ownership transfer cancelled by user');
    }
  }
}

/**
 * CLI command for transferring ANT ownership with interactive support
 */
export async function transferAntOwnershipCLICommand(
  options: CLIWriteOptionsFromAoAntParams<{
    target: string;
    interactive?: boolean;
  }>,
) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('🚀 Interactive ANT Ownership Transfer\n');
    await handleTransferAntOwnershipInteractivePrompts(options);
    console.log('\n⏳ Processing ownership transfer...');
  }

  const target = requiredStringFromOptions(options, 'target');

  if (!options.skipConfirmation && !options.interactive) {
    await assertConfirmationPrompt(
      `Are you sure you want to transfer ANT ownership to ${target}?`,
      options,
    );
  }

  return writeANTFromOptions(options).transfer(
    {
      target,
    },
    customTagsFromOptions(options),
  );
}

/**
 * Handle interactive prompting for add ANT controller parameters
 */
async function handleAddAntControllerInteractivePrompts(
  options: CLIWriteOptionsFromAoAntParams<{ controller: string }>,
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

  // Prompt for process ID if not provided
  if (options.processId == null || options.processId === '') {
    options.processId = await input({
      message: '🔧 Enter ANT process ID:',
      validate: validateProcessId,
    });
  }

  // Prompt for controller address if not provided
  if (options.controller == null || options.controller === '') {
    options.controller = await input({
      message: '👥 Enter controller address to add:',
      validate: validateArweaveAddress,
    });
  }

  // Show add controller summary
  console.log('\n📋 Add ANT Controller Summary:');
  console.log(`   ANT Process ID: ${options.processId}`);
  console.log(`   Controller to Add: ${options.controller}`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with adding this controller?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Add ANT controller cancelled by user');
    }
  }
}

/**
 * CLI command for adding ANT controller with interactive support
 */
export async function addAntControllerCLICommand(
  options: CLIWriteOptionsFromAoAntParams<{
    controller: string;
    interactive?: boolean;
  }>,
) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('🚀 Interactive Add ANT Controller\n');
    await handleAddAntControllerInteractivePrompts(options);
    console.log('\n⏳ Processing add controller...');
  }

  const controller = requiredStringFromOptions(options, 'controller');

  if (!options.skipConfirmation && !options.interactive) {
    await assertConfirmationPrompt(
      `Are you sure you want to add ${controller} as a controller?`,
      options,
    );
  }

  return writeANTFromOptions(options).addController(
    {
      controller: requiredStringFromOptions(options, 'controller'),
    },
    customTagsFromOptions(options),
  );
}

/**
 * Handle interactive prompting for remove ANT controller parameters
 */
async function handleRemoveAntControllerInteractivePrompts(
  options: CLIWriteOptionsFromAoAntParams<{ controller: string }>,
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

  // Prompt for process ID if not provided
  if (options.processId == null || options.processId === '') {
    options.processId = await input({
      message: '🔧 Enter ANT process ID:',
      validate: validateProcessId,
    });
  }

  // Prompt for controller address if not provided
  if (options.controller == null || options.controller === '') {
    options.controller = await input({
      message: '👥 Enter controller address to remove:',
      validate: validateArweaveAddress,
    });
  }

  // Show remove controller summary
  console.log('\n📋 Remove ANT Controller Summary:');
  console.log(`   ANT Process ID: ${options.processId}`);
  console.log(`   Controller to Remove: ${options.controller}`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with removing this controller?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Remove ANT controller cancelled by user');
    }
  }
}

/**
 * CLI command for removing ANT controller with interactive support
 */
export async function removeAntControllerCLICommand(
  options: CLIWriteOptionsFromAoAntParams<{
    controller: string;
    interactive?: boolean;
  }>,
) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('🚀 Interactive Remove ANT Controller\n');
    await handleRemoveAntControllerInteractivePrompts(options);
    console.log('\n⏳ Processing remove controller...');
  }

  return writeANTFromOptions(options).removeController(
    {
      controller: requiredStringFromOptions(options, 'controller'),
    },
    customTagsFromOptions(options),
  );
}

/**
 * Handle interactive prompting for remove ANT record parameters
 */
async function handleRemoveAntRecordInteractivePrompts(
  options: CLIWriteOptionsFromAoAntParams<{ undername: string }>,
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

  // Prompt for process ID if not provided
  if (options.processId == null || options.processId === '') {
    options.processId = await input({
      message: '🔧 Enter ANT process ID:',
      validate: validateProcessId,
    });
  }

  // Prompt for undername if not provided
  if (options.undername == null || options.undername === '') {
    options.undername = await input({
      message: '📝 Enter undername to remove:',
      validate: validateUndername,
    });
  }

  // Show remove record summary
  console.log('\n📋 Remove ANT Record Summary:');
  console.log(`   ANT Process ID: ${options.processId}`);
  console.log(`   Undername to Remove: ${options.undername}`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message:
        'Proceed with removing this record? This action cannot be undone.',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Remove ANT record cancelled by user');
    }
  }
}

/**
 * CLI command for removing ANT record with interactive support
 */
export async function removeAntRecordCLICommand(
  options: CLIWriteOptionsFromAoAntParams<{
    undername: string;
    interactive?: boolean;
  }>,
) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('🚀 Interactive Remove ANT Record\n');
    await handleRemoveAntRecordInteractivePrompts(options);
    console.log('\n⏳ Processing remove record...');
  }

  const undername = requiredStringFromOptions(options, 'undername');

  if (!options.skipConfirmation && !options.interactive) {
    await assertConfirmationPrompt(
      `Are you sure you want to remove the record with undername ${undername}?`,
      options,
    );
  }

  return writeANTFromOptions(options).removeRecord(
    {
      undername,
    },
    customTagsFromOptions(options),
  );
}

/**
 * Handle interactive prompting for set ANT name parameters
 */
async function handleSetAntNameInteractivePrompts(
  options: CLIWriteOptionsFromAoAntParams<{ name: string }>,
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

  // Prompt for process ID if not provided
  if (options.processId == null || options.processId === '') {
    options.processId = await input({
      message: '🔧 Enter ANT process ID:',
      validate: validateProcessId,
    });
  }

  // Prompt for name if not provided
  if (options.name == null || options.name === '') {
    options.name = await input({
      message: '📝 Enter ANT name:',
      validate: validateAntName,
    });
  }

  // Show set name summary
  console.log('\n📋 Set ANT Name Summary:');
  console.log(`   ANT Process ID: ${options.processId}`);
  console.log(`   New Name: ${options.name}`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with setting this name?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Set ANT name cancelled by user');
    }
  }
}

/**
 * CLI command for setting ANT name with interactive support
 */
export async function setAntNameCLICommand(
  options: CLIWriteOptionsFromAoAntParams<{
    name: string;
    interactive?: boolean;
  }>,
) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('🚀 Interactive Set ANT Name\n');
    await handleSetAntNameInteractivePrompts(options);
    console.log('\n⏳ Processing set name...');
  }

  const name = requiredStringFromOptions(options, 'name');

  if (!options.skipConfirmation && !options.interactive) {
    await assertConfirmationPrompt(
      `Are you sure you want to set the name to ${requiredStringFromOptions(
        options,
        'name',
      )}?`,
      options,
    );
  }

  return writeANTFromOptions(options).setName(
    {
      name,
    },
    customTagsFromOptions(options),
  );
}

/**
 * Handle interactive prompting for set ANT ticker parameters
 */
async function handleSetAntTickerInteractivePrompts(
  options: CLIWriteOptionsFromAoAntParams<{ ticker: string }>,
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

  // Prompt for process ID if not provided
  if (options.processId == null || options.processId === '') {
    options.processId = await input({
      message: '🔧 Enter ANT process ID:',
      validate: validateProcessId,
    });
  }

  // Prompt for ticker if not provided
  if (options.ticker == null || options.ticker === '') {
    options.ticker = await input({
      message: '🏷️ Enter ANT ticker (uppercase letters and numbers only):',
      validate: validateTicker,
    });
  }

  // Show set ticker summary
  console.log('\n📋 Set ANT Ticker Summary:');
  console.log(`   ANT Process ID: ${options.processId}`);
  console.log(`   New Ticker: ${options.ticker}`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with setting this ticker?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Set ANT ticker cancelled by user');
    }
  }
}

/**
 * CLI command for setting ANT ticker with interactive support
 */
export async function setAntTickerCLICommand(
  options: CLIWriteOptionsFromAoAntParams<{
    ticker: string;
    interactive?: boolean;
  }>,
) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('🚀 Interactive Set ANT Ticker\n');
    await handleSetAntTickerInteractivePrompts(options);
    console.log('\n⏳ Processing set ticker...');
  }

  const ticker = requiredStringFromOptions(options, 'ticker');

  if (!options.skipConfirmation && !options.interactive) {
    await assertConfirmationPrompt(
      `Are you sure you want to set the ticker to ${ticker}?`,
      options,
    );
  }

  return writeANTFromOptions(options).setTicker(
    {
      ticker,
    },
    customTagsFromOptions(options),
  );
}

/**
 * Handle interactive prompting for set ANT description parameters
 */
async function handleSetAntDescriptionInteractivePrompts(
  options: CLIWriteOptionsFromAoAntParams<{ description: string }>,
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

  // Prompt for process ID if not provided
  if (options.processId == null || options.processId === '') {
    options.processId = await input({
      message: '🔧 Enter ANT process ID:',
      validate: validateProcessId,
    });
  }

  // Prompt for description if not provided
  if (options.description == null || options.description === '') {
    options.description = await input({
      message: '📄 Enter ANT description:',
      validate: validateDescription,
    });
  }

  // Show set description summary
  console.log('\n📋 Set ANT Description Summary:');
  console.log(`   ANT Process ID: ${options.processId}`);
  console.log(`   New Description: ${options.description}`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with setting this description?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Set ANT description cancelled by user');
    }
  }
}

/**
 * CLI command for setting ANT description with interactive support
 */
export async function setAntDescriptionCLICommand(
  options: CLIWriteOptionsFromAoAntParams<{
    description: string;
    interactive?: boolean;
  }>,
) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('🚀 Interactive Set ANT Description\n');
    await handleSetAntDescriptionInteractivePrompts(options);
    console.log('\n⏳ Processing set description...');
  }

  const description = requiredStringFromOptions(options, 'description');

  if (!options.skipConfirmation && !options.interactive) {
    await assertConfirmationPrompt(
      `Are you sure you want to set the ANT description to ${description}?`,
      options,
    );
  }

  return writeANTFromOptions(options).setDescription(
    {
      description,
    },
    customTagsFromOptions(options),
  );
}

/**
 * Handle interactive prompting for set ANT keywords parameters
 */
async function handleSetAntKeywordsInteractivePrompts(
  options: CLIWriteOptionsFromAoAntParams<{ keywords: string[] }>,
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

  // Prompt for process ID if not provided
  if (options.processId == null || options.processId === '') {
    options.processId = await input({
      message: '🔧 Enter ANT process ID:',
      validate: validateProcessId,
    });
  }

  // Prompt for keywords if not provided
  if (!options.keywords || options.keywords.length === 0) {
    const keywordsStr = await input({
      message: '🏷️ Enter keywords (comma-separated):',
      validate: validateKeywords,
    });
    options.keywords = keywordsStr.split(',').map((k) => k.trim());
  }

  // Show set keywords summary
  console.log('\n📋 Set ANT Keywords Summary:');
  console.log(`   ANT Process ID: ${options.processId}`);
  console.log(`   New Keywords: ${options.keywords?.join(', ')}`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with setting these keywords?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Set ANT keywords cancelled by user');
    }
  }
}

/**
 * CLI command for setting ANT keywords with interactive support
 */
export async function setAntKeywordsCLICommand(
  options: CLIWriteOptionsFromAoAntParams<{
    keywords: string[];
    interactive?: boolean;
  }>,
) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('🚀 Interactive Set ANT Keywords\n');
    await handleSetAntKeywordsInteractivePrompts(options);
    console.log('\n⏳ Processing set keywords...');
  }

  const keywords = requiredStringArrayFromOptions(options, 'keywords');

  if (!options.skipConfirmation && !options.interactive) {
    await assertConfirmationPrompt(
      `Are you sure you want to set the ANT keywords to ${keywords}?`,
      options,
    );
  }

  return writeANTFromOptions(options).setKeywords(
    {
      keywords,
    },
    customTagsFromOptions(options),
  );
}

/**
 * Handle interactive prompting for set ANT logo parameters
 */
async function handleSetAntLogoInteractivePrompts(
  options: CLIWriteOptionsFromAoAntParams<{ transactionId: string }>,
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

  // Prompt for process ID if not provided
  if (options.processId == null || options.processId === '') {
    options.processId = await input({
      message: '🔧 Enter ANT process ID:',
      validate: validateProcessId,
    });
  }

  // Prompt for transaction ID if not provided
  if (options.transactionId == null || options.transactionId === '') {
    options.transactionId = await input({
      message: '🖼️ Enter logo transaction ID:',
      validate: validateTransactionId,
    });
  }

  // Show set logo summary
  console.log('\n📋 Set ANT Logo Summary:');
  console.log(`   ANT Process ID: ${options.processId}`);
  console.log(`   Logo Transaction ID: ${options.transactionId}`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with setting this logo?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Set ANT logo cancelled by user');
    }
  }
}

/**
 * CLI command for setting ANT logo with interactive support
 */
export async function setAntLogoCLICommand(
  options: CLIWriteOptionsFromAoAntParams<{
    transactionId: string;
    interactive?: boolean;
  }>,
) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('🚀 Interactive Set ANT Logo\n');
    await handleSetAntLogoInteractivePrompts(options);
    console.log('\n⏳ Processing set logo...');
  }

  const txId = requiredStringFromOptions(options, 'transactionId');

  if (!options.skipConfirmation && !options.interactive) {
    await assertConfirmationPrompt(
      `Are you sure you want to set the ANT logo to target Arweave TxID ${txId}?`,
      options,
    );
  }

  return writeANTFromOptions(options).setLogo(
    {
      txId,
    },
    customTagsFromOptions(options),
  );
}

/**
 * Handle interactive prompting for set ANT base name parameters
 */
async function handleSetAntBaseNameInteractivePrompts(
  options: CLIWriteOptionsFromAoAntParams<AoANTSetBaseNameRecordParams>,
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

  // Prompt for process ID if not provided
  if (options.processId == null || options.processId === '') {
    options.processId = await input({
      message: '🔧 Enter ANT process ID:',
      validate: validateProcessId,
    });
  }

  // Prompt for transaction ID if not provided
  if (options.transactionId == null || options.transactionId === '') {
    options.transactionId = await input({
      message: '🔗 Enter target transaction ID for base name:',
      validate: validateTransactionId,
    });
  }

  // Prompt for TTL if not provided
  if (options.ttlSeconds == null || options.ttlSeconds === '') {
    const ttlStr = await input({
      message: '⏰ Enter TTL in seconds (leave empty for default):',
      validate: (value) => {
        if (!value) return true; // Use default
        return validateTtlSeconds(value);
      },
    });
    if (ttlStr != null && ttlStr !== '') {
      options.ttlSeconds = ttlStr;
    }
  }

  // Show set base name summary
  console.log('\n📋 Set ANT Base Name Summary:');
  console.log(`   ANT Process ID: ${options.processId}`);
  console.log(`   Target Transaction ID: ${options.transactionId}`);
  if (options.ttlSeconds != null && options.ttlSeconds !== '') {
    console.log(`   TTL: ${options.ttlSeconds} seconds`);
  }
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with setting this base name?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Set ANT base name cancelled by user');
    }
  }
}

/**
 * CLI command for setting ANT base name with interactive support
 */
export async function setAntBaseNameCLICommandInteractive(
  options: CLIWriteOptionsFromAoAntParams<
    AoANTSetBaseNameRecordParams & { interactive?: boolean }
  >,
) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('🚀 Interactive Set ANT Base Name\n');
    await handleSetAntBaseNameInteractivePrompts(options);
    console.log('\n⏳ Processing set base name...');
  }

  // Use existing implementation with the interactive check
  return setAntBaseNameCLICommand(options);
}

/**
 * Handle interactive prompting for set ANT undername parameters
 */
async function handleSetAntUndernameInteractivePrompts(
  options: CLIWriteOptionsFromAoAntParams<AoANTSetUndernameRecordParams>,
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

  // Prompt for process ID if not provided
  if (options.processId == null || options.processId === '') {
    options.processId = await input({
      message: '🔧 Enter ANT process ID:',
      validate: validateProcessId,
    });
  }

  // Prompt for undername if not provided
  if (options.undername == null || options.undername === '') {
    options.undername = await input({
      message: '📝 Enter undername:',
      validate: validateUndername,
    });
  }

  // Prompt for transaction ID if not provided
  if (options.transactionId == null || options.transactionId === '') {
    options.transactionId = await input({
      message: '🔗 Enter target transaction ID for undername:',
      validate: validateTransactionId,
    });
  }

  // Prompt for TTL if not provided
  if (options.ttlSeconds == null || options.ttlSeconds === '') {
    const ttlStr = await input({
      message: '⏰ Enter TTL in seconds (leave empty for default):',
      validate: (value) => {
        if (!value) return true; // Use default
        return validateTtlSeconds(value);
      },
    });
    if (ttlStr != null && ttlStr !== '') {
      options.ttlSeconds = ttlStr;
    }
  }

  // Show set undername summary
  console.log('\n📋 Set ANT Undername Summary:');
  console.log(`   ANT Process ID: ${options.processId}`);
  console.log(`   Undername: ${options.undername}`);
  console.log(`   Target Transaction ID: ${options.transactionId}`);
  if (options.ttlSeconds != null && options.ttlSeconds !== '') {
    console.log(`   TTL: ${options.ttlSeconds} seconds`);
  }
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with setting this undername?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Set ANT undername cancelled by user');
    }
  }
}

/**
 * CLI command for setting ANT undername with interactive support
 */
export async function setAntUndernameCLICommandInteractive(
  options: CLIWriteOptionsFromAoAntParams<
    AoANTSetUndernameRecordParams & { interactive?: boolean }
  >,
) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('🚀 Interactive Set ANT Undername\n');
    await handleSetAntUndernameInteractivePrompts(options);
    console.log('\n⏳ Processing set undername...');
  }

  // Use existing implementation with the interactive check
  return setAntUndernameCLICommand(options);
}

/**
 * Handle interactive prompting for transfer record ownership parameters
 */
async function handleTransferRecordOwnershipInteractivePrompts(
  options: CLIWriteOptionsFromAoAntParams<{
    undername: string;
    recipient: string;
  }>,
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

  // Prompt for process ID if not provided
  if (options.processId == null || options.processId === '') {
    options.processId = await input({
      message: '🔧 Enter ANT process ID:',
      validate: validateProcessId,
    });
  }

  // Prompt for undername if not provided
  if (options.undername == null || options.undername === '') {
    options.undername = await input({
      message: '📝 Enter undername to transfer:',
      validate: validateUndername,
    });
  }

  // Prompt for recipient if not provided
  if (options.recipient == null || options.recipient === '') {
    options.recipient = await input({
      message: '📝 Enter recipient address:',
      validate: validateArweaveAddress,
    });
  }

  // Show transfer record ownership summary
  console.log('\n📋 Transfer Record Ownership Summary:');
  console.log(`   ANT Process ID: ${options.processId}`);
  console.log(`   Undername: ${options.undername}`);
  console.log(`   Recipient: ${options.recipient}`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message:
        'Proceed with transferring record ownership? This action cannot be undone.',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Transfer record ownership cancelled by user');
    }
  }
}

/**
 * CLI command for transferring record ownership with interactive support
 */
export async function transferRecordOwnershipCLICommandInteractive(
  options: CLIWriteOptionsFromAoAntParams<{
    undername: string;
    recipient: string;
    interactive?: boolean;
  }>,
) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('🚀 Interactive Transfer Record Ownership\n');
    await handleTransferRecordOwnershipInteractivePrompts(options);
    console.log('\n⏳ Processing transfer record ownership...');
  }

  // Use existing implementation with the interactive check
  return transferRecordOwnershipCLICommand(options);
}

/**
 * Handle interactive prompting for upgrade ANT parameters
 */
async function handleUpgradeAntInteractivePrompts(
  options: CLIWriteOptionsFromAoAntParams<
    Record<string, unknown> & {
      names?: string[];
      reassignAffiliatedNames?: boolean;
    }
  >,
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

  // Prompt for process ID if not provided
  if (options.processId == null || options.processId === '') {
    options.processId = await input({
      message: '🔧 Enter ANT process ID to upgrade:',
      validate: validateProcessId,
    });
  }

  // Prompt for reassignAffiliatedNames if not provided
  if (options.reassignAffiliatedNames === undefined) {
    options.reassignAffiliatedNames = await confirm({
      message: '🔄 Automatically reassign all affiliated names to the new ANT?',
      default: true,
    });
  }

  // If not using reassignAffiliatedNames, prompt for specific names
  if (
    !options.reassignAffiliatedNames &&
    (!options.names || options.names.length === 0)
  ) {
    const namesInput = await input({
      message:
        '📝 Enter specific names to reassign (comma-separated, leave empty to skip):',
      validate: (value) => {
        if (!value) return true; // Optional
        const names = value.split(',').map((n) => n.trim());
        for (const name of names) {
          if (name.length === 0) {
            return 'Names cannot be empty';
          }
          if (name.length > 64) {
            return 'Each name cannot be longer than 64 characters';
          }
        }
        return true;
      },
    });
    if (namesInput != null && namesInput !== '') {
      options.names = namesInput.split(',').map((n) => n.trim());
    }
  }

  // Show upgrade ANT summary
  console.log('\n📋 Upgrade ANT Summary:');
  console.log(`   ANT Process ID: ${options.processId}`);
  console.log(
    `   Reassign Affiliated Names: ${options.reassignAffiliatedNames ? 'Yes' : 'No'}`,
  );
  if (options.names && options.names.length > 0) {
    console.log(`   Specific Names: ${options.names.join(', ')}`);
  }
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message:
        'Proceed with upgrading this ANT? This will fork it to the latest version.',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Upgrade ANT cancelled by user');
    }
  }
}

/**
 * CLI command for upgrading ANT with interactive support
 */
export async function upgradeAntCLICommandInteractive(
  options: CLIWriteOptionsFromAoAntParams<
    Record<string, unknown> & {
      names?: string[];
      reassignAffiliatedNames?: boolean;
      interactive?: boolean;
    }
  >,
) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('🚀 Interactive Upgrade ANT\n');
    await handleUpgradeAntInteractivePrompts(options);
    console.log('\n⏳ Processing ANT upgrade...');
  }

  // Use existing implementation with the interactive check
  return upgradeAntCLICommand(options);
}

/**
 * Handle interactive prompting for deprecated set-ant-record command
 */
async function handleSetAntRecordInteractivePrompts(
  options: CLIWriteOptionsFromAoAntParams<
    AoANTSetUndernameRecordParams & { interactive?: boolean }
  >,
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

  // Prompt for process ID if not provided
  if (options.processId == null || options.processId === '') {
    options.processId = await input({
      message: '🔧 Enter ANT process ID:',
      validate: validateProcessId,
    });
  }

  // Prompt for undername if not provided
  if (options.undername == null || options.undername === '') {
    options.undername = await input({
      message: '📛 Enter undername for the record:',
      validate: validateUndername,
    });
  }

  // Prompt for transaction ID if not provided
  if (options.transactionId == null || options.transactionId === '') {
    options.transactionId = await input({
      message: '📄 Enter transaction ID target:',
      validate: validateTransactionId,
    });
  }

  // Show deprecated command warning and suggest alternatives
  console.log('\n⚠️  WARNING: This command is deprecated!');
  console.log('   Please consider using:');
  console.log('   • set-ant-base-name (for base name records)');
  console.log('   • set-ant-undername (for undername records)');

  // Show record summary
  console.log('\n📋 ANT Record Summary:');
  console.log(`   ANT Process ID: ${options.processId}`);
  console.log(`   Undername: ${options.undername}`);
  console.log(`   Transaction ID: ${options.transactionId}`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message:
        'Proceed with setting this ANT record? (Consider using the new commands instead)',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Set ANT record cancelled by user');
    }
  }
}

/** @deprecated -- use set-ant-base-name and set-ant-undername */
export async function setAntRecordCLICommand(
  o: CLIWriteOptionsFromAoAntParams<
    AoANTSetUndernameRecordParams & { interactive?: boolean }
  >,
) {
  // Handle interactive mode
  if (o.interactive === true) {
    console.log('🚀 Interactive Set ANT Record (Deprecated)\n');
    await handleSetAntRecordInteractivePrompts(o);
    console.log('\n⏳ Processing set record...');
  }

  const ttlSeconds = +(o.ttlSeconds ?? defaultTtlSecondsCLI);
  const undername = requiredStringFromOptions(o, 'undername');
  const transactionId = requiredStringFromOptions(o, 'transactionId');

  const writeAnt = writeANTFromOptions(o);
  const recordParams = {
    undername,
    transactionId,
    ttlSeconds,
    ...antRecordMetadataFromOptions(o),
  };

  if (!o.skipConfirmation && !o.interactive) {
    await assertConfirmationPrompt(
      `Are you sure you want to set this record on the ANT process ${writeAnt.processId}?\n${JSON.stringify(
        recordParams,
        null,
        2,
      )}`,
      o,
    );
  }

  return writeANTFromOptions(o).setRecord(
    recordParams,
    customTagsFromOptions(o),
  );
}

export async function setAntBaseNameCLICommand(
  o: CLIWriteOptionsFromAoAntParams<AoANTSetBaseNameRecordParams>,
) {
  const ttlSeconds = +(o.ttlSeconds ?? defaultTtlSecondsCLI);
  const transactionId = requiredStringFromOptions(o, 'transactionId');

  const params = {
    transactionId,
    ttlSeconds,
    ...antRecordMetadataFromOptions(o),
  };

  const writeAnt = writeANTFromOptions(o);

  if (!o.skipConfirmation) {
    await assertConfirmationPrompt(
      `Are you sure you want to set this base name on the ANT process ${writeAnt.processId}?\n${JSON.stringify(
        params,
        null,
        2,
      )}`,
      o,
    );
  }

  return writeANTFromOptions(o).setBaseNameRecord(
    params,
    customTagsFromOptions(o),
  );
}

export async function setAntUndernameCLICommand(
  o: CLIWriteOptionsFromAoAntParams<AoANTSetUndernameRecordParams>,
) {
  const ttlSeconds = +(o.ttlSeconds ?? defaultTtlSecondsCLI);
  const undername = requiredStringFromOptions(o, 'undername');
  const transactionId = requiredStringFromOptions(o, 'transactionId');

  const params = {
    undername,
    transactionId,
    ttlSeconds,
    ...antRecordMetadataFromOptions(o),
  };

  const writeAnt = writeANTFromOptions(o);

  if (!o.skipConfirmation) {
    await assertConfirmationPrompt(
      `Are you sure you want to set this undername on the ANT process ${writeAnt.processId}?\n${JSON.stringify(
        params,
        null,
        2,
      )}`,
      o,
    );
  }

  return writeANTFromOptions(o).setUndernameRecord(
    params,
    customTagsFromOptions(o),
  );
}

export async function transferRecordOwnershipCLICommand(
  o: CLIWriteOptionsFromAoAntParams<{ undername: string; recipient: string }>,
) {
  const undername = requiredStringFromOptions(o, 'undername');
  const recipient = requiredStringFromOptions(o, 'recipient');

  const writeAnt = writeANTFromOptions(o);

  if (!o.skipConfirmation) {
    await assertConfirmationPrompt(
      `Are you sure you want to transfer ownership of "${undername}" to "${recipient}" on ANT process ${writeAnt.processId}?\n${JSON.stringify(
        { undername, recipient },
        null,
        2,
      )}`,
      o,
    );
  }

  return writeANTFromOptions(o).transferRecord(
    { undername, recipient },
    customTagsFromOptions(o),
  );
}

export async function upgradeAntCLICommand(
  o: CLIWriteOptionsFromAoAntParams<Record<string, unknown>>,
) {
  const writeAnt = writeANTFromOptions(o);
  const arioProcessId = arioProcessIdFromOptions(o);
  const ario = readARIOFromOptions(o);
  const reassignAffiliatedNames = booleanFromOptions(
    o,
    'reassignAffiliatedNames',
  );

  const names = stringArrayFromOptions(o, 'names') || [];

  if (reassignAffiliatedNames) {
    // Fetch all ArNS records that point to this ANT process
    const allRecords = await ario.getArNSRecords({
      filters: {
        processId: writeAnt.processId,
      },
    });

    // Filter records that belong to this ANT
    const affiliatedNames = allRecords.items.map((record) => record.name);
    names.push(...affiliatedNames);
  }

  if (names.length === 0) {
    throw new Error('No names to reassign');
  }

  if (!o.skipConfirmation) {
    await assertConfirmationPrompt(
      `Upgrade all names affiliated with this ANT on ARIO process?\n` +
        `ARIO Process ID: ${arioProcessId}\n` +
        `ANT Process ID: ${writeAnt.processId}\n` +
        `Names that will be reassigned (${names.length}): ${names.join(', ')}`,
      o,
    );
  }

  const result = reassignAffiliatedNames
    ? await writeANTFromOptions(o).upgrade({
        reassignAffiliatedNames,
        arioProcessId,
      })
    : await writeANTFromOptions(o).upgrade({
        names,
        arioProcessId,
      });

  // Serialize error objects for JSON compatibility
  const serializedFailedReassignedNames: Record<
    string,
    { id?: string; error: string }
  > = {};
  for (const [name, failure] of Object.entries(result.failedReassignedNames)) {
    serializedFailedReassignedNames[name] = {
      id: failure.id,
      error: failure.error.message,
    };
  }

  return {
    forkedProcessId: result.forkedProcessId,
    reassignedNames: result.reassignedNames,
    failedReassignedNames: serializedFailedReassignedNames,
  };
}
