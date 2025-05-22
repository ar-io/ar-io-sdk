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
  SignatureConfig,
  Signer,
} from '@dha-team/arbundles';
import { AxiosInstance, RawAxiosRequestHeaders } from 'axios';
import { v4 as uuidv4 } from 'uuid';

import {
  AoMessageResult,
  TransactionId,
  TurboArNSSigner,
} from '../types/common.js';
import { AoTokenCostParams } from '../types/io.js';
import { mARIOToken } from '../types/token.js';
import { toB64Url } from '../utils/base64.js';
import { createAxiosInstance } from '../utils/http-client.js';
import { urlWithSearchParams } from '../utils/url.js';
import { ILogger, Logger } from './logger.js';

// Define separate config interfaces
export interface TurboUnauthenticatedConfig {
  // The URL of the Turbo payment service
  paymentUrl?: string;
  // The logger to use
  logger?: ILogger;
  // The HTTP client to use
  axios?: AxiosInstance;
}

export interface TurboAuthenticatedConfig extends TurboUnauthenticatedConfig {
  // The signer required for authenticated operations
  signer: TurboArNSSigner;
}

export async function signedRequestHeadersFromSigner({
  signer,
  nonce = uuidv4(),
}: {
  signer: TurboArNSSigner;
  nonce?: string;
}): Promise<RawAxiosRequestHeaders> {
  let signature: string | undefined = undefined;
  let publicKey: string | undefined = undefined;

  const signatureType = isWanderArweaveBrowserSigner(signer)
    ? SignatureConfig.ARWEAVE
    : (signer as Signer).signatureType;

  // equivalent to window.arweaveWallet
  if (isWanderArweaveBrowserSigner(signer)) {
    signature = toB64Url(
      Buffer.from(
        await signer.signMessage(Uint8Array.from(Buffer.from(nonce))),
      ),
    );
  } else if (signer instanceof ArconnectSigner) {
    signature = toB64Url(
      Buffer.from(
        await signer['signer'].signMessage(Uint8Array.from(Buffer.from(nonce))),
      ),
    );
  } else if (
    signer instanceof ArweaveSigner ||
    signer instanceof EthereumSigner ||
    signer instanceof InjectedEthereumSigner
  ) {
    if ('setPublicKey' in signer && signer['publicKey'] === undefined) {
      await signer.setPublicKey();
    }
    signature = toB64Url(
      Buffer.from(await signer.sign(Uint8Array.from(Buffer.from(nonce)))),
    );
  }

  switch (signatureType) {
    case SignatureConfig.ARWEAVE:
      if (isWanderArweaveBrowserSigner(signer)) {
        publicKey = await signer.getActivePublicKey();
      } else if ('setPublicKey' in signer) {
        await signer.setPublicKey();
        publicKey = toB64Url(signer.publicKey);
      }
      break;
    case SignatureConfig.ETHEREUM:
      if ('publicKey' in signer) {
        publicKey = '0x' + signer.publicKey.toString('hex');
      } else {
        throw new Error('Public key not found');
      }
      break;
    // TODO: solana sig support
    // case SignatureConfig.SOLANA:
    // case SignatureConfig.ED25519:
    default:
      throw new Error(
        `Unsupported signer type for signing requests: ${signatureType}`,
      );
  }

  if (publicKey === undefined || signature === undefined) {
    throw new Error('Public key or signature not found');
  }
  return {
    'x-public-key': publicKey,
    'x-nonce': nonce,
    'x-signature': signature,
    'x-signature-type': signatureType.toString(),
  };
}

export type ArNSPurchaseReceipt = AoTokenCostParams & {
  wincQty: string;
  mARIOQty: string;
  usdArRate: number;
  createdDate: string;
};

// Define separate provider interfaces
export interface ArNSPaymentProvider {
  // TODO: have this return just the number, for generic payment providers
  /** Returns the cost of the action in the Payment Provider's native currency (winc for Turbo) */
  getPrice(params: AoTokenCostParams): Promise<number>;
  getArNSPriceDetails(params: AoTokenCostParams): Promise<{
    winc: string;
    mARIO: mARIOToken;
  }>;
}

