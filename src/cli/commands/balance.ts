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
import { MIO_PER_IO } from '../../constants.js';
import { BalanceOptions } from '../options.js';
import { addressFromOptions, readIOFromOptions } from '../utils.js';

export async function balance(options: BalanceOptions) {
  const io = readIOFromOptions(options);
  const address = addressFromOptions(options);

  const result = await io.getBalance({ address });
  const formattedBalance = (result / MIO_PER_IO).toFixed(6);
  const [integerPart, decimalPart] = formattedBalance.split('.');
  const IOBalanceWithCommas =
    integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + decimalPart;

  const output = {
    address: address,
    mIOBalance: result,
    message: `Provided address current has a balance of ${IOBalanceWithCommas} IO`,
  };

  console.log(JSON.stringify(output, null, 2));
}
