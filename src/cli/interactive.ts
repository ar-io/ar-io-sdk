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
import chalk from 'chalk';
import figlet from 'figlet';

/**
 * Display ASCII art banner for AR.IO
 */
function displayBanner(): void {
  try {
    const banner = figlet.textSync('AR.IO', {
      font: 'Big',
      horizontalLayout: 'full',
      verticalLayout: 'fitted',
    });
    console.log(chalk.hex('#DF9BE8')(banner));
    console.log(chalk.hex('#F7C3A1')('━'.repeat(60)));
  } catch (error) {
    // Fallback if figlet fails
    console.log(chalk.cyan.bold('\n  🌐 AR.IO CLI 🌐\n'));
    console.log(chalk.gray('━'.repeat(20)));
  }
}

/**
 * Command categories for organized menu display
 */
export interface CommandCategory {
  name: string;
  description: string;
  commands: CommandInfo[];
}

export interface CommandInfo {
  name: string;
  description: string;
  command: string;
}

/**
 * Get all available commands organized by category
 */
export function getCommandCategories(): CommandCategory[] {
  return [
    {
      name: 'Network Information',
      description: 'Query network state and information',
      commands: [
        {
          name: 'Network Info',
          description: 'Get general network information',
          command: 'info',
        },
        {
          name: 'Token Supply',
          description: 'Get total token supply',
          command: 'token-supply',
        },
        {
          name: 'Check Balance',
          description: 'Get balance of an address',
          command: 'balance',
        },
        {
          name: 'Registration Fees',
          description: 'Get current registration fees',
          command: 'get-registration-fees',
        },
        {
          name: 'Demand Factor',
          description: 'Get current demand factor',
          command: 'get-demand-factor',
        },
        {
          name: 'Current Epoch',
          description: 'Get current epoch information',
          command: 'get-current-epoch',
        },
      ],
    },
    {
      name: 'Gateway Management',
      description: 'Manage gateways and network participation',
      commands: [
        {
          name: 'Join Network',
          description: 'Join a gateway to the AR.IO network',
          command: 'join-network',
        },
        {
          name: 'Leave Network',
          description: 'Leave a gateway from the AR.IO network',
          command: 'leave-network',
        },
        {
          name: 'Update Gateway Settings',
          description: 'Update gateway configuration',
          command: 'update-gateway-settings',
        },
        {
          name: 'Get Gateway Info',
          description: 'Get gateway information',
          command: 'get-gateway',
        },
        {
          name: 'List All Gateways',
          description: 'List all network gateways',
          command: 'list-gateways',
        },
        {
          name: 'Save Observations',
          description: 'Save network observations',
          command: 'save-observations',
        },
      ],
    },
    {
      name: 'Staking & Delegation',
      description: 'Manage stake and delegation operations',
      commands: [
        {
          name: 'Delegate Stake',
          description: 'Delegate stake to a gateway',
          command: 'delegate-stake',
        },
        {
          name: 'Decrease Delegate Stake',
          description: 'Decrease delegated stake',
          command: 'decrease-delegate-stake',
        },
        {
          name: 'Redelegate Stake',
          description: 'Redelegate stake to another gateway',
          command: 'redelegate-stake',
        },
        {
          name: 'Increase Operator Stake',
          description: 'Increase operator stake',
          command: 'increase-operator-stake',
        },
        {
          name: 'Decrease Operator Stake',
          description: 'Decrease operator stake',
          command: 'decrease-operator-stake',
        },
        {
          name: 'Instant Withdrawal',
          description: 'Instantly withdraw from vault',
          command: 'instant-withdrawal',
        },
        {
          name: 'Cancel Withdrawal',
          description: 'Cancel pending withdrawal',
          command: 'cancel-withdrawal',
        },
      ],
    },
    {
      name: 'ARIO Transfers & Vaults',
      description: 'Transfer ARIO tokens and manage vaults',
      commands: [
        {
          name: 'Transfer ARIO',
          description: 'Transfer ARIO to another address',
          command: 'transfer',
        },
        {
          name: 'Vaulted Transfer',
          description: 'Transfer ARIO into a locked vault',
          command: 'vaulted-transfer',
        },
        {
          name: 'Create Vault',
          description: 'Create a locked vault with balance',
          command: 'create-vault',
        },
        {
          name: 'Extend Vault',
          description: 'Extend vault lock duration',
          command: 'extend-vault',
        },
        {
          name: 'Increase Vault',
          description: 'Add balance to existing vault',
          command: 'increase-vault',
        },
        {
          name: 'Revoke Vault',
          description: 'Revoke a vaulted transfer',
          command: 'revoke-vault',
        },
      ],
    },
    {
      name: 'ArNS Names',
      description: 'Purchase and manage ArNS names',
      commands: [
        {
          name: 'Buy ArNS Name',
          description: 'Purchase an ArNS name',
          command: 'buy-record',
        },
        {
          name: 'Upgrade to Permabuy',
          description: 'Upgrade lease to permanent ownership',
          command: 'upgrade-record',
        },
        {
          name: 'Extend Lease',
          description: 'Extend name lease duration',
          command: 'extend-lease',
        },
        {
          name: 'Increase Undername Limit',
          description: 'Increase undername limit for a name',
          command: 'increase-undername-limit',
        },
        {
          name: 'Set Primary Name',
          description: 'Set your primary ArNS name',
          command: 'set-primary-name',
        },
        {
          name: 'Request Primary Name',
          description: 'Request a primary name',
          command: 'request-primary-name',
        },
        {
          name: 'Get ArNS Record',
          description: 'Get details of an ArNS name',
          command: 'get-arns-record',
        },
        {
          name: 'List ArNS Names',
          description: 'List all ArNS names',
          command: 'list-arns-records',
        },
        {
          name: 'Resolve ArNS Name',
          description: 'Resolve an ArNS name',
          command: 'resolve-arns-name',
        },
      ],
    },
    {
      name: 'ANT Management',
      description: 'Manage Arweave Name Tokens (ANTs)',
      commands: [
        {
          name: 'Spawn New ANT',
          description: 'Create a new ANT process',
          command: 'spawn-ant',
        },
        {
          name: 'Get ANT State',
          description: 'Get complete ANT state',
          command: 'get-ant-state',
        },
        {
          name: 'Get ANT Info',
          description: 'Get ANT basic information',
          command: 'get-ant-info',
        },
        {
          name: 'Transfer ANT Ownership',
          description: 'Transfer ANT to another address',
          command: 'transfer-ant-ownership',
        },
        {
          name: 'Set ANT Base Name',
          description: 'Set the base name record',
          command: 'set-ant-base-name',
        },
        {
          name: 'Set ANT Undername',
          description: 'Set an undername record',
          command: 'set-ant-undername',
        },
        {
          name: 'Add ANT Controller',
          description: 'Add a controller to ANT',
          command: 'add-ant-controller',
        },
        {
          name: 'Remove ANT Controller',
          description: 'Remove a controller from ANT',
          command: 'remove-ant-controller',
        },
        {
          name: 'Transfer Record Ownership',
          description: 'Transfer specific record ownership',
          command: 'transfer-record',
        },
        {
          name: 'Upgrade ANT',
          description: 'Upgrade ANT to latest version',
          command: 'upgrade-ant',
        },
        {
          name: 'Set ANT Name',
          description: 'Set ANT display name',
          command: 'set-ant-name',
        },
        {
          name: 'Set ANT Ticker',
          description: 'Set ANT ticker symbol',
          command: 'set-ant-ticker',
        },
        {
          name: 'Set ANT Description',
          description: 'Set ANT description',
          command: 'set-ant-description',
        },
        {
          name: 'Set ANT Logo',
          description: 'Set ANT logo',
          command: 'set-ant-logo',
        },
        {
          name: 'Set ANT Keywords',
          description: 'Set ANT keywords',
          command: 'set-ant-keywords',
        },
      ],
    },
  ];
}

