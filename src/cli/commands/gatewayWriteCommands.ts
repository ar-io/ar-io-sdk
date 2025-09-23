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
import prompts from 'prompts';

import { mARIOToken } from '../../node/index.js';
import {
  AddressAndVaultIdCLIWriteOptions,
  DecreaseDelegateStakeCLIOptions,
  JoinNetworkCLIOptions,
  OperatorStakeCLIOptions,
  RedelegateStakeCLIOptions,
  TransferCLIOptions,
  UpdateGatewaySettingsCLIOptions,
  WriteActionCLIOptions,
} from '../types.js';
import {
  assertConfirmationPrompt,
  assertEnoughMARIOBalance,
  customTagsFromOptions,
  expandTildePath,
  formatARIOWithCommas,
  gatewaySettingsFromOptions,
  redelegateParamsFromOptions,
  requiredAddressFromOptions,
  requiredMARIOFromOptions,
  requiredStringArrayFromOptions,
  requiredStringFromOptions,
  requiredTargetAndQuantityFromOptions,
  stringifyJsonForCLIDisplay,
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
 * Validates FQDN format
 */
function validateFQDN(fqdn: string): boolean | string {
  if (!fqdn) {
    return 'FQDN is required';
  }
  // Basic FQDN validation - should be a valid domain name
  const fqdnRegex =
    /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  if (!fqdnRegex.test(fqdn)) {
    return 'Please enter a valid fully qualified domain name (e.g., gateway.example.com)';
  }
  return true;
}

/**
 * Validates port number
 */
function validatePort(port: string): boolean | string {
  const num = parseInt(port, 10);
  if (isNaN(num)) {
    return 'Please enter a valid port number';
  }
  if (num < 1 || num > 65535) {
    return 'Port number must be between 1 and 65535';
  }
  return true;
}

/**
 * Validates protocol (AR.IO only supports HTTPS)
 */
function validateProtocol(protocol: string): boolean | string {
  if (!protocol) {
    return 'Protocol is required';
  }
  if (protocol.toLowerCase() !== 'https') {
    return 'Protocol must be "https" (AR.IO gateways require HTTPS)';
  }
  return true;
}

/**
 * Validates percentage (0-100)
 */
function validatePercentage(value: string): boolean | string {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return 'Please enter a valid number';
  }
  if (num < 0 || num > 100) {
    return 'Percentage must be between 0 and 100';
  }
  return true;
}

/**
 * Validates transaction ID format
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
 * Handle interactive prompting for delegate-stake command
 */
async function handleDelegateStakeInteractivePrompts(
  options: TransferCLIOptions & { interactive?: boolean },
): Promise<void> {
  const { input, confirm, select } = await import('@inquirer/prompts');

  // Prompt for wallet/private key if not provided
  if (
    (options.walletFile == null || options.walletFile === '') &&
    (options.privateKey == null || options.privateKey === '')
  ) {
    const walletChoice = await select({
      message: 'How would you like to provide your wallet?',
      choices: [
        { name: 'Wallet file path (.json, .jwk)', value: 'file' },
        { name: 'Private key (stringified JWK)', value: 'key' },
      ],
    });

    if (walletChoice === 'file') {
      const walletPath = await input({
        message: 'Enter wallet file path:',
        validate: validateWalletFile,
      });
      options.walletFile = expandTildePath(walletPath);
    } else {
      options.privateKey = await input({
        message: 'Enter private key (stringified JWK):',
        validate: validatePrivateKey,
      });
    }
  }

  // Prompt for target gateway address if not provided
  if (options.target == null || options.target === '') {
    options.target = await input({
      message: 'Enter target gateway address to delegate stake to:',
      validate: validateArweaveAddress,
    });
  }

  // Prompt for stake amount if not provided
  if (options.quantity == null || options.quantity === '') {
    const quantityStr = await input({
      message: 'Enter amount to delegate (ARIO):',
      validate: validateARIOAmount,
    });
    options.quantity = quantityStr;
  }

  // Show delegate stake summary
  console.log('\nDelegate Stake Summary:');
  console.log(`   Target Gateway: ${options.target}`);
  console.log(`   Stake Amount: ${options.quantity} ARIO`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with delegating stake to this gateway?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Delegate stake cancelled by user');
    }
  }
}

/**
 * Handle interactive prompting for decrease-delegate-stake command
 */
