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
import { ARIOWithFaucet, TokenFaucet } from '../types/faucet.js';
import { ARIOReadable, ARIOWriteable } from './io.js';

/**
 * Creates a proxy object that implements the TokenFaucet interface. It wraps the ARIOReadable instance and adds methods for claiming tokens from the faucet API.
 * @param arioInstance - The ARIOReadable instance
 * @param faucetApiUrl - The URL of the faucet API
 * @returns A proxy object that implements the TokenFaucet interface
 */
export function createFaucet(
  arioInstance: ARIOReadable | ARIOWriteable,
  faucetApiUrl: string,
): ARIOWithFaucet<ARIOReadable | ARIOWriteable> {
  const faucet = new ARIOTokenFaucet({
    faucetUrl: faucetApiUrl,
    processId: arioInstance.process.processId,
  });

  const proxy = new Proxy(arioInstance, {
    get(target, prop) {
      if (prop === 'faucet') {
        return faucet;
      }
      if (prop in target) {
        const result = target[prop as keyof typeof target];
        if (typeof result === 'function') {
          return result.bind(target);
        }
        return result;
      }
      return undefined;
    },
  });
  return proxy as ARIOWithFaucet<ARIOReadable | ARIOWriteable>;
}

export class ARIOTokenFaucet implements TokenFaucet {
  private faucetUrl: string;
  private processId: string;

  constructor({
    faucetUrl,
    processId,
  }: {
    faucetUrl: string;
    processId: string;
  }) {
    this.faucetUrl = faucetUrl;
    this.processId = processId;
  }

  /**
   * Returns the captcha URL for a process. The captcha is used to verify a human is solving the captcha. Once you have a captcha response, you can use it to request an authorization token via the requestAuthToken method.
   * @returns The captcha URL for a process
   */
  async captchaUrl(): Promise<{
    processId: string;
    captchaUrl: string;
  }> {
    const res = await fetch(
      `${this.faucetUrl}/api/captcha/url?process-id=${this.processId}`,
      {
        method: 'GET',
      },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((body as { error: string }).error);
    }
    const data = (await res.json()) as {
      processId: string;
      captchaUrl: string;
    };
    return data;
  }

  /**
   * Claim tokens for a process using a captcha response. This method is used to synchronously claim tokens for a process using a captcha response.
   * @param captchaResponse - The captcha response
   * @param recipient - The recipient address
   * @param quantity - The quantity of tokens to claim
   * @returns The claim id and success status
   */
  async claimWithCaptchaResponse({
    captchaResponse,
    recipient,
    quantity,
  }: {
    captchaResponse: string;
    recipient: string;
    quantity: number;
  }): Promise<{ id: string; success: boolean }> {
    const res = await fetch(`${this.faucetUrl}/api/claim/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        processId: this.processId,
        recipient,
        quantity,
        captchaResponse,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((body as { error: string }).error);
    }

    const data = (await res.json()) as { id: string; success: boolean };
    return data;
  }

  /**
   * Requests an authorization token for a process. The captcha response is used to verify a human is solving the captcha. Once you have an authorization token, you can use it to claim tokens from the faucet via the claimWithAuthToken method.
   * @param captchaResponse - The captcha response
   * @returns The status of the request, the authorization token, and the expiration time
   */
  async requestAuthToken({
    captchaResponse,
  }: {
    captchaResponse: string;
  }): Promise<{
    status: 'success' | 'error';
    token: string;
    expiresAt: number;
  }> {
    const res = await fetch(`${this.faucetUrl}/api/captcha/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        processId: this.processId,
        captchaResponse,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((body as { error: string }).error);
    }
    const data = (await res.json()) as {
      status: 'success' | 'error';
      token: string;
      expiresAt: number;
    };
    return data;
  }

  /**
   * Transfers tokens from the faucet wallet to a recipient address using an authorization token. To request an authorization token, solve the captcha from the captchaUrl method.
   * @param authToken - The authorization token
   * @param recipient - The recipient address
   * @param quantity - The quantity of tokens to claim
   * @returns The message id of the transfer and success status
   */
  async claimWithAuthToken({
    authToken,
    recipient,
    quantity,
  }: {
    authToken: string;
    recipient: string;
    quantity: number;
  }): Promise<{ id: string; success: boolean }> {
    const res = await fetch(`${this.faucetUrl}/api/claim/async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        recipient,
        qty: quantity,
        processId: this.processId,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((body as { error: string }).error);
    }

    const data = (await res.json()) as { id: string; success: boolean };
    return data;
  }

  /**
   * Verifies an authorization token is valid.
   * @param authToken - The authorization token
   * @returns The validity of the authorization token and the expiration time
   */
  async verifyAuthToken({ authToken }: { authToken: string }): Promise<{
    valid: boolean;
    expiresAt: number;
  }> {
    const res = await fetch(
      `${this.faucetUrl}/api/token/verify?processId=${this.processId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((body as { error: string }).error);
    }
    const data = (await res.json()) as { valid: boolean; expiresAt: number };
    return data;
  }
}