/**
 * Interactive command selection interface
 */
export async function runInteractiveCommandSelection(): Promise<void> {
  const { select, confirm } = await import('@inquirer/prompts');

  // Display ASCII banner
  displayBanner();

  console.log('\n🚀 Welcome to AR.IO Interactive CLI\n');
  console.log('Select a category to explore available commands:\n');

  const categories = getCommandCategories();

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Category selection
      const categoryChoices = categories.map((cat) => ({
        name: `${cat.name} - ${cat.description}`,
        value: cat.name,
        description: `${cat.commands.length} commands available`,
      }));

      categoryChoices.push({
        name: '🚪 Exit',
        value: 'exit',
        description: 'Exit interactive mode',
      });

      const selectedCategory = await select({
        message: '📂 Select a command category:',
        choices: categoryChoices,
        pageSize: 10,
      });

      if (selectedCategory === 'exit') {
        console.log('\n👋 Thanks for using AR.IO CLI!');
        break;
      }

      const category = categories.find((cat) => cat.name === selectedCategory);
      if (!category) continue;

      // Command selection within category
      const commandChoices = category.commands.map((cmd) => ({
        name: `${cmd.name} - ${cmd.description}`,
        value: cmd.command,
      }));

      commandChoices.push({
        name: '← Back to categories',
        value: 'back',
      });

      const selectedCommand = await select({
        message: `🔧 Select a command from ${category.name}:`,
        choices: commandChoices,
        pageSize: 15,
      });

      if (selectedCommand === 'back') {
        continue;
      }

      // Run command in interactive mode (no confirmation needed since we're already in interactive mode)
      console.log(`\n⚡ Running: ar.io ${selectedCommand} --interactive\n`);

      // Execute the command with interactive flag
      try {
        // Set up command execution by spawning a new process
        const { spawn } = await import('child_process');

        // Determine the correct executable path
        const isGlobal = process.argv[1].includes('bin/ar.io');
        const executable = isGlobal ? 'ar.io' : 'node';
        const args = isGlobal
          ? [selectedCommand, '--interactive']
          : [process.argv[1], selectedCommand, '--interactive'];

        // Spawn the command in a new process
        const child = spawn(executable, args, {
          stdio: 'inherit',
          cwd: process.cwd(),
        });

        // Wait for completion
        await new Promise((resolve, reject) => {
          child.on('close', (code) => {
            if (code === 0) {
              resolve(code);
            } else {
              reject(new Error(`Command exited with code ${code}`));
            }
          });

          child.on('error', reject);
        });
      } catch (error) {
        console.error(`❌ Error running command: ${error}`);
      }

      // Ask if user wants to continue
      const continueInteractive = await confirm({
        message: '\n🔄 Would you like to select another command?',
        default: true,
      });

      if (!continueInteractive) {
        console.log('\n👋 Thanks for using AR.IO CLI!');
        break;
      }

      console.log('\n'); // Add spacing
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('User force closed')) {
      console.log('\n\n👋 Thanks for using AR.IO CLI!');
    } else {
      console.error('❌ Interactive mode error:', error);
    }
  }
}
