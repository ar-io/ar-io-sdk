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
import { AoARIORead, AoARIOWrite } from './io.js';

export type ARIOWithFaucet<T extends AoARIORead | AoARIOWrite> = T & {
  faucet: TokenFaucet;
};
export interface TokenFaucet {
  /**
   * Claim tokens for a process using a captcha response. This method is used to synchronously claim tokens for a process using a captcha response.
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
   * Returns the captcha URL for a process. The captcha is used to verify a human is solving the captcha. Once you have a captcha response, you can use it to request an authorization token via the requestAuthToken method.
   * @returns The captcha URL for a process
   */
  captchaUrl(): Promise<{
    processId: string;
    captchaUrl: string;
  }>;

  /**
   * Requests an authorization token for a process. The captcha response is used to verify a human is solving the captcha. Once you have an authorization token, you can use it to claim tokens from the faucet via the claimWithAuthToken method.
   * @param captchaResponse - The captcha response
   * @returns The status of the request, the authorization token, and the expiration time
   */
  requestAuthToken({ captchaResponse }: { captchaResponse: string }): Promise<{
    status: 'success' | 'error';
    token: string;
    expiresAt: number;
  }>;

  /**
   * Transfers tokens from the faucet wallet to a recipient address using an authorization token. To request an authorization token, solve the captcha from the captchaUrl method.
   * @param authToken - The authorization token
   * @param recipient - The recipient address
   * @param quantity - The quantity of tokens to claim
   * @returns The message id of the transfer and success status
   */
  claimWithAuthToken({
    authToken,
    recipient,
    quantity,
  }: {
    authToken: string;
    recipient: string;
    quantity: number;
  }): Promise<{ id: string; success: boolean }>;

  /**
   * Verifies an authorization token is valid.
   * @param authToken - The authorization token
   * @returns The validity of the authorization token and the expiration time
   */
  verifyAuthToken({ authToken }: { authToken: string }): Promise<{
    valid: boolean;
    expiresAt: number;
  }>;
}
