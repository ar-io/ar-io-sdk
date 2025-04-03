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
import { ArconnectSigner, SignatureConfig } from '@dha-team/arbundles';
import { AxiosInstance, RawAxiosRequestHeaders } from 'axios';
import { v4 } from 'uuid';

import {
  AoMessageResult,
  FundFromTurboSigner,
  TransactionId,
  WriteOptions,
} from '../types/common.js';
import { Intent } from '../types/io.js';
import { mARIOToken } from '../types/token.js';
import { pruneTags } from '../utils/arweave.js';
import { toB64Url } from '../utils/base64.js';
import { createAxiosInstance } from '../utils/http-client.js';
import { ILogger, Logger } from './logger.js';

export interface TurboConfig {
  // The URL of the Turbo payment service
  paymentUrl?: string;
  // The logger to use
  logger?: ILogger;
  // The HTTP client to use
  axios?: AxiosInstance;
  signer?: FundFromTurboSigner;
}

export type InitiateArNSPurchaseParams = {
  type?: string;
  years?: number;
  increaseQty?: number;
  name: string;
  intent: Intent;
  processId?: TransactionId;
};

export async function signedRequestHeadersFromSigner(
  signer: FundFromTurboSigner,
  nonce: string = v4(),
): Promise<RawAxiosRequestHeaders> {
  await (signer as ArconnectSigner).setPublicKey?.();
  const signature = await signer.sign(Uint8Array.from(Buffer.from(nonce)));

  let publicKey: string;
  switch (signer.signatureType) {
    case SignatureConfig.ARWEAVE:
      publicKey = toB64Url(signer.publicKey);
      break;
    case SignatureConfig.ETHEREUM:
      publicKey = '0x' + signer.publicKey.toString('hex');
      break;
    // TODO: solana sig support
    // case SignatureConfig.SOLANA:
    // case SignatureConfig.ED25519:
    default:
      throw new Error(
        `Unsupported signer type for signing requests: ${signer.signatureType}`,
      );
  }

  return {
    'x-public-key': publicKey,
    'x-nonce': nonce,
    'x-signature': toB64Url(Buffer.from(signature)),
    'x-signature-type': signer.signatureType,
  };
}

export type ArNSPurchaseReceipt = InitiateArNSPurchaseParams & {
  wincQty: string;
  mARIOQty: string;
  usdArRate: number;
  createdDate: string;
};

export type ArNSPurchaseResult = {
  arioWriteResult: AoMessageResult;
  purchaseReceipt: ArNSPurchaseReceipt;
};

export interface FundFromTurboInterface {
  getArNSPurchasePrice(params: InitiateArNSPurchaseParams): Promise<number>;
  initiateArNSPurchase(
    params: InitiateArNSPurchaseParams,
    options: WriteOptions,
  ): Promise<ArNSPurchaseResult>;
  getArNSPurchaseReceipt(intent: string): Promise<ArNSPurchaseReceipt>;
}

export class FundFromTurbo {
  private readonly paymentUrl: string;
  private readonly axios: AxiosInstance;
  private readonly logger: ILogger;
  private readonly signer?: FundFromTurboSigner;

  constructor({
    paymentUrl = 'https://payment.ardrive.io',
    axios = createAxiosInstance(),
    logger = Logger.default,
    signer,
  }: TurboConfig) {
    this.paymentUrl = paymentUrl;
    this.axios = axios;
    this.logger = logger;
    this.signer = signer;
  }

  public async getArNSPurchasePrice({
    intent,
    name,
    increaseQty,
    type,
    years,
  }: InitiateArNSPurchaseParams): Promise<{ winc: string; mARIO: mARIOToken }> {
    const url = new URL(`${this.paymentUrl}/v1/arns/price/${intent}/${name}`);
    if (increaseQty !== undefined) {
      url.searchParams.append('increaseQty', increaseQty.toString());
    }
    if (type !== undefined) {
      url.searchParams.append('type', type);
    }
    if (years !== undefined) {
      url.searchParams.append('years', years.toString());
    }
    const { data, status } = await this.axios.get<{
      winc: string;
      mARIO: string;
    }>(url.toString());

    this.logger.debug('getArNSPurchasePrice', {
      intent,
      name,
      increaseQty,
      type,
      years,
      data,
      status,
    });

    if (status !== 200) {
      throw new Error(
        'Failed to get ArNS purchase price' + JSON.stringify(data),
      );
    }
    if (!data.winc || !data.mARIO) {
      throw new Error('Invalid response from Turbo' + JSON.stringify(data));
    }

    return {
      winc: data.winc,
      mARIO: new mARIOToken(+data.mARIO),
    };
  }

  public async initiateArNSPurchase({
    intent,
    name,
    increaseQty,
    processId,
    type,
    years,
  }: InitiateArNSPurchaseParams): Promise<ArNSPurchaseResult> {
    if (!this.signer) {
      throw new Error(
        'Signer required for initiating ArNS purchase with Turbo',
      );
    }

    const nonce = v4();

    const path = new URL(
      `${this.paymentUrl}/v1/arns/purchase/${intent}/${name}`,
    );
    if (increaseQty !== undefined) {
      path.searchParams.append('increaseQty', increaseQty.toString());
    }
    if (processId !== undefined) {
      path.searchParams.append('processId', processId);
    }
    if (type !== undefined) {
      path.searchParams.append('type', type);
    }
    if (years !== undefined) {
      path.searchParams.append('years', years.toString());
    }
    const { data, status } = await this.axios.post<ArNSPurchaseResult>(
      path.toString(),
      '',
      {
        headers: {
          ...((await signedRequestHeadersFromSigner(
            this.signer,
            nonce,
          )) as RawAxiosRequestHeaders),
        },
      },
    );

    this.logger.debug('Initiated ArNS purchase', {
      intent,
      name,
      increaseQty,
      processId,
      type,
      years,
      data,
      status,
      nonce,
    });

    if (status !== 200) {
      throw new Error(
        'Failed to initiate ArNS purchase' + JSON.stringify(data),
      );
    }

    return data;
  }
}
