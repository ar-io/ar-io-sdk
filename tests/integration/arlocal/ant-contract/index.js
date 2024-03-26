// src/validations.mjs
'use strict';
var validateSetRecord = validate10;
var pattern0 = new RegExp('^(?:[a-zA-Z0-9_-]+|@)$', 'u');
var pattern1 = new RegExp('^[a-zA-Z0-9_-]{43}$', 'u');
function validate10(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      let missing0;
      if (
        (data.subDomain === void 0 && (missing0 = 'subDomain')) ||
        (data.transactionId === void 0 && (missing0 = 'transactionId')) ||
        (data.ttlSeconds === void 0 && (missing0 = 'ttlSeconds'))
      ) {
        validate10.errors = [
          {
            instancePath,
            schemaPath: '#/required',
            keyword: 'required',
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === 'function' ||
              key0 === 'subDomain' ||
              key0 === 'transactionId' ||
              key0 === 'ttlSeconds'
            )
          ) {
            validate10.errors = [
              {
                instancePath,
                schemaPath: '#/additionalProperties',
                keyword: 'additionalProperties',
                params: { additionalProperty: key0 },
                message: 'must NOT have additional properties',
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.function !== void 0) {
            let data0 = data.function;
            const _errs2 = errors;
            if (typeof data0 !== 'string') {
              validate10.errors = [
                {
                  instancePath: instancePath + '/function',
                  schemaPath: '#/properties/function/type',
                  keyword: 'type',
                  params: { type: 'string' },
                  message: 'must be string',
                },
              ];
              return false;
            }
            if (data0 !== 'setRecord') {
              validate10.errors = [
                {
                  instancePath: instancePath + '/function',
                  schemaPath: '#/properties/function/const',
                  keyword: 'const',
                  params: { allowedValue: 'setRecord' },
                  message: 'must be equal to constant',
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.subDomain !== void 0) {
              let data1 = data.subDomain;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (typeof data1 === 'string') {
                  if (!pattern0.test(data1)) {
                    validate10.errors = [
                      {
                        instancePath: instancePath + '/subDomain',
                        schemaPath: '#/properties/subDomain/pattern',
                        keyword: 'pattern',
                        params: { pattern: '^(?:[a-zA-Z0-9_-]+|@)$' },
                        message: 'must match pattern "^(?:[a-zA-Z0-9_-]+|@)$"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate10.errors = [
                    {
                      instancePath: instancePath + '/subDomain',
                      schemaPath: '#/properties/subDomain/type',
                      keyword: 'type',
                      params: { type: 'string' },
                      message: 'must be string',
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.transactionId !== void 0) {
                let data2 = data.transactionId;
                const _errs6 = errors;
                if (errors === _errs6) {
                  if (typeof data2 === 'string') {
                    if (!pattern1.test(data2)) {
                      validate10.errors = [
                        {
                          instancePath: instancePath + '/transactionId',
                          schemaPath: '#/properties/transactionId/pattern',
                          keyword: 'pattern',
                          params: { pattern: '^[a-zA-Z0-9_-]{43}$' },
                          message: 'must match pattern "^[a-zA-Z0-9_-]{43}$"',
                        },
                      ];
                      return false;
                    }
                  } else {
                    validate10.errors = [
                      {
                        instancePath: instancePath + '/transactionId',
                        schemaPath: '#/properties/transactionId/type',
                        keyword: 'type',
                        params: { type: 'string' },
                        message: 'must be string',
                      },
                    ];
                    return false;
                  }
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.ttlSeconds !== void 0) {
                  let data3 = data.ttlSeconds;
                  const _errs8 = errors;
                  if (
                    !(
                      typeof data3 == 'number' &&
                      !(data3 % 1) &&
                      !isNaN(data3) &&
                      isFinite(data3)
                    )
                  ) {
                    validate10.errors = [
                      {
                        instancePath: instancePath + '/ttlSeconds',
                        schemaPath: '#/properties/ttlSeconds/type',
                        keyword: 'type',
                        params: { type: 'integer' },
                        message: 'must be integer',
                      },
                    ];
                    return false;
                  }
                  if (errors === _errs8) {
                    if (typeof data3 == 'number' && isFinite(data3)) {
                      if (data3 > 2592e3 || isNaN(data3)) {
                        validate10.errors = [
                          {
                            instancePath: instancePath + '/ttlSeconds',
                            schemaPath: '#/properties/ttlSeconds/maximum',
                            keyword: 'maximum',
                            params: { comparison: '<=', limit: 2592e3 },
                            message: 'must be <= 2592000',
                          },
                        ];
                        return false;
                      } else {
                        if (data3 < 900 || isNaN(data3)) {
                          validate10.errors = [
                            {
                              instancePath: instancePath + '/ttlSeconds',
                              schemaPath: '#/properties/ttlSeconds/minimum',
                              keyword: 'minimum',
                              params: { comparison: '>=', limit: 900 },
                              message: 'must be >= 900',
                            },
                          ];
                          return false;
                        }
                      }
                    }
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate10.errors = [
        {
          instancePath,
          schemaPath: '#/type',
          keyword: 'type',
          params: { type: 'object' },
          message: 'must be object',
        },
      ];
      return false;
    }
  }
  validate10.errors = vErrors;
  return errors === 0;
}
var validateRemoveRecord = validate11;
var pattern2 = new RegExp('^[a-zA-Z0-9_-]+$', 'u');
function validate11(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      let missing0;
      if (data.subDomain === void 0 && (missing0 = 'subDomain')) {
        validate11.errors = [
          {
            instancePath,
            schemaPath: '#/required',
            keyword: 'required',
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === 'function' || key0 === 'subDomain')) {
            validate11.errors = [
              {
                instancePath,
                schemaPath: '#/additionalProperties',
                keyword: 'additionalProperties',
                params: { additionalProperty: key0 },
                message: 'must NOT have additional properties',
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.function !== void 0) {
            let data0 = data.function;
            const _errs2 = errors;
            if (typeof data0 !== 'string') {
              validate11.errors = [
                {
                  instancePath: instancePath + '/function',
                  schemaPath: '#/properties/function/type',
                  keyword: 'type',
                  params: { type: 'string' },
                  message: 'must be string',
                },
              ];
              return false;
            }
            if (data0 !== 'removeRecord') {
              validate11.errors = [
                {
                  instancePath: instancePath + '/function',
                  schemaPath: '#/properties/function/const',
                  keyword: 'const',
                  params: { allowedValue: 'removeRecord' },
                  message: 'must be equal to constant',
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.subDomain !== void 0) {
              let data1 = data.subDomain;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (typeof data1 === 'string') {
                  if (!pattern2.test(data1)) {
                    validate11.errors = [
                      {
                        instancePath: instancePath + '/subDomain',
                        schemaPath: '#/properties/subDomain/pattern',
                        keyword: 'pattern',
                        params: { pattern: '^[a-zA-Z0-9_-]+$' },
                        message: 'must match pattern "^[a-zA-Z0-9_-]+$"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate11.errors = [
                    {
                      instancePath: instancePath + '/subDomain',
                      schemaPath: '#/properties/subDomain/type',
                      keyword: 'type',
                      params: { type: 'string' },
                      message: 'must be string',
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate11.errors = [
        {
          instancePath,
          schemaPath: '#/type',
          keyword: 'type',
          params: { type: 'object' },
          message: 'must be object',
        },
      ];
      return false;
    }
  }
  validate11.errors = vErrors;
  return errors === 0;
}
var validateSetController = validate12;
function validate12(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      let missing0;
      if (data.target === void 0 && (missing0 = 'target')) {
        validate12.errors = [
          {
            instancePath,
            schemaPath: '#/required',
            keyword: 'required',
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === 'function' || key0 === 'target')) {
            validate12.errors = [
              {
                instancePath,
                schemaPath: '#/additionalProperties',
                keyword: 'additionalProperties',
                params: { additionalProperty: key0 },
                message: 'must NOT have additional properties',
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.function !== void 0) {
            let data0 = data.function;
            const _errs2 = errors;
            if (typeof data0 !== 'string') {
              validate12.errors = [
                {
                  instancePath: instancePath + '/function',
                  schemaPath: '#/properties/function/type',
                  keyword: 'type',
                  params: { type: 'string' },
                  message: 'must be string',
                },
              ];
              return false;
            }
            if (data0 !== 'setController') {
              validate12.errors = [
                {
                  instancePath: instancePath + '/function',
                  schemaPath: '#/properties/function/const',
                  keyword: 'const',
                  params: { allowedValue: 'setController' },
                  message: 'must be equal to constant',
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.target !== void 0) {
              let data1 = data.target;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (typeof data1 === 'string') {
                  if (!pattern1.test(data1)) {
                    validate12.errors = [
                      {
                        instancePath: instancePath + '/target',
                        schemaPath: '#/properties/target/pattern',
                        keyword: 'pattern',
                        params: { pattern: '^[a-zA-Z0-9_-]{43}$' },
                        message: 'must match pattern "^[a-zA-Z0-9_-]{43}$"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate12.errors = [
                    {
                      instancePath: instancePath + '/target',
                      schemaPath: '#/properties/target/type',
                      keyword: 'type',
                      params: { type: 'string' },
                      message: 'must be string',
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate12.errors = [
        {
          instancePath,
          schemaPath: '#/type',
          keyword: 'type',
          params: { type: 'object' },
          message: 'must be object',
        },
      ];
      return false;
    }
  }
  validate12.errors = vErrors;
  return errors === 0;
}
var validateRemoveController = validate13;
function validate13(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      let missing0;
      if (data.target === void 0 && (missing0 = 'target')) {
        validate13.errors = [
          {
            instancePath,
            schemaPath: '#/required',
            keyword: 'required',
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === 'function' || key0 === 'target')) {
            validate13.errors = [
              {
                instancePath,
                schemaPath: '#/additionalProperties',
                keyword: 'additionalProperties',
                params: { additionalProperty: key0 },
                message: 'must NOT have additional properties',
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.function !== void 0) {
            let data0 = data.function;
            const _errs2 = errors;
            if (typeof data0 !== 'string') {
              validate13.errors = [
                {
                  instancePath: instancePath + '/function',
                  schemaPath: '#/properties/function/type',
                  keyword: 'type',
                  params: { type: 'string' },
                  message: 'must be string',
                },
              ];
              return false;
            }
            if (data0 !== 'removeController') {
              validate13.errors = [
                {
                  instancePath: instancePath + '/function',
                  schemaPath: '#/properties/function/const',
                  keyword: 'const',
                  params: { allowedValue: 'removeController' },
                  message: 'must be equal to constant',
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.target !== void 0) {
              let data1 = data.target;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (typeof data1 === 'string') {
                  if (!pattern1.test(data1)) {
                    validate13.errors = [
                      {
                        instancePath: instancePath + '/target',
                        schemaPath: '#/properties/target/pattern',
                        keyword: 'pattern',
                        params: { pattern: '^[a-zA-Z0-9_-]{43}$' },
                        message: 'must match pattern "^[a-zA-Z0-9_-]{43}$"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate13.errors = [
                    {
                      instancePath: instancePath + '/target',
                      schemaPath: '#/properties/target/type',
                      keyword: 'type',
                      params: { type: 'string' },
                      message: 'must be string',
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate13.errors = [
        {
          instancePath,
          schemaPath: '#/type',
          keyword: 'type',
          params: { type: 'object' },
          message: 'must be object',
        },
      ];
      return false;
    }
  }
  validate13.errors = vErrors;
  return errors === 0;
}
var validateSetName = validate14;
function validate14(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      let missing0;
      if (data.name === void 0 && (missing0 = 'name')) {
        validate14.errors = [
          {
            instancePath,
            schemaPath: '#/required',
            keyword: 'required',
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === 'function' || key0 === 'name')) {
            validate14.errors = [
              {
                instancePath,
                schemaPath: '#/additionalProperties',
                keyword: 'additionalProperties',
                params: { additionalProperty: key0 },
                message: 'must NOT have additional properties',
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.function !== void 0) {
            let data0 = data.function;
            const _errs2 = errors;
            if (typeof data0 !== 'string') {
              validate14.errors = [
                {
                  instancePath: instancePath + '/function',
                  schemaPath: '#/properties/function/type',
                  keyword: 'type',
                  params: { type: 'string' },
                  message: 'must be string',
                },
              ];
              return false;
            }
            if (data0 !== 'setName') {
              validate14.errors = [
                {
                  instancePath: instancePath + '/function',
                  schemaPath: '#/properties/function/const',
                  keyword: 'const',
                  params: { allowedValue: 'setName' },
                  message: 'must be equal to constant',
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.name !== void 0) {
              const _errs4 = errors;
              if (typeof data.name !== 'string') {
                validate14.errors = [
                  {
                    instancePath: instancePath + '/name',
                    schemaPath: '#/properties/name/type',
                    keyword: 'type',
                    params: { type: 'string' },
                    message: 'must be string',
                  },
                ];
                return false;
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate14.errors = [
        {
          instancePath,
          schemaPath: '#/type',
          keyword: 'type',
          params: { type: 'object' },
          message: 'must be object',
        },
      ];
      return false;
    }
  }
  validate14.errors = vErrors;
  return errors === 0;
}
var validateSetTicker = validate15;
function validate15(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      let missing0;
      if (data.ticker === void 0 && (missing0 = 'ticker')) {
        validate15.errors = [
          {
            instancePath,
            schemaPath: '#/required',
            keyword: 'required',
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === 'function' || key0 === 'ticker')) {
            validate15.errors = [
              {
                instancePath,
                schemaPath: '#/additionalProperties',
                keyword: 'additionalProperties',
                params: { additionalProperty: key0 },
                message: 'must NOT have additional properties',
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.function !== void 0) {
            let data0 = data.function;
            const _errs2 = errors;
            if (typeof data0 !== 'string') {
              validate15.errors = [
                {
                  instancePath: instancePath + '/function',
                  schemaPath: '#/properties/function/type',
                  keyword: 'type',
                  params: { type: 'string' },
                  message: 'must be string',
                },
              ];
              return false;
            }
            if (data0 !== 'setTicker') {
              validate15.errors = [
                {
                  instancePath: instancePath + '/function',
                  schemaPath: '#/properties/function/const',
                  keyword: 'const',
                  params: { allowedValue: 'setTicker' },
                  message: 'must be equal to constant',
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.ticker !== void 0) {
              const _errs4 = errors;
              if (typeof data.ticker !== 'string') {
                validate15.errors = [
                  {
                    instancePath: instancePath + '/ticker',
                    schemaPath: '#/properties/ticker/type',
                    keyword: 'type',
                    params: { type: 'string' },
                    message: 'must be string',
                  },
                ];
                return false;
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate15.errors = [
        {
          instancePath,
          schemaPath: '#/type',
          keyword: 'type',
          params: { type: 'object' },
          message: 'must be object',
        },
      ];
      return false;
    }
  }
  validate15.errors = vErrors;
  return errors === 0;
}
var validateBalance = validate16;
function validate16(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      let missing0;
      if (data.target === void 0 && (missing0 = 'target')) {
        validate16.errors = [
          {
            instancePath,
            schemaPath: '#/required',
            keyword: 'required',
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === 'function' || key0 === 'target')) {
            validate16.errors = [
              {
                instancePath,
                schemaPath: '#/additionalProperties',
                keyword: 'additionalProperties',
                params: { additionalProperty: key0 },
                message: 'must NOT have additional properties',
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.function !== void 0) {
            let data0 = data.function;
            const _errs2 = errors;
            if (typeof data0 !== 'string') {
              validate16.errors = [
                {
                  instancePath: instancePath + '/function',
                  schemaPath: '#/properties/function/type',
                  keyword: 'type',
                  params: { type: 'string' },
                  message: 'must be string',
                },
              ];
              return false;
            }
            if (data0 !== 'balance') {
              validate16.errors = [
                {
                  instancePath: instancePath + '/function',
                  schemaPath: '#/properties/function/const',
                  keyword: 'const',
                  params: { allowedValue: 'balance' },
                  message: 'must be equal to constant',
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.target !== void 0) {
              let data1 = data.target;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (typeof data1 === 'string') {
                  if (!pattern1.test(data1)) {
                    validate16.errors = [
                      {
                        instancePath: instancePath + '/target',
                        schemaPath: '#/properties/target/pattern',
                        keyword: 'pattern',
                        params: { pattern: '^[a-zA-Z0-9_-]{43}$' },
                        message: 'must match pattern "^[a-zA-Z0-9_-]{43}$"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate16.errors = [
                    {
                      instancePath: instancePath + '/target',
                      schemaPath: '#/properties/target/type',
                      keyword: 'type',
                      params: { type: 'string' },
                      message: 'must be string',
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate16.errors = [
        {
          instancePath,
          schemaPath: '#/type',
          keyword: 'type',
          params: { type: 'object' },
          message: 'must be object',
        },
      ];
      return false;
    }
  }
  validate16.errors = vErrors;
  return errors === 0;
}
var validateTransferTokens = validate17;
function validate17(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      let missing0;
      if (data.target === void 0 && (missing0 = 'target')) {
        validate17.errors = [
          {
            instancePath,
            schemaPath: '#/required',
            keyword: 'required',
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === 'function' || key0 === 'target')) {
            validate17.errors = [
              {
                instancePath,
                schemaPath: '#/additionalProperties',
                keyword: 'additionalProperties',
                params: { additionalProperty: key0 },
                message: 'must NOT have additional properties',
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.function !== void 0) {
            let data0 = data.function;
            const _errs2 = errors;
            if (typeof data0 !== 'string') {
              validate17.errors = [
                {
                  instancePath: instancePath + '/function',
                  schemaPath: '#/properties/function/type',
                  keyword: 'type',
                  params: { type: 'string' },
                  message: 'must be string',
                },
              ];
              return false;
            }
            if (data0 !== 'transfer') {
              validate17.errors = [
                {
                  instancePath: instancePath + '/function',
                  schemaPath: '#/properties/function/const',
                  keyword: 'const',
                  params: { allowedValue: 'transfer' },
                  message: 'must be equal to constant',
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.target !== void 0) {
              let data1 = data.target;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (typeof data1 === 'string') {
                  if (!pattern1.test(data1)) {
                    validate17.errors = [
                      {
                        instancePath: instancePath + '/target',
                        schemaPath: '#/properties/target/pattern',
                        keyword: 'pattern',
                        params: { pattern: '^[a-zA-Z0-9_-]{43}$' },
                        message: 'must match pattern "^[a-zA-Z0-9_-]{43}$"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate17.errors = [
                    {
                      instancePath: instancePath + '/target',
                      schemaPath: '#/properties/target/type',
                      keyword: 'type',
                      params: { type: 'string' },
                      message: 'must be string',
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate17.errors = [
        {
          instancePath,
          schemaPath: '#/type',
          keyword: 'type',
          params: { type: 'object' },
          message: 'must be object',
        },
      ];
      return false;
    }
  }
  validate17.errors = vErrors;
  return errors === 0;
}

// src/constants.ts
var MAX_NAME_LENGTH = 20;
var TX_ID_LENGTH = 43;
var ARWEAVE_ID_REGEX = new RegExp('^[a-zA-Z0-9_-]{43}$');
var UNDERNAME_REGEX = new RegExp('^[a-zA-Z0-9_-]+$');
var INVALID_INPUT_MESSAGE = 'Invalid input for interaction';
var NON_CONTRACT_OWNER_MESSAGE = `Caller is not the owner of the ANT!`;

// src/actions/read/balance.ts
var balance = async (state, { input }) => {
  const ticker = state.ticker;
  const owner = state.owner;
  const { target } = input;
  if (!validateBalance(input)) {
    throw new ContractError(INVALID_INPUT_MESSAGE);
  }
  if (typeof target !== 'string') {
    throw new ContractError('Must specify target to get balance for');
  }
  return {
    result: { target, ticker, balance: target === owner ? 1 : 0 },
  };
};

// src/actions/write/removeRecord.ts
var removeRecord = async (state, { caller, input }) => {
  const { subDomain } = input;
  const owner = state.owner;
  const records = state.records;
  const controllers = state.controllers;
  if (!validateRemoveRecord(input)) {
    throw new ContractError(INVALID_INPUT_MESSAGE);
  }
  if (caller !== owner && !controllers.includes(caller)) {
    throw new ContractError(`Caller is not the token owner or controller!`);
  }
  if (subDomain in records) {
    delete records[subDomain];
  } else {
    throw new ContractError(`SubDomain does not exist in this ANT!`);
  }
  return { state };
};

// src/actions/write/setName.ts
var setName = async (state, { caller, input }) => {
  const { name } = input;
  const owner = state.owner;
  const controllers = state.controllers;
  if (!validateSetName(input)) {
    throw new ContractError(INVALID_INPUT_MESSAGE);
  }
  if (caller !== owner && !controllers.includes(caller)) {
    throw new ContractError(`Caller is not the token owner or controller!`);
  }
  if (typeof name !== 'string' || name === '') {
    throw new ContractError('Invalid ANT name');
  }
  state.name = name;
  return { state };
};

// src/actions/write/setTicker.ts
var setTicker = async (state, { caller, input }) => {
  const owner = state.owner;
  const controllers = state.controllers;
  const { ticker } = input;
  if (!validateSetTicker(input)) {
    console.log(input);
    throw new ContractError(INVALID_INPUT_MESSAGE);
  }
  if (caller !== owner && !controllers.includes(caller)) {
    throw new ContractError(`Caller is not the token owner or controller!`);
  }
  if (typeof ticker !== 'string' && ticker === '') {
    throw new ContractError('Invalid ANT ticker');
  }
  state.ticker = ticker;
  return { state };
};

// src/actions/write/setRecord.ts
var setRecord = async (state, { caller, input }) => {
  const { subDomain, transactionId, ttlSeconds } = input;
  const owner = state.owner;
  const controllers = state.controllers;
  if (!validateSetRecord(input)) {
    throw new ContractError(INVALID_INPUT_MESSAGE);
  }
  if (caller !== owner && !controllers.includes(caller)) {
    throw new ContractError(NON_CONTRACT_OWNER_MESSAGE);
  }
  const namePattern = new RegExp('^[a-zA-Z0-9_-]+$');
  const nameRes = namePattern.test(subDomain);
  if (
    typeof subDomain !== 'string' ||
    subDomain.length > MAX_NAME_LENGTH ||
    (!nameRes && subDomain !== '@') ||
    subDomain === 'www'
  ) {
    throw new ContractError('Invalid ArNS Record Subdomain');
  }
  const pattern = new RegExp('^[a-zA-Z0-9_-]{43}$');
  const res = pattern.test(transactionId);
  if (
    typeof transactionId !== 'string' ||
    transactionId.length !== TX_ID_LENGTH ||
    !res
  ) {
    throw new ContractError('Invalid Arweave Transaction ID');
  }
  state.records[subDomain] = {
    transactionId,
    ttlSeconds,
  };
  return { state };
};

// src/actions/write/transferTokens.ts
var transferTokens = async (state, { caller, input }) => {
  const owner = state.owner;
  const balances = state.balances;
  const { target } = input;
  if (!validateTransferTokens(input)) {
    throw new ContractError(INVALID_INPUT_MESSAGE);
  }
  if (!target) {
    throw new ContractError('No target specified');
  }
  if (caller === target) {
    throw new ContractError('Invalid token transfer');
  }
  if (caller !== owner) {
    throw new ContractError(`Caller is not the token owner!`);
  }
  if (
    !balances[caller] ||
    balances[caller] == void 0 ||
    balances[caller] == null ||
    isNaN(balances[caller])
  ) {
    throw new ContractError(`Caller balance is not defined!`);
  }
  if (balances[caller] < 1) {
    throw new ContractError(`Caller does not have a token balance!`);
  }
  state.owner = target;
  delete balances[caller];
  balances[target] = 1;
  return { state };
};

// src/actions/write/setController.ts
var setController = async (state, { caller, input }) => {
  const { target } = input;
  const owner = state.owner;
  if (!validateSetController(input)) {
    throw new ContractError(INVALID_INPUT_MESSAGE);
  }
  if (!target) {
    throw new ContractError('No target specified');
  }
  if (caller !== owner) {
    throw new ContractError(NON_CONTRACT_OWNER_MESSAGE);
  }
  if (state.controllers.includes(target)) {
    throw new ContractError(
      `Target address ${target} is already in the list of controllers`,
    );
  }
  state.controllers.push(target);
  return { state };
};

// src/actions/write/removeController.ts
var removeController = async (state, { caller, input }) => {
  const { target } = input;
  if (!validateRemoveController(input)) {
    throw new ContractError(INVALID_INPUT_MESSAGE);
  }
  const owner = state.owner;
  if (!target) {
    throw new ContractError('No target specified');
  }
  if (caller !== owner) {
    throw new ContractError(`Caller is not the token owner!`);
  }
  if (!state.controllers.includes(target)) {
    throw new ContractError(`Target address ${target} is not a controller`);
  }
  state.controllers = state.controllers.filter(
    (controller) => controller !== target,
  );
  return { state };
};

// src/actions/write/evolve.ts
var evolve = async (state, { caller, input: { value } }) => {
  const owner = state.owner;
  if (caller !== owner) {
    throw new ContractError(NON_CONTRACT_OWNER_MESSAGE);
  }
  state.evolve = value.toString();
  return { state };
};

// src/contract.ts
async function handle(state, action) {
  const input = action.input;
  switch (input.function) {
    case 'transfer':
      return await transferTokens(state, action);
    case 'setRecord':
      return await setRecord(state, action);
    case 'setName':
      return await setName(state, action);
    case 'setTicker':
      return await setTicker(state, action);
    case 'setController':
      return await setController(state, action);
    case 'removeController':
      return await removeController(state, action);
    case 'removeRecord':
      return await removeRecord(state, action);
    case 'balance':
      return await balance(state, action);
    case 'evolve':
      return await evolve(state, action);
    default:
      throw new ContractError(
        `No function supplied or function not recognised: "${input.function}"`,
      );
  }
}
