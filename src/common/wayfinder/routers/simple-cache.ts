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
import { WayfinderRouter } from '../../../types/wayfinder.js';

export class SimpleCacheRouter implements WayfinderRouter {
  public readonly name: 'simple-cache';
  private lastUpdatedTimestamp: number;
  private ttlSeconds: number;
  private targetGateway: URL;
  private router: WayfinderRouter;
  constructor({
    router,
    ttlSeconds = 5 * 60, // 5 minutes
  }: {
    router: WayfinderRouter;
    ttlSeconds?: number;
  }) {
    this.router = router;
    this.ttlSeconds = ttlSeconds;
  }

  async getTargetGateway(): Promise<URL> {
    if (
      this.targetGateway === undefined ||
      this.lastUpdatedTimestamp + this.ttlSeconds * 1000 < Date.now()
    ) {
      this.targetGateway = await this.router.getTargetGateway();
      this.lastUpdatedTimestamp = Date.now();
    }
    return this.targetGateway;
  }
}

// TODO: a router that accepts ario and a router, and adds read through promise cache to ario.getGateways to avoid calling the ARIO contract on every request
