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
import { createHash, getRandomValues } from 'crypto';

// safely encodes and decodes base64url strings to and from buffers
const BASE64_CHAR_62 = '+';
const BASE64_CHAR_63 = '/';
const BASE64URL_CHAR_62 = '-';
const BASE64URL_CHAR_63 = '_';
const BASE64_PADDING = '=';

function base64urlToBase64(str: string): string {
  const padLength = str.length % 4;
  if (padLength) {
    str += BASE64_PADDING.repeat(4 - padLength);
  }

  return str
    .replaceAll(BASE64URL_CHAR_62, BASE64_CHAR_62)
    .replaceAll(BASE64URL_CHAR_63, BASE64_CHAR_63);
}

function base64urlFromBase64(str: string) {
  return str
    .replaceAll(BASE64_CHAR_62, BASE64URL_CHAR_62)
    .replaceAll(BASE64_CHAR_63, BASE64URL_CHAR_63)
    .replaceAll(BASE64_PADDING, '');
}

export function fromB64Url(str: string): Buffer {
  const b64Str = base64urlToBase64(str);
  return Buffer.from(b64Str, 'base64');
}

export function toB64Url(buffer: Buffer): string {
  const b64Str = buffer.toString('base64');
  return base64urlFromBase64(b64Str);
}

export function sha256B64Url(input: Buffer): string {
  return toB64Url(createHash('sha256').update(Uint8Array.from(input)).digest());
}

export function getRandomText(length = 32) {
  const array = new Uint8Array(length);
  getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length);
}