async function handleDecreaseDelegateStakeInteractivePrompts(
  options: DecreaseDelegateStakeCLIOptions & { interactive?: boolean },
): Promise<void> {
  const { input, confirm, select } = await import('@inquirer/prompts');

  // Prompt for wallet/private key if not provided
  if (
    (options.walletFile == null || options.walletFile === '') &&
    (options.privateKey == null || options.privateKey === '')
  ) {
    const walletChoice = await select({
      message: 'How would you like to provide your wallet?',
      choices: [
        { name: 'Wallet file path (.json, .jwk)', value: 'file' },
        { name: 'Private key (stringified JWK)', value: 'key' },
      ],
    });

    if (walletChoice === 'file') {
      const walletPath = await input({
        message: 'Enter wallet file path:',
        validate: validateWalletFile,
      });
      options.walletFile = expandTildePath(walletPath);
    } else {
      options.privateKey = await input({
        message: 'Enter private key (stringified JWK):',
        validate: validatePrivateKey,
      });
    }
  }

  // Prompt for target gateway address if not provided
  if (options.target == null || options.target === '') {
    options.target = await input({
      message: 'Enter target gateway address to decrease stake from:',
      validate: validateArweaveAddress,
    });
  }

  // Prompt for stake amount if not provided
  if (options.quantity == null || options.quantity === '') {
    const quantityStr = await input({
      message: 'Enter amount to decrease from delegated stake (ARIO):',
      validate: validateARIOAmount,
    });
    options.quantity = quantityStr;
  }

  // Prompt for instant withdrawal if not explicitly set
  if (options.instant === undefined) {
    options.instant = await confirm({
      message: 'Use instant withdrawal? (Note: This may incur fees)',
      default: false,
    });
  }

  // Show decrease delegate stake summary
  console.log('\nDecrease Delegate Stake Summary:');
  console.log(`   Target Gateway: ${options.target}`);
  console.log(`   Amount to Decrease: ${options.quantity} ARIO`);
  console.log(`   Instant Withdrawal: ${options.instant ? 'Yes' : 'No'}`);
  if (options.instant) {
    console.log(`   Note: Instant withdrawal may incur fees`);
  }
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with decreasing delegated stake?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Decrease delegate stake cancelled by user');
    }
  }
}

/**
 * Handle interactive prompting for redelegate-stake command
 */
async function handleRedelegateStakeInteractivePrompts(
  options: RedelegateStakeCLIOptions & { interactive?: boolean },
): Promise<void> {
  const { input, confirm, select } = await import('@inquirer/prompts');

  // Prompt for wallet/private key if not provided
  if (
    (options.walletFile == null || options.walletFile === '') &&
    (options.privateKey == null || options.privateKey === '')
  ) {
    const walletChoice = await select({
      message: 'How would you like to provide your wallet?',
      choices: [
        { name: 'Wallet file path (.json, .jwk)', value: 'file' },
        { name: 'Private key (stringified JWK)', value: 'key' },
      ],
    });

    if (walletChoice === 'file') {
      const walletPath = await input({
        message: 'Enter wallet file path:',
        validate: validateWalletFile,
      });
      options.walletFile = expandTildePath(walletPath);
    } else {
      options.privateKey = await input({
        message: 'Enter private key (stringified JWK):',
        validate: validatePrivateKey,
      });
    }
  }

  // Prompt for source gateway address if not provided
  if (options.source == null || options.source === '') {
    options.source = await input({
      message: 'Enter source gateway address to redelegate stake from:',
      validate: validateArweaveAddress,
    });
  }

  // Prompt for target gateway address if not provided
  if (options.target == null || options.target === '') {
    options.target = await input({
      message: 'Enter target gateway address to redelegate stake to:',
      validate: validateArweaveAddress,
    });
  }

  // Prompt for stake amount if not provided
  if (options.quantity == null || options.quantity === '') {
    const quantityStr = await input({
      message: 'Enter amount to redelegate (ARIO):',
      validate: validateARIOAmount,
    });
    options.quantity = quantityStr;
  }

  // Show redelegate stake summary
  console.log('\nRedelegate Stake Summary:');
  console.log(`   From Gateway: ${options.source}`);
  console.log(`   To Gateway: ${options.target}`);
  console.log(`   Amount: ${options.quantity} ARIO`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with redelegating stake between these gateways?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Redelegate stake cancelled by user');
    }
  }
}

/**
 * Handle interactive prompting for join-network command
 */
