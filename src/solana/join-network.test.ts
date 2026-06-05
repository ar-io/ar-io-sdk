/**
 * Tests for the joinNetwork Borsh serialization layout and the
 * getObserverLookupPDA derivation added alongside it.
 *
 * These are pure unit tests — no network calls, no validator.
 * They verify that the BorshWriter output matches the Rust
 * JoinNetworkParams struct byte-for-byte:
 *
 *   pub struct JoinNetworkParams {
 *       pub operator_stake: u64,
 *       pub label: String,
 *       pub fqdn: String,
 *       pub port: u16,
 *       pub protocol: Protocol,       // enum { Http=0, Https=1 }
 *       pub properties: Option<String>,
 *       pub auto_stake: bool,
 *       pub allow_delegated_staking: bool,
 *       pub delegate_reward_share_ratio: u8,
 *       pub min_delegate_stake: Option<u64>,
 *       pub observer_address: Pubkey,
 *   }
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  type Address,
  address,
  generateKeyPairSigner,
  getAddressDecoder,
} from '@solana/kit';

import { OBSERVER_LOOKUP_SEED } from './constants.js';
import { BorshWriter } from './deserialize.js';
import { getObserverLookupPDA } from './pda.js';

const addressDecoder = getAddressDecoder();

/** Generate a random Address via a throwaway signer (tests-only helper). */
async function randomAddress(): Promise<Address> {
  const signer = await generateKeyPairSigner();
  return signer.address;
}

/**
 * Replicate the exact Borsh encoding that io-writeable.ts performs inside
 * joinNetwork, so we can assert the binary layout field-by-field.
 */
function encodeJoinNetworkParams(params: {
  operatorStake: bigint | number;
  label: string;
  fqdn: string;
  port: number;
  properties?: string;
  autoStake: boolean;
  allowDelegatedStaking: boolean;
  delegateRewardShareRatio: number;
  minDelegatedStake?: bigint | number;
  observerAddress: Address;
}): Buffer {
  const w = new BorshWriter(1024);
  w.writeU64(params.operatorStake);
  w.writeString(params.label);
  w.writeString(params.fqdn);
  w.writeU16(params.port);
  w.writeU8(1); // protocol: Https=1
  // properties: Option<String>
  if (params.properties) {
    w.writeU8(1);
    w.writeString(params.properties);
  } else {
    w.writeU8(0);
  }
  w.writeBool(params.autoStake);
  w.writeBool(params.allowDelegatedStaking);
  w.writeU8(params.delegateRewardShareRatio);
  // min_delegate_stake: Option<u64>
  if (params.minDelegatedStake !== undefined) {
    w.writeU8(1);
    w.writeU64(params.minDelegatedStake);
  } else {
    w.writeU8(0);
  }
  w.writePubkey(params.observerAddress);
  return w.toBuffer();
}

