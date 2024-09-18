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
import { MIO_PER_IO } from './constants.js';

interface Equatable<T> {
  equals(other: T): boolean;
}

class PositiveFiniteInteger implements Equatable<PositiveFiniteInteger> {
  constructor(private readonly positiveFiniteInteger: number) {
    if (
      !Number.isFinite(this.positiveFiniteInteger) ||
      !Number.isInteger(this.positiveFiniteInteger) ||
      this.positiveFiniteInteger < 0
    ) {
      throw new Error(
        `Number must be a non-negative integer value! ${positiveFiniteInteger}`,
      );
    }
  }

  [Symbol.toPrimitive](hint?: string): number | string {
    if (hint === 'string') {
      this.toString();
    }

    return this.positiveFiniteInteger;
  }

  plus(positiveFiniteInteger: PositiveFiniteInteger): PositiveFiniteInteger {
    return new PositiveFiniteInteger(
      this.positiveFiniteInteger + positiveFiniteInteger.positiveFiniteInteger,
    );
  }

  minus(positiveFiniteInteger: PositiveFiniteInteger): PositiveFiniteInteger {
    return new PositiveFiniteInteger(
      this.positiveFiniteInteger - positiveFiniteInteger.positiveFiniteInteger,
    );
  }

  isGreaterThan(positiveFiniteInteger: PositiveFiniteInteger): boolean {
    return (
      this.positiveFiniteInteger > positiveFiniteInteger.positiveFiniteInteger
    );
  }

  isGreaterThanOrEqualTo(
    positiveFiniteInteger: PositiveFiniteInteger,
  ): boolean {
    return (
      this.positiveFiniteInteger >= positiveFiniteInteger.positiveFiniteInteger
    );
  }

  isLessThan(positiveFiniteInteger: PositiveFiniteInteger): boolean {
    return (
      this.positiveFiniteInteger < positiveFiniteInteger.positiveFiniteInteger
    );
  }

  isLessThanOrEqualTo(positiveFiniteInteger: PositiveFiniteInteger): boolean {
    return (
      this.positiveFiniteInteger <= positiveFiniteInteger.positiveFiniteInteger
    );
  }

  toString(): string {
    return `${this.positiveFiniteInteger}`;
  }

  valueOf(): number {
    return this.positiveFiniteInteger;
  }

  toJSON(): number {
    return this.positiveFiniteInteger;
  }

  equals(other: PositiveFiniteInteger): boolean {
    return this.positiveFiniteInteger === other.positiveFiniteInteger;
  }
}

export class IOToken {
  protected value: number;
  constructor(value: number) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('IOToken must be a non-negative finite number');
    }
    this.value = +value.toFixed(6);
  }

  valueOf(): number {
    return this.value;
  }

  toMIO(): mIOToken {
    return new mIOToken(Math.floor(this.value * MIO_PER_IO));
  }

  toString(): string {
    return `${this.value}`;
  }
}

export class mIOToken extends PositiveFiniteInteger {
  constructor(value: number) {
    super(value);
  }

  multiply(multiplier: mIOToken | number): mIOToken {
    // always round down on multiplication and division
    const result = Math.floor(this.valueOf() * multiplier.valueOf());
    return new mIOToken(result);
  }

  divide(divisor: mIOToken | number): mIOToken {
    if (divisor.valueOf() === 0) {
      // TODO: how should we handle this
      throw new Error('Cannot divide by zero');
    }
    // always round down on multiplication and division
    const result = Math.floor(this.valueOf() / divisor.valueOf());
    return new mIOToken(result);
  }

  plus(addend: mIOToken): mIOToken {
    const result = super.plus(addend);
    return new mIOToken(result.valueOf());
  }

  minus(subtractHend: mIOToken): mIOToken {
    const result = super.minus(subtractHend);
    return new mIOToken(result.valueOf());
  }

  toIO(): IOToken {
    return new IOToken(this.valueOf() / MIO_PER_IO);
  }
}

export type AoSigner = (args: {
  data: string | Buffer;
  tags?: { name: string; value: string }[];
  target?: string;
  anchor?: string;
}) => Promise<{ id: string; raw: ArrayBuffer }>;