async function handleJoinNetworkInteractivePrompts(
  options: JoinNetworkCLIOptions & { interactive?: boolean },
): Promise<void> {
  const { input, confirm, select } = await import('@inquirer/prompts');

  // Prompt for wallet/private key if not provided
  if (
    (options.walletFile == null || options.walletFile === '') &&
    (options.privateKey == null || options.privateKey === '')
  ) {
    const walletChoice = await select({
      message: 'How would you like to provide your wallet?',
      choices: [
        { name: 'Wallet file path (.json, .jwk)', value: 'file' },
        { name: 'Private key (stringified JWK)', value: 'key' },
      ],
    });

    if (walletChoice === 'file') {
      const walletPath = await input({
        message: 'Enter wallet file path:',
        validate: validateWalletFile,
      });
      options.walletFile = expandTildePath(walletPath);
    } else {
      options.privateKey = await input({
        message: 'Enter private key (stringified JWK):',
        validate: validatePrivateKey,
      });
    }
  }

  // Prompt for required operator stake
  if (options.operatorStake == null || options.operatorStake === '') {
    const operatorStakeStr = await input({
      message: 'Enter operator stake amount (ARIO):',
      validate: validateARIOAmount,
    });
    options.operatorStake = operatorStakeStr;
  }

  // Prompt for required label
  if (options.label == null || options.label === '') {
    options.label = await input({
      message: 'Enter gateway label:',
      validate: (value) => (value ? true : 'Label is required'),
    });
  }

  // Prompt for required FQDN
  if (options.fqdn == null || options.fqdn === '') {
    options.fqdn = await input({
      message: 'Enter gateway FQDN (e.g., gateway.example.com):',
      validate: validateFQDN,
    });
  }

  // Prompt for port (default 443)
  if (options.port == null || options.port === '') {
    const portStr = await input({
      message: 'Enter gateway port:',
      default: '443',
      validate: validatePort,
    });
    options.port = portStr;
  }

  // Prompt for protocol (always https for AR.IO)
  if (options.protocol == null) {
    const protocolStr = await input({
      message: 'Enter gateway protocol (must be "https"):',
      default: 'https',
      validate: validateProtocol,
    });
    options.protocol = protocolStr as 'https';
  }

  // Optional: Auto-stake setting
  if (options.autoStake === undefined) {
    options.autoStake = await confirm({
      message: 'Enable auto-staking of operator rewards?',
      default: true,
    });
  }

  // Optional: Allow delegated staking
  if (options.allowDelegatedStaking === undefined) {
    options.allowDelegatedStaking = await confirm({
      message: 'Allow delegated staking to your gateway?',
      default: true,
    });
  }

  // Optional: Delegate reward share ratio
  if (
    (options.delegateRewardShareRatio == null ||
      options.delegateRewardShareRatio === '') &&
    options.allowDelegatedStaking === true
  ) {
    const ratioStr = await input({
      message: 'Enter delegate reward share ratio (0-100%):',
      default: '0',
      validate: validatePercentage,
    });
    options.delegateRewardShareRatio = ratioStr;
  }

  // Optional: Minimum delegated stake
  if (
    (options.minDelegatedStake == null || options.minDelegatedStake === '') &&
    options.allowDelegatedStaking === true
  ) {
    const minStakeStr = await input({
      message: 'Enter minimum delegated stake (ARIO):',
      default: '100',
      validate: validateARIOAmount,
    });
    options.minDelegatedStake = minStakeStr;
  }

  // Optional: Observer address
  if (options.observerAddress == null || options.observerAddress === '') {
    const hasObserver = await confirm({
      message: 'Do you have a separate observer address?',
      default: false,
    });

    if (hasObserver) {
      options.observerAddress = await input({
        message: 'Enter observer address:',
        validate: validateArweaveAddress,
      });
    }
  }

  // Optional: Note
  if (options.note == null || options.note === '') {
    const hasNote = await confirm({
      message: 'Do you want to add a note for your gateway?',
      default: false,
    });

    if (hasNote) {
      options.note = await input({
        message: 'Enter gateway note:',
      });
    }
  }

  // Show join network summary
  console.log('\nJoin Network Summary:');
  console.log(`   Label: ${options.label}`);
  console.log(`   FQDN: ${options.fqdn}`);
  console.log(`   Port: ${options.port}`);
  console.log(`   Protocol: ${options.protocol}`);
  console.log(`   Operator Stake: ${options.operatorStake} ARIO`);
  console.log(`   Auto-stake: ${options.autoStake === true ? 'Yes' : 'No'}`);
  console.log(
    `   Allow Delegated Staking: ${options.allowDelegatedStaking === true ? 'Yes' : 'No'}`,
  );
  if (options.allowDelegatedStaking === true) {
    console.log(
      `   Delegate Reward Share: ${options.delegateRewardShareRatio ?? 0}%`,
    );
    console.log(
      `   Min Delegated Stake: ${options.minDelegatedStake ?? 'Default'} ARIO`,
    );
  }
  if (options.observerAddress != null && options.observerAddress !== '') {
    console.log(`   Observer Address: ${options.observerAddress}`);
  }
  if (options.note != null && options.note !== '') {
    console.log(`   Note: ${options.note}`);
  }
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with joining the network?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Join network cancelled by user');
    }
  }
}

/**
 * Handle interactive prompting for update-gateway-settings command
 */
