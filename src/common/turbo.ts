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
import { v4 as uuidv4 } from 'uuid';

import {
  AoMessageResult,
  TransactionId,
  TurboArNSSigner,
  WriteOptions,
} from '../types/common.js';
import { AoTokenCostParams } from '../types/io.js';
import { mARIOToken } from '../types/token.js';
import { toB64Url } from '../utils/base64.js';
import { createAxiosInstance } from '../utils/http-client.js';
import { urlWithSearchParams } from '../utils/url.js';
import { ILogger, Logger } from './logger.js';

export interface TurboConfig {
  // The URL of the Turbo payment service
  paymentUrl?: string;
  // The logger to use
  logger?: ILogger;
  // The HTTP client to use
  axios?: AxiosInstance;
  signer?: TurboArNSSigner;
}

export async function signedRequestHeadersFromSigner({
  signer,
  nonce = uuidv4(),
}: {
  signer: TurboArNSSigner;
  nonce?: string;
}): Promise<RawAxiosRequestHeaders> {
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

export type ArNSPurchaseReceipt = AoTokenCostParams & {
  wincQty: string;
  mARIOQty: string;
  usdArRate: number;
  createdDate: string;
};

export interface ArNSPaymentProvider {
  // TODO: have this return just the number, for generic payment providers
  /** Returns the cost of the action in the Payment Provider's native currency (winc for Turbo) */
  getPrice(params: AoTokenCostParams): Promise<number>;
  getArNSPriceDetails(params: AoTokenCostParams): Promise<{
    winc: string;
    mARIO: mARIOToken;
  }>;
  initiateArNSPurchase(
    params: AoTokenCostParams & { processId?: TransactionId },
    options: WriteOptions,
  ): Promise<AoMessageResult<ArNSPurchaseReceipt>>;
}

export class TurboArNSPaymentProvider implements ArNSPaymentProvider {
  private readonly paymentUrl: string;
  private readonly axios: AxiosInstance;
  private readonly logger: ILogger;
  private readonly signer?: TurboArNSSigner;

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

  public async getArNSPriceDetails({
    intent,
    name,
    quantity,
    type,
    years,
  }: AoTokenCostParams): Promise<{ winc: string; mARIO: mARIOToken }> {
    const url = urlWithSearchParams({
      baseUrl: `${this.paymentUrl}/v1/arns/price/${intent}/${name}`,
      params: {
        increaseQty: quantity,
        type,
        years,
      },
    });

    const { data, status } = await this.axios.get<{
      winc: string;
      mARIO: string;
    }>(url);

    this.logger.debug('getArNSPriceDetails', {
      intent,
      name,
      quantity,
      type,
      years,
      data,
      status,
    });

    if (status !== 200) {
      throw new Error(
        'Failed to get ArNS purchase price ' + JSON.stringify(data),
      );
    }
    if (!data.winc || !data.mARIO) {
      throw new Error('Invalid response from Turbo ' + JSON.stringify(data));
    }

    return {
      winc: data.winc,
      mARIO: new mARIOToken(+data.mARIO),
    };
  }

  public async getPrice(params: AoTokenCostParams): Promise<number> {
    const { winc } = await this.getArNSPriceDetails(params);
    return +winc;
  }

  public async initiateArNSPurchase({
    intent,
    name,
    quantity,
    type,
    processId,
    years,
  }: AoTokenCostParams & {
    processId?: TransactionId;
  }): Promise<AoMessageResult<ArNSPurchaseReceipt>> {
    if (!this.signer) {
      throw new Error(
        'Signer required for initiating ArNS purchase with Turbo',
      );
    }

    const url = urlWithSearchParams({
      baseUrl: `${this.paymentUrl}/v1/arns/purchase/${intent}/${name}`,
      params: {
        increaseQty: quantity,
        processId,
        type,
        years,
      },
    });

    const headers = await signedRequestHeadersFromSigner({
      signer: this.signer,
    });

    const { data, status } = await this.axios.post<{
      arioWriteResult: AoMessageResult;
      purchaseReceipt: ArNSPurchaseReceipt;
    }>(url, null, {
      headers,
    });

    this.logger.debug('Initiated ArNS purchase', {
      intent,
      name,
      quantity,
      processId,
      type,
      years,
      data,
      status,
    });

    if (status !== 200) {
      throw new Error(
        'Failed to initiate ArNS purchase ' + JSON.stringify(data),
      );
    }

    return {
      id: data.arioWriteResult.id,
      result: data.purchaseReceipt,
    };
  }
}
