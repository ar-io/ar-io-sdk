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
import { program } from 'commander';

import { version } from '../version.js';
import { globalOptions } from './options.js';
import { applyOptions, makeCommand } from './utils.js';

applyOptions(
  program
    .name('ar.io')
    .version(version)
    .description('AR.IO Network CLI')
    .helpCommand(true),
  globalOptions,
);

makeCommand({
  name: '',
  description: 'Get network info',
  action: () => {
    console.log('wayfinder');
    return Promise.resolve({});
  },
});