async function handleUpdateGatewaySettingsInteractivePrompts(
  options: UpdateGatewaySettingsCLIOptions & { interactive?: boolean },
): Promise<void> {
  const { input, confirm, select, checkbox } = await import(
    '@inquirer/prompts'
  );

  // Prompt for wallet/private key if not provided
  if (
    (options.walletFile == null || options.walletFile === '') &&
    (options.privateKey == null || options.privateKey === '')
  ) {
    const walletChoice = await select({
      message: 'How would you like to provide your wallet?',
      choices: [
        { name: 'Wallet file path (.json, .jwk)', value: 'file' },
        { name: 'Private key (stringified JWK)', value: 'key' },
      ],
    });

    if (walletChoice === 'file') {
      const walletPath = await input({
        message: 'Enter wallet file path:',
        validate: validateWalletFile,
      });
      options.walletFile = expandTildePath(walletPath);
    } else {
      options.privateKey = await input({
        message: 'Enter private key (stringified JWK):',
        validate: validatePrivateKey,
      });
    }
  }

  // Let user select which settings to update
  const settingsToUpdate = await checkbox({
    message: 'Select gateway settings to update:',
    choices: [
      { name: 'Label', value: 'label' },
      { name: 'FQDN', value: 'fqdn' },
      { name: 'Port', value: 'port' },
      { name: 'Protocol', value: 'protocol' },
      { name: 'Auto-stake', value: 'autoStake' },
      { name: 'Allow delegated staking', value: 'allowDelegatedStaking' },
      {
        name: 'Delegate reward share ratio',
        value: 'delegateRewardShareRatio',
      },
      { name: 'Minimum delegated stake', value: 'minDelegatedStake' },
      { name: 'Observer address', value: 'observerAddress' },
      { name: 'Note', value: 'note' },
      { name: 'Allowed delegates', value: 'allowedDelegates' },
    ],
  });

  if (settingsToUpdate.length === 0) {
    throw new Error('No settings selected for update');
  }

  // Prompt for each selected setting
  for (const setting of settingsToUpdate) {
    switch (setting) {
      case 'label':
        options.label = await input({
          message: 'Enter new gateway label:',
          validate: (value) => (value ? true : 'Label is required'),
        });
        break;
      case 'fqdn':
        options.fqdn = await input({
          message: 'Enter new gateway FQDN:',
          validate: validateFQDN,
        });
        break;
      case 'port': {
        const portStr = await input({
          message: 'Enter new gateway port:',
          validate: validatePort,
        });
        options.port = portStr;
        break;
      }
      case 'protocol': {
        const protocolStr = await input({
          message: 'Enter new gateway protocol (must be "https"):',
          default: 'https',
          validate: validateProtocol,
        });
        options.protocol = protocolStr as 'https';
        break;
      }
      case 'autoStake':
        options.autoStake = await confirm({
          message: 'Enable auto-staking of operator rewards?',
        });
        break;
      case 'allowDelegatedStaking':
        options.allowDelegatedStaking = await confirm({
          message: 'Allow delegated staking to your gateway?',
        });
        break;
      case 'delegateRewardShareRatio': {
        const ratioStr = await input({
          message: 'Enter delegate reward share ratio (0-100%):',
          validate: validatePercentage,
        });
        options.delegateRewardShareRatio = ratioStr;
        break;
      }
      case 'minDelegatedStake': {
        const minStakeStr = await input({
          message: 'Enter minimum delegated stake (ARIO):',
          validate: validateARIOAmount,
        });
        options.minDelegatedStake = minStakeStr;
        break;
      }
      case 'observerAddress':
        options.observerAddress = await input({
          message: 'Enter observer address:',
          validate: validateArweaveAddress,
        });
        break;
      case 'note':
        options.note = await input({
          message: 'Enter gateway note:',
        });
        break;
      case 'allowedDelegates': {
        const delegatesInput = await input({
          message:
            'Enter allowed delegate addresses (comma-separated, leave empty for all):',
        });
        if (delegatesInput.trim()) {
          options.allowedDelegates = delegatesInput
            .split(',')
            .map((addr) => addr.trim());
        } else {
          options.allowedDelegates = [];
        }
        break;
      }
    }
  }

  // Show update summary
  console.log('\nGateway Settings Update Summary:');
  settingsToUpdate.forEach((setting) => {
    const value = (options as any)[setting];
    if (value !== undefined) {
      console.log(
        `   ${setting}: ${Array.isArray(value) ? value.join(', ') : value}`,
      );
    }
  });
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with updating gateway settings?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Gateway settings update cancelled by user');
    }
  }
}

/**
 * Handle interactive prompting for leave-network command
 */
async function handleLeaveNetworkInteractivePrompts(
  options: WriteActionCLIOptions & { interactive?: boolean },
): Promise<void> {
  const { input, confirm, select } = await import('@inquirer/prompts');

  // Prompt for wallet/private key if not provided
  if (
    (options.walletFile == null || options.walletFile === '') &&
    (options.privateKey == null || options.privateKey === '')
  ) {
    const walletChoice = await select({
      message: 'How would you like to provide your wallet?',
      choices: [
        { name: 'Wallet file path (.json, .jwk)', value: 'file' },
        { name: 'Private key (stringified JWK)', value: 'key' },
      ],
    });

    if (walletChoice === 'file') {
      const walletPath = await input({
        message: 'Enter wallet file path:',
        validate: validateWalletFile,
      });
      options.walletFile = expandTildePath(walletPath);
    } else {
      options.privateKey = await input({
        message: 'Enter private key (stringified JWK):',
        validate: validatePrivateKey,
      });
    }
  }

  // Show leave network summary
  console.log('\nLeave Network Summary:');
  console.log('   Action: Leave AR.IO network');
  console.log('   WARNING: This will remove your gateway from the network');
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message:
        'Are you sure you want to leave the AR.IO network? This action cannot be undone.',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Leave network cancelled by user');
    }
  }
}

/**
 * Handle interactive prompting for save-observations command
 */
