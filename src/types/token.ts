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
import { MARIO_PER_ARIO } from '../constants.js';

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

export class ARIOToken {
  protected value: number;
  constructor(value: number) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('ARIOToken must be a non-negative finite number');
    }
    this.value = +value.toFixed(6);
  }

  valueOf(): number {
    return this.value;
  }

  toMARIO(): mARIOToken {
    return new mARIOToken(Math.floor(this.value * MARIO_PER_ARIO));
  }

  toString(): string {
    return `${this.value}`;
  }
}

export class mARIOToken extends PositiveFiniteInteger {
  constructor(value: number) {
    super(value);
  }

  multiply(multiplier: mARIOToken | number): mARIOToken {
    // always round down on multiplication and division
    const result = Math.floor(this.valueOf() * multiplier.valueOf());
    return new mARIOToken(result);
  }

  divide(divisor: mARIOToken | number): mARIOToken {
    if (divisor.valueOf() === 0) {
      // TODO: how should we handle this
      throw new Error('Cannot divide by zero');
    }
    // always round down on multiplication and division
    const result = Math.floor(this.valueOf() / divisor.valueOf());
    return new mARIOToken(result);
  }

  plus(addend: mARIOToken): mARIOToken {
    const result = super.plus(addend);
    return new mARIOToken(result.valueOf());
  }

  minus(subtractHend: mARIOToken): mARIOToken {
    const result = super.minus(subtractHend);
    return new mARIOToken(result.valueOf());
  }

  toARIO(): ARIOToken {
    return new ARIOToken(this.valueOf() / MARIO_PER_ARIO);
  }
}

export type AoSigner = (args: {
  data: string | Buffer;
  tags?: { name: string; value: string }[];
  target?: string;
  anchor?: string;
}) => Promise<{ id: string; raw: ArrayBuffer }>;
