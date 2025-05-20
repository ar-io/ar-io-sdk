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
import { RoutingStrategy } from '../../../../types/wayfinder.js';

export class StaticRoutingStrategy implements RoutingStrategy {
  public readonly name = 'static';
  private gateway: URL;

  constructor({ gateway }: { gateway: string }) {
    try {
      this.gateway = new URL(gateway);
    } catch (error) {
      throw new Error(`Invalid URL provided for static gateway: ${gateway}`);
    }
  }

  async selectGateway({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    gateways,
  }: {
    gateways?: URL[];
  } = {}): Promise<URL> {
    return this.gateway;
  }
}
