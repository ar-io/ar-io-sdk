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
import { JSONValue } from '../../types/common.js';
import { Logger } from '../logger.js';

export type HBConfig = {
  url: string;
  processId: string;
  logger?: Logger;
};

export interface Hyperbeam {
  meta(): Promise<JSONValue>;
  now<T extends JSONValue>({
    path,
    json,
  }: {
    path: string;
    json?: boolean;
  }): Promise<T>;
  compute<T extends JSONValue>({
    path,
    json,
  }: {
    path: string;
    json?: boolean;
  }): Promise<T>;
  checkHyperBeamCompatibility(): Promise<boolean>;
}

export class HB implements Hyperbeam {
  readonly url: string;
  readonly processId: string;

  protected isHyperBeamCompatible: boolean | undefined;

  protected checkHyperBeamPromise: Promise<boolean> | undefined;
  private logger: Logger;

  constructor(config: HBConfig) {
    this.url = config.url;
    this.processId = config.processId;
    this.logger = config.logger ?? Logger.default;

    this.isHyperBeamCompatible = undefined;
    this.checkHyperBeamPromise = this.checkHyperBeamCompatibility();
  }

  async meta(): Promise<JSONValue> {
    const url = new URL(`${this.url}/${this.processId}~process@1.0/meta`);
    url.searchParams.set('require-codec', 'application/json');
    url.searchParams.set('accept-bundle', 'true');
    const res = await fetch(url);
    return res.json() as Promise<JSONValue>;
  }

  /**
   * calls the process device /now function, which evaluates the current process state pulling new messages
   * to get the latest state
   *
   * @param path - The path to the hb state
   * @param json - Whether to return the result as JSON, defaults to true
   * @returns The result of the compute operation
   *
   * @example
   * const hyperbeam = new Hyperbeam({ url: 'https://hyperbeam.ario.permaweb.services', processId: 'qNvAoz0TgcH7DMg8BCVn8jF32QH5L6T29VjHxhHqqGE' });
   * const result = await hyperbeam.now({ path: 'balances/QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ' });
   * console.log(result);
   */
  async now<T extends JSONValue>({
    path,
    json = true,
  }: {
    path: string;
    json?: boolean;
  }): Promise<T> {
    // json ?require-codec=application/json&accept-bundle=true
    const url = new URL(
      `${this.url}/${this.processId}~process@1.0/now/${path}`,
    );
    if (json) {
      url.searchParams.set('require-codec', 'application/json');
      url.searchParams.set('accept-bundle', 'true');
    }

    const res = await fetch(url);
    return res.json() as Promise<T>;
  }

  /**
   * calls the process device /compute function, which uses the currently evaluated state in the node
   *
   * @param path - The path to the compute resource
   * @param json - Whether to return the result as JSON, defaults to true
   * @returns The result of the compute operation
   *
   * @example
   * const hyperbeam = new Hyperbeam({ url: 'https://hyperbeam.ario.permaweb.services', processId: 'qNvAoz0TgcH7DMg8BCVn8jF32QH5L6T29VjHxhHqqGE' });
   * const result = await hyperbeam.compute({ path: 'balances/QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ' });
   * console.log(result);
   */
  async compute<T extends JSONValue>({
    path,
    json = true,
  }: {
    path: string;
    json?: boolean;
  }): Promise<T> {
    const url = new URL(
      `${this.url}/${this.processId}~process@1.0/compute/${path}`,
    );
    if (json) {
      url.searchParams.set('require-codec', 'application/json');
      url.searchParams.set('accept-bundle', 'true');
    }
    const res = await fetch(url);
    return res.json() as Promise<T>;
  }

  /**
   * Checks if the process is HyperBeam compatible and caches the result.
   *
   * @returns {Promise<boolean>} True if the process is HyperBeam compatible, false otherwise.
   */
  async checkHyperBeamCompatibility(): Promise<boolean> {
    if (this.checkHyperBeamPromise !== undefined) {
      return this.checkHyperBeamPromise;
    }
    if (this.isHyperBeamCompatible !== undefined) {
      return Promise.resolve(this.isHyperBeamCompatible);
    }

    const result = fetch(
      // use /now to force a refresh of the cache state, then compute when calling it for keys
      `${this.url.toString()}${this.processId}~process@1.0/now`,
      {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      },
    )
      .then((res) => {
        if (res.ok) {
          this.isHyperBeamCompatible = true;
          return true;
        }
        this.isHyperBeamCompatible = false;
        return false;
      })
      .catch((error) => {
        this.logger.debug('Failed to check HyperBeam compatibility', {
          cause: error,
        });
        this.isHyperBeamCompatible = false;
        return false;
      });

    this.checkHyperBeamPromise = result;

    return result;
  }
}
