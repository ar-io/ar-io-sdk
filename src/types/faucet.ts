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
export type JsonWebToken = {
  processId: string;
  iat: number;
  exp: number;
  nonce: string;
};

export type TokenFaucet<T = Record<string, never>> = T & {
  faucet: {
    /**
     * Claim tokens for a process using a captcha response
     * @param captchaResponse - The captcha response
     * @param recipient - The recipient address
     * @param quantity - The quantity of tokens to claim
     * @returns The claim id and success status
     */
    claimWithCaptchaResponse({
      captchaResponse,
      recipient,
      quantity,
    }: {
      captchaResponse: string;
      recipient: string;
      quantity: number;
    }): Promise<{ id: string; success: boolean }>;

    /**
     * Returns the captcha URL for a process, which once solved, can be used to claim tokens
     * @returns The captcha URL for a process
     */
    captchaUrl(): Promise<{
      processId: string;
      captchaUrl: string;
    }>;

    /**
     * Claims tokens for a process using an auth token
     * @param authToken - The auth token
     * @param recipient - The recipient address
     */
    requestAuthToken({
      captchaResponse,
    }: {
      captchaResponse: string;
    }): Promise<{
      status: 'success' | 'error';
      token: string;
      expiresAt: number;
    }>;

    claimWithAuthToken({
      authToken,
      recipient,
      quantity,
    }: {
      authToken: string;
      recipient: string;
      quantity: number;
    }): Promise<{ id: string; success: boolean }>;
    verifyAuthToken(authToken: JsonWebToken): Promise<{
      valid: boolean;
    }>;
  };
};