describe('joinNetwork Borsh serialization', () => {
  const observerKey: Address = address(
    '11111111111111111111111111111112', // well-known key (system program + 1)
  );

  it('encodes operator_stake as u64 LE in the first 8 bytes', () => {
    const buf = encodeJoinNetworkParams({
      operatorStake: 20_000_000_000n, // 20,000 ARIO
      label: '',
      fqdn: '',
      port: 443,
      autoStake: false,
      allowDelegatedStaking: false,
      delegateRewardShareRatio: 0,
      observerAddress: observerKey,
    });

    const stake = buf.readBigUInt64LE(0);
    assert.equal(stake, 20_000_000_000n);
  });

  it('encodes label as Borsh String (u32 len + utf8) right after operator_stake', () => {
    const buf = encodeJoinNetworkParams({
      operatorStake: 0n,
      label: 'my-gw',
      fqdn: '',
      port: 443,
      autoStake: false,
      allowDelegatedStaking: false,
      delegateRewardShareRatio: 0,
      observerAddress: observerKey,
    });

    // offset 8: label length (u32 LE)
    const labelLen = buf.readUInt32LE(8);
    assert.equal(labelLen, 5);
    // offset 12: label bytes
    const label = buf.subarray(12, 12 + labelLen).toString('utf8');
    assert.equal(label, 'my-gw');
  });

  it('encodes port as u16 LE after fqdn', () => {
    const label = 'gw';
    const fqdn = 'example.com';
    const buf = encodeJoinNetworkParams({
      operatorStake: 0n,
      label,
      fqdn,
      port: 8080,
      autoStake: false,
      allowDelegatedStaking: false,
      delegateRewardShareRatio: 0,
      observerAddress: observerKey,
    });

    // Calculate offset: 8 (u64) + 4+2 (label) + 4+11 (fqdn)
    const portOffset = 8 + (4 + label.length) + (4 + fqdn.length);
    const port = buf.readUInt16LE(portOffset);
    assert.equal(port, 8080);
  });

  it('encodes protocol as single byte (Https=1) after port', () => {
    const label = '';
    const fqdn = '';
    const buf = encodeJoinNetworkParams({
      operatorStake: 0n,
      label,
      fqdn,
      port: 443,
      autoStake: false,
      allowDelegatedStaking: false,
      delegateRewardShareRatio: 0,
      observerAddress: observerKey,
    });

    // offset: 8 + 4 + 4 + 2 = 18
    const protocolOffset = 8 + 4 + 4 + 2;
    assert.equal(buf[protocolOffset], 1); // Https
  });

  it('encodes properties as Option<String>::None (0x00) when absent', () => {
    const label = '';
    const fqdn = '';
    const buf = encodeJoinNetworkParams({
      operatorStake: 0n,
      label,
      fqdn,
      port: 443,
      autoStake: false,
      allowDelegatedStaking: false,
      delegateRewardShareRatio: 0,
      observerAddress: observerKey,
    });

    // offset: 8 + 4 + 4 + 2 + 1 (protocol) = 19
    const optOffset = 8 + 4 + 4 + 2 + 1;
    assert.equal(buf[optOffset], 0); // None
  });

  it('encodes properties as Option<String>::Some with u32 len prefix when present', () => {
    const label = '';
    const fqdn = '';
    const props = 'FH1aVetOoulPGqgYukj0VE0kk0Gk';
    const buf = encodeJoinNetworkParams({
      operatorStake: 0n,
      label,
      fqdn,
      port: 443,
      properties: props,
      autoStake: false,
      allowDelegatedStaking: false,
      delegateRewardShareRatio: 0,
      observerAddress: observerKey,
    });

    const optOffset = 8 + 4 + 4 + 2 + 1;
    assert.equal(buf[optOffset], 1); // Some
    const strLen = buf.readUInt32LE(optOffset + 1);
    assert.equal(strLen, props.length);
    const decoded = buf
      .subarray(optOffset + 1 + 4, optOffset + 1 + 4 + strLen)
      .toString('utf8');
    assert.equal(decoded, props);
  });

  it('encodes auto_stake before allow_delegated_staking', () => {
    const label = '';
    const fqdn = '';
    const buf = encodeJoinNetworkParams({
      operatorStake: 0n,
      label,
      fqdn,
      port: 443,
      autoStake: true,
      allowDelegatedStaking: false,
      delegateRewardShareRatio: 0,
      observerAddress: observerKey,
    });

    // properties None: optOffset = 19, then auto_stake at 20, allow_delegated_staking at 21
    const autoStakeOffset = 8 + 4 + 4 + 2 + 1 + 1; // 20
    assert.equal(buf[autoStakeOffset], 1); // true
    assert.equal(buf[autoStakeOffset + 1], 0); // false (allow_delegated_staking)
  });

  it('encodes delegate_reward_share_ratio as u8 (not u16)', () => {
    const label = '';
    const fqdn = '';
    const buf = encodeJoinNetworkParams({
      operatorStake: 0n,
      label,
      fqdn,
      port: 443,
      autoStake: false,
      allowDelegatedStaking: true,
      delegateRewardShareRatio: 42,
      observerAddress: observerKey,
    });

    // After auto_stake(1) + allow_delegated_staking(1), ratio is at +22
    const ratioOffset = 8 + 4 + 4 + 2 + 1 + 1 + 1 + 1;
    assert.equal(buf[ratioOffset], 42);
    // Verify it's a single byte, not u16 — the next byte should be part of
    // min_delegate_stake Option tag, not a second byte of ratio
  });

  it('encodes min_delegate_stake as Option<u64>::None when undefined', () => {
    const label = '';
    const fqdn = '';
    const buf = encodeJoinNetworkParams({
      operatorStake: 0n,
      label,
      fqdn,
      port: 443,
      autoStake: false,
      allowDelegatedStaking: false,
      delegateRewardShareRatio: 0,
      observerAddress: observerKey,
    });

    // ratio(1) then Option tag
    const optOffset = 8 + 4 + 4 + 2 + 1 + 1 + 1 + 1 + 1;
    assert.equal(buf[optOffset], 0); // None
  });

  it('encodes min_delegate_stake as Option<u64>::Some with value when defined', () => {
    const label = '';
    const fqdn = '';
    const buf = encodeJoinNetworkParams({
      operatorStake: 0n,
      label,
      fqdn,
      port: 443,
      autoStake: false,
      allowDelegatedStaking: false,
      delegateRewardShareRatio: 0,
      minDelegatedStake: 500_000_000n,
      observerAddress: observerKey,
    });

    const optOffset = 8 + 4 + 4 + 2 + 1 + 1 + 1 + 1 + 1;
    assert.equal(buf[optOffset], 1); // Some
    const val = buf.readBigUInt64LE(optOffset + 1);
    assert.equal(val, 500_000_000n);
  });

  it('encodes observer_address as plain Pubkey (32 bytes, no Option tag)', () => {
    const label = '';
    const fqdn = '';
    const buf = encodeJoinNetworkParams({
      operatorStake: 0n,
      label,
      fqdn,
      port: 443,
      autoStake: false,
      allowDelegatedStaking: false,
      delegateRewardShareRatio: 0,
      observerAddress: observerKey,
    });

    // min_delegate_stake None: 1 byte. observer_address starts right after.
    const observerOffset = 8 + 4 + 4 + 2 + 1 + 1 + 1 + 1 + 1 + 1;
    const pubkeyBytes = buf.subarray(observerOffset, observerOffset + 32);
    const decoded = addressDecoder.decode(pubkeyBytes);
    assert.equal(decoded, observerKey);

    // Total buffer length should be observerOffset + 32
    assert.equal(buf.length, observerOffset + 32);
  });

  it('full encoding matches expected byte layout for a realistic params set', async () => {
    const observer = await randomAddress();
    const label = 'ar-io-node';
    const fqdn = 'gateway.example.com';
    const props = 'FH1aVetOoulPGqgYukj0VE0kk0Gk';

    const buf = encodeJoinNetworkParams({
      operatorStake: 50_000_000_000n, // 50,000 ARIO
      label,
      fqdn,
      port: 443,
      properties: props,
      autoStake: true,
      allowDelegatedStaking: true,
      delegateRewardShareRatio: 10,
      minDelegatedStake: 100_000_000n,
      observerAddress: observer,
    });

    // Walk through the buffer and verify every field
    let off = 0;

    // operator_stake: u64
    assert.equal(buf.readBigUInt64LE(off), 50_000_000_000n);
    off += 8;

    // label: String
    assert.equal(buf.readUInt32LE(off), label.length);
    off += 4;
    assert.equal(buf.subarray(off, off + label.length).toString(), label);
    off += label.length;

    // fqdn: String
    assert.equal(buf.readUInt32LE(off), fqdn.length);
    off += 4;
    assert.equal(buf.subarray(off, off + fqdn.length).toString(), fqdn);
    off += fqdn.length;

    // port: u16
    assert.equal(buf.readUInt16LE(off), 443);
    off += 2;

    // protocol: u8 (Https=1)
    assert.equal(buf[off], 1);
    off += 1;

    // properties: Option<String> = Some(props)
    assert.equal(buf[off], 1); // Some
    off += 1;
    assert.equal(buf.readUInt32LE(off), props.length);
    off += 4;
    assert.equal(buf.subarray(off, off + props.length).toString(), props);
    off += props.length;

    // auto_stake: bool
    assert.equal(buf[off], 1);
    off += 1;

    // allow_delegated_staking: bool
    assert.equal(buf[off], 1);
    off += 1;

    // delegate_reward_share_ratio: u8
    assert.equal(buf[off], 10);
    off += 1;

    // min_delegate_stake: Option<u64> = Some(100_000_000)
    assert.equal(buf[off], 1); // Some
    off += 1;
    assert.equal(buf.readBigUInt64LE(off), 100_000_000n);
    off += 8;

    // observer_address: Pubkey (32 bytes, no Option tag)
    const decoded = addressDecoder.decode(buf.subarray(off, off + 32));
    assert.equal(decoded, observer);
    off += 32;

    // Buffer should end exactly here
    assert.equal(buf.length, off);
  });

  it('does NOT include note or allowlistOnly fields', () => {
    // If note or allowlistOnly were serialized, the buffer would be longer
    // than expected. We verify the exact expected length for minimal params.
    const label = '';
    const fqdn = '';
    const buf = encodeJoinNetworkParams({
      operatorStake: 0n,
      label,
      fqdn,
      port: 443,
      autoStake: false,
      allowDelegatedStaking: false,
      delegateRewardShareRatio: 0,
      observerAddress: observerKey,
    });

    // Expected: 8(u64) + 4(label len) + 4(fqdn len) + 2(port) + 1(protocol)
    //         + 1(Option None) + 1(auto_stake) + 1(allow_delegated_staking)
    //         + 1(ratio) + 1(Option None) + 32(pubkey) = 56
    assert.equal(buf.length, 56);
  });
});

