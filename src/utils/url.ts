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
export const urlWithSearchParams = ({
  baseUrl,
  params,
}: {
  baseUrl: string;
  params: Record<
    string,
    string | number | boolean | string[] | null | undefined
  >;
}) => {
  const urlObj = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value) && value.length > 0) {
      for (const v of value) {
        if (v === undefined || v === null) continue;
        urlObj.searchParams.append(key, v.toString());
      }
    }
    urlObj.searchParams.set(key, value.toString());
  });
  return urlObj.toString();
};
