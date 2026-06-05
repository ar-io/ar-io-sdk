# AR.IO CLI

The AR.IO CLI is a Node.js command line interface for interacting with the AR.IO network on Solana. It allows you to perform various actions such as transferring ARIO, delegating stake, buying records, and more. The CLI is designed to be easy to use and provides detailed help information for each command. This document provides an overview of the CLI and its usage.

<!-- toc -->

- [Installation](#installation)
- [Usage](#usage)
- [Options](#options)
- [Commands](#commands)
- [Development](#development)

<!-- tocstop -->

## Installation

Ensure that you have Node.js (>= 18) installed on your system before installing the CLI. You can check if Node.js is installed by running:

```bash
node --version
```

The AR.IO CLI can be installed using npm or yarn:

```bash
npm install -g @ar.io/sdk
```

or

```bash
yarn global add @ar.io/sdk
```

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

- `--rpc-url <rpcUrl>`: Solana RPC URL (defaults to `https://api.mainnet-beta.solana.com`)
- `--mainnet`: Run against AR.IO mainnet (Solana)
- `--debug`: Enable debug log output
- `--skip-confirmation`: Skip confirmation prompts
- `-w, --wallet-file <walletFilePath>`: Path to a Solana keypair JSON file (64-byte secret-key array)
- `--private-key <key>`: Base58-encoded Solana secret key
- `--core-program-id <id>`: Override the `ario-core` program id (devnet / localnet)
- `--gar-program-id <id>`: Override the `ario-gar` program id (devnet / localnet)
- `--arns-program-id <id>`: Override the `ario-arns` program id (devnet / localnet)
- `--ant-program-id <id>`: Override the `ario-ant` program id (devnet / localnet)

## Commands

The AR.IO CLI provides a set of commands that allow you to interact with the AR.IO network.

```sh
Usage: ar.io [options] [command]

AR.IO Network CLI

Options:
  -V, --version                           output the version number
  -w, --wallet-file <walletFilePath>      The file path to the wallet to use for the interaction
  --private-key <key>                     Stringified private key to use with the action
  --mainnet                               Run against AR.IO mainnet (Solana)
  --debug                                 Enable debug log output
  --rpc-url <rpcUrl>                      Solana RPC URL (defaults to mainnet-beta)
  --ant-program-id <antProgramId>         Override the ario-ant program id
  --core-program-id <coreProgramId>       Override the ario-core program id
  --gar-program-id <garProgramId>         Override the ario-gar program id
  --arns-program-id <arnsProgramId>       Override the ario-arns program id
  -h, --help                              display help for command

Commands:
  # ARIO Network

  # Getters
  info [options]                          Get network info
  token-supply [options]                  Get the total token supply
  balance [options]                       Get the balance of an address
  get-registration-fees [options]         Get registration fees
  get-demand-factor [options]             Get demand factor
  get-demand-factor-settings [options]    Get current settings for demand factor
  get-epoch-settings [options]            Get current settings for epochs
  get-gateway [options]                   Get the gateway of an address
  get-gateway-delegates [options]         Get the delegates of a gateway
  get-gateway-vaults [options]            Get the vaults of a gateway
  get-withdrawals [options]               Get all pending stake withdrawals (operator + delegate) owned by an address
  get-delegations [options]               Get all stake delegated to gateways from this address
  get-allowed-delegates [options]         Get the allow list of a gateway delegate
  get-arns-record [options]               Get an ArNS record by name
  get-arns-reserved-name [options]        Get a reserved ArNS name
  get-arns-returned-name [options]        Get an ArNS returned name by name
  get-epoch [options]                     Get epoch data
  get-current-epoch [options]             Get current epoch data
  get-prescribed-observers [options]      Get prescribed observers for an epoch
  get-prescribed-names [options]          Get prescribed names for an epoch
  get-observations [options]              Get observations for an epoch
  get-distributions [options]             Get distributions for an epoch
  get-eligible-rewards [options]          Get eligible distributions for an epoch
  get-token-cost [options]                Get token cost for an intended action
  get-cost-details [options]              Get expanded cost details for an intended action
  get-primary-name [options]              Get primary name
  get-primary-name-request [options]      Get primary name request
  get-redelegation-fee [options]          Get redelegation fee
  get-vault [options]                     Get the vault of provided address and vault ID

  # ArNS Resolution
  resolve-arns-name [options]             Resolve an ArNS name

  # Paginated handlers
  list-gateways [options]                 List the gateways of the network
  list-all-delegates [options]            List all paginated delegates from all gateways
  list-arns-records [options]             List all ArNS records
  list-arns-reserved-names [options]      Get all reserved ArNS names
  list-arns-returned-names [options]      Get all ArNS recently returned names
  list-vaults [options]                   Get all wallet vaults
  list-primary-name-requests [options]    Get primary name requests
  list-primary-names [options]            Get primary names
  list-balances [options]                 List all balances
  list-all-gateway-vaults [options]       List vaults from all gateways

  # Actions
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
  claim-withdrawal [options]              Claim a matured stake withdrawal vault
  delegate-stake [options]                Delegate stake to a gateway
  decrease-delegate-stake [options]       Decrease delegated stake
  redelegate-stake [options]              Redelegate stake to another gateway
  buy-record [options]                    Buy a record
  upgrade-record [options]                Upgrade the lease of a record to a permabuy
  extend-lease [options]                  Extend the lease of a record
  increase-undername-limit [options]      Increase the limit of a name
  request-primary-name [options]          Request a primary name
  set-primary-name [options]              Set an ArNS name you own as your primary name
  sync-attributes [options]               Sync the on-chain ANT Attributes plugin with the current ArnsRecord

  # Prune / cleanup (permissionless crank surface)
  prune-expired-names [options]           Batch-prune expired ArnsRecord PDAs
  prune-name-to-returned [options]        Convert a single expired-but-not-yet-returned lease into a ReturnedName
  prune-returned-names [options]          Batch-prune expired ReturnedName PDAs
  prune-expired-reservation [options]     Close an expired ReservedName PDA
  prune-gateway [options]                 Slash + remove a deficient gateway (≥30 consecutive failures)
  finalize-gone [options]                 GC a Leaving/Gone gateway whose leave window has fully elapsed
  close-observation [options]             Reclaim rent from an Observation PDA whose epoch has been distributed
  close-empty-delegation [options]        Close an empty Delegation PDA (amount == 0)
  close-drained-withdrawal [options]      Close a drained Withdrawal PDA (amount == 0)
  release-vault [options]                 Release tokens from an expired vault back to the owner
  close-expired-request [options]         Close an expired PrimaryNameRequest PDA

  # ANTS

  # Getters
  get-ant-state [options]                 Get the state of an ANT
  get-ant-info [options]                  Get the info of an ANT
  get-ant-record [options]                Get a record of an ANT
  get-ant-owner [options]                 Get the owner of an ANT
  get-ant-name [options]                  Get the name of an ANT
  get-ant-ticker [options]                Get the ticker of an ANT
  get-ant-balance [options]               Get the balance of an ANT
  get-ants-for-address [options]          List all ANTs owned/controlled by an address

  # Spawn
  spawn-ant [options]                     Spawn an ANT (mints a new MPL Core asset + ario-ant PDAs)

  # ANT Paginated Handlers
  list-ant-records [options]              Get the records of an ANT
  list-ant-controllers [options]          List the controllers of an ANT
  list-ant-balances [options]             Get the balances of an ANT

  # Actions
  transfer-ant-ownership [options]        Transfer ownership of an ANT
  add-ant-controller [options]            Add a controller to an ANT
  remove-ant-controller [options]         Remove a controller from an ANT
  remove-ant-record [options]             Remove a record from an ANT
  set-ant-record [options]                Set a record of an ANT (deprecated: use set-ant-base-name and set-ant-undername)
  set-ant-base-name [options]             Set the base name of an ANT
  set-ant-undername [options]             Set an undername of an ANT
  transfer-record [options]               Transfer ownership of a specific record (undername) to another address
  set-ant-ticker [options]                Set the ticker of an ANT
  set-ant-name [options]                  Set the name of an ANT
  set-ant-description [options]           Set the description of an ANT
  set-ant-keywords [options]              Set the keywords of an ANT
  set-ant-logo [options]                  Set the logo of an ANT

  # ANT Escrow (trustless multi-protocol custody)
  escrow-status [options]                 Read the on-chain EscrowAnt PDA for an ANT mint
  escrow-deposit [options]                Lock an ANT into the trustless escrow program
  escrow-cancel [options]                 Pull an escrowed ANT back to the depositor
  escrow-update-recipient [options]       Re-target an active escrow at a different Arweave/Ethereum identity
  escrow-claim-arweave [options]          Submit an Arweave RSA-PSS-4096 signature to release the ANT
  escrow-claim-ethereum [options]         Submit an Ethereum ECDSA personal_sign signature to release the ANT

  help [command]                          display help for command
```

## Development

To iterate on the CLI and run it locally, you can use the following after making changes to the source code:

```bash
yarn build:esm
node lib/esm/cli/cli.js <command>
```