async function handleSaveObservationsInteractivePrompts(
  options: WriteActionCLIOptions & {
    failedGateways?: string[];
    transactionId?: string;
    interactive?: boolean;
  },
): Promise<void> {
  const { input, confirm, select } = await import('@inquirer/prompts');

  // Prompt for wallet/private key if not provided
  if (
    (options.walletFile == null || options.walletFile === '') &&
    (options.privateKey == null || options.privateKey === '')
  ) {
    const walletChoice = await select({
      message: 'How would you like to provide your wallet?',
      choices: [
        { name: 'Wallet file path (.json, .jwk)', value: 'file' },
        { name: 'Private key (stringified JWK)', value: 'key' },
      ],
    });

    if (walletChoice === 'file') {
      const walletPath = await input({
        message: 'Enter wallet file path:',
        validate: validateWalletFile,
      });
      options.walletFile = expandTildePath(walletPath);
    } else {
      options.privateKey = await input({
        message: 'Enter private key (stringified JWK):',
        validate: validatePrivateKey,
      });
    }
  }

  // Prompt for failed gateways if not provided
  if (!options.failedGateways || options.failedGateways.length === 0) {
    const failedGatewaysInput = await input({
      message: 'Enter failed gateway addresses (comma-separated):',
      validate: (value) => {
        if (!value.trim()) {
          return 'At least one failed gateway address is required';
        }
        const addresses = value.split(',').map((addr) => addr.trim());
        for (const addr of addresses) {
          const validation = validateArweaveAddress(addr);
          if (validation !== true) {
            return `Invalid address "${addr}": ${validation}`;
          }
        }
        return true;
      },
    });
    options.failedGateways = failedGatewaysInput
      .split(',')
      .map((addr) => addr.trim());
  }

  // Prompt for transaction ID if not provided
  if (options.transactionId == null || options.transactionId === '') {
    options.transactionId = await input({
      message: 'Enter observation report transaction ID:',
      validate: validateTransactionId,
    });
  }

  // Show save observations summary
  console.log('\nSave Observations Summary:');
  console.log(`   Failed Gateways: ${options.failedGateways.join(', ')}`);
  console.log(`   Report Transaction ID: ${options.transactionId}`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: 'Proceed with saving observations?',
      default: false,
    });

    if (!confirmed) {
      throw new Error('Save observations cancelled by user');
    }
  }
}

/**
 * Handle interactive prompting for operator stake commands
 */
async function handleOperatorStakeInteractivePrompts(
  options: OperatorStakeCLIOptions & { interactive?: boolean },
  action: 'increase' | 'decrease',
): Promise<void> {
  const { input, confirm, select } = await import('@inquirer/prompts');

  // Prompt for wallet/private key if not provided
  if (
    (options.walletFile == null || options.walletFile === '') &&
    (options.privateKey == null || options.privateKey === '')
  ) {
    const walletChoice = await select({
      message: 'How would you like to provide your wallet?',
      choices: [
        { name: 'Wallet file path (.json, .jwk)', value: 'file' },
        { name: 'Private key (stringified JWK)', value: 'key' },
      ],
    });

    if (walletChoice === 'file') {
      const walletPath = await input({
        message: 'Enter wallet file path:',
        validate: validateWalletFile,
      });
      options.walletFile = expandTildePath(walletPath);
    } else {
      options.privateKey = await input({
        message: 'Enter private key (stringified JWK):',
        validate: validatePrivateKey,
      });
    }
  }

  // Prompt for operator stake amount if not provided
  if (options.operatorStake == null || options.operatorStake === '') {
    const stakeStr = await input({
      message: `Enter amount to ${action} operator stake (ARIO):`,
      validate: validateARIOAmount,
    });
    options.operatorStake = stakeStr;
  }

  // Show operator stake summary
  console.log(
    `\n${action === 'increase' ? 'Increase' : 'Decrease'} Operator Stake Summary:`,
  );
  console.log(`   Action: ${action} operator stake`);
  console.log(`   Amount: ${options.operatorStake} ARIO`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: `Proceed with ${action}ing operator stake?`,
      default: false,
    });

    if (!confirmed) {
      throw new Error(
        `${action === 'increase' ? 'Increase' : 'Decrease'} operator stake cancelled by user`,
      );
    }
  }
}

/**
 * Handle interactive prompting for withdrawal commands
 */
