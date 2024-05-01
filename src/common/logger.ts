/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import bunyan from 'bunyan';

import { Logger } from '../types.js';
import { version } from '../version.js';

export class DefaultLogger implements Logger {
  private logger: bunyan.Logger;
  constructor({
    level = 'info',
  }: {
    level?: 'info' | 'debug' | 'error' | 'none' | undefined;
  } = {}) {
    this.logger = bunyan.createLogger({
      level,
      name: 'ar-io-sdk',
      version,
      serializers: bunyan.stdSerializers,
    });
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  info(message: string, ...args: any[]) {
    this.logger.info(...args, message);
  }

  warn(message: string, ...args: any[]) {
    this.logger.warn(...args, message);
  }

  error(message: string, ...args: any[]) {
    this.logger.error(...args, message);
  }

  debug(message: string, ...args: any[]) {
    this.logger.debug(...args, message);
  }

  setLogLevel(level: string) {
    this.logger.level = level;
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