export interface TurboInitiateArNSPurchaseParams extends AoTokenCostParams {
  processId?: TransactionId;
  paidBy?: string | string[];
}

export interface ArNSAuthenticatedPaymentProvider extends ArNSPaymentProvider {
  initiateArNSPurchase(
    params: TurboInitiateArNSPurchaseParams,
  ): Promise<AoMessageResult<ArNSPurchaseReceipt>>;
}

export class TurboArNSPaymentFactory {
  static init(): TurboArNSPaymentProviderUnauthenticated;
  // Overload: without signer, will return unauthenticated provider
  static init({
    paymentUrl,
    axios,
    logger,
  }: TurboUnauthenticatedConfig & {
    signer?: TurboArNSSigner;
  }): TurboArNSPaymentProviderUnauthenticated;
  // Overload: with signer, will return authenticated provider
  static init({
    signer,
    paymentUrl,
    axios,
    logger,
  }: TurboAuthenticatedConfig): TurboArNSPaymentProviderAuthenticated;
  static init(
    config?:
      | TurboAuthenticatedConfig
      | (TurboUnauthenticatedConfig & { signer?: TurboArNSSigner }),
  ):
    | TurboArNSPaymentProviderAuthenticated
    | TurboArNSPaymentProviderUnauthenticated {
    const { signer, paymentUrl, axios, logger } = config ?? {};
    if (signer !== undefined) {
      return new TurboArNSPaymentProviderAuthenticated({
        signer,
        paymentUrl,
        axios,
        logger,
      });
    }
    return new TurboArNSPaymentProviderUnauthenticated({
      paymentUrl,
      axios,
      logger,
    });
  }
}

// Base class for unauthenticated operations
export class TurboArNSPaymentProviderUnauthenticated
  implements ArNSPaymentProvider
{
  protected readonly paymentUrl: string;
  protected readonly axios: AxiosInstance;
  protected readonly logger: ILogger;

  constructor({
    paymentUrl = 'https://payment.ardrive.io',
    axios = createAxiosInstance(),
    logger = Logger.default,
  }: TurboUnauthenticatedConfig) {
    this.paymentUrl = paymentUrl;
    this.axios = axios;
    this.logger = logger;
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
}

// Class for authenticated operations, extending the base class
export class TurboArNSPaymentProviderAuthenticated
  extends TurboArNSPaymentProviderUnauthenticated
  implements ArNSAuthenticatedPaymentProvider
{
  private readonly signer: TurboArNSSigner;

  constructor({ signer, ...restConfig }: TurboAuthenticatedConfig) {
    super(restConfig); // Pass unauthenticated config to base class+
    if (!isTurboArNSSigner(signer)) {
      throw new Error('Signer must be a TurboArNSSigner');
    }
    this.signer = signer;
  }

  public async initiateArNSPurchase({
    intent,
    name,
    quantity,
    type,
    processId,
    years,
    paidBy = [],
  }: TurboInitiateArNSPurchaseParams): Promise<
    AoMessageResult<ArNSPurchaseReceipt>
  > {
    // Signer check is implicitly handled by requiring it in the constructor
    const url = urlWithSearchParams({
      baseUrl: `${this.paymentUrl}/v1/arns/purchase/${intent}/${name}`,
      params: {
        increaseQty: quantity,
        processId,
        type,
        years,
        paidBy,
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

type WanderWallet = {
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  getActivePublicKey: () => Promise<string>;
};

function isWanderArweaveBrowserSigner(signer: unknown): signer is WanderWallet {
  return (
    typeof signer === 'object' &&
    signer !== null &&
    'signMessage' in signer &&
    'getActivePublicKey' in signer
  );
}

export function isTurboArNSSigner(signer: unknown): signer is TurboArNSSigner {
  const isWanderWallet = isWanderArweaveBrowserSigner(signer);
  const isSigner =
    signer instanceof EthereumSigner ||
    signer instanceof InjectedEthereumSigner ||
    signer instanceof ArweaveSigner ||
    signer instanceof ArconnectSigner;
  return isWanderWallet || isSigner;
}