async function handleWithdrawalInteractivePrompts(
  options: AddressAndVaultIdCLIWriteOptions & { interactive?: boolean },
  action: 'instant' | 'cancel',
): Promise<void> {
  const { input, confirm, select } = await import('@inquirer/prompts');

  // Prompt for wallet/private key if not provided
  if (
    (options.walletFile == null || options.walletFile === '') &&
    (options.privateKey == null || options.privateKey === '')
  ) {
    const walletChoice = await select({
      message: 'How would you like to provide your wallet?',
      choices: [
        { name: 'Wallet file path (.json, .jwk)', value: 'file' },
        { name: 'Private key (stringified JWK)', value: 'key' },
      ],
    });

    if (walletChoice === 'file') {
      const walletPath = await input({
        message: 'Enter wallet file path:',
        validate: validateWalletFile,
      });
      options.walletFile = expandTildePath(walletPath);
    } else {
      options.privateKey = await input({
        message: 'Enter private key (stringified JWK):',
        validate: validatePrivateKey,
      });
    }
  }

  // Prompt for gateway address if not provided
  if (options.address == null || options.address === '') {
    options.address = await input({
      message: 'Enter gateway address:',
      validate: validateArweaveAddress,
    });
  }

  // Prompt for vault ID if not provided
  if (options.vaultId == null || options.vaultId === '') {
    options.vaultId = await input({
      message: 'Enter vault ID:',
      validate: validateVaultId,
    });
  }

  // Show withdrawal summary
  console.log(
    `\n${action === 'instant' ? 'Instant' : 'Cancel'} Withdrawal Summary:`,
  );
  console.log(`   Action: ${action} withdrawal`);
  console.log(`   Gateway Address: ${options.address}`);
  console.log(`   Vault ID: ${options.vaultId}`);
  if (options.walletFile != null && options.walletFile !== '') {
    console.log(`   Wallet: ${options.walletFile}`);
  } else if (options.privateKey != null && options.privateKey !== '') {
    console.log(`   Wallet: Private key provided`);
  }

  // Confirmation prompt (unless skipped)
  if (!options.skipConfirmation) {
    const confirmed = await confirm({
      message: `Proceed with ${action} withdrawal?`,
      default: false,
    });

    if (!confirmed) {
      throw new Error(
        `${action === 'instant' ? 'Instant' : 'Cancel'} withdrawal cancelled by user`,
      );
    }
  }
}

export async function joinNetwork(
  options: JoinNetworkCLIOptions & { interactive?: boolean },
) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('Interactive Join Network\n');
    await handleJoinNetworkInteractivePrompts(options);
    console.log('\nProcessing join network...');
  }

  const { ario, signerAddress } = writeARIOFromOptions(options);

  const mARIOQuantity = requiredMARIOFromOptions(options, 'operatorStake');

  const settings = {
    ...gatewaySettingsFromOptions(options),
    operatorStake: mARIOQuantity.valueOf(),
  };

  if (settings.label === undefined) {
    throw new Error(
      'Label is required. Please provide a --label for your node.',
    );
  }
  if (settings.fqdn === undefined) {
    throw new Error('FQDN is required. Please provide a --fqdn for your node.');
  }

  if (!options.skipConfirmation && !options.interactive) {
    const registrySettings = await ario.getGatewayRegistrySettings();
    if (registrySettings.operators.minStake > mARIOQuantity.valueOf()) {
      throw new Error(
        `The minimum operator stake is ${formatARIOWithCommas(
          new mARIOToken(registrySettings.operators.minStake).toARIO(),
        )} ARIO. Please provide a higher stake.`,
      );
    }
    await assertEnoughMARIOBalance({
      ario,
      address: signerAddress,
      mARIOQuantity,
    });

    await assertConfirmationPrompt(
      `Gateway Settings:\n\n${JSON.stringify(settings, null, 2)}\n\nYou are about to stake ${formatARIOWithCommas(mARIOQuantity.toARIO())} ARIO to join the AR.IO network\nAre you sure?\n`,
      options,
    );
  }

  const result = await ario.joinNetwork(
    settings,
    customTagsFromOptions(options),
  );

  const output = {
    joinNetworkResult: result,
    joinedAddress: signerAddress,
    message: `Congratulations! You have successfully joined the AR.IO network  (;`,
  };

  return output;
}

export async function updateGatewaySettings(
  options: UpdateGatewaySettingsCLIOptions & { interactive?: boolean },
) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('Interactive Update Gateway Settings\n');
    await handleUpdateGatewaySettingsInteractivePrompts(options);
    console.log('\nProcessing gateway settings update...');
  }

  const { ario, signerAddress } = writeARIOFromOptions(options);
  const gatewaySettings = gatewaySettingsFromOptions(options);

  if (Object.keys(gatewaySettings).length === 0) {
    // TODO: The contract accepts empty Update-Gateway-Settings actions, but we'll throw in the CLI for now
    throw new Error('No gateway settings provided');
  }

  if (!options.skipConfirmation && !options.interactive) {
    await assertConfirmationPrompt(
      `Gateway Settings:\n\n${stringifyJsonForCLIDisplay(gatewaySettings)}\n\nYou are about to update your gateway settings to the above\nAre you sure?\n`,
      options,
    );
  }

  const result = await ario.updateGatewaySettings(
    gatewaySettings,
    customTagsFromOptions(options),
  );

  const output = {
    updateGatewaySettingsResult: result,
    updatedGatewayAddress: signerAddress,
    message: `Gateway settings updated successfully`,
  };

  return output;
}

