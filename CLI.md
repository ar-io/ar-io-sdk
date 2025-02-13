# AR.IO CLI

The AR.IO CLI is a Node.js command line interface for interacting with the AR.IO network. It allows you to perform various actions such as transferring ARIO, delegating stake, buying records, and more. The CLI is designed to be easy to use and provides detailed help information for each command. This document provides an overview of the CLI and its usage.

<!-- toc -->

- [Installation](#installation)
- [Usage](#usage)
- [Options](#options)
- [Commands](#commands)
- [Development](#development)

<!-- tocstop -->

## Installation

Ensure that you have Node.js installed on your system before installing the CLI. You can check if Node.js is installed by running:

```bash
node --version
```

The AR.IO CLI can be installed using npm or yarn. To install the CLI, run one the following commands:

```bash
npm install -g @ar.io/sdk
```

or

```bash
yarn global add @ar.io/sdk --ignore-engines
```

> [!NOTE]
> The `--ignore-engines` flag is required when using yarn, as [permaweb/aoconnect] recommends only the use of npm. Alternatively, you can add a `.yarnrc.yml` file to your project containing `ignore-engines true` to ignore the engines check.

After installing the CLI, you can run the `ar.io --version` command to verify that the CLI was installed successfully.

```bash
ar.io --version
```

## Usage

The AR.IO CLI provides a set of commands that allow you to interact with the AR.IO network. To see a list of available commands, run the following command:

```bash
ar.io --help
```

This will display a list of available commands along with a brief description of each command. You can also get detailed help information for a specific command by running:

```bash
ar.io help <command>
```

## Options

For each command the AR.IO CLI provides a set of options that allow you to customize the behavior of the CLI. Some of the common options include:

- `--dev`: Run against the AR.IO devnet process
- `--debug`: Enable debug log output
- `--skip-confirmation`: Skip confirmation prompts
- `--ario-process-id <arioProcessId>`: Run against a custom AR.IO process id
- `--cu-url <cuUrl>`: The URL for a custom compute unit
- `-w, --wallet-file <walletFilePath>`: The file path to the wallet to use for the interaction
- `--private-key <key>`: Stringified private key to use with the action

## Commands

The AR.IO CLI provides a set of commands that allow you to interact with the AR.IO network.

```sh
Usage: ar.io [options] [command]

AR.IO Network CLI

Options:
  -V, --version                           output the version number
  -w, --wallet-file <walletFilePath>      The file path to the wallet to use for the interaction
  --private-key <key>                     Stringified private key to use with the action
  --dev, --devnet                         Run against the AR.IO devnet process
  --testnet                               Run against the AR.IO testnet process
  --mainnet                               Run against the AR.IO mainnet process
  --debug                                 Enable debug log output
  --ario-process-id <arioProcessId>       Run against a custom AR.IO process id
  --cu-url <cuUrl>                        The URL for a custom compute unit
  -h, --help                              display help for command

Commands:
  info [options]                          Get network info
  token-supply [options]                  Get the total token supply
  get-registration-fees [options]         Get registration fees
  get-demand-factor [options]             Get demand factor
  get-gateway [options]                   Get the gateway of an address
  list-gateways [options]                 List the gateways of the network
  list-all-delegates [options]            List all paginated delegates from all gateways
  get-gateway-delegates [options]         Get the delegates of a gateway
  get-delegations [options]               Get all stake delegated to gateways from this address
  get-allowed-delegates [options]         Get the allow list of a gateway delegate
  get-arns-record [options]               Get an ArNS record by name
  list-arns-records [options]             List all ArNS records
  get-arns-reserved-name [options]        Get a reserved ArNS name
  list-arns-reserved-names [options]      Get all reserved ArNS names
  get-arns-returned-name [options]        Get an ArNS returned name by name
  list-arns-returned-names [options]      Get all ArNS recently returned names
  get-epoch [options]                     Get epoch data
  get-current-epoch [options]             Get current epoch data
  get-prescribed-observers [options]      Get prescribed observers for an epoch
  get-prescribed-names [options]          Get prescribed names for an epoch
  get-observations [options]              Get observations for an epoch
  get-distributions [options]             Get distributions for an epoch
  get-eligible-rewards [options]          Get eligible distributions for an epoch
  get-token-cost [options]                Get token cost for an intended action
  get-cost-details [options]              Get expanded cost details for an intended action
  list-vaults [options]                   Get all wallet vaults
  get-primary-name-request [options]      Get primary name request
  list-primary-name-requests [options]    Get primary name requests
  get-primary-name [options]              Get primary name
  list-primary-names [options]            Get primary names
  balance [options]                       Get the balance of an address
  list-balances [options]                 List all balances
  get-redelegation-fee [options]          Get redelegation fee
  get-vault [options]                     Get the vault of provided address and vault ID
  get-gateway-vaults [options]            Get the vaults of a gateway
  list-all-gateway-vaults [options]       List vaults from all gateways
  transfer [options]                      Transfer ARIO to another address
  vaulted-transfer [options]              Transfer ARIO to another address into a locked vault
  revoke-vault [options]                  Revoke a vaulted transfer as the controller
  create-vault [options]                  Create a locked vault with balance from the sender
  extend-vault [options]                  Extend the lock length of a vault as the recipient
  increase-vault [options]                Increase the balance of a locked vault as the recipient
  join-network [options]                  Join a gateway to the AR.IO network
  leave-network [options]                 Leave a gateway from the AR.IO network
  update-gateway-settings [options]       Update AR.IO gateway settings
  save-observations [options]             Save observations
  increase-operator-stake [options]       Increase operator stake
  decrease-operator-stake [options]       Decrease operator stake
  instant-withdrawal [options]            Instantly withdraw stake from an existing gateway withdrawal vault
  cancel-withdrawal [options]             Cancel a pending gateway withdrawal vault
  delegate-stake [options]                Delegate stake to a gateway
  decrease-delegate-stake [options]       Decrease delegated stake
  redelegate-stake [options]              Redelegate stake to another gateway
  buy-record [options]                    Buy a record
  upgrade-record [options]                Upgrade the lease of a record to a permabuy
  extend-lease [options]                  Extend the lease of a record
  increase-undername-limit [options]      Increase the limit of a name
  request-primary-name [options]          Request a primary name
  spawn-ant [options]                     Spawn an ANT process
  get-ant-state [options]                 Get the state of an ANT process
  get-ant-info [options]                  Get the info of an ANT process
  get-ant-record [options]                Get a record of an ANT process
  list-ant-records [options]              Get the records of an ANT process
  get-ant-owner [options]                 Get the owner of an ANT process
  list-ant-controllers [options]          List the controllers of an ANT process
  get-ant-name [options]                  Get the name of an ANT process
  get-ant-ticker [options]                Get the ticker of an ANT process
  get-ant-balance [options]               Get the balance of an ANT process
  list-ant-balances [options]             Get the balances of an ANT process
  transfer-ant-ownership [options]        Transfer ownership of an ANT process
  add-ant-controller [options]            Add a controller to an ANT process
  remove-ant-controller [options]         Remove a controller from an ANT process
  set-ant-record [options]                Set a record of an ANT process. Deprecated: use set-ant-base-name and set-ant-undername
  set-ant-base-name [options]             Set the base name of an ANT process
  set-ant-undername [options]             Set an undername of an ANT process
  remove-ant-record [options]             Remove a record from an ANT process
  set-ant-ticker [options]                Set the ticker of an ANT process
  set-ant-name [options]                  Set the name of an ANT process
  set-ant-description [options]           Set the description of an ANT process
  set-ant-keywords [options]              Set the keywords of an ANT process
  set-ant-logo [options]                  Set the logo of an ANT process
  release-name [options]                  Release the name of an ANT process
  reassign-name [options]                 Reassign the name of an ANT process to another ANT process
  approve-primary-name-request [options]  Approve a primary name request
  remove-primary-names [options]          Remove primary names
  write-action [options]                  Send a write action to an AO Process
  help [command]                          display help for command
```

## Development

To iterate on the CLI and run it locally, you can use the following to after making changes to the source code:

```bash
yarn build:esm
node lib/esm/cli/cli.js <command>
```

[permaweb/aoconnect]: https://github.com/permaweb/aoconnect
