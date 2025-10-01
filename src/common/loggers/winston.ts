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
import { version } from '../../version.js';
import { ILogger } from '../logger.js';

export class WinstonLogger implements ILogger {
  private logger: any;

  constructor({
    level = 'info',
  }: {
    level?: 'info' | 'debug' | 'error' | 'warn' | 'none';
  } = {}) {
    this.initializeLogger(level);
  }

  private async initializeLogger(
    level: 'info' | 'debug' | 'error' | 'warn' | 'none',
  ) {
    try {
      const winston = await import('winston');

      this.logger = winston.createLogger({
        level: level === 'none' ? 'error' : level,
        silent: level === 'none',
        defaultMeta: {
          name: 'ar-io-sdk',
          version,
        },
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            ),
          }),
        ],
      });
    } catch (error) {
      throw new Error(
        'Winston is not installed. Install it with: npm install winston',
      );
    }
  }

  info(message: string, ...args: unknown[]) {
    this.logger?.info(message, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    this.logger?.warn(message, ...args);
  }

  error(message: string, ...args: unknown[]) {
    this.logger?.error(message, ...args);
  }

  debug(message: string, ...args: unknown[]) {
    this.logger?.debug(message, ...args);
  }

  setLogLevel(level: 'info' | 'debug' | 'error' | 'warn' | 'none') {
    if (this.logger) {
      if (level === 'none') {
        this.logger.silent = true;
      } else {
        this.logger.silent = false;
        this.logger.level = level;
      }
    }
  }
}
