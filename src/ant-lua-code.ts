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
export default `

-- module: ".common.json"
local function _loaded_mod_common_json()
--
-- json.lua
--
-- Copyright (c) 2020 rxi
--
-- Permission is hereby granted, free of charge, to any person obtaining a copy of
-- this software and associated documentation files (the "Software"), to deal in
-- the Software without restriction, including without limitation the rights to
-- use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
-- of the Software, and to permit persons to whom the Software is furnished to do
-- so, subject to the following conditions:
--
-- The above copyright notice and this permission notice shall be included in all
-- copies or substantial portions of the Software.
--
-- THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
-- IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
-- FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
-- AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
-- LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
-- OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
-- SOFTWARE.
--

local json = { _version = "0.1.2" }

-------------------------------------------------------------------------------
-- Encode
-------------------------------------------------------------------------------

local encode

local escape_char_map = {
	["\\"] = "\\",
	['"'] = '"',
	["\b"] = "b",
	["\f"] = "f",
	["\n"] = "n",
	["\r"] = "r",
	["\t"] = "t",
}

local escape_char_map_inv = { ["/"] = "/" }
for k, v in pairs(escape_char_map) do
	escape_char_map_inv[v] = k
end

local function escape_char(c)
	return "\\" .. (escape_char_map[c] or string.format("u%04x", c:byte()))
end

local function encode_nil(val)
	return "null"
end

local function encode_table(val, stack)
	local res = {}
	stack = stack or {}

	-- Circular reference?
	if stack[val] then
		error("circular reference")
	end

	stack[val] = true

	if rawget(val, 1) ~= nil or next(val) == nil then
		-- Treat as array -- check keys are valid and it is not sparse
		local n = 0
		for k in pairs(val) do
			if type(k) ~= "number" then
				error("invalid table: mixed or invalid key types")
			end
			n = n + 1
		end
		if n ~= #val then
			error("invalid table: sparse array")
		end
		-- Encode
		for i, v in ipairs(val) do
			table.insert(res, encode(v, stack))
		end
		stack[val] = nil
		return "[" .. table.concat(res, ",") .. "]"
	else
		-- Treat as an object
		for k, v in pairs(val) do
			if type(k) ~= "string" then
				error("invalid table: mixed or invalid key types")
			end
			table.insert(res, encode(k, stack) .. ":" .. encode(v, stack))
		end
		stack[val] = nil
		return "{" .. table.concat(res, ",") .. "}"
	end
end

local function encode_string(val)
	return '"' .. val:gsub('[%z\\1-\\31\\"]', escape_char) .. '"'
end

local function encode_number(val)
	-- Check for NaN, -inf and inf
	if val ~= val or val <= -math.huge or val >= math.huge then
		error("unexpected number value '" .. tostring(val) .. "'")
	end
	return string.format("%.14g", val)
end

local type_func_map = {
	["nil"] = encode_nil,
	["table"] = encode_table,
	["string"] = encode_string,
	["number"] = encode_number,
	["boolean"] = tostring,
}

encode = function(val, stack)
	local t = type(val)
	local f = type_func_map[t]
	if f then
		return f(val, stack)
	end
	error("unexpected type '" .. t .. "'")
end

function json.encode(val)
	return (encode(val))
end

-------------------------------------------------------------------------------
-- Decode
-------------------------------------------------------------------------------

local parse

local function create_set(...)
	local res = {}
	for i = 1, select("#", ...) do
		res[select(i, ...)] = true
	end
	return res
end

local space_chars = create_set(" ", "\t", "\r", "\n")
local delim_chars = create_set(" ", "\t", "\r", "\n", "]", "}", ",")
local escape_chars = create_set("\\", "/", '"', "b", "f", "n", "r", "t", "u")
local literals = create_set("true", "false", "null")

local literal_map = {
	["true"] = true,
	["false"] = false,
	["null"] = nil,
}

local function next_char(str, idx, set, negate)
	for i = idx, #str do
		if set[str:sub(i, i)] ~= negate then
			return i
		end
	end
	return #str + 1
end

local function decode_error(str, idx, msg)
	local line_count = 1
	local col_count = 1
	for i = 1, idx - 1 do
		col_count = col_count + 1
		if str:sub(i, i) == "\n" then
			line_count = line_count + 1
			col_count = 1
		end
	end
	error(string.format("%s at line %d col %d", msg, line_count, col_count))
end

local function codepoint_to_utf8(n)
	-- http://scripts.sil.org/cms/scripts/page.php?site_id=nrsi&id=iws-appendixa
	local f = math.floor
	if n <= 0x7f then
		return string.char(n)
	elseif n <= 0x7ff then
		return string.char(f(n / 64) + 192, n % 64 + 128)
	elseif n <= 0xffff then
		return string.char(f(n / 4096) + 224, f(n % 4096 / 64) + 128, n % 64 + 128)
	elseif n <= 0x10ffff then
		return string.char(f(n / 262144) + 240, f(n % 262144 / 4096) + 128, f(n % 4096 / 64) + 128, n % 64 + 128)
	end
	error(string.format("invalid unicode codepoint '%x'", n))
end

local function parse_unicode_escape(s)
	local n1 = tonumber(s:sub(1, 4), 16)
	local n2 = tonumber(s:sub(7, 10), 16)
	-- Surrogate pair?
	if n2 then
		return codepoint_to_utf8((n1 - 0xd800) * 0x400 + (n2 - 0xdc00) + 0x10000)
	else
		return codepoint_to_utf8(n1)
	end
end

local function parse_string(str, i)
	local res = ""
	local j = i + 1
	local k = j

	while j <= #str do
		local x = str:byte(j)

		if x < 32 then
			decode_error(str, j, "control character in string")
		elseif x == 92 then -- \`\`: Escape
			res = res .. str:sub(k, j - 1)
			j = j + 1
			local c = str:sub(j, j)
			if c == "u" then
				local hex = str:match("^[dD][89aAbB]%x%x\\u%x%x%x%x", j + 1)
					or str:match("^%x%x%x%x", j + 1)
					or decode_error(str, j - 1, "invalid unicode escape in string")
				res = res .. parse_unicode_escape(hex)
				j = j + #hex
			else
				if not escape_chars[c] then
					decode_error(str, j - 1, "invalid escape char '" .. c .. "' in string")
				end
				res = res .. escape_char_map_inv[c]
			end
			k = j + 1
		elseif x == 34 then -- \`"\`: End of string
			res = res .. str:sub(k, j - 1)
			return res, j + 1
		end

		j = j + 1
	end

	decode_error(str, i, "expected closing quote for string")
end

local function parse_number(str, i)
	local x = next_char(str, i, delim_chars)
	local s = str:sub(i, x - 1)
	local n = tonumber(s)
	if not n then
		decode_error(str, i, "invalid number '" .. s .. "'")
	end
	return n, x
end

local function parse_literal(str, i)
	local x = next_char(str, i, delim_chars)
	local word = str:sub(i, x - 1)
	if not literals[word] then
		decode_error(str, i, "invalid literal '" .. word .. "'")
	end
	return literal_map[word], x
end

local function parse_array(str, i)
	local res = {}
	local n = 1
	i = i + 1
	while 1 do
		local x
		i = next_char(str, i, space_chars, true)
		-- Empty / end of array?
		if str:sub(i, i) == "]" then
			i = i + 1
			break
		end
		-- Read token
		x, i = parse(str, i)
		res[n] = x
		n = n + 1
		-- Next token
		i = next_char(str, i, space_chars, true)
		local chr = str:sub(i, i)
		i = i + 1
		if chr == "]" then
			break
		end
		if chr ~= "," then
			decode_error(str, i, "expected ']' or ','")
		end
	end
	return res, i
end

local function parse_object(str, i)
	local res = {}
	i = i + 1
	while 1 do
		local key, val
		i = next_char(str, i, space_chars, true)
		-- Empty / end of object?
		if str:sub(i, i) == "}" then
			i = i + 1
			break
		end
		-- Read key
		if str:sub(i, i) ~= '"' then
			decode_error(str, i, "expected string for key")
		end
		key, i = parse(str, i)
		-- Read ':' delimiter
		i = next_char(str, i, space_chars, true)
		if str:sub(i, i) ~= ":" then
			decode_error(str, i, "expected ':' after key")
		end
		i = next_char(str, i + 1, space_chars, true)
		-- Read value
		val, i = parse(str, i)
		-- Set
		res[key] = val
		-- Next token
		i = next_char(str, i, space_chars, true)
		local chr = str:sub(i, i)
		i = i + 1
		if chr == "}" then
			break
		end
		if chr ~= "," then
			decode_error(str, i, "expected '}' or ','")
		end
	end
	return res, i
end

local char_func_map = {
	['"'] = parse_string,
	["0"] = parse_number,
	["1"] = parse_number,
	["2"] = parse_number,
	["3"] = parse_number,
	["4"] = parse_number,
	["5"] = parse_number,
	["6"] = parse_number,
	["7"] = parse_number,
	["8"] = parse_number,
	["9"] = parse_number,
	["-"] = parse_number,
	["t"] = parse_literal,
	["f"] = parse_literal,
	["n"] = parse_literal,
	["["] = parse_array,
	["{"] = parse_object,
}

parse = function(str, idx)
	local chr = str:sub(idx, idx)
	local f = char_func_map[chr]
	if f then
		return f(str, idx)
	end
	decode_error(str, idx, "unexpected character '" .. chr .. "'")
end

function json.decode(str)
	if type(str) ~= "string" then
		error("expected argument of type string, got " .. type(str))
	end
	local res, idx = parse(str, next_char(str, 1, space_chars, true))
	idx = next_char(str, idx, space_chars, true)
	if idx <= #str then
		decode_error(str, idx, "trailing garbage")
	end
	return res
end

return json

end

_G.package.loaded[".common.json"] = _loaded_mod_common_json()

-- module: ".common.constants"
local function _loaded_mod_common_constants()
local constants = {}

constants.MAX_UNDERNAME_LENGTH = 61
constants.UNDERNAME_DOES_NOT_EXIST_MESSAGE = "Name does not exist in the ANT!"
constants.UNDERNAME_REGEXP = "^(?:@|[a-zA-Z0-9][a-zA-Z0-9-_]{0,"
	.. (constants.MAX_UNDERNAME_LENGTH - 2)
	.. "}[a-zA-Z0-9])$"
constants.ARWEAVE_ID_REGEXP = "^[a-zA-Z0-9-_]{43}$"
constants.INVALID_ARWEAVE_ID_MESSAGE = "Invalid Arweave ID"
constants.MIN_TTL_SECONDS = 900
constants.MAX_TTL_SECONDS = 3600
constants.INVALID_TTL_MESSAGE = "Invalid TTL. TLL must be an integer between "
	.. constants.MIN_TTL_SECONDS
	.. " and "
	.. constants.MAX_TTL_SECONDS
	.. " seconds"

return constants

end

_G.package.loaded[".common.constants"] = _loaded_mod_common_constants()

-- module: ".common.utils"
local function _loaded_mod_common_utils()
-- the majority of this file came from https://github.com/permaweb/aos/blob/main/process/utils.lua

local constants = require(".common.constants")
local utils = { _version = "0.0.1" }

local function isArray(table)
	if type(table) == "table" then
		local maxIndex = 0
		for k, v in pairs(table) do
			if type(k) ~= "number" or k < 1 or math.floor(k) ~= k then
				return false -- If there's a non-integer key, it's not an array
			end
			maxIndex = math.max(maxIndex, k)
		end
		-- If the highest numeric index is equal to the number of elements, it's an array
		return maxIndex == #table
	end
	return false
end

-- @param {function} fn
-- @param {number} arity
utils.curry = function(fn, arity)
	assert(type(fn) == "function", "function is required as first argument")
	arity = arity or debug.getinfo(fn, "u").nparams
	if arity < 2 then
		return fn
	end

	return function(...)
		local args = { ... }

		if #args >= arity then
			return fn(table.unpack(args))
		else
			return utils.curry(function(...)
				return fn(table.unpack(args), ...)
			end, arity - #args)
		end
	end
end

--- Concat two Array Tables.
-- @param {table<Array>} a
-- @param {table<Array>} b
utils.concat = utils.curry(function(a, b)
	assert(type(a) == "table", "first argument should be a table that is an array")
	assert(type(b) == "table", "second argument should be a table that is an array")
	assert(isArray(a), "first argument should be a table")
	assert(isArray(b), "second argument should be a table")

	local result = {}
	for i = 1, #a do
		result[#result + 1] = a[i]
	end
	for i = 1, #b do
		result[#result + 1] = b[i]
	end
	return result
end, 2)

--- reduce applies a function to a table
-- @param {function} fn
-- @param {any} initial
-- @param {table<Array>} t
utils.reduce = utils.curry(function(fn, initial, t)
	assert(type(fn) == "function", "first argument should be a function that accepts (result, value, key)")
	assert(type(t) == "table" and isArray(t), "third argument should be a table that is an array")
	local result = initial
	for k, v in pairs(t) do
		if result == nil then
			result = v
		else
			result = fn(result, v, k)
		end
	end
	return result
end, 3)

-- @param {function} fn
-- @param {table<Array>} data
utils.map = utils.curry(function(fn, data)
	assert(type(fn) == "function", "first argument should be a unary function")
	assert(type(data) == "table" and isArray(data), "second argument should be an Array")

	local function map(result, v, k)
		result[k] = fn(v, k)
		return result
	end

	return utils.reduce(map, {}, data)
end, 2)

-- @param {function} fn
-- @param {table<Array>} data
utils.filter = utils.curry(function(fn, data)
	assert(type(fn) == "function", "first argument should be a unary function")
	assert(type(data) == "table" and isArray(data), "second argument should be an Array")

	local function filter(result, v, _k)
		if fn(v) then
			table.insert(result, v)
		end
		return result
	end

	return utils.reduce(filter, {}, data)
end, 2)

-- @param {function} fn
-- @param {table<Array>} t
utils.find = utils.curry(function(fn, t)
	assert(type(fn) == "function", "first argument should be a unary function")
	assert(type(t) == "table", "second argument should be a table that is an array")
	for _, v in pairs(t) do
		if fn(v) then
			return v
		end
	end
end, 2)

-- @param {string} propName
-- @param {string} value
-- @param {table} object
utils.propEq = utils.curry(function(propName, value, object)
	assert(type(propName) == "string", "first argument should be a string")
	-- assert(type(value) == "string", "second argument should be a string")
	assert(type(object) == "table", "third argument should be a table<object>")

	return object[propName] == value
end, 3)

-- @param {table<Array>} data
utils.reverse = function(data)
	assert(type(data) == "table", "argument needs to be a table that is an array")
	return utils.reduce(function(result, v, i)
		result[#data - i + 1] = v
		return result
	end, {}, data)
end

-- @param {function} ...
utils.compose = utils.curry(function(...)
	local mutations = utils.reverse({ ... })

	return function(v)
		local result = v
		for _, fn in pairs(mutations) do
			assert(type(fn) == "function", "each argument needs to be a function")
			result = fn(result)
		end
		return result
	end
end, 2)

-- @param {string} propName
-- @param {table} object
utils.prop = utils.curry(function(propName, object)
	return object[propName]
end, 2)

-- @param {any} val
-- @param {table<Array>} t
utils.includes = utils.curry(function(val, t)
	assert(type(t) == "table", "argument needs to be a table")
	return utils.find(function(v)
		return v == val
	end, t) ~= nil
end, 2)

-- @param {table} t
utils.keys = function(t)
	assert(type(t) == "table", "argument needs to be a table")
	local keys = {}
	for key in pairs(t) do
		table.insert(keys, key)
	end
	return keys
end

-- @param {table} t
utils.values = function(t)
	assert(type(t) == "table", "argument needs to be a table")
	local values = {}
	for _, value in pairs(t) do
		table.insert(values, value)
	end
	return values
end

function utils.hasMatchingTag(tag, value)
	return Handlers.utils.hasMatchingTag(tag, value)
end

function utils.reply(msg)
	Handlers.utils.reply(msg)
end

function utils.validateUndername(name)
	local valid = string.match(name, constants.UNDERNAME_REGEXP) == nil
	assert(valid ~= false, constants.UNDERNAME_DOES_NOT_EXIST_MESSAGE)
end

function utils.validateArweaveId(id)
	local valid = string.match(id, constants.ARWEAVE_ID_REGEXP) == nil

	assert(valid == true, constants.INVALID_ARWEAVE_ID_MESSAGE)
end

function utils.validateTTLSeconds(ttl)
	local valid = type(ttl) == "number" and ttl >= constants.MIN_TTL_SECONDS and ttl <= constants.MAX_TTL_SECONDS
	return assert(valid ~= false, constants.INVALID_TTL_MESSAGE)
end

function utils.validateOwner(caller)
	local isOwner = false
	if Owner == caller or Balances[caller] or ao.env.Process.Id == caller then
		isOwner = true
	end
	assert(isOwner, "Sender is not the owner.")
end

function utils.assertHasPermission(from)
	local isController = false
	for _, c in ipairs(Controllers) do
		if c == from then
			isController = true
			break
		end
	end
	local hasPermission = isController == true or Balances[from] or Owner == from or ao.env.Process.Id == from
	assert(hasPermission == true, "Only controllers and owners can set controllers and records.")
end

function utils.camelCase(str)
	-- Remove any leading or trailing spaces
	str = string.gsub(str, "^%s*(.-)%s*$", "%1")

	-- Convert PascalCase to camelCase
	str = string.gsub(str, "^%u", string.lower)

	-- Handle kebab-case, snake_case, and space-separated words
	str = string.gsub(str, "[-_%s](%w)", function(s)
		return string.upper(s)
	end)

	return str
end

utils.notices = {}

function utils.notices.credit(msg)
	local notice = {
		Target = msg.From,
		Action = "Credit-Notice",
		Sender = msg.From,
	}
	for tagName, tagValue in pairs(msg) do
		-- Tags beginning with "X-" are forwarded
		if string.sub(tagName, 1, 2) == "X-" then
			notice[tagName] = tagValue
		end
	end

	return notice
end

function utils.notices.debit(msg)
	local notice = {
		Target = msg.From,
		Action = "Debit-Notice",
		Sender = msg.From,
	}
	-- Add forwarded tags to the credit and debit notice messages
	for tagName, tagValue in pairs(msg) do
		-- Tags beginning with "X-" are forwarded
		if string.sub(tagName, 1, 2) == "X-" then
			notice[tagName] = tagValue
		end
	end

	return notice
end

-- @param notices table
function utils.notices.sendNotices(notices)
	for _, notice in ipairs(notices) do
		ao.send(notice)
	end
end

return utils

end

_G.package.loaded[".common.utils"] = _loaded_mod_common_utils()

-- module: ".common.balances"
local function _loaded_mod_common_balances()
local utils = require(".common.utils")
local json = require(".common.json")

local balances = {}

function balances.walletHasSufficientBalance(wallet)
	return Balances[wallet] ~= nil and Balances[wallet] > 0
end

function balances.transfer(to)
	utils.validateArweaveId(to)
	Balances = { [to] = 1 }
	Owner = to
	Controllers = {}
	return "Transfer successful"
end

function balances.balance(address)
	utils.validateArweaveId(address)
	local balance = Balances[address] or 0
	return balance
end

function balances.balances()
	return json.encode(Balances)
end

function balances.setName(name)
	assert(type(name) == "string", "Name must be a string")
	Name = name
	return "Name set to " .. name
end

function balances.setTicker(ticker)
	assert(type(ticker) == "string", "Ticker must be a string")
	Ticker = ticker
	return "Ticker set to " .. ticker
end

return balances

end

_G.package.loaded[".common.balances"] = _loaded_mod_common_balances()

-- module: ".common.initialize"
local function _loaded_mod_common_initialize()
local utils = require(".common.utils")
local json = require(".common.json")
local initialize = {}

function initialize.initializeANTState(state)
	local encoded = json.decode(state)
	local balances = encoded.balances
	local controllers = encoded.controllers
	local records = encoded.records
	local name = encoded.name
	local ticker = encoded.ticker
	assert(type(name) == "string", "name must be a string")
	assert(type(ticker) == "string", "ticker must be a string")
	assert(type(balances) == "table", "balances must be a table")
	for k, v in pairs(balances) do
		balances[k] = tonumber(v)
	end
	assert(type(controllers) == "table", "controllers must be a table")
	assert(type(records) == "table", "records must be a table")
	for k, v in pairs(records) do
		utils.validateUndername(k)
		assert(type(v) == "table", "records values must be tables")
		utils.validateArweaveId(v.transactionId)
		utils.validateTTLSeconds(v.ttlSeconds)
	end

	Name = name
	Ticker = ticker
	Balances = balances
	Controllers = controllers
	Records = records
	Initialized = true

	return {
		name = Name,
		ticker = Ticker,
		balances = Balances,
		controllers = Controllers,
		records = Records,
	}
end

local function findObject(array, key, value)
	for i, object in ipairs(array) do
		if object[key] == value then
			return object
		end
	end
	return nil
end

function initialize.initializeProcessState(msg, env)
	Errors = Errors or {}
	Inbox = Inbox or {}

	-- temporary fix for Spawn
	if not Owner then
		local _from = findObject(env.Process.Tags, "name", "From-Process")
		if _from then
			Owner = _from.value
		else
			Owner = msg.From
		end
	end

	if not Name then
		local taggedName = findObject(env.Process.Tags, "name", "Name")
		if taggedName then
			Name = taggedName.value
		else
			Name = "ANT"
		end
	end
end

return initialize

end

_G.package.loaded[".common.initialize"] = _loaded_mod_common_initialize()

-- module: ".common.records"
local function _loaded_mod_common_records()
local utils = require(".common.utils")
local json = require(".common.json")
local records = {}
-- defaults to landing page txid
Records = Records or { ["@"] = { transactionId = "UyC5P5qKPZaltMmmZAWdakhlDXsBF6qmyrbWYFchRTk", ttlSeconds = 3600 } }

function records.setRecord(name, transactionId, ttlSeconds)
	local nameValidity, nameValidityError = pcall(utils.validateUndername, name)
	assert(nameValidity ~= false, nameValidityError)
	local targetIdValidity, targetValidityError = pcall(utils.validateArweaveId, transactionId)
	assert(targetIdValidity ~= false, targetValidityError)
	local ttlSecondsValidity, ttlValidityError = pcall(utils.validateTTLSeconds, ttlSeconds)
	assert(ttlSecondsValidity ~= false, ttlValidityError)

	Records[name] = {
		transactionId = transactionId,
		ttlSeconds = ttlSeconds,
	}

	return "Record set"
end

function records.removeRecord(name)
	local nameValidity, nameValidityError = pcall(utils.validateUndername, name)
	assert(nameValidity ~= false, nameValidityError)
	Records[name] = nil

	return "Record removed"
end

function records.getRecord(name)
	utils.validateUndername(name)
	assert(Records[name] ~= nil, "Record does not exist")

	return json.encode(Records[name])
end

function records.getRecords()
	return json.encode(Records)
end

return records

end

_G.package.loaded[".common.records"] = _loaded_mod_common_records()

-- module: ".common.controllers"
local function _loaded_mod_common_controllers()
local json = require(".common.json")
local utils = require(".common.utils")

local controllers = {}

function controllers.setController(controller)
	utils.validateArweaveId(controller)

	for _, c in ipairs(Controllers) do
		assert(c ~= controller, "Controller already exists")
	end

	table.insert(Controllers, controller)
	return "Controller added"
end

function controllers.removeController(controller)
	utils.validateArweaveId(controller)
	local controllerExists = false

	for i, v in ipairs(Controllers) do
		if v == controller then
			table.remove(Controllers, i)
			controllerExists = true
			break
		end
	end

	assert(controllerExists ~= nil, "Controller does not exist")
	return "Controller removed"
end

function controllers.getControllers()
	return json.encode(Controllers)
end

return controllers

end

_G.package.loaded[".common.controllers"] = _loaded_mod_common_controllers()

-- module: ".common.main"
local function _loaded_mod_common_main()
local ant = {}

function ant.init()
	-- main.lua
	-- utils
	local json = require(".common.json")
	local utils = require(".common.utils")
	local camel = utils.camelCase
	-- spec modules
	local balances = require(".common.balances")
	local initialize = require(".common.initialize")
	local records = require(".common.records")
	local controllers = require(".common.controllers")

	Owner = Owner or ao.env.Process.Owner
	Balances = Balances or { [Owner] = 1 }
	Controllers = Controllers or { Owner }

	Name = Name or "Arweave Name Token"
	Ticker = Ticker or "ANT"
	Logo = Logo or "Sie_26dvgyok0PZD_-iQAFOhOd5YxDTkczOLoqTTL_A"
	Denomination = Denomination or 0
	TotalSupply = TotalSupply or 1
	Initialized = Initialized or false

	local ActionMap = {
		-- write
		SetController = "Set-Controller",
		RemoveController = "Remove-Controller",
		SetRecord = "Set-Record",
		RemoveRecord = "Remove-Record",
		SetName = "Set-Name",
		SetTicker = "Set-Ticker",
		--- initialization method for bootstrapping the contract from other platforms ---
		InitializeState = "Initialize-State",
		-- read
		GetControllers = "Get-Controllers",
		GetRecord = "Get-Record",
		GetRecords = "Get-Records",
	}

	local TokenSpecActionMap = {
		Info = "Info",
		Balances = "Balances",
		Balance = "Balance",
		Transfer = "Transfer",
		TotalSupply = "Total-Supply",
		CreditNotice = "Credit-Notice",
		-- not implemented
		Mint = "Mint",
		Burn = "Burn",
	}

	Handlers.add(
		camel(TokenSpecActionMap.Transfer),
		utils.hasMatchingTag("Action", TokenSpecActionMap.Transfer),
		function(msg)
			local recipient = msg.Tags.Recipient
			local function checkAssertions()
				utils.validateArweaveId(recipient)
				utils.validateOwner(msg.From)
			end

			local inputStatus, inputResult = pcall(checkAssertions)

			if not inputStatus then
				ao.send({
					Target = msg.From,
					Tags = { Error = "Transfer-Error" },
					Error = tostring(inputResult),
					["Message-Id"] = msg.Id,
					Data = inputResult,
				})
				return
			end
			local transferStatus, transferResult = pcall(balances.transfer, recipient)

			if not transferStatus then
				ao.send({
					Target = msg.From,
					Action = "Transfer-Error",
					Error = tostring(transferResult),
					["Message-Id"] = msg.Id,
					Data = transferResult,
				})
				return
			elseif not msg.Cast then
				ao.send(utils.notices.debit(msg))
				ao.send(utils.notices.credit(msg))
			end
		end
	)

	Handlers.add(
		camel(TokenSpecActionMap.Balance),
		utils.hasMatchingTag("Action", TokenSpecActionMap.Balance),
		function(msg)
			local balStatus, balRes = pcall(balances.balance, msg.Tags.Recipient or msg.From)
			if not balStatus then
				ao.send({
					Target = msg.From,
					Tags = { Error = "Balance-Error" },
					Error = tostring(balRes),
					["Message-Id"] = msg.Id,
					Data = balRes,
				})
			else
				ao.send({
					Target = msg.From,
					Balance = balRes,
					Ticker = Ticker,
					Account = msg.Tags.Recipient or msg.From,
					Data = balRes,
				})
			end
		end
	)

	Handlers.add(
		camel(TokenSpecActionMap.Balances),
		utils.hasMatchingTag("Action", TokenSpecActionMap.Balances),
		function(msg)
			ao.send({
				Target = msg.From,
				Data = balances.balances(),
			})
		end
	)

	Handlers.add(
		camel(TokenSpecActionMap.TotalSupply),
		utils.hasMatchingTag("Action", TokenSpecActionMap.TotalSupply),
		function(msg)
			assert(msg.From ~= ao.id, "Cannot call Total-Supply from the same process!")

			ao.send({
				Target = msg.From,
				Action = "Total-Supply",
				Data = TotalSupply,
				Ticker = Ticker,
			})
		end
	)

	Handlers.add(camel(TokenSpecActionMap.Info), utils.hasMatchingTag("Action", TokenSpecActionMap.Info), function(msg)
		local info = {
			Name = Name,
			Ticker = Ticker,
			["Total-Supply"] = TotalSupply,
			Logo = Logo,
			Denomination = Denomination,
			Owner = Owner,
		}
		ao.send({
			Target = msg.From,
			Tags = info,
			Data = json.encode(info),
		})
	end)

	-- ActionMap (ANT Spec)

	Handlers.add(camel(ActionMap.SetController), utils.hasMatchingTag("Action", ActionMap.SetController), function(msg)
		local assertHasPermission, permissionErr = pcall(utils.assertHasPermission, msg.From)
		if assertHasPermission == false then
			return ao.send({
				Target = msg.From,
				Error = "Set-Controller-Error",
				["Message-Id"] = msg.Id,
				Data = permissionErr,
			})
		end
		local controllerStatus, controllerRes = pcall(controllers.setController, msg.Tags.Controller)
		if not controllerStatus then
			ao.send({
				Target = msg.From,
				Error = "Set-Controller-Error",
				["Message-Id"] = msg.Id,
				Data = controllerRes,
			})
			return
		end
		ao.send({ Target = msg.From, Data = controllerRes })
	end)

	Handlers.add(
		camel(ActionMap.RemoveController),
		utils.hasMatchingTag("Action", ActionMap.RemoveController),
		function(msg)
			local assertHasPermission, permissionErr = pcall(utils.assertHasPermission, msg.From)
			if assertHasPermission == false then
				return ao.send({
					Target = msg.From,
					Data = permissionErr,
					Error = "Remove-Controller-Error",
					["Message-Id"] = msg.Id,
				})
			end
			local removeStatus, removeRes = pcall(controllers.removeController, msg.Tags.Controller)
			if not removeStatus then
				ao.send({
					Target = msg.From,
					Data = removeRes,
					Error = "Remove-Controller-Error",
					["Message-Id"] = msg.Id,
				})
				return
			end

			ao.send({ Target = msg.From, Data = removeRes })
		end
	)

	Handlers.add(
		camel(ActionMap.GetControllers),
		utils.hasMatchingTag("Action", ActionMap.GetControllers),
		function(msg)
			ao.send({ Target = msg.From, Data = controllers.getControllers() })
		end
	)

	Handlers.add(camel(ActionMap.SetRecord), utils.hasMatchingTag("Action", ActionMap.SetRecord), function(msg)
		local assertHasPermission, permissionErr = pcall(utils.assertHasPermission, msg.From)
		if assertHasPermission == false then
			return ao.send({
				Target = msg.From,
				Data = permissionErr,
				Error = "Set-Record-Error",
				["Message-Id"] = msg.Id,
			})
		end
		local tags = msg.Tags
		local name, transactionId, ttlSeconds =
			tags["Sub-Domain"], tags["Transaction-Id"], tonumber(tags["TTL-Seconds"])

		local setRecordStatus, setRecordResult = pcall(records.setRecord, name, transactionId, ttlSeconds)
		if not setRecordStatus then
			ao.send({ Target = msg.From, Data = setRecordResult, Error = "Set-Record-Error", ["Message-Id"] = msg.Id })
			return
		end

		ao.send({ Target = msg.From, Data = setRecordResult })
	end)

	Handlers.add(camel(ActionMap.RemoveRecord), utils.hasMatchingTag("Action", ActionMap.RemoveRecord), function(msg)
		local assertHasPermission, permissionErr = pcall(utils.assertHasPermission, msg.From)
		if assertHasPermission == false then
			return ao.send({ Target = msg.From, Data = permissionErr })
		end
		local removeRecordStatus, removeRecordResult = pcall(records.removeRecord, msg.Tags["Sub-Domain"])
		if not removeRecordStatus then
			ao.send({
				Target = msg.From,
				Data = removeRecordResult,
				Error = "Remove-Record-Error",
				["Message-Id"] = msg.Id,
			})
		else
			ao.send({ Target = msg.From, Data = removeRecordResult })
		end
	end)

	Handlers.add(camel(ActionMap.GetRecord), utils.hasMatchingTag("Action", ActionMap.GetRecord), function(msg)
		local nameStatus, nameRes = pcall(records.getRecord, msg.Tags["Sub-Domain"])
		if not nameStatus then
			ao.send({ Target = msg.From, Data = nameRes, Error = "Get-Record-Error", ["Message-Id"] = msg.Id })
			return
		end

		ao.send({ Target = msg.From, Data = nameRes })
	end)

	Handlers.add(camel(ActionMap.GetRecords), utils.hasMatchingTag("Action", ActionMap.GetRecords), function(msg)
		ao.send({ Target = msg.From, Data = records.getRecords() })
	end)

	Handlers.add(camel(ActionMap.SetName), utils.hasMatchingTag("Action", ActionMap.SetName), function(msg)
		local nameStatus, nameRes = pcall(balances.setName, msg.Tags.Name)
		if not nameStatus then
			ao.send({ Target = msg.From, Data = nameRes, Error = "Set-Name-Error", ["Message-Id"] = msg.Id })
			return
		end
		ao.send({ Target = msg.From, Data = nameRes })
	end)

	Handlers.add(camel(ActionMap.SetTicker), utils.hasMatchingTag("Action", ActionMap.SetTicker), function(msg)
		local tickerStatus, tickerRes = pcall(balances.setTicker, msg.Tags.Ticker)
		if not tickerStatus then
			ao.send({ Target = msg.From, Data = tickerRes, Error = "Set-Ticker-Error", ["Message-Id"] = msg.Id })
			return
		end

		ao.send({ Target = msg.From, Data = tickerRes })
	end)

	Handlers.add(
		camel(ActionMap.InitializeState),
		utils.hasMatchingTag("Action", ActionMap.InitializeState),
		function(msg)
			local initStatus, result = pcall(initialize.initializeANTState, msg.Data)

			if not initStatus then
				ao.send({ Target = msg.From, Data = result, Error = "Initialize-State-Error", ["Message-Id"] = msg.Id })
				return
			else
				ao.send({ Target = msg.From, Data = json.encode(result) })
			end
		end
	)
end

return ant

end

_G.package.loaded[".common.main"] = _loaded_mod_common_main()

local ant = require(".common.main")

ant.init()
`;
