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
import { JsonWebToken, TokenFaucet } from '../types/faucet.js';
import { ARIOReadable } from './io.js';

export function createFaucet<T extends ARIOReadable>(
  arioInstance: T,
  faucetApiUrl: string,
): TokenFaucet<T> {
  const faucetMethods = {
    async captchaUrl(): Promise<{
      processId: string;
      captchaUrl: string;
    }> {
      return {
        processId: arioInstance.process.processId,
        captchaUrl: `${faucetApiUrl}/captcha?process-id=${arioInstance.process.processId}`,
      };
    },

    async claimWithCaptchaResponse({
      captchaResponse,
      recipient,
      quantity,
    }: {
      captchaResponse: string;
      recipient: string;
      quantity: number;
    }): Promise<{ id: string; success: boolean }> {
      const res = await fetch(`${faucetApiUrl}/api/claim/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processId: arioInstance.process.processId,
          recipient,
          quantity,
          captchaResponse,
        }),
      });
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return await res.json();
    },

    async requestAuthToken({
      captchaResponse,
    }: {
      captchaResponse: string;
    }): Promise<{
      status: 'success' | 'error';
      token: string;
      expiresAt: number;
    }> {
      const res = await fetch(`${faucetApiUrl}/api/captcha/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processId: arioInstance.process.processId,
          captchaResponse,
        }),
      });
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return data;
    },

    async claimWithAuthToken({
      authToken,
      recipient,
      quantity,
    }: {
      authToken: string;
      recipient: string;
      quantity: number;
    }): Promise<{ id: string; success: boolean }> {
      const res = await fetch(`${faucetApiUrl}/api/claim/async`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          recipient,
          qty: quantity,
          processId: arioInstance.process.processId,
        }),
      });
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return await res.json();
    },

    async verifyCaptchaResponse({
      captchaResponse,
    }: {
      captchaResponse: string;
    }): Promise<{
      processId: string;
      token: string;
      expiresAt: number;
    }> {
      const res = await fetch(`${faucetApiUrl}/api/captcha/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captchaResponse,
          processId: arioInstance.process.processId,
        }),
      });
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return await res.json();
    },

    async verifyAuthToken(authToken: JsonWebToken): Promise<{
      valid: boolean;
    }> {
      const res = await fetch(`${faucetApiUrl}/api/token/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return await res.json();
    },
  };

  // Initialize proxy target with faucet property to avoid read-only error
  const proxy = new Proxy({} as TokenFaucet<T>, {
    get(_, prop) {
      if (prop === 'faucet') {
        return faucetMethods;
      }
      if (prop in process) {
        return (process as any)[prop];
      }
      return undefined;
    },
  });

  return proxy;
}
