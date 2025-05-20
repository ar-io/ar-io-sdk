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

export class RoundRobinRoutingStrategy implements RoutingStrategy {
  private gateways: URL[];
  private currentIndex: number;

  constructor({ gateways }: { gateways: URL[] }) {
    this.gateways = gateways;
    this.currentIndex = 0;
  }

  // ignore the provided gateways list and use the internal list
  async selectGateway({
    // - we want to ignore the provided gateways list
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    gateways,
  }: {
    gateways?: URL[];
  } = {}): Promise<URL> {
    const gateway = this.gateways[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.gateways.length;
    return gateway;
  }
}
