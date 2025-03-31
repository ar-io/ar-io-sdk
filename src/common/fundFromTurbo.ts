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
import {
  ArconnectSigner,
  ArweaveSigner,
  EthereumSigner,
  InjectedEthereumSigner,
  Signer,
  stringToBuffer,
} from '@dha-team/arbundles';
import { AxiosInstance, RawAxiosRequestHeaders } from 'axios';
import { randomBytes } from 'crypto';

import {
  AoMessageResult,
  TransactionId,
  WriteOptions,
} from '../types/common.js';
import { pruneTags } from '../utils/arweave.js';
import { toB64Url } from '../utils/base64.js';
import { createAxiosInstance } from '../utils/http-client.js';
import { ILogger, Logger } from './logger.js';

export interface TurboConfig {
  // The URL of the Turbo upload service
  uploadUrl?: string;
  // The URL of the Turbo payment service
  paymentUrl?: string;
  // The logger to use
  logger?: ILogger;
  // The HTTP client to use
  axios?: AxiosInstance;
  signer: Signer;
}

export type InitiateArNSPurchaseParams = {
  type?: string;
  years?: number;
  increaseQty?: number;
  name: string;
  intent: string;
  processId?: TransactionId;
};

export async function signedRequestHeadersFromSigner(
  signer: Signer,
  nonce: string = randomBytes(32).toString('hex'),
): Promise<RawAxiosRequestHeaders> {
  const signature = await signer.sign(stringToBuffer(nonce));

  let publicKey: string;
  if (signer instanceof EthereumSigner) {
    console.log('EthereumSigner', signer);
    publicKey = signer.publicKey.toString('hex');
  } else if (signer instanceof ArweaveSigner) {
    publicKey = toB64Url(signer.publicKey);
  } else if (signer instanceof ArconnectSigner) {
    await signer.setPublicKey();
    publicKey = toB64Url(signer.publicKey);
  } else if (signer instanceof InjectedEthereumSigner) {
    await signer.setPublicKey();
    publicKey = signer.publicKey.toString('hex');
  } else {
    throw new Error('Unsupported signer type for signing requests');
  }
  console.log('publicKey', publicKey);

  return {
    'x-public-key': publicKey,
    'x-nonce': nonce,
    'x-signature': toB64Url(Buffer.from(signature)),
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
  private readonly uploadUrl: string;
  private readonly axios: AxiosInstance;
  private readonly logger: ILogger;
  private readonly signer: Signer;

  constructor({
    paymentUrl = 'http://localhost:3000',
    uploadUrl = 'http://localhost:3000',
    axios = createAxiosInstance(),
    logger = Logger.default,
    signer,
  }: TurboConfig) {
    this.paymentUrl = paymentUrl;
    this.uploadUrl = uploadUrl;
    this.axios = axios;
    this.logger = logger;
    this.signer = signer;

    console.log(this.uploadUrl);
  }

  public async getArNSPurchasePrice(
    params: InitiateArNSPurchaseParams,
  ): Promise<number> {
    const { data } = await this.axios.post<{ price: number }>(
      `${this.paymentUrl}/price`,
      params,
    );
    return data.price;
  }

  public async initiateArNSPurchase(
    {
      intent,
      name,
      increaseQty,
      processId,
      type,
      years,
    }: InitiateArNSPurchaseParams,
    options?: WriteOptions,
  ): Promise<ArNSPurchaseResult> {
    const tags = [
      { name: 'Turbo-ArNS-Purchase-Intent', value: intent },
      { name: 'Name', value: name },
      { name: 'Quantity', value: increaseQty?.toString() },
      { name: 'Type', value: type },
      { name: 'Years', value: years?.toString() },
      { name: 'Process-Id', value: processId },
    ];
    const prunedTags = pruneTags(tags);
    const nonce = randomBytes(32).toString('hex');

    if (options && options.tags) {
      options.tags.forEach((tag) => {
        prunedTags.push(tag);
      });
    }

    const path = new URL(
      `${this.paymentUrl}/v1/initiate-arns-purchase/${intent}/${name}`,
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
    const { data, status } = await this.axios.get<ArNSPurchaseResult>(
      path.toString(),
      {
        headers: {
          ...((await signedRequestHeadersFromSigner(
            this.signer,
            nonce,
          )) as RawAxiosRequestHeaders),
        },
      },
    );

    console.log('status', status);
    console.log('data', data);

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
      throw new Error('Failed to initiate ArNS purchase');
    }

    return data;
  }
}