export async function leaveNetwork(
  options: WriteActionCLIOptions & { interactive?: boolean },
) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('Interactive Leave Network\n');
    await handleLeaveNetworkInteractivePrompts(options);
    console.log('\nProcessing leave network...');
  }

  const { ario, signerAddress } = writeARIOFromOptions(options);

  if (!options.skipConfirmation && !options.interactive) {
    const gateway = await ario.getGateway({ address: signerAddress });

    await assertConfirmationPrompt(
      'Gateway Details:\n\n' +
        stringifyJsonForCLIDisplay(gateway) +
        '\n\n' +
        'Are you sure you want to leave the AR.IO network?',
      options,
    );
  }

  return writeARIOFromOptions(options).ario.leaveNetwork(
    customTagsFromOptions(options),
  );
}

export async function saveObservations(
  o: WriteActionCLIOptions & {
    failedGateways?: string[];
    transactionId?: string;
    interactive?: boolean;
  },
) {
  // Handle interactive mode
  if (o.interactive) {
    console.log('Interactive Save Observations\n');
    await handleSaveObservationsInteractivePrompts(o);
    console.log('\nProcessing save observations...');
  }

  const failedGateways = requiredStringArrayFromOptions(o, 'failedGateways');
  const reportTxId = requiredStringFromOptions(o, 'transactionId');

  if (!o.skipConfirmation && !o.interactive) {
    await assertConfirmationPrompt(
      `You are about to save the following failed gateways to the AR.IO network:\n\n${failedGateways.join(
        '\n',
      )}\n\nTransaction ID: ${reportTxId}\n\nAre you sure?`,
      o,
    );
  }

  return writeARIOFromOptions(o).ario.saveObservations(
    {
      failedGateways: requiredStringArrayFromOptions(o, 'failedGateways'),
      reportTxId: requiredStringFromOptions(o, 'transactionId'),
    },
    customTagsFromOptions(o),
  );
}

export async function increaseOperatorStake(
  o: OperatorStakeCLIOptions & { interactive?: boolean },
) {
  // Handle interactive mode
  if (o.interactive) {
    console.log('Interactive Increase Operator Stake\n');
    await handleOperatorStakeInteractivePrompts(o, 'increase');
    console.log('\nProcessing increase operator stake...');
  }

  const increaseQty = requiredMARIOFromOptions(o, 'operatorStake');

  if (!o.skipConfirmation && !o.interactive) {
    await assertConfirmationPrompt(
      `You are about to increase your operator stake by ${formatARIOWithCommas(
        increaseQty.toARIO(),
      )} ARIO\nAre you sure?`,
      o,
    );
  }

  return writeARIOFromOptions(o).ario.increaseOperatorStake(
    {
      increaseQty,
    },
    customTagsFromOptions(o),
  );
}

export async function decreaseOperatorStake(
  o: OperatorStakeCLIOptions & { interactive?: boolean },
) {
  // Handle interactive mode
  if (o.interactive) {
    console.log('Interactive Decrease Operator Stake\n');
    await handleOperatorStakeInteractivePrompts(o, 'decrease');
    console.log('\nProcessing decrease operator stake...');
  }

  const decreaseQty = requiredMARIOFromOptions(o, 'operatorStake');

  // TODO: Can assert stake is sufficient for action, and new target stake meets contract minimum

  if (!o.skipConfirmation && !o.interactive) {
    await assertConfirmationPrompt(
      `You are about to decrease your operator stake by ${formatARIOWithCommas(
        decreaseQty.toARIO(),
      )} ARIO\nAre you sure?`,
      o,
    );
  }

  return writeARIOFromOptions(o).ario.decreaseOperatorStake(
    {
      decreaseQty,
    },
    customTagsFromOptions(o),
  );
}

export async function instantWithdrawal(
  o: AddressAndVaultIdCLIWriteOptions & { interactive?: boolean },
) {
  // Handle interactive mode
  if (o.interactive) {
    console.log('Interactive Instant Withdrawal\n');
    await handleWithdrawalInteractivePrompts(o, 'instant');
    console.log('\nProcessing instant withdrawal...');
  }

  const vaultId = requiredStringFromOptions(o, 'vaultId');
  const gatewayAddress = requiredAddressFromOptions(o);

  if (!o.skipConfirmation && !o.interactive) {
    await assertConfirmationPrompt(
      `You are about to instantly withdraw from vault ${vaultId} for with gateway address ${gatewayAddress}\nAre you sure?`,
      o,
    );
  }

  return writeARIOFromOptions(o).ario.instantWithdrawal(
    {
      vaultId,
      gatewayAddress,
    },
    customTagsFromOptions(o),
  );
}

export async function cancelWithdrawal(
  o: AddressAndVaultIdCLIWriteOptions & { interactive?: boolean },
) {
  // Handle interactive mode
  if (o.interactive) {
    console.log('Interactive Cancel Withdrawal\n');
    await handleWithdrawalInteractivePrompts(o, 'cancel');
    console.log('\nProcessing cancel withdrawal...');
  }

  const vaultId = requiredStringFromOptions(o, 'vaultId');
  const gatewayAddress = requiredAddressFromOptions(o);

  if (!o.skipConfirmation && !o.interactive) {
    await assertConfirmationPrompt(
      `You are about to cancel the pending withdrawal from vault ${vaultId} for with gateway address ${gatewayAddress}\nAre you sure?`,
      o,
    );
  }

  return writeARIOFromOptions(o).ario.cancelWithdrawal(
    {
      vaultId,
      gatewayAddress,
    },
    customTagsFromOptions(o),
  );
}

