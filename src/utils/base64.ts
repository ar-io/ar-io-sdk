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
import { createHash } from 'crypto';

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
  return toB64Url(createHash('sha256').update(input).digest());
}
