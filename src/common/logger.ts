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
import { Logger, createLogger, format, transports } from 'winston';

import { Logger as ILogger } from '../types.js';
import { version } from '../version.js';

export class DefaultLogger implements ILogger {
  private logger: Logger | Console;
  private silent = false;

  constructor({
    level = 'info',
  }: {
    level?: 'info' | 'debug' | 'error' | 'warn' | 'none';
  } = {}) {
    if (level === 'none') {
      this.silent = true;
      return;
    }
    this.logger = createLogger({
      level,
      silent: this.silent,
      defaultMeta: {
        name: 'ar-io-sdk',
        version,
      },
      format: format.combine(format.timestamp(), format.json()),
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof window !== 'undefined') {
      this.logger = console;
    } else {
      this.logger.add(
        new transports.Console({
          format: format.combine(format.timestamp(), format.json()),
        }),
      );
    }
  }

  info(message: string, ...args: unknown[]) {
    if (this.silent) return;
    this.logger.info(message, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    if (this.silent) return;
    this.logger.warn(message, ...args);
  }

  error(message: string, ...args: unknown[]) {
    if (this.silent) return;
    this.logger.error(message, ...args);
  }

  debug(message: string, ...args: unknown[]) {
    if (this.silent) return;
    this.logger.debug(message, ...args);
  }

  setLogLevel(level: string) {
    if ('silent' in this.logger) {
      this.logger.silent = level === 'none';
      return;
    }

    if ('level' in this.logger) {
      this.logger.level = level;
    }
  }
}