export async function delegateStake(
  options: TransferCLIOptions & { interactive?: boolean },
) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('Interactive Delegate Stake\n');
    await handleDelegateStakeInteractivePrompts(options);
    console.log('\nProcessing delegate stake...');
  }

  const { ario, signerAddress } = writeARIOFromOptions(options);

  const { target, arioQuantity } =
    requiredTargetAndQuantityFromOptions(options);
  const mARIOQuantity = arioQuantity.toMARIO();

  if (!options.skipConfirmation && !options.interactive) {
    const balance = await ario.getBalance({ address: signerAddress });

    if (balance < mARIOQuantity.valueOf()) {
      throw new Error(
        `Insufficient ARIO balance for delegating stake. Balance available: ${new mARIOToken(balance).toARIO()} ARIO`,
      );
    }

    const targetGateway = await ario.getGateway({ address: target });
    if (targetGateway === undefined) {
      throw new Error(`Gateway not found for address: ${target}`);
    }
    if (targetGateway.settings.allowDelegatedStaking === false) {
      throw new Error(`Gateway does not allow delegated staking: ${target}`);
    }

    // TODO: could get allow list and assert doesn't exist or user is on it

    // TODO: could read from contract to get current delegated stake if there is none, get contract minimum delegated stake. Then see if the new stake value will satisfy minimum delegated stake for both the target gateway settings min delegate stake and contract min delegated amounts

    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Target Gateway:\n${JSON.stringify(targetGateway, null, 2)}\n\nAre you sure you want to delegate ${formatARIOWithCommas(arioQuantity)} ARIO to ${target}?`,
    });

    if (!confirm) {
      return { message: 'Delegate stake aborted by user' };
    }
  }

  const result = await ario.delegateStake(
    {
      target,
      stakeQty: arioQuantity.toMARIO(),
    },
    customTagsFromOptions(options),
  );

  const output = {
    senderAddress: signerAddress,
    transferResult: result,
    message: `Successfully delegated ${formatARIOWithCommas(arioQuantity)} ARIO to ${target}`,
  };

  return output;
}

export async function decreaseDelegateStake(
  options: DecreaseDelegateStakeCLIOptions & { interactive?: boolean },
) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('Interactive Decrease Delegate Stake\n');
    await handleDecreaseDelegateStakeInteractivePrompts(options);
    console.log('\nProcessing decrease delegate stake...');
  }

  const ario = writeARIOFromOptions(options).ario;
  const { target, arioQuantity } =
    requiredTargetAndQuantityFromOptions(options);
  const instant = options.instant ?? false;

  // TODO: Could assert sender is a delegate with enough stake to decrease
  // TODO: Could assert new target stake meets contract and target gateway minimums
  // TODO: Could present confirmation prompt with any fee for instant withdrawal (50% of the stake is put back into protocol??)

  if (!options.skipConfirmation && !options.interactive) {
    await assertConfirmationPrompt(
      `Are you sure you'd like to decrease delegated stake of ${formatARIOWithCommas(arioQuantity)} ARIO on gateway ${target}?`,
      options,
    );
  }

  const result = await ario.decreaseDelegateStake({
    target,
    decreaseQty: arioQuantity.toMARIO(),
    instant,
  });

  const output = {
    targetGateway: target,
    decreaseDelegateStakeResult: result,
    message: `Successfully decreased delegated stake of ${formatARIOWithCommas(
      arioQuantity,
    )} ARIO to ${target}`,
  };

  return output;
}

export async function redelegateStake(
  options: RedelegateStakeCLIOptions & { interactive?: boolean },
) {
  // Handle interactive mode
  if (options.interactive) {
    console.log('Interactive Redelegate Stake\n');
    await handleRedelegateStakeInteractivePrompts(options);
    console.log('\nProcessing redelegate stake...');
  }

  const ario = writeARIOFromOptions(options).ario;
  const params = redelegateParamsFromOptions(options);

  // TODO: Could assert target gateway exists
  // TODO: Could do assertion on source has enough stake to redelegate
  // TODO: Could do assertions on source/target min delegate stakes are met

  if (!options.skipConfirmation && !options.interactive) {
    await assertConfirmationPrompt(
      `Are you sure you'd like to redelegate stake of ${formatARIOWithCommas(params.stakeQty.toARIO())} ARIO from ${params.source} to ${params.target}?`,
      options,
    );
  }

  const result = await ario.redelegateStake(params);

  const output = {
    sourceGateway: params.source,
    targetGateway: params.target,
    redelegateStakeResult: result,
    message: `Successfully re-delegated stake of ${formatARIOWithCommas(
      params.stakeQty.toARIO(),
    )} ARIO from ${params.source} to ${params.target}`,
  };

  return output;
}