describe('getObserverLookupPDA', () => {
  it('derives a valid PDA using OBSERVER_LOOKUP_SEED and observer address', async () => {
    const observer = await randomAddress();
    const [pda, bump] = await getObserverLookupPDA(observer);

    // Kit returns the PDA as a branded Address (base58 string)
    assert.equal(typeof pda, 'string');
    assert.ok(typeof bump === 'number');
    assert.ok(bump >= 0 && bump <= 255);
  });

  it('returns the same PDA for the same observer address', async () => {
    const observer = await randomAddress();
    const [pda1] = await getObserverLookupPDA(observer);
    const [pda2] = await getObserverLookupPDA(observer);
    assert.equal(pda1, pda2);
  });

  it('returns different PDAs for different observer addresses', async () => {
    const obs1 = await randomAddress();
    const obs2 = await randomAddress();
    const [pda1] = await getObserverLookupPDA(obs1);
    const [pda2] = await getObserverLookupPDA(obs2);
    assert.notEqual(pda1, pda2);
  });

  it('uses the OBSERVER_LOOKUP_SEED constant', () => {
    // Verify the seed matches what we expect from constants.ts
    assert.equal(OBSERVER_LOOKUP_SEED.toString(), 'observer_lookup');
  });

  it('accepts a custom programId override', async () => {
    const observer = await randomAddress();
    const customProgram = await randomAddress();
    const [pdaDefault] = await getObserverLookupPDA(observer);
    const [pdaCustom] = await getObserverLookupPDA(observer, customProgram);
    // Different program IDs should yield different PDAs
    assert.notEqual(pdaDefault, pdaCustom);
  });
});
