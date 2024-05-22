// src/types.ts
var PositiveFiniteInteger = class {
  constructor(positiveFiniteInteger) {
    this.positiveFiniteInteger = positiveFiniteInteger;
    if (
      !Number.isFinite(this.positiveFiniteInteger) ||
      !Number.isInteger(this.positiveFiniteInteger) ||
      this.positiveFiniteInteger < 0
    ) {
      throw new ContractError(
        `Number must be a non-negative integer value! ${positiveFiniteInteger}`,
      );
    }
  }
  [Symbol.toPrimitive](hint) {
    if (hint === 'string') {
      this.toString();
    }
    return this.positiveFiniteInteger;
  }
  plus(positiveFiniteInteger) {
    return new PositiveFiniteInteger(
      this.positiveFiniteInteger + positiveFiniteInteger.positiveFiniteInteger,
    );
  }
  minus(positiveFiniteInteger) {
    return new PositiveFiniteInteger(
      this.positiveFiniteInteger - positiveFiniteInteger.positiveFiniteInteger,
    );
  }
  isGreaterThan(positiveFiniteInteger) {
    return (
      this.positiveFiniteInteger > positiveFiniteInteger.positiveFiniteInteger
    );
  }
  isGreaterThanOrEqualTo(positiveFiniteInteger) {
    return (
      this.positiveFiniteInteger >= positiveFiniteInteger.positiveFiniteInteger
    );
  }
  isLessThan(positiveFiniteInteger) {
    return (
      this.positiveFiniteInteger < positiveFiniteInteger.positiveFiniteInteger
    );
  }
  isLessThanOrEqualTo(positiveFiniteInteger) {
    return (
      this.positiveFiniteInteger <= positiveFiniteInteger.positiveFiniteInteger
    );
  }
  toString() {
    return `${this.positiveFiniteInteger}`;
  }
  valueOf() {
    return this.positiveFiniteInteger;
  }
  toJSON() {
    return this.positiveFiniteInteger;
  }
  equals(other) {
    return this.positiveFiniteInteger === other.positiveFiniteInteger;
  }
};
var BlockHeight = class extends PositiveFiniteInteger {
  // TODO: Improve upon this technique for sub-type discrimination
  type = 'BlockHeight';
  constructor(blockHeight) {
    super(blockHeight);
  }
  plus(blockHeight) {
    const result = super.plus(blockHeight);
    return new BlockHeight(result.valueOf());
  }
  minus(blockHeight) {
    const result = super.minus(blockHeight);
    return new BlockHeight(result.valueOf());
  }
};
var BlockTimestamp = class extends PositiveFiniteInteger {
  // TODO: Improve upon this technique for sub-type discrimination
  type = 'BlockTimestamp';
  constructor(blockTimestamp) {
    super(blockTimestamp);
  }
};
var mIOPerIO = 1e6;
var IOToken = class {
  value;
  constructor(value) {
    this.value = +value.toFixed(6);
  }
  valueOf() {
    return this.value;
  }
  toMIO() {
    return new mIOToken(Math.floor(this.value * mIOPerIO));
  }
};
var mIOToken = class extends PositiveFiniteInteger {
  constructor(value) {
    super(value);
  }
  multiply(multiplier) {
    const result = Math.floor(this.valueOf() * multiplier.valueOf());
    return new mIOToken(result);
  }
  divide(divisor) {
    if (divisor.valueOf() === 0) {
      throw new ContractError('Cannot divide by zero');
    }
    const result = Math.floor(this.valueOf() / divisor.valueOf());
    return new mIOToken(result);
  }
  plus(addend) {
    const result = super.plus(addend);
    return new mIOToken(result.valueOf());
  }
  minus(subtractHend) {
    const result = super.minus(subtractHend);
    return new mIOToken(result.valueOf());
  }
  toIO() {
    return new IOToken(this.valueOf() / mIOPerIO);
  }
};

// src/constants.ts
var TOTAL_IO_SUPPLY = new IOToken(1e9).toMIO();
var SECONDS_IN_A_YEAR = 31536e3;
var BLOCKS_PER_DAY = 720;
var GATEWAY_LEAVE_BLOCK_LENGTH = new BlockHeight(21 * BLOCKS_PER_DAY);
var GATEWAY_REDUCE_STAKE_BLOCK_LENGTH = 30 * BLOCKS_PER_DAY;
var MAX_TOKEN_LOCK_BLOCK_LENGTH = 12 * 365 * BLOCKS_PER_DAY;
var MIN_TOKEN_LOCK_BLOCK_LENGTH = 14 * BLOCKS_PER_DAY;
var MINIMUM_ALLOWED_NAME_LENGTH = 5;
var NETWORK_JOIN_STATUS = 'joined';
var NETWORK_LEAVING_STATUS = 'leaving';
var MIN_OPERATOR_STAKE = new IOToken(1e4).toMIO();
var MIN_DELEGATED_STAKE = new IOToken(100).toMIO();
var DELEGATED_STAKE_UNLOCK_LENGTH = new BlockHeight(30 * BLOCKS_PER_DAY);
var MAX_DELEGATES = 1e4;
var GATEWAY_REGISTRY_SETTINGS = {
  gatewayLeaveLength: new BlockHeight(3600),
  // approximately 5 days
  maxLockLength: new BlockHeight(788400),
  minGatewayJoinLength: new BlockHeight(3600),
  // TODO: remove this as gatewayLeaveLength achieves the same thing
  minLockLength: new BlockHeight(720),
  // 1 day
  operatorStakeWithdrawLength: new BlockHeight(3600),
  // TODO: bump to 90 days
  // TODO: add delegatedStakeWithdrawLength to 30 days
};
var MAX_TENURE_WEIGHT = 4;
var TENURE_WEIGHT_DAYS = 180;
var TENURE_WEIGHT_PERIOD = TENURE_WEIGHT_DAYS * BLOCKS_PER_DAY;
var ARNS_LEASE_LENGTH_MAX_YEARS = 5;
var RESERVED_ATOMIC_TX_ID = 'atomic';
var SHORT_NAME_RESERVATION_UNLOCK_TIMESTAMP = 17250804e5;
var PERMABUY_LEASE_FEE_LENGTH = 10;
var ANNUAL_PERCENTAGE_FEE = 0.2;
var DEFAULT_UNDERNAME_COUNT = 10;
var UNDERNAME_LEASE_FEE_PERCENTAGE = 1e-3;
var UNDERNAME_PERMABUY_FEE_PERCENTAGE = 5e-3;
var MAX_ALLOWED_UNDERNAMES = 1e4;
var SECONDS_IN_GRACE_PERIOD = 1814400;
var AUCTION_SETTINGS = {
  floorPriceMultiplier: 1,
  startPriceMultiplier: 50,
  exponentialDecayRate: 2e-6,
  scalingExponent: 190,
  auctionDuration: 10080,
  // approx 14 days long
};
var DEMAND_FACTORING_SETTINGS = {
  movingAvgPeriodCount: 7,
  periodBlockCount: 720,
  demandFactorBaseValue: 1,
  demandFactorMin: 0.5,
  demandFactorUpAdjustment: 0.05,
  demandFactorDownAdjustment: 0.025,
  stepDownThreshold: 3,
  // number of times at minimum allowed before resetting genesis fees (ultimately leads to 4 periods at the new fee, including the reset period)
  criteria: 'revenue',
};
var NON_CONTRACT_OWNER_MESSAGE = `Caller is not the owner of the ArNS!`;
var ARNS_NAME_MUST_BE_AUCTIONED_MESSAGE = 'Name must be auctioned.';
var ARNS_NAME_RESERVED_MESSAGE = 'Name is reserved.';
var ARNS_NAME_IN_AUCTION_MESSAGE = 'Name is currently in auction.';
var ARNS_NAME_AUCTION_EXPIRED_MESSAGE = 'Auction has expired.';
var ARNS_NON_EXPIRED_NAME_MESSAGE =
  'This name already exists in an active lease';
var ARNS_NAME_DOES_NOT_EXIST_MESSAGE =
  'Name does not exist in the ArNS Contract!';
var ARNS_MAX_UNDERNAME_MESSAGE = `Name has reached undername limit of ${MAX_ALLOWED_UNDERNAMES}`;
var ARNS_INVALID_YEARS_MESSAGE = `Invalid number of years. Must be an integer and less than or equal to ${ARNS_LEASE_LENGTH_MAX_YEARS}`;
var ARNS_INVALID_SHORT_NAME = `Name is less than ${MINIMUM_ALLOWED_NAME_LENGTH} characters. It will be available for auction after ${SHORT_NAME_RESERVATION_UNLOCK_TIMESTAMP}.`;
var ARNS_INVALID_EXTENSION_MESSAGE = `This name has been permanently registered and its lease cannot be extended.`;
var INVALID_VAULT_LOCK_LENGTH_MESSAGE = `Invalid lock length. Must be between ${MIN_TOKEN_LOCK_BLOCK_LENGTH} - ${MAX_TOKEN_LOCK_BLOCK_LENGTH}.`;
var INVALID_OBSERVATION_CALLER_MESSAGE =
  'Invalid caller. Caller is not eligible to submit observation reports for this epoch.';
var INVALID_GATEWAY_STAKE_AMOUNT_MESSAGE = `Quantity must be greater than or equal to the minimum network join stake amount.`;
var INVALID_OBSERVER_WALLET =
  'Invalid observer wallet. The provided observer wallet is correlated with another gateway.';
var INVALID_GATEWAY_REGISTERED_MESSAGE =
  'Target gateway is not currently registered';
var INVALID_GATEWAY_EXISTS_MESSAGE =
  'A gateway with this address already exists.';
var INSUFFICIENT_FUNDS_MESSAGE = 'Insufficient funds for this transaction.';
var INVALID_TARGET_MESSAGE = 'Invalid target specified';
var INVALID_INPUT_MESSAGE = 'Invalid input for interaction';
var OBSERVERS_SAMPLED_BLOCKS_COUNT = 3;
var OBSERVERS_SAMPLED_BLOCKS_OFFSET = 50;
var EPOCH_BLOCK_LENGTH = 720;
var EPOCH_DISTRIBUTION_DELAY = 15;
var EPOCH_REWARD_PERCENTAGE = 25e-4;
var GATEWAY_PERCENTAGE_OF_EPOCH_REWARD = 0.95;
var OBSERVER_PERCENTAGE_OF_EPOCH_REWARD =
  1 - GATEWAY_PERCENTAGE_OF_EPOCH_REWARD;
var OBSERVATION_FAILURE_THRESHOLD = 0.5;
var BAD_OBSERVER_GATEWAY_PENALTY = 0.25;
var MAXIMUM_OBSERVERS_PER_EPOCH = 50;
var MAXIMUM_OBSERVER_CONSECUTIVE_FAIL_COUNT = 21;
var EPOCH_BLOCK_ZERO_START_HEIGHT = 1350700;
var DEFAULT_GATEWAY_PERFORMANCE_STATS = {
  passedEpochCount: 0,
  failedConsecutiveEpochs: 0,
  totalEpochParticipationCount: 0,
  submittedEpochCount: 0,
  totalEpochsPrescribedCount: 0,
};
var INITIAL_EPOCH_DISTRIBUTION_DATA = {
  epochZeroStartHeight: EPOCH_BLOCK_ZERO_START_HEIGHT,
  epochStartHeight: EPOCH_BLOCK_ZERO_START_HEIGHT,
  epochEndHeight: EPOCH_BLOCK_ZERO_START_HEIGHT + EPOCH_BLOCK_LENGTH - 1,
  epochPeriod: 0,
  nextDistributionHeight:
    EPOCH_BLOCK_ZERO_START_HEIGHT +
    EPOCH_BLOCK_LENGTH -
    1 +
    EPOCH_DISTRIBUTION_DELAY,
};

// src/pricing.ts
function tallyNamePurchase(dfData, revenue) {
  const newDfData = cloneDemandFactoringData(dfData);
  newDfData.purchasesThisPeriod++;
  newDfData.revenueThisPeriod += revenue.valueOf();
  return newDfData;
}
function updateDemandFactor(currentHeight, dfData, fees) {
  if (!shouldUpdateDemandFactor(currentHeight, dfData)) {
    return {
      demandFactoring: dfData,
      fees,
    };
  }
  const newDemandFactoringData = cloneDemandFactoringData(dfData);
  let updatedFees;
  const numNamesPurchasedInLastPeriod = dfData.purchasesThisPeriod;
  const mvgAvgOfTrailingNamePurchases = mvgAvgTrailingPurchaseCounts(dfData);
  const revenueInLastPeriod = dfData.revenueThisPeriod;
  const mvgAvgOfTrailingRevenue = mvgAvgTrailingRevenues(dfData);
  if (
    demandIsIncreasing({
      numNamesPurchasedInLastPeriod,
      mvgAvgOfTrailingNamePurchases,
      revenueInLastPeriod,
      mvgAvgOfTrailingRevenue,
      demandFactoringCriteria: DEMAND_FACTORING_SETTINGS.criteria,
    })
  ) {
    newDemandFactoringData.demandFactor *=
      1 + DEMAND_FACTORING_SETTINGS.demandFactorUpAdjustment;
  } else if (dfData.demandFactor > DEMAND_FACTORING_SETTINGS.demandFactorMin) {
    newDemandFactoringData.demandFactor *=
      1 - DEMAND_FACTORING_SETTINGS.demandFactorDownAdjustment;
  }
  if (
    newDemandFactoringData.demandFactor ===
    DEMAND_FACTORING_SETTINGS.demandFactorMin
  ) {
    if (
      ++newDemandFactoringData.consecutivePeriodsWithMinDemandFactor >=
      DEMAND_FACTORING_SETTINGS.stepDownThreshold
    ) {
      newDemandFactoringData.consecutivePeriodsWithMinDemandFactor = 0;
      newDemandFactoringData.demandFactor =
        DEMAND_FACTORING_SETTINGS.demandFactorBaseValue;
      updatedFees = Object.keys(fees).reduce((acc, nameLength) => {
        const updatedFee = new mIOToken(fees[nameLength]).multiply(
          DEMAND_FACTORING_SETTINGS.demandFactorMin,
        );
        acc[nameLength] = Math.max(
          updatedFee.valueOf(),
          new mIOToken(1).valueOf(),
        );
        return acc;
      }, {});
    }
  } else {
    newDemandFactoringData.consecutivePeriodsWithMinDemandFactor = 0;
  }
  const trailingPeriodIndex = demandFactorPeriodIndex(
    newDemandFactoringData.currentPeriod,
  );
  newDemandFactoringData.trailingPeriodPurchases[trailingPeriodIndex] =
    numNamesPurchasedInLastPeriod;
  newDemandFactoringData.trailingPeriodRevenues[trailingPeriodIndex] =
    revenueInLastPeriod;
  newDemandFactoringData.currentPeriod++;
  newDemandFactoringData.purchasesThisPeriod = 0;
  newDemandFactoringData.revenueThisPeriod = 0;
  return {
    demandFactoring: newDemandFactoringData,
    fees: updatedFees || fees,
  };
}
function shouldUpdateDemandFactor(currentHeight, dfData) {
  if (currentHeight.valueOf() === dfData.periodZeroBlockHeight) {
    return false;
  }
  const currentPeriod = periodAtHeight(
    currentHeight,
    new BlockHeight(dfData.periodZeroBlockHeight),
  );
  return currentPeriod > dfData.currentPeriod;
}
function demandIsIncreasing({
  numNamesPurchasedInLastPeriod,
  mvgAvgOfTrailingNamePurchases: mvgAvgOfTailingNamePurchases,
  revenueInLastPeriod,
  mvgAvgOfTrailingRevenue,
  demandFactoringCriteria,
}) {
  switch (demandFactoringCriteria) {
    case 'purchases':
      return (
        numNamesPurchasedInLastPeriod >= mvgAvgOfTailingNamePurchases &&
        numNamesPurchasedInLastPeriod !== 0
      );
    case 'revenue':
      return (
        revenueInLastPeriod >= mvgAvgOfTrailingRevenue &&
        revenueInLastPeriod !== 0
      );
  }
}
function periodAtHeight(height, periodZeroHeight) {
  return Math.floor(
    (height.valueOf() - periodZeroHeight.valueOf()) /
      DEMAND_FACTORING_SETTINGS.periodBlockCount,
  );
}
function demandFactorPeriodIndex(period) {
  return period % DEMAND_FACTORING_SETTINGS.movingAvgPeriodCount;
}
function mvgAvgTrailingPurchaseCounts(dfData) {
  return (
    dfData.trailingPeriodPurchases.reduce(
      (acc, periodPurchaseCount) => acc + periodPurchaseCount,
      0,
    ) / DEMAND_FACTORING_SETTINGS.movingAvgPeriodCount
  );
}
function mvgAvgTrailingRevenues(dfData) {
  return (
    dfData.trailingPeriodRevenues.reduce(
      (acc, periodRevenue) => acc + periodRevenue,
      0,
    ) / DEMAND_FACTORING_SETTINGS.movingAvgPeriodCount
  );
}
function cloneDemandFactoringData(dfData) {
  return {
    ...dfData,
    trailingPeriodPurchases: dfData.trailingPeriodPurchases.slice(),
    trailingPeriodRevenues: dfData.trailingPeriodRevenues.slice(),
  };
}
function calculateLeaseFee({ name, fees, years, demandFactoring }) {
  const initialNamePurchaseFee = new mIOToken(fees[name.length.toString()]);
  const annualRenewalFees = calculateAnnualRenewalFee({
    name,
    fees,
    years,
  });
  const initialFeeWithAnnualRenewal =
    initialNamePurchaseFee.plus(annualRenewalFees);
  return initialFeeWithAnnualRenewal.multiply(demandFactoring.demandFactor);
}
function calculateAnnualRenewalFee({ name, fees, years }) {
  const initialNamePurchaseFee = new mIOToken(fees[name.length.toString()]);
  return initialNamePurchaseFee.multiply(ANNUAL_PERCENTAGE_FEE).multiply(years);
}
function calculatePermabuyFee({ name, fees, demandFactoring }) {
  const initialNamePurchaseFee = new mIOToken(fees[name.length.toString()]);
  const annualRenewalFeeForPermabuy = calculateAnnualRenewalFee({
    name,
    fees,
    years: PERMABUY_LEASE_FEE_LENGTH,
  });
  const initialFeeWithAnnualRenewal = initialNamePurchaseFee.plus(
    annualRenewalFeeForPermabuy,
  );
  return initialFeeWithAnnualRenewal.multiply(demandFactoring.demandFactor);
}
function calculateRegistrationFee({
  type,
  name,
  fees,
  years,
  currentBlockTimestamp,
  demandFactoring,
}) {
  switch (type) {
    case 'lease':
      return calculateLeaseFee({
        name,
        fees,
        years,
        currentBlockTimestamp,
        demandFactoring,
      });
    case 'permabuy':
      return calculatePermabuyFee({
        name,
        fees,
        currentBlockTimestamp,
        demandFactoring,
      });
  }
}
function calculateUndernameCost({
  name,
  fees,
  increaseQty,
  type,
  demandFactoring,
  years,
}) {
  const initialNameFee = new mIOToken(fees[name.length.toString()]);
  const getUndernameFeePercentage = () => {
    switch (type) {
      case 'lease':
        return UNDERNAME_LEASE_FEE_PERCENTAGE;
      case 'permabuy':
        return UNDERNAME_PERMABUY_FEE_PERCENTAGE;
    }
  };
  const undernamePercentageFee = getUndernameFeePercentage();
  const totalFeeForQtyAndYears = initialNameFee
    .multiply(undernamePercentageFee)
    .multiply(increaseQty)
    .multiply(years);
  return totalFeeForQtyAndYears.multiply(demandFactoring.demandFactor);
}

// src/records.ts
function isNameInGracePeriod({ record, currentBlockTimestamp }) {
  if (!record.endTimestamp) return false;
  const recordIsExpired = currentBlockTimestamp.valueOf() > record.endTimestamp;
  return (
    recordIsExpired &&
    record.endTimestamp + SECONDS_IN_GRACE_PERIOD >
      currentBlockTimestamp.valueOf()
  );
}
function getMaxAllowedYearsExtensionForRecord({
  currentBlockTimestamp,
  record,
}) {
  if (!record.endTimestamp) {
    return 0;
  }
  if (
    currentBlockTimestamp.valueOf() >
    record.endTimestamp + SECONDS_IN_GRACE_PERIOD
  ) {
    return 0;
  }
  if (isNameInGracePeriod({ currentBlockTimestamp, record })) {
    return ARNS_LEASE_LENGTH_MAX_YEARS;
  }
  const yearsRemainingOnLease = Math.ceil(
    (record.endTimestamp.valueOf() - currentBlockTimestamp.valueOf()) /
      SECONDS_IN_A_YEAR,
  );
  return ARNS_LEASE_LENGTH_MAX_YEARS - yearsRemainingOnLease;
}
function isExistingActiveRecord({ record, currentBlockTimestamp }) {
  if (!record) return false;
  if (!isLeaseRecord(record)) {
    return true;
  }
  return (
    record.endTimestamp > currentBlockTimestamp.valueOf() ||
    isNameInGracePeriod({ currentBlockTimestamp, record })
  );
}
function isShortNameRestricted({ name, currentBlockTimestamp }) {
  return (
    name.length < MINIMUM_ALLOWED_NAME_LENGTH &&
    currentBlockTimestamp.valueOf() < SHORT_NAME_RESERVATION_UNLOCK_TIMESTAMP
  );
}
function isActiveReservedName({ caller, reservedName, currentBlockTimestamp }) {
  if (!reservedName) return false;
  const target = reservedName.target;
  const endTimestamp = reservedName.endTimestamp;
  const permanentlyReserved = !target && !endTimestamp;
  if (permanentlyReserved) {
    return true;
  }
  const isCallerTarget = caller !== void 0 && target === caller;
  const isActiveReservation =
    endTimestamp === void 0 ||
    (endTimestamp !== void 0 && endTimestamp > currentBlockTimestamp.valueOf());
  if (!isCallerTarget && isActiveReservation) {
    return true;
  }
  return false;
}
function assertAvailableRecord({
  caller,
  name,
  records,
  reserved,
  currentBlockTimestamp,
  type,
  auction,
}) {
  const isActiveRecord = isExistingActiveRecord({
    record: records[name],
    currentBlockTimestamp,
  });
  const isReserved = isActiveReservedName({
    caller,
    reservedName: reserved[name],
    currentBlockTimestamp,
  });
  const isShortName = isShortNameRestricted({
    name,
    currentBlockTimestamp,
  });
  const isAuctionRequired = isNameRequiredToBeAuction({ name, type });
  if (isActiveRecord) {
    throw new ContractError(ARNS_NON_EXPIRED_NAME_MESSAGE);
  }
  if (reserved[name]?.target === caller) {
    return;
  }
  if (!caller) {
    return;
  }
  if (isReserved) {
    throw new ContractError(ARNS_NAME_RESERVED_MESSAGE);
  }
  if (isShortName) {
    throw new ContractError(ARNS_INVALID_SHORT_NAME);
  }
  if (isAuctionRequired && !auction) {
    throw new ContractError(ARNS_NAME_MUST_BE_AUCTIONED_MESSAGE);
  }
}
function isLeaseRecord(record) {
  return record.type === 'lease';
}

// src/auctions.ts
function calculateAuctionPriceForBlock({
  startHeight,
  startPrice,
  floorPrice,
  currentBlockHeight,
  auctionSettings = AUCTION_SETTINGS,
}) {
  const blocksSinceStart = currentBlockHeight.valueOf() - startHeight.valueOf();
  const decaySinceStart =
    auctionSettings.exponentialDecayRate * blocksSinceStart;
  const dutchAuctionBid = startPrice.multiply(
    Math.pow(1 - decaySinceStart, auctionSettings.scalingExponent),
  );
  const defaultMinimumBid = floorPrice.isGreaterThan(dutchAuctionBid)
    ? floorPrice
    : dutchAuctionBid;
  return startPrice.isLessThan(defaultMinimumBid)
    ? startPrice
    : defaultMinimumBid;
}
function getAuctionPricesForInterval({
  startHeight,
  startPrice,
  floorPrice,
  blocksPerInterval,
  auctionSettings = AUCTION_SETTINGS,
}) {
  const prices = {};
  for (
    let intervalBlockHeight = 0;
    intervalBlockHeight <= auctionSettings.auctionDuration;
    intervalBlockHeight += blocksPerInterval
  ) {
    const blockHeightForInterval = startHeight.valueOf() + intervalBlockHeight;
    const price = calculateAuctionPriceForBlock({
      startHeight,
      startPrice,
      floorPrice,
      currentBlockHeight: new BlockHeight(blockHeightForInterval),
      auctionSettings,
    });
    prices[blockHeightForInterval] = price.valueOf();
  }
  return prices;
}
function createAuctionObject({
  fees,
  contractTxId,
  currentBlockHeight,
  currentBlockTimestamp,
  type,
  initiator,
  demandFactoring,
  name,
}) {
  const initialRegistrationFee = calculateRegistrationFee({
    name,
    fees,
    type,
    years: 1,
    currentBlockTimestamp,
    demandFactoring,
  });
  const calculatedFloorPrice = initialRegistrationFee.multiply(
    AUCTION_SETTINGS.floorPriceMultiplier,
  );
  const startPrice = calculatedFloorPrice.multiply(
    AUCTION_SETTINGS.startPriceMultiplier,
  );
  const endHeight = currentBlockHeight.plus(
    new BlockHeight(AUCTION_SETTINGS.auctionDuration),
  );
  const baseAuctionData = {
    initiator,
    // the balance that the floor price is decremented from
    contractTxId,
    startPrice,
    floorPrice: calculatedFloorPrice,
    // this is decremented from the initiators wallet, and could be higher than the precalculated floor
    startHeight: currentBlockHeight,
    // auction starts right away
    endHeight,
    // auction ends after the set duration
    type,
  };
  switch (type) {
    case 'permabuy':
      return {
        ...baseAuctionData,
        type: 'permabuy',
      };
    case 'lease':
      return {
        ...baseAuctionData,
        years: 1,
        type: 'lease',
      };
    default:
      throw new ContractError('Invalid auction type');
  }
}
function getEndTimestampForAuction({ auction, currentBlockTimestamp }) {
  switch (auction.type) {
    case 'permabuy':
      return void 0;
    case 'lease':
      return new BlockTimestamp(
        currentBlockTimestamp.valueOf() + SECONDS_IN_A_YEAR * auction.years,
      );
    default:
      throw new ContractError('Invalid auction type');
  }
}
function calculateExistingAuctionBidForCaller({
  caller,
  auction,
  submittedBid,
  requiredMinimumBid,
}) {
  if (submittedBid && submittedBid.isLessThan(requiredMinimumBid)) {
    throw new ContractError(
      `The bid (${submittedBid.valueOf()} mIO) is less than the current required minimum bid of ${requiredMinimumBid.valueOf()} mIO.`,
    );
  }
  if (caller === auction.initiator) {
    const floorPrice = new mIOToken(auction.floorPrice);
    return requiredMinimumBid.minus(floorPrice);
  }
  return requiredMinimumBid;
}
function isNameAvailableForAuction({
  name,
  record,
  reservedName,
  caller,
  currentBlockTimestamp,
}) {
  return (
    !isExistingActiveRecord({ record, currentBlockTimestamp }) &&
    !isActiveReservedName({ reservedName, caller, currentBlockTimestamp }) &&
    !isShortNameRestricted({ name, currentBlockTimestamp })
  );
}
function isNameRequiredToBeAuction({ name, type }) {
  return type === 'permabuy' && name.length < 12;
}

// src/actions/read/auctions.ts
var getAuction = (state, { caller, input: { name, type = 'lease' } }) => {
  const { records, auctions, fees, reserved } = state;
  const formattedName = name.toLowerCase().trim();
  const auction = auctions[formattedName];
  if (!auction) {
    const currentBlockTimestamp = new BlockTimestamp(
      +SmartWeave.block.timestamp,
    );
    const currentBlockHeight = new BlockHeight(+SmartWeave.block.height);
    const auctionObject = createAuctionObject({
      type,
      name,
      fees,
      currentBlockTimestamp,
      demandFactoring: state.demandFactoring,
      currentBlockHeight,
      contractTxId: '',
      initiator: '',
    });
    const prices2 = getAuctionPricesForInterval({
      startHeight: currentBlockHeight,
      // set it to the current block height
      startPrice: auctionObject.startPrice,
      floorPrice: auctionObject.floorPrice,
      blocksPerInterval: 30,
      // TODO: this could be an input on the function
      auctionSettings: AUCTION_SETTINGS,
    });
    const record = records[formattedName];
    const reservedName = reserved[formattedName];
    const isAvailableForAuction = isNameAvailableForAuction({
      caller,
      name: formattedName,
      record,
      reservedName,
      currentBlockTimestamp,
    });
    const isRequiredToBeAuctioned2 = isNameRequiredToBeAuction({
      name: formattedName,
      type,
    });
    return {
      result: {
        name: formattedName,
        ...auctionObject,
        isActive: false,
        isAvailableForAuction,
        isRequiredToBeAuctioned: isRequiredToBeAuctioned2,
        startPrice: auctionObject.startPrice.valueOf(),
        floorPrice: auctionObject.floorPrice.valueOf(),
        startHeight: auctionObject.startHeight.valueOf(),
        endHeight: auctionObject.endHeight.valueOf(),
        currentPrice: auctionObject.floorPrice.valueOf(),
        // since its not active yet, the minimum bid is the floor price
        prices: prices2,
      },
    };
  }
  const { startHeight, floorPrice, startPrice } = auction;
  const expirationHeight = startHeight + AUCTION_SETTINGS.auctionDuration;
  const isRequiredToBeAuctioned = isNameRequiredToBeAuction({
    name: formattedName,
    type: auction.type,
  });
  const prices = getAuctionPricesForInterval({
    startHeight: new BlockHeight(startHeight),
    startPrice: new mIOToken(startPrice),
    floorPrice: new mIOToken(floorPrice),
    blocksPerInterval: 30,
    // TODO: this could be an input on the function
    auctionSettings: AUCTION_SETTINGS,
  });
  const minimumBid = calculateAuctionPriceForBlock({
    startHeight: new BlockHeight(startHeight),
    startPrice: new mIOToken(startPrice),
    floorPrice: new mIOToken(floorPrice),
    currentBlockHeight: new BlockHeight(+SmartWeave.block.height),
    auctionSettings: AUCTION_SETTINGS,
  });
  return {
    result: {
      name: formattedName,
      isActive: expirationHeight >= +SmartWeave.block.height,
      isAvailableForAuction: false,
      isRequiredToBeAuctioned,
      currentPrice: minimumBid.valueOf(),
      ...auction,
      prices,
    },
  };
};

// src/actions/read/balance.ts
var balance = async (state, { input: { target } }) => {
  const balances = state.balances;
  if (typeof target !== 'string') {
    throw new ContractError('Must specify target to get balance for');
  }
  if (typeof balances[target] !== 'number') {
    throw new ContractError('Cannot get balance, target does not exist');
  }
  const balance2 = new mIOToken(balances[target]);
  return {
    result: {
      target,
      balance: balance2.valueOf(),
    },
  };
};

// src/observers.ts
function getEpochDataForHeight({
  currentBlockHeight,
  epochBlockLength = new BlockHeight(EPOCH_BLOCK_LENGTH),
  epochZeroStartHeight,
}) {
  const epochIndexForCurrentBlockHeight = Math.floor(
    Math.max(
      0,
      (currentBlockHeight.valueOf() - epochZeroStartHeight.valueOf()) /
        epochBlockLength.valueOf(),
    ),
  );
  const epochStartHeight =
    epochZeroStartHeight.valueOf() +
    epochBlockLength.valueOf() * epochIndexForCurrentBlockHeight;
  const epochEndHeight = epochStartHeight + epochBlockLength.valueOf() - 1;
  const epochDistributionHeight = epochEndHeight + EPOCH_DISTRIBUTION_DELAY;
  return {
    epochStartHeight: new BlockHeight(epochStartHeight),
    epochEndHeight: new BlockHeight(epochEndHeight),
    epochDistributionHeight: new BlockHeight(epochDistributionHeight),
    epochPeriod: new BlockHeight(epochIndexForCurrentBlockHeight),
  };
}
async function getEntropyHashForEpoch({ epochStartHeight }) {
  let bufferHash = Buffer.from('');
  for (let i = 0; i < OBSERVERS_SAMPLED_BLOCKS_COUNT; i++) {
    const blockHeight = Math.max(
      0,
      epochStartHeight.valueOf() - OBSERVERS_SAMPLED_BLOCKS_OFFSET - i,
    );
    const path = `/block/height/${blockHeight}`;
    const data = await SmartWeave.safeArweaveGet(path);
    const indep_hash = data.indep_hash;
    if (!indep_hash) {
      throw new ContractError(
        `Block ${blockHeight.valueOf()} has no indep_hash`,
      );
    }
    bufferHash = Buffer.concat([
      bufferHash,
      Buffer.from(indep_hash, 'base64url'),
    ]);
  }
  return SmartWeave.arweave.crypto.hash(bufferHash, 'SHA-256');
}
function isGatewayLeaving({ gateway, currentBlockHeight }) {
  return (
    gateway.status === 'leaving' && gateway.end <= currentBlockHeight.valueOf()
  );
}
function isGatewayEligibleForDistribution({
  epochStartHeight,
  epochEndHeight,
  gateway,
}) {
  if (!gateway) return false;
  const didStartBeforeEpoch = gateway.start <= epochStartHeight.valueOf();
  const didNotLeaveDuringEpoch = !isGatewayLeaving({
    gateway,
    currentBlockHeight: epochEndHeight,
  });
  return didStartBeforeEpoch && didNotLeaveDuringEpoch;
}
function getEligibleGatewaysForEpoch({
  epochStartHeight,
  epochEndHeight,
  gateways,
}) {
  const eligibleGateways = {};
  for (const [address, gateway] of Object.entries(gateways)) {
    if (
      isGatewayEligibleForDistribution({
        epochStartHeight,
        epochEndHeight,
        gateway,
      })
    ) {
      eligibleGateways[address] = gateway;
    }
  }
  return eligibleGateways;
}
function getObserverWeightsForEpoch({
  gateways,
  epochStartHeight,
  minOperatorStake,
}) {
  const weightedObservers = [];
  let totalCompositeWeight = 0;
  for (const [address, gateway] of Object.entries(gateways)) {
    const stake = new mIOToken(
      gateway.operatorStake + gateway.totalDelegatedStake,
    );
    const stakeWeightRatio = stake.valueOf() / minOperatorStake.valueOf();
    const gatewayStart = new BlockHeight(gateway.start);
    const totalBlocksForGateway = epochStartHeight.isGreaterThanOrEqualTo(
      gatewayStart,
    )
      ? epochStartHeight.minus(gatewayStart).valueOf()
      : -1;
    const calculatedTenureWeightForGateway =
      totalBlocksForGateway < 0
        ? 0
        : totalBlocksForGateway
          ? totalBlocksForGateway / TENURE_WEIGHT_PERIOD
          : 1 / TENURE_WEIGHT_PERIOD;
    const gatewayTenureWeight = Math.min(
      calculatedTenureWeightForGateway,
      MAX_TENURE_WEIGHT,
    );
    const totalEpochsGatewayPassed = gateway.stats.passedEpochCount || 0;
    const totalEpochsParticipatedIn =
      gateway.stats.totalEpochParticipationCount || 0;
    const gatewayRewardRatioWeight =
      (1 + totalEpochsGatewayPassed) / (1 + totalEpochsParticipatedIn);
    const totalEpochsPrescribed = gateway.stats.totalEpochsPrescribedCount || 0;
    const totalEpochsSubmitted = gateway.stats.submittedEpochCount || 0;
    const observerRewardRatioWeight =
      (1 + totalEpochsSubmitted) / (1 + totalEpochsPrescribed);
    const compositeWeight =
      stakeWeightRatio *
      gatewayTenureWeight *
      gatewayRewardRatioWeight *
      observerRewardRatioWeight;
    weightedObservers.push({
      gatewayAddress: address,
      observerAddress: gateway.observerWallet,
      stake: stake.valueOf(),
      start: gateway.start,
      stakeWeight: stakeWeightRatio,
      tenureWeight: gatewayTenureWeight,
      gatewayRewardRatioWeight,
      observerRewardRatioWeight,
      compositeWeight,
      normalizedCompositeWeight: void 0,
      // set later once we have the total composite weight
    });
    totalCompositeWeight += compositeWeight;
  }
  for (const weightedObserver of weightedObservers) {
    weightedObserver.normalizedCompositeWeight = totalCompositeWeight
      ? weightedObserver.compositeWeight / totalCompositeWeight
      : 0;
  }
  return weightedObservers;
}
async function getPrescribedObserversForEpoch({
  gateways,
  epochStartHeight,
  epochEndHeight,
  minOperatorStake,
}) {
  const eligibleGateways = getEligibleGatewaysForEpoch({
    epochStartHeight,
    epochEndHeight,
    gateways,
  });
  const weightedObservers = getObserverWeightsForEpoch({
    gateways: eligibleGateways,
    epochStartHeight,
    minOperatorStake,
    // filter out any that could have a normalized composite weight of 0 to avoid infinite loops when randomly selecting prescribed observers below
  }).filter((observer) => observer.normalizedCompositeWeight > 0);
  if (MAXIMUM_OBSERVERS_PER_EPOCH >= weightedObservers.length) {
    return weightedObservers;
  }
  const blockHeightEntropyHash = await getEntropyHashForEpoch({
    epochStartHeight,
  });
  const prescribedObserversAddresses = /* @__PURE__ */ new Set();
  let hash = blockHeightEntropyHash;
  while (prescribedObserversAddresses.size < MAXIMUM_OBSERVERS_PER_EPOCH) {
    const random = hash.readUInt32BE(0) / 4294967295;
    let cumulativeNormalizedCompositeWeight = 0;
    for (const observer of weightedObservers) {
      if (prescribedObserversAddresses.has(observer.gatewayAddress)) continue;
      cumulativeNormalizedCompositeWeight += observer.normalizedCompositeWeight;
      if (random <= cumulativeNormalizedCompositeWeight) {
        prescribedObserversAddresses.add(observer.gatewayAddress);
        break;
      }
      hash = await SmartWeave.arweave.crypto.hash(hash, 'SHA-256');
    }
  }
  const prescribedObservers = weightedObservers.filter((observer) =>
    prescribedObserversAddresses.has(observer.gatewayAddress),
  );
  return prescribedObservers.sort(
    (a, b) => a.normalizedCompositeWeight - b.normalizedCompositeWeight,
  );
}

// src/actions/read/gateways.ts
var getGateway = async (state, { caller, input: { target = caller } }) => {
  const { gateways = {}, distributions } = state;
  if (!(target in gateways)) {
    throw new ContractError(`No gateway found with wallet address ${target}.`);
  }
  const gateway = gateways[target];
  const { epochStartHeight } = getEpochDataForHeight({
    currentBlockHeight: new BlockHeight(+SmartWeave.block.height),
    epochZeroStartHeight: new BlockHeight(distributions.epochZeroStartHeight),
    epochBlockLength: new BlockHeight(EPOCH_BLOCK_LENGTH),
  });
  const observerWeights = getObserverWeightsForEpoch({
    gateways,
    epochStartHeight,
    minOperatorStake: MIN_OPERATOR_STAKE,
  }).find(
    (observer) =>
      observer.gatewayAddress === target || observer.observerAddress === target,
  );
  const gatewayWithWeights = {
    ...gateway,
    // computed weights based on the current epoch
    weights: {
      stakeWeight: observerWeights?.stakeWeight || 0,
      tenureWeight: observerWeights?.tenureWeight || 0,
      gatewayRewardRatioWeight: observerWeights?.gatewayRewardRatioWeight || 0,
      observerRewardRatioWeight:
        observerWeights?.observerRewardRatioWeight || 0,
      compositeWeight: observerWeights?.compositeWeight || 0,
      normalizedCompositeWeight:
        observerWeights?.normalizedCompositeWeight || 0,
    },
  };
  return {
    result: gatewayWithWeights,
  };
};
var getGateways = async (state) => {
  const { gateways, distributions } = state;
  const { epochStartHeight } = getEpochDataForHeight({
    currentBlockHeight: new BlockHeight(+SmartWeave.block.height),
    epochZeroStartHeight: new BlockHeight(distributions.epochZeroStartHeight),
    epochBlockLength: new BlockHeight(EPOCH_BLOCK_LENGTH),
  });
  const allObserverWeights = getObserverWeightsForEpoch({
    gateways,
    epochStartHeight,
    minOperatorStake: MIN_OPERATOR_STAKE,
  });
  const gatewaysWithWeights = Object.keys(gateways).reduce((acc, address) => {
    const observerWeights = allObserverWeights.find(
      (observer) => observer.gatewayAddress === address,
    );
    const gateway = gateways[address];
    const gatewayWithWeights = {
      ...gateway,
      // computed weights based on the current epoch
      weights: {
        stakeWeight: observerWeights?.stakeWeight || 0,
        tenureWeight: observerWeights?.tenureWeight || 0,
        gatewayRewardRatioWeight:
          observerWeights?.gatewayRewardRatioWeight || 0,
        observerRewardRatioWeight:
          observerWeights?.observerRewardRatioWeight || 0,
        compositeWeight: observerWeights?.compositeWeight || 0,
        normalizedCompositeWeight:
          observerWeights?.normalizedCompositeWeight || 0,
      },
    };
    acc[address] = gatewayWithWeights;
    return acc;
  }, {});
  return {
    result: gatewaysWithWeights,
  };
};

// src/actions/read/observers.ts
var getPrescribedObservers = async (state) => {
  const { prescribedObservers, distributions } = state;
  const { epochStartHeight } = getEpochDataForHeight({
    currentBlockHeight: new BlockHeight(+SmartWeave.block.height),
    epochZeroStartHeight: new BlockHeight(distributions.epochZeroStartHeight),
    epochBlockLength: new BlockHeight(EPOCH_BLOCK_LENGTH),
  });
  const existingOrComputedObservers =
    prescribedObservers[epochStartHeight.valueOf()] || [];
  return { result: existingOrComputedObservers };
};
async function getEpoch(state, { input: { height } }) {
  const { distributions } = state;
  const requestedHeight = height || +SmartWeave.block.height;
  if (isNaN(requestedHeight) || requestedHeight <= 0) {
    throw new ContractError('Invalid height. Must be a number greater than 0.');
  }
  const {
    epochStartHeight,
    epochEndHeight,
    epochDistributionHeight,
    epochPeriod,
  } = getEpochDataForHeight({
    currentBlockHeight: new BlockHeight(requestedHeight),
    epochZeroStartHeight: new BlockHeight(distributions.epochZeroStartHeight),
    epochBlockLength: new BlockHeight(EPOCH_BLOCK_LENGTH),
  });
  return {
    result: {
      epochStartHeight: epochStartHeight.valueOf(),
      epochEndHeight: epochEndHeight.valueOf(),
      epochZeroStartHeight: distributions.epochZeroStartHeight,
      epochDistributionHeight: epochDistributionHeight.valueOf(),
      epochPeriod: epochPeriod.valueOf(),
      epochBlockLength: EPOCH_BLOCK_LENGTH,
    },
  };
}

// src/utilities.ts
function walletHasSufficientBalance(balances, wallet, qty) {
  return !!balances[wallet] && balances[wallet] >= qty.valueOf();
}
function getInvalidAjvMessage(validator, input, functionName) {
  return `${INVALID_INPUT_MESSAGE} for ${functionName}: ${validator.errors
    .map((e) => {
      const key = e.instancePath.replace('/', '');
      const value = input[key];
      return `${key} ('${value}') ${e.message}`;
    })
    .join(', ')}`;
}
function isGatewayJoined({ gateway, currentBlockHeight }) {
  return (
    gateway?.status === 'joined' &&
    gateway?.start <= currentBlockHeight.valueOf()
  );
}
function isGatewayEligibleToBeRemoved({ gateway, currentBlockHeight }) {
  return (
    gateway?.status === 'leaving' &&
    gateway?.end <= currentBlockHeight.valueOf()
  );
}
function isGatewayEligibleToLeave({
  gateway,
  currentBlockHeight,
  minimumGatewayJoinLength,
}) {
  if (!gateway) return false;
  const joinedForMinimum =
    currentBlockHeight.valueOf() >=
    gateway.start + minimumGatewayJoinLength.valueOf();
  const isActive = isGatewayJoined({ gateway, currentBlockHeight });
  return joinedForMinimum && isActive;
}
function calculateYearsBetweenTimestamps({ startTimestamp, endTimestamp }) {
  const yearsRemainingFloat =
    (endTimestamp.valueOf() - startTimestamp.valueOf()) / SECONDS_IN_A_YEAR;
  return +yearsRemainingFloat.toFixed(2);
}
function unsafeDecrementBalance(
  balances,
  address,
  amount,
  removeIfZero = true,
) {
  balances[address] -= amount.valueOf();
  if (removeIfZero && balances[address] === 0) {
    delete balances[address];
  }
}
function incrementBalance(balances, address, amount) {
  if (amount.valueOf() < 1) {
    throw new ContractError(`"Amount must be positive`);
  }
  if (address in balances) {
    const prevBalance = new mIOToken(balances[address]);
    const newBalance = prevBalance.plus(amount);
    balances[address] = newBalance.valueOf();
  } else {
    balances[address] = amount.valueOf();
  }
}

// src/transfer.ts
function safeTransfer({ balances, fromAddress, toAddress, qty }) {
  if (qty.valueOf() < 1) {
    return;
  }
  if (fromAddress === toAddress) {
    throw new ContractError(INVALID_TARGET_MESSAGE);
  }
  if (balances[fromAddress] === null || isNaN(balances[fromAddress])) {
    throw new ContractError(`Caller balance is not defined!`);
  }
  if (!walletHasSufficientBalance(balances, fromAddress, qty)) {
    throw new ContractError(INSUFFICIENT_FUNDS_MESSAGE);
  }
  incrementBalance(balances, toAddress, qty);
  unsafeDecrementBalance(balances, fromAddress, qty);
}
function safeVaultedTransfer({
  balances,
  vaults,
  fromAddress,
  toAddress,
  startHeight,
  id,
  qty,
  lockLength,
}) {
  if (!walletHasSufficientBalance(balances, fromAddress, qty)) {
    throw new ContractError(INSUFFICIENT_FUNDS_MESSAGE);
  }
  if (vaults[toAddress] && id in vaults[toAddress]) {
    throw new ContractError(`Vault with id '${id}' already exists`);
  }
  if (
    lockLength.valueOf() < MIN_TOKEN_LOCK_BLOCK_LENGTH ||
    lockLength.valueOf() > MAX_TOKEN_LOCK_BLOCK_LENGTH
  ) {
    throw new ContractError(INVALID_VAULT_LOCK_LENGTH_MESSAGE);
  }
  const newVault = {
    balance: qty.valueOf(),
    start: startHeight.valueOf(),
    end: startHeight.valueOf() + lockLength.valueOf(),
  };
  vaults[toAddress] = {
    ...vaults[toAddress],
    [id]: newVault,
  };
  unsafeDecrementBalance(balances, fromAddress, qty);
}

// src/validations.js
var validateAuctionBid = validate10;
var pattern0 = new RegExp('^(submitAuctionBid|buyRecord)$', 'u');
var pattern1 = new RegExp(
  '^([a-zA-Z0-9][a-zA-Z0-9-]{0,49}[a-zA-Z0-9]|[a-zA-Z0-9]{1})$',
  'u',
);
var pattern2 = new RegExp('^(lease|permabuy)$', 'u');
var pattern3 = new RegExp('^(atomic|[a-zA-Z0-9-_]{43})$', 'u');
function validate10(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.name === void 0) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'name' },
        message: "must have required property 'name'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.function !== void 0) {
      let data0 = data.function;
      if (typeof data0 === 'string') {
        if (!pattern0.test(data0)) {
          const err1 = {
            instancePath: instancePath + '/function',
            schemaPath: '#/properties/function/pattern',
            keyword: 'pattern',
            params: { pattern: '^(submitAuctionBid|buyRecord)$' },
            message: 'must match pattern "^(submitAuctionBid|buyRecord)$"',
          };
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
      } else {
        const err2 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.name !== void 0) {
      let data1 = data.name;
      if (typeof data1 === 'string') {
        if (!pattern1.test(data1)) {
          const err3 = {
            instancePath: instancePath + '/name',
            schemaPath: '#/properties/name/pattern',
            keyword: 'pattern',
            params: {
              pattern:
                '^([a-zA-Z0-9][a-zA-Z0-9-]{0,49}[a-zA-Z0-9]|[a-zA-Z0-9]{1})$',
            },
            message:
              'must match pattern "^([a-zA-Z0-9][a-zA-Z0-9-]{0,49}[a-zA-Z0-9]|[a-zA-Z0-9]{1})$"',
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = {
          instancePath: instancePath + '/name',
          schemaPath: '#/properties/name/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.qty !== void 0) {
      let data2 = data.qty;
      if (typeof data2 == 'number' && isFinite(data2)) {
        if (data2 < 0 || isNaN(data2)) {
          const err5 = {
            instancePath: instancePath + '/qty',
            schemaPath: '#/properties/qty/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 0 },
            message: 'must be >= 0',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + '/qty',
          schemaPath: '#/properties/qty/type',
          keyword: 'type',
          params: { type: 'number' },
          message: 'must be number',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.type !== void 0) {
      let data3 = data.type;
      if (typeof data3 === 'string') {
        if (!pattern2.test(data3)) {
          const err7 = {
            instancePath: instancePath + '/type',
            schemaPath: '#/properties/type/pattern',
            keyword: 'pattern',
            params: { pattern: '^(lease|permabuy)$' },
            message: 'must match pattern "^(lease|permabuy)$"',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = {
          instancePath: instancePath + '/type',
          schemaPath: '#/properties/type/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.contractTxId !== void 0) {
      let data4 = data.contractTxId;
      if (typeof data4 === 'string') {
        if (!pattern3.test(data4)) {
          const err9 = {
            instancePath: instancePath + '/contractTxId',
            schemaPath: '#/properties/contractTxId/pattern',
            keyword: 'pattern',
            params: { pattern: '^(atomic|[a-zA-Z0-9-_]{43})$' },
            message: 'must match pattern "^(atomic|[a-zA-Z0-9-_]{43})$"',
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = {
          instancePath: instancePath + '/contractTxId',
          schemaPath: '#/properties/contractTxId/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
  } else {
    const err11 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  validate10.errors = vErrors;
  return errors === 0;
}
var validateBuyRecord = validate11;
function validate11(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.name === void 0) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'name' },
        message: "must have required property 'name'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.name !== void 0) {
      let data0 = data.name;
      if (typeof data0 === 'string') {
        if (!pattern1.test(data0)) {
          const err1 = {
            instancePath: instancePath + '/name',
            schemaPath: '#/properties/name/pattern',
            keyword: 'pattern',
            params: {
              pattern:
                '^([a-zA-Z0-9][a-zA-Z0-9-]{0,49}[a-zA-Z0-9]|[a-zA-Z0-9]{1})$',
            },
            message:
              'must match pattern "^([a-zA-Z0-9][a-zA-Z0-9-]{0,49}[a-zA-Z0-9]|[a-zA-Z0-9]{1})$"',
          };
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
      } else {
        const err2 = {
          instancePath: instancePath + '/name',
          schemaPath: '#/properties/name/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.contractTxId !== void 0) {
      let data1 = data.contractTxId;
      if (typeof data1 === 'string') {
        if (!pattern3.test(data1)) {
          const err3 = {
            instancePath: instancePath + '/contractTxId',
            schemaPath: '#/properties/contractTxId/pattern',
            keyword: 'pattern',
            params: { pattern: '^(atomic|[a-zA-Z0-9-_]{43})$' },
            message: 'must match pattern "^(atomic|[a-zA-Z0-9-_]{43})$"',
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = {
          instancePath: instancePath + '/contractTxId',
          schemaPath: '#/properties/contractTxId/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.years !== void 0) {
      let data2 = data.years;
      if (
        !(
          typeof data2 == 'number' &&
          !(data2 % 1) &&
          !isNaN(data2) &&
          isFinite(data2)
        )
      ) {
        const err5 = {
          instancePath: instancePath + '/years',
          schemaPath: '#/properties/years/type',
          keyword: 'type',
          params: { type: 'integer' },
          message: 'must be integer',
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
      if (typeof data2 == 'number' && isFinite(data2)) {
        if (data2 > 5 || isNaN(data2)) {
          const err6 = {
            instancePath: instancePath + '/years',
            schemaPath: '#/properties/years/maximum',
            keyword: 'maximum',
            params: { comparison: '<=', limit: 5 },
            message: 'must be <= 5',
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (data2 < 1 || isNaN(data2)) {
          const err7 = {
            instancePath: instancePath + '/years',
            schemaPath: '#/properties/years/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 1 },
            message: 'must be >= 1',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      }
    }
    if (data.type !== void 0) {
      let data3 = data.type;
      if (typeof data3 === 'string') {
        if (!pattern2.test(data3)) {
          const err8 = {
            instancePath: instancePath + '/type',
            schemaPath: '#/properties/type/pattern',
            keyword: 'pattern',
            params: { pattern: '^(lease|permabuy)$' },
            message: 'must match pattern "^(lease|permabuy)$"',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + '/type',
          schemaPath: '#/properties/type/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.auction !== void 0) {
      if (typeof data.auction !== 'boolean') {
        const err10 = {
          instancePath: instancePath + '/auction',
          schemaPath: '#/properties/auction/type',
          keyword: 'type',
          params: { type: 'boolean' },
          message: 'must be boolean',
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
  } else {
    const err11 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  validate11.errors = vErrors;
  return errors === 0;
}
var validateCreateReservedName = validate12;
var pattern8 = new RegExp('^[a-zA-Z0-9-_]{43}$', 'u');
function validate12(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.name === void 0) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'name' },
        message: "must have required property 'name'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.target === void 0) {
      const err1 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'target' },
        message: "must have required property 'target'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (
        !(
          key0 === 'function' ||
          key0 === 'name' ||
          key0 === 'target' ||
          key0 === 'endTimestamp'
        )
      ) {
        const err2 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.function !== void 0) {
      let data0 = data.function;
      if (typeof data0 !== 'string') {
        const err3 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
      if ('createReservedName' !== data0) {
        const err4 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/const',
          keyword: 'const',
          params: { allowedValue: 'createReservedName' },
          message: 'must be equal to constant',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.name !== void 0) {
      let data1 = data.name;
      if (typeof data1 === 'string') {
        if (!pattern1.test(data1)) {
          const err5 = {
            instancePath: instancePath + '/name',
            schemaPath: '#/properties/name/pattern',
            keyword: 'pattern',
            params: {
              pattern:
                '^([a-zA-Z0-9][a-zA-Z0-9-]{0,49}[a-zA-Z0-9]|[a-zA-Z0-9]{1})$',
            },
            message:
              'must match pattern "^([a-zA-Z0-9][a-zA-Z0-9-]{0,49}[a-zA-Z0-9]|[a-zA-Z0-9]{1})$"',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + '/name',
          schemaPath: '#/properties/name/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.target !== void 0) {
      let data2 = data.target;
      if (typeof data2 === 'string') {
        if (!pattern8.test(data2)) {
          const err7 = {
            instancePath: instancePath + '/target',
            schemaPath: '#/properties/target/pattern',
            keyword: 'pattern',
            params: { pattern: '^[a-zA-Z0-9-_]{43}$' },
            message: 'must match pattern "^[a-zA-Z0-9-_]{43}$"',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = {
          instancePath: instancePath + '/target',
          schemaPath: '#/properties/target/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.endTimestamp !== void 0) {
      let data3 = data.endTimestamp;
      if (
        !(
          typeof data3 == 'number' &&
          !(data3 % 1) &&
          !isNaN(data3) &&
          isFinite(data3)
        )
      ) {
        const err9 = {
          instancePath: instancePath + '/endTimestamp',
          schemaPath: '#/properties/endTimestamp/type',
          keyword: 'type',
          params: { type: 'integer' },
          message: 'must be integer',
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
      if (typeof data3 == 'number' && isFinite(data3)) {
        if (data3 < 1 || isNaN(data3)) {
          const err10 = {
            instancePath: instancePath + '/endTimestamp',
            schemaPath: '#/properties/endTimestamp/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 1 },
            message: 'must be >= 1',
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      }
    }
  } else {
    const err11 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  validate12.errors = vErrors;
  return errors === 0;
}
var validateExtendRecord = validate13;
function validate13(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.name === void 0) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'name' },
        message: "must have required property 'name'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.years === void 0) {
      const err1 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'years' },
        message: "must have required property 'years'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === 'function' || key0 === 'name' || key0 === 'years')) {
        const err2 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.function !== void 0) {
      let data0 = data.function;
      if (typeof data0 !== 'string') {
        const err3 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
      if ('extendRecord' !== data0) {
        const err4 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/const',
          keyword: 'const',
          params: { allowedValue: 'extendRecord' },
          message: 'must be equal to constant',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.name !== void 0) {
      let data1 = data.name;
      if (typeof data1 === 'string') {
        if (!pattern1.test(data1)) {
          const err5 = {
            instancePath: instancePath + '/name',
            schemaPath: '#/properties/name/pattern',
            keyword: 'pattern',
            params: {
              pattern:
                '^([a-zA-Z0-9][a-zA-Z0-9-]{0,49}[a-zA-Z0-9]|[a-zA-Z0-9]{1})$',
            },
            message:
              'must match pattern "^([a-zA-Z0-9][a-zA-Z0-9-]{0,49}[a-zA-Z0-9]|[a-zA-Z0-9]{1})$"',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + '/name',
          schemaPath: '#/properties/name/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.years !== void 0) {
      let data2 = data.years;
      if (
        !(
          typeof data2 == 'number' &&
          !(data2 % 1) &&
          !isNaN(data2) &&
          isFinite(data2)
        )
      ) {
        const err7 = {
          instancePath: instancePath + '/years',
          schemaPath: '#/properties/years/type',
          keyword: 'type',
          params: { type: 'integer' },
          message: 'must be integer',
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
      if (typeof data2 == 'number' && isFinite(data2)) {
        if (data2 > 5 || isNaN(data2)) {
          const err8 = {
            instancePath: instancePath + '/years',
            schemaPath: '#/properties/years/maximum',
            keyword: 'maximum',
            params: { comparison: '<=', limit: 5 },
            message: 'must be <= 5',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (data2 < 1 || isNaN(data2)) {
          const err9 = {
            instancePath: instancePath + '/years',
            schemaPath: '#/properties/years/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 1 },
            message: 'must be >= 1',
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      }
    }
  } else {
    const err10 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err10];
    } else {
      vErrors.push(err10);
    }
    errors++;
  }
  validate13.errors = vErrors;
  return errors === 0;
}
var validateIncreaseUndernameCount = validate14;
function validate14(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.name === void 0) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'name' },
        message: "must have required property 'name'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.qty === void 0) {
      const err1 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'qty' },
        message: "must have required property 'qty'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === 'function' || key0 === 'name' || key0 === 'qty')) {
        const err2 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.function !== void 0) {
      let data0 = data.function;
      if (typeof data0 !== 'string') {
        const err3 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
      if ('increaseUndernameCount' !== data0) {
        const err4 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/const',
          keyword: 'const',
          params: { allowedValue: 'increaseUndernameCount' },
          message: 'must be equal to constant',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.name !== void 0) {
      let data1 = data.name;
      if (typeof data1 === 'string') {
        if (!pattern1.test(data1)) {
          const err5 = {
            instancePath: instancePath + '/name',
            schemaPath: '#/properties/name/pattern',
            keyword: 'pattern',
            params: {
              pattern:
                '^([a-zA-Z0-9][a-zA-Z0-9-]{0,49}[a-zA-Z0-9]|[a-zA-Z0-9]{1})$',
            },
            message:
              'must match pattern "^([a-zA-Z0-9][a-zA-Z0-9-]{0,49}[a-zA-Z0-9]|[a-zA-Z0-9]{1})$"',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + '/name',
          schemaPath: '#/properties/name/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.qty !== void 0) {
      let data2 = data.qty;
      if (typeof data2 == 'number' && isFinite(data2)) {
        if (data2 > 9990 || isNaN(data2)) {
          const err7 = {
            instancePath: instancePath + '/qty',
            schemaPath: '#/properties/qty/maximum',
            keyword: 'maximum',
            params: { comparison: '<=', limit: 9990 },
            message: 'must be <= 9990',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (data2 < 1 || isNaN(data2)) {
          const err8 = {
            instancePath: instancePath + '/qty',
            schemaPath: '#/properties/qty/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 1 },
            message: 'must be >= 1',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + '/qty',
          schemaPath: '#/properties/qty/type',
          keyword: 'type',
          params: { type: 'number' },
          message: 'must be number',
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
  } else {
    const err10 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err10];
    } else {
      vErrors.push(err10);
    }
    errors++;
  }
  validate14.errors = vErrors;
  return errors === 0;
}
var validateJoinNetwork = validate15;
var schema16 = {
  $id: '#/definitions/joinNetwork',
  type: 'object',
  properties: {
    function: { type: 'string', const: 'joinNetwork' },
    qty: { type: 'number', minimum: 1 },
    fqdn: {
      type: 'string',
      pattern: '^(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\\.)+[A-Za-z]{1,63}$',
    },
    port: { type: 'integer', minimum: 0, maximum: 65535 },
    protocol: { type: 'string', pattern: '^(http|https)$' },
    properties: { type: 'string', pattern: '^[a-zA-Z0-9_-]{43}$' },
    note: { type: 'string', pattern: '^.{1,256}$' },
    label: { type: 'string', pattern: '^.{1,64}$' },
    observerWallet: { type: 'string', pattern: '^[a-zA-Z0-9_-]{43}$' },
    autoStake: { type: 'boolean' },
    allowDelegatedStaking: { type: 'boolean' },
    delegateRewardShareRatio: { type: 'integer', minimum: 0, maximum: 100 },
    allowedDelegates: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^[a-zA-Z0-9-_]{43}$',
        description:
          'The unique list of delegate addresses the that can stake on this gateway',
      },
      uniqueItems: true,
      minItems: 0,
      maxItems: 1e4,
    },
    minDelegatedStake: { type: 'integer', minimum: 100 },
  },
  required: ['qty', 'fqdn', 'port', 'protocol', 'properties', 'note', 'label'],
  additionalProperties: false,
};
var func2 = Object.prototype.hasOwnProperty;
var pattern11 = new RegExp(
  '^(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\\.)+[A-Za-z]{1,63}$',
  'u',
);
var pattern12 = new RegExp('^(http|https)$', 'u');
var pattern13 = new RegExp('^[a-zA-Z0-9_-]{43}$', 'u');
var pattern14 = new RegExp('^.{1,256}$', 'u');
var pattern15 = new RegExp('^.{1,64}$', 'u');
function validate15(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.qty === void 0) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'qty' },
        message: "must have required property 'qty'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.fqdn === void 0) {
      const err1 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'fqdn' },
        message: "must have required property 'fqdn'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.port === void 0) {
      const err2 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'port' },
        message: "must have required property 'port'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.protocol === void 0) {
      const err3 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'protocol' },
        message: "must have required property 'protocol'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.properties === void 0) {
      const err4 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'properties' },
        message: "must have required property 'properties'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.note === void 0) {
      const err5 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'note' },
        message: "must have required property 'note'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.label === void 0) {
      const err6 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'label' },
        message: "must have required property 'label'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func2.call(schema16.properties, key0)) {
        const err7 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.function !== void 0) {
      let data0 = data.function;
      if (typeof data0 !== 'string') {
        const err8 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
      if ('joinNetwork' !== data0) {
        const err9 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/const',
          keyword: 'const',
          params: { allowedValue: 'joinNetwork' },
          message: 'must be equal to constant',
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.qty !== void 0) {
      let data1 = data.qty;
      if (typeof data1 == 'number' && isFinite(data1)) {
        if (data1 < 1 || isNaN(data1)) {
          const err10 = {
            instancePath: instancePath + '/qty',
            schemaPath: '#/properties/qty/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 1 },
            message: 'must be >= 1',
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = {
          instancePath: instancePath + '/qty',
          schemaPath: '#/properties/qty/type',
          keyword: 'type',
          params: { type: 'number' },
          message: 'must be number',
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.fqdn !== void 0) {
      let data2 = data.fqdn;
      if (typeof data2 === 'string') {
        if (!pattern11.test(data2)) {
          const err12 = {
            instancePath: instancePath + '/fqdn',
            schemaPath: '#/properties/fqdn/pattern',
            keyword: 'pattern',
            params: {
              pattern: '^(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\\.)+[A-Za-z]{1,63}$',
            },
            message:
              'must match pattern "^(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\\.)+[A-Za-z]{1,63}$"',
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = {
          instancePath: instancePath + '/fqdn',
          schemaPath: '#/properties/fqdn/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.port !== void 0) {
      let data3 = data.port;
      if (
        !(
          typeof data3 == 'number' &&
          !(data3 % 1) &&
          !isNaN(data3) &&
          isFinite(data3)
        )
      ) {
        const err14 = {
          instancePath: instancePath + '/port',
          schemaPath: '#/properties/port/type',
          keyword: 'type',
          params: { type: 'integer' },
          message: 'must be integer',
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
      if (typeof data3 == 'number' && isFinite(data3)) {
        if (data3 > 65535 || isNaN(data3)) {
          const err15 = {
            instancePath: instancePath + '/port',
            schemaPath: '#/properties/port/maximum',
            keyword: 'maximum',
            params: { comparison: '<=', limit: 65535 },
            message: 'must be <= 65535',
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        if (data3 < 0 || isNaN(data3)) {
          const err16 = {
            instancePath: instancePath + '/port',
            schemaPath: '#/properties/port/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 0 },
            message: 'must be >= 0',
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      }
    }
    if (data.protocol !== void 0) {
      let data4 = data.protocol;
      if (typeof data4 === 'string') {
        if (!pattern12.test(data4)) {
          const err17 = {
            instancePath: instancePath + '/protocol',
            schemaPath: '#/properties/protocol/pattern',
            keyword: 'pattern',
            params: { pattern: '^(http|https)$' },
            message: 'must match pattern "^(http|https)$"',
          };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
      } else {
        const err18 = {
          instancePath: instancePath + '/protocol',
          schemaPath: '#/properties/protocol/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.properties !== void 0) {
      let data5 = data.properties;
      if (typeof data5 === 'string') {
        if (!pattern13.test(data5)) {
          const err19 = {
            instancePath: instancePath + '/properties',
            schemaPath: '#/properties/properties/pattern',
            keyword: 'pattern',
            params: { pattern: '^[a-zA-Z0-9_-]{43}$' },
            message: 'must match pattern "^[a-zA-Z0-9_-]{43}$"',
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      } else {
        const err20 = {
          instancePath: instancePath + '/properties',
          schemaPath: '#/properties/properties/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.note !== void 0) {
      let data6 = data.note;
      if (typeof data6 === 'string') {
        if (!pattern14.test(data6)) {
          const err21 = {
            instancePath: instancePath + '/note',
            schemaPath: '#/properties/note/pattern',
            keyword: 'pattern',
            params: { pattern: '^.{1,256}$' },
            message: 'must match pattern "^.{1,256}$"',
          };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
      } else {
        const err22 = {
          instancePath: instancePath + '/note',
          schemaPath: '#/properties/note/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
    if (data.label !== void 0) {
      let data7 = data.label;
      if (typeof data7 === 'string') {
        if (!pattern15.test(data7)) {
          const err23 = {
            instancePath: instancePath + '/label',
            schemaPath: '#/properties/label/pattern',
            keyword: 'pattern',
            params: { pattern: '^.{1,64}$' },
            message: 'must match pattern "^.{1,64}$"',
          };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
      } else {
        const err24 = {
          instancePath: instancePath + '/label',
          schemaPath: '#/properties/label/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.observerWallet !== void 0) {
      let data8 = data.observerWallet;
      if (typeof data8 === 'string') {
        if (!pattern13.test(data8)) {
          const err25 = {
            instancePath: instancePath + '/observerWallet',
            schemaPath: '#/properties/observerWallet/pattern',
            keyword: 'pattern',
            params: { pattern: '^[a-zA-Z0-9_-]{43}$' },
            message: 'must match pattern "^[a-zA-Z0-9_-]{43}$"',
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
      } else {
        const err26 = {
          instancePath: instancePath + '/observerWallet',
          schemaPath: '#/properties/observerWallet/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err26];
        } else {
          vErrors.push(err26);
        }
        errors++;
      }
    }
    if (data.autoStake !== void 0) {
      if (typeof data.autoStake !== 'boolean') {
        const err27 = {
          instancePath: instancePath + '/autoStake',
          schemaPath: '#/properties/autoStake/type',
          keyword: 'type',
          params: { type: 'boolean' },
          message: 'must be boolean',
        };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
    }
    if (data.allowDelegatedStaking !== void 0) {
      if (typeof data.allowDelegatedStaking !== 'boolean') {
        const err28 = {
          instancePath: instancePath + '/allowDelegatedStaking',
          schemaPath: '#/properties/allowDelegatedStaking/type',
          keyword: 'type',
          params: { type: 'boolean' },
          message: 'must be boolean',
        };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
    }
    if (data.delegateRewardShareRatio !== void 0) {
      let data11 = data.delegateRewardShareRatio;
      if (
        !(
          typeof data11 == 'number' &&
          !(data11 % 1) &&
          !isNaN(data11) &&
          isFinite(data11)
        )
      ) {
        const err29 = {
          instancePath: instancePath + '/delegateRewardShareRatio',
          schemaPath: '#/properties/delegateRewardShareRatio/type',
          keyword: 'type',
          params: { type: 'integer' },
          message: 'must be integer',
        };
        if (vErrors === null) {
          vErrors = [err29];
        } else {
          vErrors.push(err29);
        }
        errors++;
      }
      if (typeof data11 == 'number' && isFinite(data11)) {
        if (data11 > 100 || isNaN(data11)) {
          const err30 = {
            instancePath: instancePath + '/delegateRewardShareRatio',
            schemaPath: '#/properties/delegateRewardShareRatio/maximum',
            keyword: 'maximum',
            params: { comparison: '<=', limit: 100 },
            message: 'must be <= 100',
          };
          if (vErrors === null) {
            vErrors = [err30];
          } else {
            vErrors.push(err30);
          }
          errors++;
        }
        if (data11 < 0 || isNaN(data11)) {
          const err31 = {
            instancePath: instancePath + '/delegateRewardShareRatio',
            schemaPath: '#/properties/delegateRewardShareRatio/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 0 },
            message: 'must be >= 0',
          };
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors++;
        }
      }
    }
    if (data.allowedDelegates !== void 0) {
      let data12 = data.allowedDelegates;
      if (Array.isArray(data12)) {
        if (data12.length > 1e4) {
          const err32 = {
            instancePath: instancePath + '/allowedDelegates',
            schemaPath: '#/properties/allowedDelegates/maxItems',
            keyword: 'maxItems',
            params: { limit: 1e4 },
            message: 'must NOT have more than 10000 items',
          };
          if (vErrors === null) {
            vErrors = [err32];
          } else {
            vErrors.push(err32);
          }
          errors++;
        }
        if (data12.length < 0) {
          const err33 = {
            instancePath: instancePath + '/allowedDelegates',
            schemaPath: '#/properties/allowedDelegates/minItems',
            keyword: 'minItems',
            params: { limit: 0 },
            message: 'must NOT have fewer than 0 items',
          };
          if (vErrors === null) {
            vErrors = [err33];
          } else {
            vErrors.push(err33);
          }
          errors++;
        }
        const len0 = data12.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data13 = data12[i0];
          if (typeof data13 === 'string') {
            if (!pattern8.test(data13)) {
              const err34 = {
                instancePath: instancePath + '/allowedDelegates/' + i0,
                schemaPath: '#/properties/allowedDelegates/items/pattern',
                keyword: 'pattern',
                params: { pattern: '^[a-zA-Z0-9-_]{43}$' },
                message: 'must match pattern "^[a-zA-Z0-9-_]{43}$"',
              };
              if (vErrors === null) {
                vErrors = [err34];
              } else {
                vErrors.push(err34);
              }
              errors++;
            }
          } else {
            const err35 = {
              instancePath: instancePath + '/allowedDelegates/' + i0,
              schemaPath: '#/properties/allowedDelegates/items/type',
              keyword: 'type',
              params: { type: 'string' },
              message: 'must be string',
            };
            if (vErrors === null) {
              vErrors = [err35];
            } else {
              vErrors.push(err35);
            }
            errors++;
          }
        }
        let i1 = data12.length;
        let j0;
        if (i1 > 1) {
          const indices0 = {};
          for (; i1--; ) {
            let item0 = data12[i1];
            if (typeof item0 !== 'string') {
              continue;
            }
            if (typeof indices0[item0] == 'number') {
              j0 = indices0[item0];
              const err36 = {
                instancePath: instancePath + '/allowedDelegates',
                schemaPath: '#/properties/allowedDelegates/uniqueItems',
                keyword: 'uniqueItems',
                params: { i: i1, j: j0 },
                message:
                  'must NOT have duplicate items (items ## ' +
                  j0 +
                  ' and ' +
                  i1 +
                  ' are identical)',
              };
              if (vErrors === null) {
                vErrors = [err36];
              } else {
                vErrors.push(err36);
              }
              errors++;
              break;
            }
            indices0[item0] = i1;
          }
        }
      } else {
        const err37 = {
          instancePath: instancePath + '/allowedDelegates',
          schemaPath: '#/properties/allowedDelegates/type',
          keyword: 'type',
          params: { type: 'array' },
          message: 'must be array',
        };
        if (vErrors === null) {
          vErrors = [err37];
        } else {
          vErrors.push(err37);
        }
        errors++;
      }
    }
    if (data.minDelegatedStake !== void 0) {
      let data14 = data.minDelegatedStake;
      if (
        !(
          typeof data14 == 'number' &&
          !(data14 % 1) &&
          !isNaN(data14) &&
          isFinite(data14)
        )
      ) {
        const err38 = {
          instancePath: instancePath + '/minDelegatedStake',
          schemaPath: '#/properties/minDelegatedStake/type',
          keyword: 'type',
          params: { type: 'integer' },
          message: 'must be integer',
        };
        if (vErrors === null) {
          vErrors = [err38];
        } else {
          vErrors.push(err38);
        }
        errors++;
      }
      if (typeof data14 == 'number' && isFinite(data14)) {
        if (data14 < 100 || isNaN(data14)) {
          const err39 = {
            instancePath: instancePath + '/minDelegatedStake',
            schemaPath: '#/properties/minDelegatedStake/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 100 },
            message: 'must be >= 100',
          };
          if (vErrors === null) {
            vErrors = [err39];
          } else {
            vErrors.push(err39);
          }
          errors++;
        }
      }
    }
  } else {
    const err40 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err40];
    } else {
      vErrors.push(err40);
    }
    errors++;
  }
  validate15.errors = vErrors;
  return errors === 0;
}
var validateTransferToken = validate16;
var schema17 = {
  $id: '#/definitions/transferTokens',
  type: 'object',
  properties: {
    function: { type: 'string', const: 'transfer' },
    target: { type: 'string', pattern: '^[a-zA-Z0-9-_]{43}$' },
    qty: { type: 'number', minimum: 1 },
    denomination: { type: 'string', enum: ['IO', 'mIO'], default: 'mIO' },
  },
  required: ['target', 'qty'],
  additionalProperties: false,
};
function validate16(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.target === void 0) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'target' },
        message: "must have required property 'target'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.qty === void 0) {
      const err1 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'qty' },
        message: "must have required property 'qty'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (
        !(
          key0 === 'function' ||
          key0 === 'target' ||
          key0 === 'qty' ||
          key0 === 'denomination'
        )
      ) {
        const err2 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.function !== void 0) {
      let data0 = data.function;
      if (typeof data0 !== 'string') {
        const err3 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
      if ('transfer' !== data0) {
        const err4 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/const',
          keyword: 'const',
          params: { allowedValue: 'transfer' },
          message: 'must be equal to constant',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.target !== void 0) {
      let data1 = data.target;
      if (typeof data1 === 'string') {
        if (!pattern8.test(data1)) {
          const err5 = {
            instancePath: instancePath + '/target',
            schemaPath: '#/properties/target/pattern',
            keyword: 'pattern',
            params: { pattern: '^[a-zA-Z0-9-_]{43}$' },
            message: 'must match pattern "^[a-zA-Z0-9-_]{43}$"',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + '/target',
          schemaPath: '#/properties/target/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.qty !== void 0) {
      let data2 = data.qty;
      if (typeof data2 == 'number' && isFinite(data2)) {
        if (data2 < 1 || isNaN(data2)) {
          const err7 = {
            instancePath: instancePath + '/qty',
            schemaPath: '#/properties/qty/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 1 },
            message: 'must be >= 1',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = {
          instancePath: instancePath + '/qty',
          schemaPath: '#/properties/qty/type',
          keyword: 'type',
          params: { type: 'number' },
          message: 'must be number',
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.denomination !== void 0) {
      let data3 = data.denomination;
      if (typeof data3 !== 'string') {
        const err9 = {
          instancePath: instancePath + '/denomination',
          schemaPath: '#/properties/denomination/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
      if (!(data3 === 'IO' || data3 === 'mIO')) {
        const err10 = {
          instancePath: instancePath + '/denomination',
          schemaPath: '#/properties/denomination/enum',
          keyword: 'enum',
          params: { allowedValues: schema17.properties.denomination.enum },
          message: 'must be equal to one of the allowed values',
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
  } else {
    const err11 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  validate16.errors = vErrors;
  return errors === 0;
}
var validateTransferTokensLocked = validate17;
function validate17(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.target === void 0) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'target' },
        message: "must have required property 'target'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.qty === void 0) {
      const err1 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'qty' },
        message: "must have required property 'qty'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.lockLength === void 0) {
      const err2 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'lockLength' },
        message: "must have required property 'lockLength'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (
        !(
          key0 === 'function' ||
          key0 === 'target' ||
          key0 === 'qty' ||
          key0 === 'lockLength'
        )
      ) {
        const err3 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.function !== void 0) {
      let data0 = data.function;
      if (typeof data0 !== 'string') {
        const err4 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
      if ('vaultedTransfer' !== data0) {
        const err5 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/const',
          keyword: 'const',
          params: { allowedValue: 'vaultedTransfer' },
          message: 'must be equal to constant',
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.target !== void 0) {
      let data1 = data.target;
      if (typeof data1 === 'string') {
        if (!pattern8.test(data1)) {
          const err6 = {
            instancePath: instancePath + '/target',
            schemaPath: '#/properties/target/pattern',
            keyword: 'pattern',
            params: { pattern: '^[a-zA-Z0-9-_]{43}$' },
            message: 'must match pattern "^[a-zA-Z0-9-_]{43}$"',
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = {
          instancePath: instancePath + '/target',
          schemaPath: '#/properties/target/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.qty !== void 0) {
      let data2 = data.qty;
      if (typeof data2 == 'number' && isFinite(data2)) {
        if (data2 < 1 || isNaN(data2)) {
          const err8 = {
            instancePath: instancePath + '/qty',
            schemaPath: '#/properties/qty/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 1 },
            message: 'must be >= 1',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + '/qty',
          schemaPath: '#/properties/qty/type',
          keyword: 'type',
          params: { type: 'number' },
          message: 'must be number',
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.lockLength !== void 0) {
      let data3 = data.lockLength;
      if (typeof data3 == 'number' && isFinite(data3)) {
        if (data3 > 3153600 || isNaN(data3)) {
          const err10 = {
            instancePath: instancePath + '/lockLength',
            schemaPath: '#/properties/lockLength/maximum',
            keyword: 'maximum',
            params: { comparison: '<=', limit: 3153600 },
            message: 'must be <= 3153600',
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        if (data3 < 10080 || isNaN(data3)) {
          const err11 = {
            instancePath: instancePath + '/lockLength',
            schemaPath: '#/properties/lockLength/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 10080 },
            message: 'must be >= 10080',
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      } else {
        const err12 = {
          instancePath: instancePath + '/lockLength',
          schemaPath: '#/properties/lockLength/type',
          keyword: 'type',
          params: { type: 'number' },
          message: 'must be number',
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
  } else {
    const err13 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err13];
    } else {
      vErrors.push(err13);
    }
    errors++;
  }
  validate17.errors = vErrors;
  return errors === 0;
}
var validateCreateVault = validate18;
function validate18(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.qty === void 0) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'qty' },
        message: "must have required property 'qty'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.lockLength === void 0) {
      const err1 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'lockLength' },
        message: "must have required property 'lockLength'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === 'function' || key0 === 'qty' || key0 === 'lockLength')) {
        const err2 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.function !== void 0) {
      let data0 = data.function;
      if (typeof data0 !== 'string') {
        const err3 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
      if ('createVault' !== data0) {
        const err4 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/const',
          keyword: 'const',
          params: { allowedValue: 'createVault' },
          message: 'must be equal to constant',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.qty !== void 0) {
      let data1 = data.qty;
      if (typeof data1 == 'number' && isFinite(data1)) {
        if (data1 < 1 || isNaN(data1)) {
          const err5 = {
            instancePath: instancePath + '/qty',
            schemaPath: '#/properties/qty/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 1 },
            message: 'must be >= 1',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + '/qty',
          schemaPath: '#/properties/qty/type',
          keyword: 'type',
          params: { type: 'number' },
          message: 'must be number',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.lockLength !== void 0) {
      let data2 = data.lockLength;
      if (typeof data2 == 'number' && isFinite(data2)) {
        if (data2 > 3153600 || isNaN(data2)) {
          const err7 = {
            instancePath: instancePath + '/lockLength',
            schemaPath: '#/properties/lockLength/maximum',
            keyword: 'maximum',
            params: { comparison: '<=', limit: 3153600 },
            message: 'must be <= 3153600',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (data2 < 10080 || isNaN(data2)) {
          const err8 = {
            instancePath: instancePath + '/lockLength',
            schemaPath: '#/properties/lockLength/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 10080 },
            message: 'must be >= 10080',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + '/lockLength',
          schemaPath: '#/properties/lockLength/type',
          keyword: 'type',
          params: { type: 'number' },
          message: 'must be number',
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
  } else {
    const err10 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err10];
    } else {
      vErrors.push(err10);
    }
    errors++;
  }
  validate18.errors = vErrors;
  return errors === 0;
}
var validateExtendVault = validate19;
function validate19(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'id' },
        message: "must have required property 'id'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.extendLength === void 0) {
      const err1 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'extendLength' },
        message: "must have required property 'extendLength'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === 'function' || key0 === 'id' || key0 === 'extendLength')) {
        const err2 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.function !== void 0) {
      let data0 = data.function;
      if (typeof data0 !== 'string') {
        const err3 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
      if ('extendVault' !== data0) {
        const err4 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/const',
          keyword: 'const',
          params: { allowedValue: 'extendVault' },
          message: 'must be equal to constant',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data1 = data.id;
      if (typeof data1 === 'string') {
        if (!pattern8.test(data1)) {
          const err5 = {
            instancePath: instancePath + '/id',
            schemaPath: '#/properties/id/pattern',
            keyword: 'pattern',
            params: { pattern: '^[a-zA-Z0-9-_]{43}$' },
            message: 'must match pattern "^[a-zA-Z0-9-_]{43}$"',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + '/id',
          schemaPath: '#/properties/id/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.extendLength !== void 0) {
      let data2 = data.extendLength;
      if (typeof data2 == 'number' && isFinite(data2)) {
        if (data2 > 3153600 || isNaN(data2)) {
          const err7 = {
            instancePath: instancePath + '/extendLength',
            schemaPath: '#/properties/extendLength/maximum',
            keyword: 'maximum',
            params: { comparison: '<=', limit: 3153600 },
            message: 'must be <= 3153600',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (data2 < 10080 || isNaN(data2)) {
          const err8 = {
            instancePath: instancePath + '/extendLength',
            schemaPath: '#/properties/extendLength/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 10080 },
            message: 'must be >= 10080',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + '/extendLength',
          schemaPath: '#/properties/extendLength/type',
          keyword: 'type',
          params: { type: 'number' },
          message: 'must be number',
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
  } else {
    const err10 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err10];
    } else {
      vErrors.push(err10);
    }
    errors++;
  }
  validate19.errors = vErrors;
  return errors === 0;
}
var validateIncreaseVault = validate20;
function validate20(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'id' },
        message: "must have required property 'id'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.qty === void 0) {
      const err1 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'qty' },
        message: "must have required property 'qty'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === 'function' || key0 === 'id' || key0 === 'qty')) {
        const err2 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.function !== void 0) {
      let data0 = data.function;
      if (typeof data0 !== 'string') {
        const err3 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
      if ('increaseVault' !== data0) {
        const err4 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/const',
          keyword: 'const',
          params: { allowedValue: 'increaseVault' },
          message: 'must be equal to constant',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data1 = data.id;
      if (typeof data1 === 'string') {
        if (!pattern8.test(data1)) {
          const err5 = {
            instancePath: instancePath + '/id',
            schemaPath: '#/properties/id/pattern',
            keyword: 'pattern',
            params: { pattern: '^[a-zA-Z0-9-_]{43}$' },
            message: 'must match pattern "^[a-zA-Z0-9-_]{43}$"',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + '/id',
          schemaPath: '#/properties/id/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.qty !== void 0) {
      let data2 = data.qty;
      if (typeof data2 == 'number' && isFinite(data2)) {
        if (data2 < 1 || isNaN(data2)) {
          const err7 = {
            instancePath: instancePath + '/qty',
            schemaPath: '#/properties/qty/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 1 },
            message: 'must be >= 1',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = {
          instancePath: instancePath + '/qty',
          schemaPath: '#/properties/qty/type',
          keyword: 'type',
          params: { type: 'number' },
          message: 'must be number',
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
  } else {
    const err9 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate20.errors = vErrors;
  return errors === 0;
}
var validateSaveObservations = validate21;
function validate21(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.failedGateways === void 0) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'failedGateways' },
        message: "must have required property 'failedGateways'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.observerReportTxId === void 0) {
      const err1 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'observerReportTxId' },
        message: "must have required property 'observerReportTxId'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (
        !(
          key0 === 'function' ||
          key0 === 'observerReportTxId' ||
          key0 === 'failedGateways'
        )
      ) {
        const err2 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.function !== void 0) {
      let data0 = data.function;
      if (typeof data0 !== 'string') {
        const err3 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
      if ('saveObservations' !== data0) {
        const err4 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/const',
          keyword: 'const',
          params: { allowedValue: 'saveObservations' },
          message: 'must be equal to constant',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.observerReportTxId !== void 0) {
      let data1 = data.observerReportTxId;
      if (typeof data1 === 'string') {
        if (!pattern8.test(data1)) {
          const err5 = {
            instancePath: instancePath + '/observerReportTxId',
            schemaPath: '#/properties/observerReportTxId/pattern',
            keyword: 'pattern',
            params: { pattern: '^[a-zA-Z0-9-_]{43}$' },
            message: 'must match pattern "^[a-zA-Z0-9-_]{43}$"',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + '/observerReportTxId',
          schemaPath: '#/properties/observerReportTxId/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.failedGateways !== void 0) {
      let data2 = data.failedGateways;
      if (Array.isArray(data2)) {
        if (data2.length < 0) {
          const err7 = {
            instancePath: instancePath + '/failedGateways',
            schemaPath: '#/properties/failedGateways/minItems',
            keyword: 'minItems',
            params: { limit: 0 },
            message: 'must NOT have fewer than 0 items',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        const len0 = data2.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data3 = data2[i0];
          if (typeof data3 === 'string') {
            if (!pattern8.test(data3)) {
              const err8 = {
                instancePath: instancePath + '/failedGateways/' + i0,
                schemaPath: '#/properties/failedGateways/items/pattern',
                keyword: 'pattern',
                params: { pattern: '^[a-zA-Z0-9-_]{43}$' },
                message: 'must match pattern "^[a-zA-Z0-9-_]{43}$"',
              };
              if (vErrors === null) {
                vErrors = [err8];
              } else {
                vErrors.push(err8);
              }
              errors++;
            }
          } else {
            const err9 = {
              instancePath: instancePath + '/failedGateways/' + i0,
              schemaPath: '#/properties/failedGateways/items/type',
              keyword: 'type',
              params: { type: 'string' },
              message: 'must be string',
            };
            if (vErrors === null) {
              vErrors = [err9];
            } else {
              vErrors.push(err9);
            }
            errors++;
          }
        }
        let i1 = data2.length;
        let j0;
        if (i1 > 1) {
          const indices0 = {};
          for (; i1--; ) {
            let item0 = data2[i1];
            if (typeof item0 !== 'string') {
              continue;
            }
            if (typeof indices0[item0] == 'number') {
              j0 = indices0[item0];
              const err10 = {
                instancePath: instancePath + '/failedGateways',
                schemaPath: '#/properties/failedGateways/uniqueItems',
                keyword: 'uniqueItems',
                params: { i: i1, j: j0 },
                message:
                  'must NOT have duplicate items (items ## ' +
                  j0 +
                  ' and ' +
                  i1 +
                  ' are identical)',
              };
              if (vErrors === null) {
                vErrors = [err10];
              } else {
                vErrors.push(err10);
              }
              errors++;
              break;
            }
            indices0[item0] = i1;
          }
        }
      } else {
        const err11 = {
          instancePath: instancePath + '/failedGateways',
          schemaPath: '#/properties/failedGateways/type',
          keyword: 'type',
          params: { type: 'array' },
          message: 'must be array',
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
  } else {
    const err12 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err12];
    } else {
      vErrors.push(err12);
    }
    errors++;
  }
  validate21.errors = vErrors;
  return errors === 0;
}
var validateUpdateGateway = validate22;
var schema23 = {
  $id: '#/definitions/updateGateway',
  type: 'object',
  properties: {
    function: { type: 'string', const: 'updateGatewaySettings' },
    fqdn: {
      type: 'string',
      pattern: '^(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\\.)+[A-Za-z]{1,63}$',
    },
    port: { type: 'number', minimum: 0, maximum: 65535 },
    protocol: { type: 'string', pattern: '^(http|https)$' },
    properties: { type: 'string', pattern: '^[a-zA-Z0-9_-]{43}$' },
    note: { type: 'string', pattern: '^.{1,256}$' },
    label: { type: 'string', pattern: '^.{1,64}$' },
    observerWallet: { type: 'string', pattern: '^(|[a-zA-Z0-9_-]{43})$' },
    autoStake: { type: 'boolean' },
    allowDelegatedStaking: { type: 'boolean' },
    delegateRewardShareRatio: { type: 'integer', minimum: 0, maximum: 100 },
    minDelegatedStake: { type: 'integer', minimum: 100 },
  },
  required: [],
  additionalProperties: false,
};
var pattern29 = new RegExp('^(|[a-zA-Z0-9_-]{43})$', 'u');
function validate22(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    for (const key0 in data) {
      if (!func2.call(schema23.properties, key0)) {
        const err0 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.function !== void 0) {
      let data0 = data.function;
      if (typeof data0 !== 'string') {
        const err1 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
      if ('updateGatewaySettings' !== data0) {
        const err2 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/const',
          keyword: 'const',
          params: { allowedValue: 'updateGatewaySettings' },
          message: 'must be equal to constant',
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.fqdn !== void 0) {
      let data1 = data.fqdn;
      if (typeof data1 === 'string') {
        if (!pattern11.test(data1)) {
          const err3 = {
            instancePath: instancePath + '/fqdn',
            schemaPath: '#/properties/fqdn/pattern',
            keyword: 'pattern',
            params: {
              pattern: '^(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\\.)+[A-Za-z]{1,63}$',
            },
            message:
              'must match pattern "^(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\\.)+[A-Za-z]{1,63}$"',
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = {
          instancePath: instancePath + '/fqdn',
          schemaPath: '#/properties/fqdn/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.port !== void 0) {
      let data2 = data.port;
      if (typeof data2 == 'number' && isFinite(data2)) {
        if (data2 > 65535 || isNaN(data2)) {
          const err5 = {
            instancePath: instancePath + '/port',
            schemaPath: '#/properties/port/maximum',
            keyword: 'maximum',
            params: { comparison: '<=', limit: 65535 },
            message: 'must be <= 65535',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (data2 < 0 || isNaN(data2)) {
          const err6 = {
            instancePath: instancePath + '/port',
            schemaPath: '#/properties/port/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 0 },
            message: 'must be >= 0',
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = {
          instancePath: instancePath + '/port',
          schemaPath: '#/properties/port/type',
          keyword: 'type',
          params: { type: 'number' },
          message: 'must be number',
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.protocol !== void 0) {
      let data3 = data.protocol;
      if (typeof data3 === 'string') {
        if (!pattern12.test(data3)) {
          const err8 = {
            instancePath: instancePath + '/protocol',
            schemaPath: '#/properties/protocol/pattern',
            keyword: 'pattern',
            params: { pattern: '^(http|https)$' },
            message: 'must match pattern "^(http|https)$"',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + '/protocol',
          schemaPath: '#/properties/protocol/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.properties !== void 0) {
      let data4 = data.properties;
      if (typeof data4 === 'string') {
        if (!pattern13.test(data4)) {
          const err10 = {
            instancePath: instancePath + '/properties',
            schemaPath: '#/properties/properties/pattern',
            keyword: 'pattern',
            params: { pattern: '^[a-zA-Z0-9_-]{43}$' },
            message: 'must match pattern "^[a-zA-Z0-9_-]{43}$"',
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = {
          instancePath: instancePath + '/properties',
          schemaPath: '#/properties/properties/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.note !== void 0) {
      let data5 = data.note;
      if (typeof data5 === 'string') {
        if (!pattern14.test(data5)) {
          const err12 = {
            instancePath: instancePath + '/note',
            schemaPath: '#/properties/note/pattern',
            keyword: 'pattern',
            params: { pattern: '^.{1,256}$' },
            message: 'must match pattern "^.{1,256}$"',
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = {
          instancePath: instancePath + '/note',
          schemaPath: '#/properties/note/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.label !== void 0) {
      let data6 = data.label;
      if (typeof data6 === 'string') {
        if (!pattern15.test(data6)) {
          const err14 = {
            instancePath: instancePath + '/label',
            schemaPath: '#/properties/label/pattern',
            keyword: 'pattern',
            params: { pattern: '^.{1,64}$' },
            message: 'must match pattern "^.{1,64}$"',
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
      } else {
        const err15 = {
          instancePath: instancePath + '/label',
          schemaPath: '#/properties/label/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.observerWallet !== void 0) {
      let data7 = data.observerWallet;
      if (typeof data7 === 'string') {
        if (!pattern29.test(data7)) {
          const err16 = {
            instancePath: instancePath + '/observerWallet',
            schemaPath: '#/properties/observerWallet/pattern',
            keyword: 'pattern',
            params: { pattern: '^(|[a-zA-Z0-9_-]{43})$' },
            message: 'must match pattern "^(|[a-zA-Z0-9_-]{43})$"',
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      } else {
        const err17 = {
          instancePath: instancePath + '/observerWallet',
          schemaPath: '#/properties/observerWallet/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.autoStake !== void 0) {
      if (typeof data.autoStake !== 'boolean') {
        const err18 = {
          instancePath: instancePath + '/autoStake',
          schemaPath: '#/properties/autoStake/type',
          keyword: 'type',
          params: { type: 'boolean' },
          message: 'must be boolean',
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.allowDelegatedStaking !== void 0) {
      if (typeof data.allowDelegatedStaking !== 'boolean') {
        const err19 = {
          instancePath: instancePath + '/allowDelegatedStaking',
          schemaPath: '#/properties/allowDelegatedStaking/type',
          keyword: 'type',
          params: { type: 'boolean' },
          message: 'must be boolean',
        };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.delegateRewardShareRatio !== void 0) {
      let data10 = data.delegateRewardShareRatio;
      if (
        !(
          typeof data10 == 'number' &&
          !(data10 % 1) &&
          !isNaN(data10) &&
          isFinite(data10)
        )
      ) {
        const err20 = {
          instancePath: instancePath + '/delegateRewardShareRatio',
          schemaPath: '#/properties/delegateRewardShareRatio/type',
          keyword: 'type',
          params: { type: 'integer' },
          message: 'must be integer',
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
      if (typeof data10 == 'number' && isFinite(data10)) {
        if (data10 > 100 || isNaN(data10)) {
          const err21 = {
            instancePath: instancePath + '/delegateRewardShareRatio',
            schemaPath: '#/properties/delegateRewardShareRatio/maximum',
            keyword: 'maximum',
            params: { comparison: '<=', limit: 100 },
            message: 'must be <= 100',
          };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
        if (data10 < 0 || isNaN(data10)) {
          const err22 = {
            instancePath: instancePath + '/delegateRewardShareRatio',
            schemaPath: '#/properties/delegateRewardShareRatio/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 0 },
            message: 'must be >= 0',
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
      }
    }
    if (data.minDelegatedStake !== void 0) {
      let data11 = data.minDelegatedStake;
      if (
        !(
          typeof data11 == 'number' &&
          !(data11 % 1) &&
          !isNaN(data11) &&
          isFinite(data11)
        )
      ) {
        const err23 = {
          instancePath: instancePath + '/minDelegatedStake',
          schemaPath: '#/properties/minDelegatedStake/type',
          keyword: 'type',
          params: { type: 'integer' },
          message: 'must be integer',
        };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
      if (typeof data11 == 'number' && isFinite(data11)) {
        if (data11 < 100 || isNaN(data11)) {
          const err24 = {
            instancePath: instancePath + '/minDelegatedStake',
            schemaPath: '#/properties/minDelegatedStake/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 100 },
            message: 'must be >= 100',
          };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
      }
    }
  } else {
    const err25 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err25];
    } else {
      vErrors.push(err25);
    }
    errors++;
  }
  validate22.errors = vErrors;
  return errors === 0;
}
var validateDelegateStake = validate23;
function validate23(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.target === void 0) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'target' },
        message: "must have required property 'target'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.qty === void 0) {
      const err1 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'qty' },
        message: "must have required property 'qty'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === 'function' || key0 === 'target' || key0 === 'qty')) {
        const err2 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.function !== void 0) {
      let data0 = data.function;
      if (typeof data0 !== 'string') {
        const err3 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
      if ('delegateStake' !== data0) {
        const err4 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/const',
          keyword: 'const',
          params: { allowedValue: 'delegateStake' },
          message: 'must be equal to constant',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.target !== void 0) {
      let data1 = data.target;
      if (typeof data1 === 'string') {
        if (!pattern8.test(data1)) {
          const err5 = {
            instancePath: instancePath + '/target',
            schemaPath: '#/properties/target/pattern',
            keyword: 'pattern',
            params: { pattern: '^[a-zA-Z0-9-_]{43}$' },
            message: 'must match pattern "^[a-zA-Z0-9-_]{43}$"',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + '/target',
          schemaPath: '#/properties/target/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.qty !== void 0) {
      let data2 = data.qty;
      if (
        !(
          typeof data2 == 'number' &&
          !(data2 % 1) &&
          !isNaN(data2) &&
          isFinite(data2)
        )
      ) {
        const err7 = {
          instancePath: instancePath + '/qty',
          schemaPath: '#/properties/qty/type',
          keyword: 'type',
          params: { type: 'integer' },
          message: 'must be integer',
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
      if (typeof data2 == 'number' && isFinite(data2)) {
        if (data2 < 1 || isNaN(data2)) {
          const err8 = {
            instancePath: instancePath + '/qty',
            schemaPath: '#/properties/qty/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 1 },
            message: 'must be >= 1',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      }
    }
  } else {
    const err9 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate23.errors = vErrors;
  return errors === 0;
}
var validateDecreaseDelegateStake = validate24;
function validate24(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.target === void 0) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'target' },
        message: "must have required property 'target'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.qty === void 0) {
      const err1 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'qty' },
        message: "must have required property 'qty'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === 'function' || key0 === 'target' || key0 === 'qty')) {
        const err2 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.function !== void 0) {
      let data0 = data.function;
      if (typeof data0 !== 'string') {
        const err3 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
      if ('decreaseDelegateStake' !== data0) {
        const err4 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/const',
          keyword: 'const',
          params: { allowedValue: 'decreaseDelegateStake' },
          message: 'must be equal to constant',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.target !== void 0) {
      let data1 = data.target;
      if (typeof data1 === 'string') {
        if (!pattern8.test(data1)) {
          const err5 = {
            instancePath: instancePath + '/target',
            schemaPath: '#/properties/target/pattern',
            keyword: 'pattern',
            params: { pattern: '^[a-zA-Z0-9-_]{43}$' },
            message: 'must match pattern "^[a-zA-Z0-9-_]{43}$"',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + '/target',
          schemaPath: '#/properties/target/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.qty !== void 0) {
      let data2 = data.qty;
      if (
        !(
          typeof data2 == 'number' &&
          !(data2 % 1) &&
          !isNaN(data2) &&
          isFinite(data2)
        )
      ) {
        const err7 = {
          instancePath: instancePath + '/qty',
          schemaPath: '#/properties/qty/type',
          keyword: 'type',
          params: { type: 'integer' },
          message: 'must be integer',
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
      if (typeof data2 == 'number' && isFinite(data2)) {
        if (data2 < 1 || isNaN(data2)) {
          const err8 = {
            instancePath: instancePath + '/qty',
            schemaPath: '#/properties/qty/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 1 },
            message: 'must be >= 1',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      }
    }
  } else {
    const err9 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate24.errors = vErrors;
  return errors === 0;
}
var validateDecreaseOperatorStake = validate25;
function validate25(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.qty === void 0) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'qty' },
        message: "must have required property 'qty'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === 'function' || key0 === 'qty')) {
        const err1 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.function !== void 0) {
      let data0 = data.function;
      if (typeof data0 !== 'string') {
        const err2 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
      if ('decreaseOperatorStake' !== data0) {
        const err3 = {
          instancePath: instancePath + '/function',
          schemaPath: '#/properties/function/const',
          keyword: 'const',
          params: { allowedValue: 'decreaseOperatorStake' },
          message: 'must be equal to constant',
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.qty !== void 0) {
      let data1 = data.qty;
      if (
        !(
          typeof data1 == 'number' &&
          !(data1 % 1) &&
          !isNaN(data1) &&
          isFinite(data1)
        )
      ) {
        const err4 = {
          instancePath: instancePath + '/qty',
          schemaPath: '#/properties/qty/type',
          keyword: 'type',
          params: { type: 'integer' },
          message: 'must be integer',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
      if (typeof data1 == 'number' && isFinite(data1)) {
        if (data1 < 1 || isNaN(data1)) {
          const err5 = {
            instancePath: instancePath + '/qty',
            schemaPath: '#/properties/qty/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 1 },
            message: 'must be >= 1',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      }
    }
  } else {
    const err6 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err6];
    } else {
      vErrors.push(err6);
    }
    errors++;
  }
  validate25.errors = vErrors;
  return errors === 0;
}

// src/actions/write/submitAuctionBid.ts
var AuctionBid = class {
  name;
  qty;
  type;
  contractTxId;
  years;
  constructor(input) {
    if (!validateAuctionBid(input)) {
      throw new ContractError(
        getInvalidAjvMessage(validateAuctionBid, input, 'auctionBid'),
      );
    }
    const {
      name,
      qty,
      type = 'lease',
      contractTxId = RESERVED_ATOMIC_TX_ID,
    } = input;
    this.name = name.trim().toLowerCase();
    this.qty = qty ? new mIOToken(qty) : void 0;
    this.type = type;
    this.contractTxId =
      contractTxId === RESERVED_ATOMIC_TX_ID
        ? SmartWeave.transaction.id
        : contractTxId;
    if (this.type === 'lease') {
      this.years = 1;
    }
  }
};
var submitAuctionBid = (state, { caller, input }) => {
  const auctionBid = new AuctionBid(input);
  const currentBlockTimestamp = new BlockTimestamp(+SmartWeave.block.timestamp);
  const currentBlockHeight = new BlockHeight(+SmartWeave.block.height);
  assertAvailableRecord({
    caller,
    name: auctionBid.name,
    records: state.records,
    reserved: state.reserved,
    currentBlockTimestamp,
    type: auctionBid.type,
    auction: true,
  });
  if (state.auctions[auctionBid.name]) {
    return handleBidForExistingAuction({
      state,
      auctionBid,
      caller,
      currentBlockHeight,
      currentBlockTimestamp,
    });
  } else {
    return handleBidForNewAuction({
      state,
      auctionBid,
      caller,
      currentBlockHeight,
      currentBlockTimestamp,
    });
  }
};
function handleBidForExistingAuction({
  state,
  auctionBid,
  caller,
  currentBlockHeight,
  currentBlockTimestamp,
}) {
  const { name, qty: submittedBid, contractTxId } = auctionBid;
  const existingAuction = state.auctions[name];
  const updatedRecords = {};
  const updatedBalances = {
    [SmartWeave.contract.id]: state.balances[SmartWeave.contract.id] || 0,
    [caller]: state.balances[caller] || 0,
    [existingAuction.initiator]: state.balances[existingAuction.initiator] || 0,
  };
  if (currentBlockHeight.valueOf() > existingAuction.endHeight) {
    throw new ContractError(ARNS_NAME_AUCTION_EXPIRED_MESSAGE);
  }
  const currentRequiredMinimumBid = calculateAuctionPriceForBlock({
    startHeight: new BlockHeight(existingAuction.startHeight),
    startPrice: new mIOToken(existingAuction.startPrice),
    floorPrice: new mIOToken(existingAuction.floorPrice),
    currentBlockHeight,
    auctionSettings: AUCTION_SETTINGS,
  });
  const finalBidForCaller = calculateExistingAuctionBidForCaller({
    auction: existingAuction,
    submittedBid,
    caller,
    requiredMinimumBid: currentRequiredMinimumBid,
  });
  if (!walletHasSufficientBalance(state.balances, caller, finalBidForCaller)) {
    throw new ContractError(INSUFFICIENT_FUNDS_MESSAGE);
  }
  const endTimestamp = getEndTimestampForAuction({
    auction: existingAuction,
    currentBlockTimestamp,
  });
  switch (existingAuction.type) {
    case 'permabuy':
      updatedRecords[name] = {
        contractTxId,
        // only update the new contract tx id
        type: existingAuction.type,
        startTimestamp: +SmartWeave.block.timestamp,
        // overwrite initial start timestamp
        undernames: DEFAULT_UNDERNAME_COUNT,
        purchasePrice: currentRequiredMinimumBid.valueOf(),
        // the total amount paid for the name
      };
      break;
    case 'lease':
      updatedRecords[name] = {
        contractTxId,
        // only update the new contract tx id
        type: existingAuction.type,
        startTimestamp: +SmartWeave.block.timestamp,
        // overwrite initial start timestamp
        undernames: DEFAULT_UNDERNAME_COUNT,
        // only include timestamp on lease, endTimestamp is easy in this situation since it was a second interaction that won it
        endTimestamp: endTimestamp.valueOf(),
        purchasePrice: currentRequiredMinimumBid.valueOf(),
        // the total amount paid for the name
      };
      break;
  }
  incrementBalance(
    updatedBalances,
    SmartWeave.contract.id,
    currentRequiredMinimumBid,
  );
  unsafeDecrementBalance(updatedBalances, caller, finalBidForCaller, false);
  if (caller !== existingAuction.initiator) {
    const floorPrice = new mIOToken(existingAuction.floorPrice);
    incrementBalance(updatedBalances, existingAuction.initiator, floorPrice);
  }
  const balances = {
    ...state.balances,
    ...updatedBalances,
  };
  Object.keys(updatedBalances)
    .filter((address) => updatedBalances[address] === 0)
    .forEach((address) => delete balances[address]);
  const records = {
    ...state.records,
    ...updatedRecords,
  };
  const { [name]: _, ...auctions } = state.auctions;
  Object.assign(state, {
    auctions,
    balances,
    records,
    demandFactoring: tallyNamePurchase(
      state.demandFactoring,
      currentRequiredMinimumBid,
    ),
  });
  return { state };
}
function handleBidForNewAuction({
  state,
  auctionBid,
  caller,
  currentBlockHeight,
  currentBlockTimestamp,
}) {
  const { name, type, contractTxId } = auctionBid;
  const initialAuctionBid = createAuctionObject({
    name,
    type,
    fees: state.fees,
    currentBlockTimestamp,
    demandFactoring: state.demandFactoring,
    currentBlockHeight,
    initiator: caller,
    contractTxId,
  });
  const floorPrice = initialAuctionBid.floorPrice;
  if (!walletHasSufficientBalance(state.balances, caller, floorPrice)) {
    throw new ContractError(INSUFFICIENT_FUNDS_MESSAGE);
  }
  const updatedBalances = {
    [SmartWeave.contract.id]: state.balances[SmartWeave.contract.id] || 0,
    [caller]: state.balances[caller] || 0,
  };
  unsafeDecrementBalance(updatedBalances, caller, floorPrice, false);
  const { [name]: _, ...reserved } = state.reserved;
  const auctions = {
    ...state.auctions,
    [name]: {
      ...initialAuctionBid,
      startPrice: initialAuctionBid.startPrice.valueOf(),
      floorPrice: initialAuctionBid.floorPrice.valueOf(),
      startHeight: currentBlockHeight.valueOf(),
      endHeight: initialAuctionBid.endHeight.valueOf(),
    },
  };
  const balances = {
    ...state.balances,
    ...updatedBalances,
  };
  Object.keys(updatedBalances)
    .filter((address) => updatedBalances[address] === 0)
    .forEach((address) => delete balances[address]);
  Object.assign(state, {
    auctions,
    balances,
    reserved,
  });
  return { state };
}

// src/actions/write/buyRecord.ts
var BuyRecord = class {
  name;
  contractTxId;
  years;
  type;
  auction;
  constructor(input) {
    if (!validateBuyRecord(input)) {
      throw new ContractError(
        getInvalidAjvMessage(validateBuyRecord, input, 'buyRecord'),
      );
    }
    const {
      name,
      contractTxId = RESERVED_ATOMIC_TX_ID,
      years = 1,
      type = 'lease',
      auction = false,
    } = input;
    this.name = name.trim().toLowerCase();
    this.contractTxId =
      contractTxId === RESERVED_ATOMIC_TX_ID
        ? SmartWeave.transaction.id
        : contractTxId;
    this.years = years;
    this.type = type;
    this.auction = auction;
  }
};
var buyRecord = async (state, { caller, input }) => {
  const { balances, records, reserved, fees, auctions } = state;
  const { name, contractTxId, years, type, auction } = new BuyRecord(input);
  const currentBlockTimestamp = new BlockTimestamp(+SmartWeave.block.timestamp);
  if (auction) {
    return submitAuctionBid(state, {
      caller,
      input,
    });
  }
  if (auctions[name]) {
    throw new ContractError(ARNS_NAME_IN_AUCTION_MESSAGE);
  }
  assertAvailableRecord({
    caller,
    name,
    records,
    reserved,
    currentBlockTimestamp,
    type,
    auction,
  });
  const totalRegistrationFee = calculateRegistrationFee({
    name,
    fees,
    years,
    type,
    currentBlockTimestamp,
    demandFactoring: state.demandFactoring,
  });
  if (!walletHasSufficientBalance(balances, caller, totalRegistrationFee)) {
    throw new ContractError(
      `Caller balance not high enough to purchase this name for ${totalRegistrationFee} token(s)!`,
    );
  }
  safeTransfer({
    balances,
    fromAddress: caller,
    toAddress: SmartWeave.contract.id,
    qty: totalRegistrationFee,
  });
  switch (type) {
    case 'permabuy':
      records[name] = {
        contractTxId,
        type,
        startTimestamp: +SmartWeave.block.timestamp,
        undernames: DEFAULT_UNDERNAME_COUNT,
        purchasePrice: totalRegistrationFee.valueOf(),
      };
      break;
    case 'lease':
      records[name] = {
        contractTxId,
        type,
        startTimestamp: +SmartWeave.block.timestamp,
        undernames: DEFAULT_UNDERNAME_COUNT,
        purchasePrice: totalRegistrationFee.valueOf(),
        // set the end lease period for this based on number of years if it's a lease
        endTimestamp:
          currentBlockTimestamp.valueOf() + SECONDS_IN_A_YEAR * years,
      };
      break;
  }
  if (reserved[name]) {
    delete state.reserved[name];
  }
  state.demandFactoring = tallyNamePurchase(
    state.demandFactoring,
    totalRegistrationFee,
  );
  return { state };
};

// src/actions/write/extendRecord.ts
var ExtendRecord = class {
  function = 'extendRecord';
  name;
  years;
  constructor(input) {
    if (!validateExtendRecord(input)) {
      throw new ContractError(
        getInvalidAjvMessage(validateExtendRecord, input, 'extendRecord'),
      );
    }
    const { name, years } = input;
    this.name = name.trim().toLowerCase();
    this.years = years;
  }
};
var extendRecord = async (state, { caller, input }) => {
  const { balances, records, fees } = state;
  const currentBlockTimestamp = new BlockTimestamp(+SmartWeave.block.timestamp);
  const { name, years } = new ExtendRecord(input);
  const record = records[name];
  if (!record) {
    throw new ContractError(ARNS_NAME_DOES_NOT_EXIST_MESSAGE);
  }
  if (
    !balances[caller] ||
    balances[caller] == void 0 ||
    balances[caller] == null ||
    isNaN(balances[caller])
  ) {
    throw new ContractError(INSUFFICIENT_FUNDS_MESSAGE);
  }
  if (!isLeaseRecord(record)) {
    throw new ContractError(ARNS_INVALID_EXTENSION_MESSAGE);
  }
  assertRecordCanBeExtended({
    record,
    currentBlockTimestamp,
    years,
  });
  const demandFactor = state.demandFactoring.demandFactor;
  const annualRenewalFee = calculateAnnualRenewalFee({
    name,
    fees,
    years,
  });
  const totalExtensionAnnualFee = annualRenewalFee.multiply(demandFactor);
  if (!walletHasSufficientBalance(balances, caller, totalExtensionAnnualFee)) {
    throw new ContractError(INSUFFICIENT_FUNDS_MESSAGE);
  }
  safeTransfer({
    balances: state.balances,
    fromAddress: caller,
    toAddress: SmartWeave.contract.id,
    qty: totalExtensionAnnualFee,
  });
  record.endTimestamp += SECONDS_IN_A_YEAR * years;
  state.demandFactoring = tallyNamePurchase(
    state.demandFactoring,
    totalExtensionAnnualFee,
  );
  return { state };
};
function assertRecordCanBeExtended({ record, currentBlockTimestamp, years }) {
  if (
    !isExistingActiveRecord({
      record,
      currentBlockTimestamp,
    })
  ) {
    throw new ContractError(
      `This name has expired and must renewed before it can be extended.`,
    );
  }
  if (!isLeaseRecord(record)) {
    throw new ContractError(ARNS_INVALID_EXTENSION_MESSAGE);
  }
  if (
    years >
    getMaxAllowedYearsExtensionForRecord({ currentBlockTimestamp, record })
  ) {
    throw new ContractError(ARNS_INVALID_YEARS_MESSAGE);
  }
}

// src/actions/write/increaseUndernameCount.ts
var IncreaseUndernameCount = class {
  function = 'increaseUndernameCount';
  name;
  qty;
  constructor(input) {
    if (!validateIncreaseUndernameCount(input)) {
      throw new ContractError(
        getInvalidAjvMessage(
          validateIncreaseUndernameCount,
          input,
          'increaseUndernameCount',
        ),
      );
    }
    const { name, qty } = input;
    this.name = name.trim().toLowerCase();
    this.qty = qty;
  }
};
var increaseUndernameCount = async (state, { caller, input }) => {
  const { name, qty } = new IncreaseUndernameCount(input);
  const { balances, records } = state;
  const record = records[name];
  const currentBlockTimestamp = new BlockTimestamp(+SmartWeave.block.timestamp);
  assertRecordCanIncreaseUndernameCount({
    record,
    qty,
    currentBlockTimestamp,
  });
  const { type, undernames: existingUndernames } = record;
  const endTimestamp = isLeaseRecord(record) ? record.endTimestamp : void 0;
  const yearsRemaining = endTimestamp
    ? calculateYearsBetweenTimestamps({
        startTimestamp: currentBlockTimestamp,
        endTimestamp: new BlockTimestamp(endTimestamp),
      })
    : PERMABUY_LEASE_FEE_LENGTH;
  const incrementedUndernames = existingUndernames + qty;
  const additionalUndernameCost = calculateUndernameCost({
    name,
    fees: state.fees,
    increaseQty: qty,
    type,
    demandFactoring: state.demandFactoring,
    years: yearsRemaining,
  });
  if (!walletHasSufficientBalance(balances, caller, additionalUndernameCost)) {
    throw new ContractError(
      `${INSUFFICIENT_FUNDS_MESSAGE}: caller has ${balances[caller].toLocaleString()} but needs to have ${additionalUndernameCost.toLocaleString()} to pay for this undername increase of ${qty} for ${name}.`,
    );
  }
  state.records[name].undernames = incrementedUndernames;
  safeTransfer({
    balances: state.balances,
    fromAddress: caller,
    toAddress: SmartWeave.contract.id,
    qty: additionalUndernameCost,
  });
  return { state };
};
function assertRecordCanIncreaseUndernameCount({
  record,
  qty,
  currentBlockTimestamp,
}) {
  if (!record) {
    throw new ContractError(ARNS_NAME_DOES_NOT_EXIST_MESSAGE);
  }
  if (
    !isExistingActiveRecord({
      record,
      currentBlockTimestamp,
    })
  ) {
    throw new ContractError(
      `This name has expired and must renewed before its undername support can be extended.`,
    );
  }
  if (record.undernames + qty > MAX_ALLOWED_UNDERNAMES) {
    throw new ContractError(ARNS_MAX_UNDERNAME_MESSAGE);
  }
}

// src/actions/read/price.ts
function getPriceForInteraction(state, { caller, input }) {
  let fee;
  const { interactionName: _, ...parsedInput } = {
    ...input,
    function: input.interactionName,
  };
  const interactionTimestamp = new BlockTimestamp(+SmartWeave.block.timestamp);
  const interactionHeight = new BlockHeight(+SmartWeave.block.height);
  switch (input.interactionName) {
    case 'buyRecord': {
      const { name, years, type, auction } = new BuyRecord(parsedInput);
      if (auction) {
        return getPriceForInteraction(state, {
          caller,
          input: {
            ...input,
            function: 'submitAuctionBid',
          },
        });
      }
      assertAvailableRecord({
        caller: void 0,
        // stub the caller so we still get the price
        name,
        records: state.records,
        reserved: state.reserved,
        currentBlockTimestamp: interactionTimestamp,
        type,
        auction,
      });
      fee = calculateRegistrationFee({
        name,
        fees: state.fees,
        type,
        years,
        currentBlockTimestamp: interactionTimestamp,
        demandFactoring: state.demandFactoring,
      });
      break;
    }
    case 'submitAuctionBid': {
      const { name, type } = new AuctionBid(parsedInput);
      const auction = state.auctions[name];
      assertAvailableRecord({
        caller: void 0,
        // stub the caller so we still get the price
        name,
        records: state.records,
        reserved: state.reserved,
        currentBlockTimestamp: interactionTimestamp,
        type,
        auction: true,
      });
      if (!auction) {
        const newAuction = createAuctionObject({
          name,
          currentBlockTimestamp: interactionTimestamp,
          currentBlockHeight: interactionHeight,
          fees: state.fees,
          demandFactoring: state.demandFactoring,
          type: 'lease',
          initiator: caller,
          contractTxId: SmartWeave.transaction.id,
        });
        fee = newAuction.floorPrice;
        break;
      }
      const minimumAuctionBid = calculateAuctionPriceForBlock({
        startHeight: new BlockHeight(auction.startHeight),
        currentBlockHeight: interactionHeight,
        startPrice: new mIOToken(auction.startPrice),
        floorPrice: new mIOToken(auction.floorPrice),
        auctionSettings: AUCTION_SETTINGS,
      });
      fee = minimumAuctionBid;
      break;
    }
    case 'extendRecord': {
      const { name, years } = new ExtendRecord(parsedInput);
      const record = state.records[name];
      assertRecordCanBeExtended({
        record,
        currentBlockTimestamp: interactionTimestamp,
        years,
      });
      fee = calculateAnnualRenewalFee({
        name,
        years,
        fees: state.fees,
      }).multiply(state.demandFactoring.demandFactor);
      break;
    }
    case 'increaseUndernameCount': {
      const { name, qty } = new IncreaseUndernameCount(parsedInput);
      const record = state.records[name];
      assertRecordCanIncreaseUndernameCount({
        record,
        qty,
        currentBlockTimestamp: interactionTimestamp,
      });
      const { type } = record;
      const endTimestamp = isLeaseRecord(record) ? record.endTimestamp : void 0;
      const yearsRemaining = endTimestamp
        ? calculateYearsBetweenTimestamps({
            startTimestamp: interactionTimestamp,
            endTimestamp: new BlockTimestamp(endTimestamp),
          })
        : PERMABUY_LEASE_FEE_LENGTH;
      fee = calculateUndernameCost({
        name,
        fees: state.fees,
        type,
        years: yearsRemaining,
        increaseQty: qty,
        demandFactoring: state.demandFactoring,
      });
      break;
    }
    default:
      throw new ContractError(
        `Invalid function provided. Available options are 'buyRecord', 'extendRecord', and 'increaseUndernameCount'.`,
      );
  }
  return {
    result: {
      input,
      price: fee.valueOf(),
    },
  };
}

// src/actions/read/record.ts
var getRecord = async (state, { input: { name } }) => {
  const records = state.records;
  if (typeof name !== 'string') {
    throw new ContractError('Must specify the ArNS Name');
  }
  if (!(name in records)) {
    throw new ContractError('This name does not exist');
  }
  const arnsName = records[name];
  return {
    result: {
      name,
      ...arnsName,
    },
  };
};

// src/actions/write/createReservedName.ts
var ReservedName = class {
  name;
  target;
  endTimestamp;
  constructor(input) {
    if (!validateCreateReservedName(input)) {
      throw new ContractError(
        getInvalidAjvMessage(
          validateCreateReservedName,
          input,
          'createReservedName',
        ),
      );
    }
    const { name, target, endTimestamp } = input;
    this.endTimestamp = endTimestamp;
    this.target = target;
    this.name = name;
  }
};
var createReservedName = async (state, { caller, input }) => {
  const owner = state.owner;
  if (caller !== owner) {
    throw new ContractError(NON_CONTRACT_OWNER_MESSAGE);
  }
  const reservedName = new ReservedName(input);
  if (reservedName.endTimestamp < +SmartWeave.block.timestamp) {
    throw new ContractError('End timestamp is in the past');
  }
  state.reserved[reservedName.name] = {
    target: reservedName.target,
    endTimestamp: reservedName.endTimestamp,
  };
  return { state };
};

// src/vaults.ts
function safeCreateVault({
  balances,
  vaults,
  address,
  qty,
  id,
  lockLength,
  startHeight,
}) {
  if (!walletHasSufficientBalance(balances, address, qty)) {
    throw new ContractError(INSUFFICIENT_FUNDS_MESSAGE);
  }
  if (vaults[address] && id in vaults[address]) {
    throw new Error(`Vault with id '${id}' already exists`);
  }
  if (
    lockLength.valueOf() < MIN_TOKEN_LOCK_BLOCK_LENGTH ||
    lockLength.valueOf() > MAX_TOKEN_LOCK_BLOCK_LENGTH
  ) {
    throw new ContractError(INVALID_VAULT_LOCK_LENGTH_MESSAGE);
  }
  const end = startHeight.valueOf() + lockLength.valueOf();
  const newVault = {
    balance: qty.valueOf(),
    start: startHeight.valueOf(),
    end,
  };
  vaults[address] = {
    ...vaults[address],
    [id]: newVault,
  };
  unsafeDecrementBalance(balances, address, qty);
}
function safeExtendVault({ vaults, address, id, extendLength }) {
  if (!vaults[address] || !(id in vaults[address])) {
    throw new ContractError('Invalid vault ID.');
  }
  if (+SmartWeave.block.height >= vaults[address][id].end) {
    throw new ContractError('This vault has ended.');
  }
  const currentEnd = vaults[address][id].end;
  const totalBlocksRemaining = currentEnd - +SmartWeave.block.height;
  if (
    extendLength.valueOf() < MIN_TOKEN_LOCK_BLOCK_LENGTH ||
    extendLength.valueOf() > MAX_TOKEN_LOCK_BLOCK_LENGTH ||
    totalBlocksRemaining + extendLength.valueOf() > MAX_TOKEN_LOCK_BLOCK_LENGTH
  ) {
    throw new ContractError(INVALID_VAULT_LOCK_LENGTH_MESSAGE);
  }
  const newEnd = currentEnd + extendLength.valueOf();
  vaults[address][id].end = newEnd;
}
function safeIncreaseVault({ balances, vaults, address, id, qty }) {
  if (!walletHasSufficientBalance(balances, address, qty)) {
    throw new ContractError(INSUFFICIENT_FUNDS_MESSAGE);
  }
  if (!vaults[address] || !(id in vaults[address])) {
    throw new ContractError('Invalid vault ID.');
  }
  if (+SmartWeave.block.height >= vaults[address][id].end) {
    throw new ContractError('This vault has ended.');
  }
  vaults[address][id].balance += qty.valueOf();
  unsafeDecrementBalance(balances, address, qty);
}

// src/actions/write/createVault.ts
var CreateVault = class {
  qty;
  lockLength;
  constructor(input) {
    if (!validateCreateVault(input)) {
      throw new ContractError(
        getInvalidAjvMessage(validateCreateVault, input, 'createVault'),
      );
    }
    const { qty, lockLength } = input;
    this.qty = new mIOToken(qty);
    this.lockLength = new BlockHeight(lockLength);
  }
};
var createVault = async (state, { caller, input }) => {
  const { balances, vaults } = state;
  const { qty, lockLength } = new CreateVault(input);
  safeCreateVault({
    balances,
    vaults,
    address: caller,
    qty,
    lockLength,
    id: SmartWeave.transaction.id,
    startHeight: new BlockHeight(SmartWeave.block.height),
  });
  return { state };
};

// src/delegates.ts
function safeDelegateStake({
  balances,
  gateways,
  fromAddress,
  gatewayAddress,
  qty,
  startHeight,
}) {
  if (balances[fromAddress] === null || isNaN(balances[fromAddress])) {
    throw new ContractError(`Caller balance is not defined!`);
  }
  if (!walletHasSufficientBalance(balances, fromAddress, qty)) {
    throw new ContractError(INSUFFICIENT_FUNDS_MESSAGE);
  }
  const gateway = gateways[gatewayAddress];
  if (!gateway) {
    throw new ContractError(INVALID_GATEWAY_REGISTERED_MESSAGE);
  }
  if (gateway.status === NETWORK_LEAVING_STATUS) {
    throw new ContractError(
      'This Gateway is in the process of leaving the network and cannot have more stake delegated to it.',
    );
  }
  if (!gateway.settings.allowDelegatedStaking) {
    throw new ContractError(
      `This Gateway does not allow delegated staking. Only allowed delegates can delegate stake to this Gateway.`,
    );
  }
  if (Object.keys(gateway.delegates).length > MAX_DELEGATES) {
    throw new ContractError(
      `This Gateway has reached its maximum amount of delegated stakers.`,
    );
  }
  const existingDelegate = gateway.delegates[fromAddress];
  const minimumStakeForGatewayAndDelegate =
    // it already has a stake that is not zero
    existingDelegate && existingDelegate.delegatedStake !== 0
      ? 1
      : gateway.settings.minDelegatedStake;
  if (qty.valueOf() < minimumStakeForGatewayAndDelegate) {
    throw new ContractError(
      `Qty must be greater than the minimum delegated stake amount.`,
    );
  }
  if (!existingDelegate) {
    gateways[gatewayAddress].delegates[fromAddress] = {
      delegatedStake: qty.valueOf(),
      start: startHeight.valueOf(),
      vaults: {},
    };
  } else {
    existingDelegate.delegatedStake += qty.valueOf();
  }
  gateways[gatewayAddress].totalDelegatedStake += qty.valueOf();
  unsafeDecrementBalance(balances, fromAddress, qty);
}
function safeDecreaseDelegateStake({
  gateways,
  fromAddress,
  gatewayAddress,
  qty,
  id,
  startHeight,
}) {
  if (!gateways[gatewayAddress]) {
    throw new ContractError(INVALID_GATEWAY_REGISTERED_MESSAGE);
  }
  const gateway = gateways[gatewayAddress];
  const existingDelegate = gateway.delegates[fromAddress];
  if (!existingDelegate) {
    throw new ContractError('This delegate is not staked at this gateway.');
  }
  const existingStake = new mIOToken(existingDelegate.delegatedStake);
  const requiredMinimumStake = new mIOToken(gateway.settings.minDelegatedStake);
  const maxAllowedToWithdraw = existingStake.minus(requiredMinimumStake);
  if (maxAllowedToWithdraw.isLessThan(qty) && !qty.equals(existingStake)) {
    throw new ContractError(
      `Remaining delegated stake must be greater than the minimum delegated stake amount.`,
    );
  }
  gateways[gatewayAddress].delegates[fromAddress].delegatedStake -=
    qty.valueOf();
  gateways[gatewayAddress].delegates[fromAddress].vaults[id] = {
    balance: qty.valueOf(),
    start: startHeight.valueOf(),
    end: startHeight.plus(DELEGATED_STAKE_UNLOCK_LENGTH).valueOf(),
  };
  gateways[gatewayAddress].totalDelegatedStake -= qty.valueOf();
}

// src/actions/write/decreaseDelegateStake.ts
var DecreaseDelegateStake = class {
  target;
  qty;
  constructor(input) {
    if (!validateDecreaseDelegateStake(input)) {
      throw new ContractError(
        getInvalidAjvMessage(
          validateDecreaseDelegateStake,
          input,
          'decreaseDelegateStake',
        ),
      );
    }
    const { target, qty } = input;
    this.target = target;
    this.qty = new mIOToken(qty);
  }
};
var decreaseDelegateStake = async (state, { caller, input }) => {
  const { gateways } = state;
  const { target, qty } = new DecreaseDelegateStake(input);
  safeDecreaseDelegateStake({
    gateways,
    fromAddress: caller,
    gatewayAddress: target,
    qty,
    id: SmartWeave.transaction.id,
    startHeight: new BlockHeight(SmartWeave.block.height),
  });
  return { state };
};

// src/actions/write/decreaseOperatorStake.ts
var DecreaseOperatorStake = class {
  qty;
  constructor(input) {
    if (!validateDecreaseOperatorStake(input)) {
      throw new ContractError(
        getInvalidAjvMessage(
          validateDecreaseOperatorStake,
          input,
          'decreaseOperatorStake',
        ),
      );
    }
    const { qty } = input;
    this.qty = new mIOToken(qty);
  }
};
var decreaseOperatorStake = async (state, { caller, input }) => {
  const { gateways } = state;
  const { qty } = new DecreaseOperatorStake(input);
  if (!(caller in gateways)) {
    throw new ContractError(INVALID_GATEWAY_EXISTS_MESSAGE);
  }
  if (gateways[caller].status === NETWORK_LEAVING_STATUS) {
    throw new ContractError(
      'Gateway is leaving the network and cannot accept additional stake.',
    );
  }
  const existingStake = new mIOToken(gateways[caller].operatorStake);
  const maxWithdraw = existingStake.minus(MIN_OPERATOR_STAKE);
  if (qty.isGreaterThan(maxWithdraw)) {
    throw new ContractError(
      `Resulting stake is not enough maintain the minimum operator stake of ${MIN_OPERATOR_STAKE.valueOf()} mIO`,
    );
  }
  const interactionHeight = new BlockHeight(+SmartWeave.block.height);
  const updatedGateway = {
    ...gateways[caller],
    operatorStake: existingStake.minus(qty).valueOf(),
    vaults: {
      ...gateways[caller].vaults,
      [SmartWeave.transaction.id]: {
        balance: qty.valueOf(),
        start: interactionHeight.valueOf(),
        end: interactionHeight
          .plus(GATEWAY_REGISTRY_SETTINGS.operatorStakeWithdrawLength)
          .valueOf(),
      },
    },
  };
  state.gateways[caller] = updatedGateway;
  return { state };
};

// src/actions/write/delegateStake.ts
var DelegateStake = class {
  target;
  qty;
  constructor(input) {
    if (!validateDelegateStake(input)) {
      throw new ContractError(
        getInvalidAjvMessage(validateDelegateStake, input, 'delegateStake'),
      );
    }
    const { target, qty } = input;
    this.target = target;
    this.qty = new mIOToken(qty);
  }
};
var delegateStake = async (state, { caller, input }) => {
  const { balances, gateways } = state;
  const { target, qty } = new DelegateStake(input);
  safeDelegateStake({
    balances,
    gateways,
    fromAddress: caller,
    gatewayAddress: target,
    qty,
    startHeight: new BlockHeight(SmartWeave.block.height),
  });
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

// src/actions/write/evolveState.ts
var evolveState = async (state, { caller }) => {
  const owner = state.owner;
  if (caller !== owner) {
    throw new ContractError(NON_CONTRACT_OWNER_MESSAGE);
  }
  const updatedFees = Object.keys(state.fees).reduce((acc, key) => {
    const existingFee = state.fees[key];
    acc[key] = existingFee / 1e6;
    return acc;
  }, {});
  state.fees = updatedFees;
  return { state };
};

// src/actions/write/extendVault.ts
var ExtendVault = class {
  id;
  extendLength;
  constructor(input) {
    if (!validateExtendVault(input)) {
      throw new ContractError(
        getInvalidAjvMessage(validateExtendVault, input, 'extendVault'),
      );
    }
    const { id, extendLength } = input;
    this.id = id;
    this.extendLength = new BlockHeight(extendLength);
  }
};
var extendVault = async (state, { caller, input }) => {
  const { vaults } = state;
  const { id, extendLength } = new ExtendVault(input);
  safeExtendVault({ vaults, address: caller, id, extendLength });
  return { state };
};

// src/actions/write/increaseOperatorStake.ts
var increaseOperatorStake = async (state, { caller, input }) => {
  const { gateways, balances } = state;
  if (isNaN(input.qty) || input.qty <= 0) {
    throw new ContractError(INVALID_INPUT_MESSAGE);
  }
  const qty = new mIOToken(input.qty);
  if (!(caller in gateways)) {
    throw new ContractError(INVALID_GATEWAY_EXISTS_MESSAGE);
  }
  if (gateways[caller].status === NETWORK_LEAVING_STATUS) {
    throw new ContractError(
      'Gateway is leaving the network and cannot accept additional stake.',
    );
  }
  if (!walletHasSufficientBalance(balances, caller, qty)) {
    throw new ContractError(INSUFFICIENT_FUNDS_MESSAGE);
  }
  unsafeDecrementBalance(state.balances, caller, qty);
  state.gateways[caller].operatorStake += qty.valueOf();
  return { state };
};

// src/actions/write/increaseVault.ts
var IncreaseVault = class {
  id;
  qty;
  constructor(input) {
    if (!validateIncreaseVault(input)) {
      throw new ContractError(
        getInvalidAjvMessage(validateIncreaseVault, input, 'increaseVault'),
      );
    }
    const { id, qty } = input;
    this.id = id;
    this.qty = new mIOToken(qty);
  }
};
var increaseVault = async (state, { caller, input }) => {
  const { balances, vaults } = state;
  const { id, qty } = new IncreaseVault(input);
  safeIncreaseVault({
    balances,
    vaults,
    address: caller,
    id,
    qty,
  });
  return { state };
};

// src/actions/write/joinNetwork.ts
var JoinNetwork = class {
  qty;
  fqdn;
  label;
  note;
  properties;
  protocol;
  port;
  observerWallet;
  autoStake;
  allowDelegatedStaking;
  delegateRewardShareRatio;
  minDelegatedStake;
  constructor(input, caller) {
    if (!validateJoinNetwork(input)) {
      throw new ContractError(
        getInvalidAjvMessage(validateJoinNetwork, input, 'joinNetwork'),
      );
    }
    const {
      qty = MIN_OPERATOR_STAKE,
      label,
      port,
      fqdn,
      note,
      protocol,
      properties,
      observerWallet = caller,
      autoStake = false,
      allowDelegatedStaking = false,
      delegateRewardShareRatio = 0,
      minDelegatedStake = MIN_DELEGATED_STAKE,
    } = input;
    this.qty = new mIOToken(qty);
    this.label = label;
    this.port = port;
    this.protocol = protocol;
    this.properties = properties;
    this.fqdn = fqdn;
    this.note = note;
    this.observerWallet = observerWallet;
    this.autoStake = autoStake;
    this.allowDelegatedStaking = allowDelegatedStaking;
    this.delegateRewardShareRatio = delegateRewardShareRatio;
    this.minDelegatedStake = minDelegatedStake;
  }
};
var joinNetwork = async (state, { caller, input }) => {
  const { balances, gateways = {} } = state;
  const { qty, observerWallet, ...gatewaySettings } = new JoinNetwork(
    input,
    caller,
  );
  if (!walletHasSufficientBalance(balances, caller, qty)) {
    throw new ContractError(INSUFFICIENT_FUNDS_MESSAGE);
  }
  if (qty.isLessThan(MIN_OPERATOR_STAKE)) {
    throw new ContractError(INVALID_GATEWAY_STAKE_AMOUNT_MESSAGE);
  }
  if (caller in gateways) {
    throw new ContractError(INVALID_GATEWAY_EXISTS_MESSAGE);
  }
  if (
    Object.values(gateways).some(
      (gateway) => gateway.observerWallet === observerWallet,
    )
  ) {
    throw new ContractError(INVALID_OBSERVER_WALLET);
  }
  unsafeDecrementBalance(state.balances, caller, qty);
  state.gateways[caller] = {
    operatorStake: qty.valueOf(),
    totalDelegatedStake: 0,
    // defaults to no delegated stake
    observerWallet,
    // defaults to caller
    vaults: {},
    delegates: {},
    settings: {
      ...gatewaySettings,
      minDelegatedStake: gatewaySettings.minDelegatedStake.valueOf(),
    },
    status: NETWORK_JOIN_STATUS,
    start: +SmartWeave.block.height,
    // TODO: timestamp vs. height
    end: 0,
    stats: DEFAULT_GATEWAY_PERFORMANCE_STATS,
  };
  return { state };
};

// src/actions/write/leaveNetwork.ts
var leaveNetwork = async (state, { caller }) => {
  const gateways = state.gateways;
  const gateway = gateways[caller];
  const currentBlockHeight = new BlockHeight(+SmartWeave.block.height);
  if (!gateway) {
    throw new ContractError('The caller does not have a registered gateway.');
  }
  if (
    !isGatewayEligibleToLeave({
      gateway,
      currentBlockHeight,
      minimumGatewayJoinLength: GATEWAY_REGISTRY_SETTINGS.minGatewayJoinLength,
    })
  ) {
    throw new ContractError(
      `The gateway is not eligible to leave the network. It must be joined for a minimum of ${GATEWAY_REGISTRY_SETTINGS.minGatewayJoinLength} blocks and can not already be leaving the network. Current status: ${gateways[caller].status}`,
    );
  }
  const interactionHeight = new BlockHeight(+SmartWeave.block.height);
  const gatewayEndHeight = interactionHeight.plus(GATEWAY_LEAVE_BLOCK_LENGTH);
  const gatewayStakeWithdrawHeight = interactionHeight.plus(
    GATEWAY_REGISTRY_SETTINGS.operatorStakeWithdrawLength,
  );
  const delegateEndHeight = interactionHeight.plus(
    DELEGATED_STAKE_UNLOCK_LENGTH,
  );
  gateways[caller].vaults[caller] = {
    balance: MIN_OPERATOR_STAKE.valueOf(),
    start: interactionHeight.valueOf(),
    end: gatewayEndHeight.valueOf(),
  };
  gateways[caller].operatorStake -= MIN_OPERATOR_STAKE.valueOf();
  if (gateways[caller].operatorStake > 0) {
    gateways[caller].vaults[SmartWeave.transaction.id] = {
      balance: gateways[caller].operatorStake,
      start: interactionHeight.valueOf(),
      end: gatewayStakeWithdrawHeight.valueOf(),
    };
  }
  gateways[caller].operatorStake = 0;
  gateways[caller].end = gatewayEndHeight.valueOf();
  gateways[caller].status = NETWORK_LEAVING_STATUS;
  for (const address in gateways[caller].delegates) {
    gateways[caller].delegates[address].vaults[SmartWeave.transaction.id] = {
      balance: gateways[caller].delegates[address].delegatedStake,
      start: interactionHeight.valueOf(),
      end: delegateEndHeight.valueOf(),
    };
    gateways[caller].totalDelegatedStake -=
      gateways[caller].delegates[address].delegatedStake;
    gateways[caller].delegates[address].delegatedStake = 0;
  }
  state.gateways = gateways;
  return { state };
};

// src/actions/write/saveObservations.ts
var SaveObservations = class {
  observerReportTxId;
  failedGateways;
  gatewayAddress;
  constructor(input) {
    if (!validateSaveObservations(input)) {
      throw new ContractError(
        getInvalidAjvMessage(
          validateSaveObservations,
          input,
          'saveObservations',
        ),
      );
    }
    const { observerReportTxId, failedGateways } = input;
    this.observerReportTxId = observerReportTxId;
    this.failedGateways = failedGateways;
  }
};
var saveObservations = async (state, { caller, input }) => {
  const {
    observations,
    gateways,
    distributions,
    prescribedObservers: observersForEpoch,
  } = state;
  const { observerReportTxId, failedGateways } = new SaveObservations(input);
  const { epochStartHeight } = getEpochDataForHeight({
    currentBlockHeight: new BlockHeight(+SmartWeave.block.height),
    // observations must be submitted within the epoch and after the last epochs distribution period (see below)
    epochZeroStartHeight: new BlockHeight(distributions.epochZeroStartHeight),
    epochBlockLength: new BlockHeight(EPOCH_BLOCK_LENGTH),
  });
  if (
    +SmartWeave.block.height <
    epochStartHeight.valueOf() + EPOCH_DISTRIBUTION_DELAY
  ) {
    throw new ContractError(
      `Observations for the current epoch cannot be submitted before block height: ${epochStartHeight.valueOf() + EPOCH_DISTRIBUTION_DELAY}`,
    );
  }
  const prescribedObservers =
    observersForEpoch[epochStartHeight.valueOf()] || [];
  const observer = prescribedObservers.find(
    (prescribedObserver) => prescribedObserver.observerAddress === caller,
  );
  if (!observer) {
    throw new ContractError(INVALID_OBSERVATION_CALLER_MESSAGE);
  }
  const observingGateway = gateways[observer.gatewayAddress];
  if (!observingGateway) {
    throw new ContractError(
      'The associated gateway does not exist in the registry',
    );
  }
  if (!observations[epochStartHeight.valueOf()]) {
    observations[epochStartHeight.valueOf()] = {
      failureSummaries: {},
      reports: {},
    };
  }
  for (const address of failedGateways) {
    const failedGateway = gateways[address];
    if (
      !failedGateway ||
      failedGateway.start > epochStartHeight.valueOf() ||
      failedGateway.status !== NETWORK_JOIN_STATUS
    ) {
      continue;
    }
    const existingObservers =
      observations[epochStartHeight.valueOf()].failureSummaries[address] || [];
    const updatedObserversForFailedGateway = /* @__PURE__ */ new Set([
      ...existingObservers,
    ]);
    updatedObserversForFailedGateway.add(observingGateway.observerWallet);
    observations[epochStartHeight.valueOf()].failureSummaries[address] = [
      ...updatedObserversForFailedGateway,
    ];
  }
  observations[epochStartHeight.valueOf()].reports[
    observingGateway.observerWallet
  ] = observerReportTxId;
  state.observations = observations;
  return { state };
};

// src/distributions.ts
function safeDelegateDistribution({
  balances,
  gateways,
  protocolAddress,
  gatewayAddress,
  delegateAddress,
  qty,
}) {
  if (balances[protocolAddress] === null || isNaN(balances[protocolAddress])) {
    throw new ContractError(`Caller balance is not defined!`);
  }
  if (!walletHasSufficientBalance(balances, protocolAddress, qty)) {
    throw new ContractError(INSUFFICIENT_FUNDS_MESSAGE);
  }
  if (!gateways[gatewayAddress]) {
    throw new ContractError(INVALID_GATEWAY_REGISTERED_MESSAGE);
  }
  if (!gateways[gatewayAddress].delegates[delegateAddress]) {
    throw new ContractError('Delegate not staked on this gateway.');
  }
  gateways[gatewayAddress].delegates[delegateAddress].delegatedStake +=
    qty.valueOf();
  gateways[gatewayAddress].totalDelegatedStake += qty.valueOf();
  unsafeDecrementBalance(balances, protocolAddress, qty);
}
function safeGatewayStakeDistribution({
  balances,
  gateways,
  protocolAddress,
  gatewayAddress,
  qty,
}) {
  if (balances[protocolAddress] === null || isNaN(balances[protocolAddress])) {
    throw new ContractError(`Caller balance is not defined!`);
  }
  if (!walletHasSufficientBalance(balances, protocolAddress, qty)) {
    throw new ContractError(INSUFFICIENT_FUNDS_MESSAGE);
  }
  if (!gateways[gatewayAddress]) {
    throw new ContractError(INVALID_GATEWAY_REGISTERED_MESSAGE);
  }
  gateways[gatewayAddress].operatorStake += qty.valueOf();
  unsafeDecrementBalance(balances, protocolAddress, qty);
}

// src/actions/write/tick.ts
async function tickInternal({
  currentBlockHeight,
  currentBlockTimestamp,
  state,
}) {
  const updatedState = state;
  const { demandFactoring: prevDemandFactoring, fees: prevFees } = state;
  Object.assign(
    updatedState,
    updateDemandFactor(currentBlockHeight, prevDemandFactoring, prevFees),
  );
  Object.assign(
    updatedState,
    tickAuctions({
      currentBlockHeight,
      currentBlockTimestamp,
      records: updatedState.records,
      auctions: updatedState.auctions,
      balances: updatedState.balances,
      demandFactoring: updatedState.demandFactoring,
    }),
  );
  Object.assign(
    updatedState,
    tickGatewayRegistry({
      currentBlockHeight,
      gateways: updatedState.gateways,
      balances: updatedState.balances,
    }),
  );
  Object.assign(
    updatedState,
    tickVaults({
      currentBlockHeight,
      vaults: updatedState.vaults,
      balances: updatedState.balances,
    }),
  );
  Object.assign(
    updatedState,
    tickRecords({
      currentBlockTimestamp,
      records: updatedState.records,
    }),
  );
  Object.assign(
    updatedState,
    tickReservedNames({
      currentBlockTimestamp,
      reservedNames: updatedState.reserved,
    }),
  );
  Object.assign(
    updatedState,
    await tickRewardDistribution({
      currentBlockHeight,
      gateways: updatedState.gateways,
      distributions:
        updatedState.distributions || INITIAL_EPOCH_DISTRIBUTION_DATA,
      observations: updatedState.observations || {},
      balances: updatedState.balances,
      prescribedObservers: updatedState.prescribedObservers || {},
    }),
  );
  Object.assign(updatedState, {
    lastTickedHeight: currentBlockHeight.valueOf(),
  });
  return updatedState;
}
function tickRecords({ currentBlockTimestamp, records }) {
  const updatedRecords = Object.keys(records).reduce((acc, key) => {
    const record = records[key];
    if (isExistingActiveRecord({ record, currentBlockTimestamp })) {
      acc[key] = record;
    }
    return acc;
  }, {});
  return {
    records: updatedRecords,
  };
}
function tickReservedNames({ currentBlockTimestamp, reservedNames }) {
  const activeReservedNames = Object.keys(reservedNames).reduce((acc, key) => {
    const reservedName = reservedNames[key];
    if (
      isActiveReservedName({
        caller: void 0,
        reservedName,
        currentBlockTimestamp,
      })
    ) {
      acc[key] = reservedName;
    }
    return acc;
  }, {});
  return {
    reserved: activeReservedNames,
  };
}
function tickGatewayRegistry({ currentBlockHeight, gateways, balances }) {
  const updatedBalances = {};
  const updatedRegistry = Object.keys(gateways).reduce((acc, key) => {
    const gateway = { ...gateways[key] };
    if (
      isGatewayEligibleToBeRemoved({
        gateway,
        currentBlockHeight,
      })
    ) {
      if (!updatedBalances[key]) {
        updatedBalances[key] = balances[key] || 0;
      }
      for (const vault of Object.values(gateway.vaults)) {
        incrementBalance(updatedBalances, key, new mIOToken(vault.balance));
      }
      if (gateway.operatorStake) {
        incrementBalance(
          updatedBalances,
          key,
          new mIOToken(gateway.operatorStake),
        );
      }
      for (const [delegateAddress, delegate] of Object.entries(
        gateway.delegates,
      )) {
        for (const vault of Object.values(delegate.vaults)) {
          incrementBalance(
            updatedBalances,
            delegateAddress,
            new mIOToken(vault.balance),
          );
        }
        if (delegate.delegatedStake) {
          incrementBalance(
            updatedBalances,
            delegateAddress,
            new mIOToken(delegate.delegatedStake),
          );
        }
      }
      return acc;
    }
    const updatedVaults = {};
    for (const [id, vault] of Object.entries(gateway.vaults)) {
      if (vault.end <= currentBlockHeight.valueOf()) {
        if (!updatedBalances[key]) {
          updatedBalances[key] = balances[key] || 0;
        }
        incrementBalance(updatedBalances, key, new mIOToken(vault.balance));
      } else {
        updatedVaults[id] = vault;
      }
    }
    const updatedDelegates = {};
    for (const [delegateAddress, delegate] of Object.entries(
      gateway.delegates,
    )) {
      if (!updatedDelegates[delegateAddress]) {
        updatedDelegates[delegateAddress] = {
          ...gateways[key].delegates[delegateAddress],
          vaults: {},
          // start with no vaults
        };
      }
      for (const [id, vault] of Object.entries(delegate.vaults)) {
        if (vault.end <= currentBlockHeight.valueOf()) {
          if (!updatedBalances[delegateAddress]) {
            updatedBalances[delegateAddress] = balances[delegateAddress] || 0;
          }
          incrementBalance(
            updatedBalances,
            delegateAddress,
            new mIOToken(vault.balance),
          );
        } else {
          updatedDelegates[delegateAddress].vaults[id] = vault;
        }
      }
      if (
        updatedDelegates[delegateAddress].delegatedStake === 0 &&
        Object.keys(updatedDelegates[delegateAddress].vaults).length === 0
      ) {
        delete updatedDelegates[delegateAddress];
      }
    }
    if (
      gateway.stats.failedConsecutiveEpochs >
        MAXIMUM_OBSERVER_CONSECUTIVE_FAIL_COUNT &&
      gateway.status !== NETWORK_LEAVING_STATUS
    ) {
      const interactionBlockHeight = new BlockHeight(+SmartWeave.block.height);
      const gatewayEndHeight = interactionBlockHeight.plus(
        GATEWAY_LEAVE_BLOCK_LENGTH,
      );
      const gatewayStakeWithdrawHeight = interactionBlockHeight.plus(
        GATEWAY_REGISTRY_SETTINGS.operatorStakeWithdrawLength,
      );
      const delegateEndHeight = interactionBlockHeight.plus(
        DELEGATED_STAKE_UNLOCK_LENGTH,
      );
      updatedVaults[key] = {
        balance: MIN_OPERATOR_STAKE.valueOf(),
        start: interactionBlockHeight.valueOf(),
        end: gatewayEndHeight.valueOf(),
      };
      gateway.operatorStake -= MIN_OPERATOR_STAKE.valueOf();
      if (gateway.operatorStake > 0) {
        updatedVaults[SmartWeave.transaction.id] = {
          balance: gateway.operatorStake,
          start: interactionBlockHeight.valueOf(),
          end: gatewayStakeWithdrawHeight.valueOf(),
        };
      }
      gateway.operatorStake = 0;
      gateway.end = gatewayEndHeight.valueOf();
      gateway.status = NETWORK_LEAVING_STATUS;
      for (const address in updatedDelegates) {
        updatedDelegates[address].vaults[SmartWeave.transaction.id] = {
          balance: updatedDelegates[address].delegatedStake,
          start: interactionBlockHeight.valueOf(),
          end: delegateEndHeight.valueOf(),
        };
        gateway.totalDelegatedStake -= updatedDelegates[address].delegatedStake;
        updatedDelegates[address].delegatedStake = 0;
      }
    }
    acc[key] = {
      ...gateway,
      delegates: updatedDelegates,
      vaults: updatedVaults,
    };
    return acc;
  }, {});
  const newBalances = Object.keys(updatedBalances).length
    ? { ...balances, ...updatedBalances }
    : balances;
  return {
    gateways: updatedRegistry,
    balances: newBalances,
  };
}
function tickVaults({ currentBlockHeight, vaults, balances }) {
  const updatedBalances = {};
  const updatedVaults = Object.keys(vaults).reduce((acc, address) => {
    const activeVaults = Object.entries(vaults[address]).reduce(
      (addressVaults, [id, vault]) => {
        if (vault.end <= currentBlockHeight.valueOf()) {
          if (!updatedBalances[address]) {
            updatedBalances[address] = balances[address] || 0;
          }
          incrementBalance(
            updatedBalances,
            address,
            new mIOToken(vault.balance),
          );
          return addressVaults;
        }
        addressVaults[id] = vault;
        return addressVaults;
      },
      {},
    );
    if (Object.keys(activeVaults).length > 0) {
      acc[address] = activeVaults;
    }
    return acc;
  }, {});
  const newBalances = Object.keys(updatedBalances).length
    ? { ...balances, ...updatedBalances }
    : balances;
  return {
    vaults: updatedVaults,
    balances: newBalances,
  };
}
function tickAuctions({
  currentBlockHeight,
  currentBlockTimestamp,
  records,
  balances,
  auctions,
  demandFactoring,
}) {
  const updatedRecords = {};
  const updatedBalances = {};
  let updatedDemandFactoring = cloneDemandFactoringData(demandFactoring);
  const updatedAuctions = Object.keys(auctions).reduce((acc, key) => {
    const auction = auctions[key];
    if (auction.endHeight >= currentBlockHeight.valueOf()) {
      acc[key] = auction;
      return acc;
    }
    switch (auction.type) {
      case 'permabuy':
        updatedRecords[key] = {
          type: auction.type,
          contractTxId: auction.contractTxId,
          startTimestamp: currentBlockTimestamp.valueOf(),
          undernames: DEFAULT_UNDERNAME_COUNT,
          purchasePrice: auction.floorPrice,
        };
        break;
      case 'lease':
        updatedRecords[key] = {
          type: auction.type,
          contractTxId: auction.contractTxId,
          startTimestamp: currentBlockTimestamp.valueOf(),
          undernames: DEFAULT_UNDERNAME_COUNT,
          // TODO: Block timestamps is broken here - user could be getting bonus time here when the next write interaction occurs
          // update the records field but do not decrement balance from the initiator as that happens on auction initiation
          endTimestamp:
            +auction.years * SECONDS_IN_A_YEAR +
            currentBlockTimestamp.valueOf(),
          purchasePrice: auction.floorPrice,
        };
        break;
    }
    if (!updatedBalances[SmartWeave.contract.id]) {
      updatedBalances[SmartWeave.contract.id] =
        balances[SmartWeave.contract.id] || 0;
    }
    incrementBalance(
      updatedBalances,
      SmartWeave.contract.id,
      new mIOToken(auction.floorPrice),
    );
    const floorPrice = new mIOToken(auction.floorPrice);
    updatedDemandFactoring = tallyNamePurchase(
      updatedDemandFactoring,
      floorPrice,
    );
    return acc;
  }, {});
  const newRecords = Object.keys(updatedRecords).length
    ? {
        ...records,
        ...updatedRecords,
      }
    : records;
  const newBalances = Object.keys(updatedBalances).length
    ? {
        ...balances,
        ...updatedBalances,
      }
    : balances;
  return {
    auctions: updatedAuctions,
    balances: newBalances,
    records: newRecords,
    demandFactoring: updatedDemandFactoring,
  };
}
async function tickRewardDistribution({
  currentBlockHeight,
  gateways,
  distributions,
  observations,
  balances,
  prescribedObservers,
}) {
  const updatedBalances = {};
  const updatedGateways = {};
  const currentProtocolBalance = balances[SmartWeave.contract.id] || 0;
  const distributionHeightForLastEpoch = new BlockHeight(
    distributions.nextDistributionHeight,
  );
  if (
    currentBlockHeight.valueOf() !== distributionHeightForLastEpoch.valueOf()
  ) {
    return {
      distributions,
      balances,
      gateways,
      prescribedObservers,
    };
  }
  const { epochStartHeight, epochEndHeight } = getEpochDataForHeight({
    currentBlockHeight: new BlockHeight(
      distributionHeightForLastEpoch.valueOf() - EPOCH_DISTRIBUTION_DELAY - 1,
    ),
    epochZeroStartHeight: new BlockHeight(distributions.epochZeroStartHeight),
    epochBlockLength: new BlockHeight(EPOCH_BLOCK_LENGTH),
  });
  const totalReportsSubmitted = Object.keys(
    observations[epochStartHeight.valueOf()]?.reports || [],
  ).length;
  const failureReportCountThreshold = Math.floor(
    totalReportsSubmitted * OBSERVATION_FAILURE_THRESHOLD,
  );
  const eligibleGateways = getEligibleGatewaysForEpoch({
    epochStartHeight,
    epochEndHeight,
    gateways,
  });
  const previouslyPrescribedObservers =
    prescribedObservers[epochStartHeight.valueOf()] ||
    (await getPrescribedObserversForEpoch({
      gateways,
      epochStartHeight,
      epochEndHeight,
      distributions,
      minOperatorStake: MIN_OPERATOR_STAKE,
    }));
  const gatewaysToReward = [];
  const observerGatewaysToReward = [];
  for (const [gatewayAddress, existingGateway] of Object.entries(
    eligibleGateways,
  )) {
    if (!existingGateway) {
      continue;
    }
    const existingGatewayStats =
      existingGateway.stats || DEFAULT_GATEWAY_PERFORMANCE_STATS;
    const updatedGatewayStats = {
      ...existingGatewayStats,
      totalEpochParticipationCount:
        existingGatewayStats.totalEpochParticipationCount + 1,
      // increment the total right away
    };
    if (!observations[epochStartHeight.valueOf()]?.reports) {
      updatedGateways[gatewayAddress] = {
        ...existingGateway,
        stats: updatedGatewayStats,
      };
      continue;
    }
    const totalNumberOfFailuresReported = (
      observations[epochStartHeight.valueOf()]?.failureSummaries[
        gatewayAddress
      ] || []
    ).length;
    if (totalNumberOfFailuresReported > failureReportCountThreshold) {
      updatedGatewayStats.failedConsecutiveEpochs += 1;
      updatedGateways[gatewayAddress] = {
        ...existingGateway,
        stats: updatedGatewayStats,
      };
      continue;
    }
    updatedGatewayStats.passedEpochCount += 1;
    updatedGatewayStats.failedConsecutiveEpochs = 0;
    gatewaysToReward.push(gatewayAddress);
    updatedGateways[gatewayAddress] = {
      ...existingGateway,
      stats: updatedGatewayStats,
    };
  }
  for (const observer of previouslyPrescribedObservers) {
    const existingGateway =
      updatedGateways[observer.gatewayAddress] ||
      gateways[observer.gatewayAddress];
    if (!existingGateway) {
      continue;
    }
    const existingGatewayStats =
      existingGateway?.stats || DEFAULT_GATEWAY_PERFORMANCE_STATS;
    const updatedGatewayStats = {
      ...existingGatewayStats,
      totalEpochsPrescribedCount:
        existingGatewayStats?.totalEpochsPrescribedCount + 1,
      // increment the prescribed count right away
    };
    const observerSubmittedReportForEpoch =
      observations[epochStartHeight.valueOf()]?.reports[
        observer.observerAddress
      ];
    if (!observerSubmittedReportForEpoch) {
      updatedGateways[observer.gatewayAddress] = {
        ...existingGateway,
        stats: updatedGatewayStats,
      };
      continue;
    }
    updatedGatewayStats.submittedEpochCount += 1;
    updatedGateways[observer.gatewayAddress] = {
      ...existingGateway,
      stats: updatedGatewayStats,
    };
    observerGatewaysToReward.push(observer.gatewayAddress);
  }
  const totalPotentialReward = new mIOToken(
    Math.floor(currentProtocolBalance * EPOCH_REWARD_PERCENTAGE),
  );
  const totalPotentialGatewayReward = totalPotentialReward.multiply(
    GATEWAY_PERCENTAGE_OF_EPOCH_REWARD,
  );
  if (Object.keys(eligibleGateways).length > 0) {
    const perGatewayReward = totalPotentialGatewayReward.divide(
      Object.keys(eligibleGateways).length,
    );
    for (const gatewayAddress of gatewaysToReward) {
      const rewardedGateway = gateways[gatewayAddress];
      if (!updatedBalances[SmartWeave.contract.id]) {
        updatedBalances[SmartWeave.contract.id] =
          balances[SmartWeave.contract.id] || 0;
      }
      if (!updatedBalances[gatewayAddress]) {
        updatedBalances[gatewayAddress] = balances[gatewayAddress] || 0;
      }
      let gatewayReward = perGatewayReward;
      if (
        previouslyPrescribedObservers.some(
          (prescribed) => prescribed.gatewayAddress === gatewayAddress,
        ) &&
        !observerGatewaysToReward.includes(gatewayAddress)
      ) {
        gatewayReward = perGatewayReward.multiply(
          1 - BAD_OBSERVER_GATEWAY_PENALTY,
        );
      }
      if (
        // Reminder: if an operator sets allowDelegatedStaking to false all delegates current stake get vaulted, and they cannot change it until those vaults are returned
        rewardedGateway.settings.allowDelegatedStaking &&
        Object.keys(rewardedGateway.delegates).length &&
        rewardedGateway.settings.delegateRewardShareRatio > 0 &&
        rewardedGateway.totalDelegatedStake > 0
      ) {
        let totalDistributedToDelegates = new mIOToken(0);
        let totalDelegatedStakeForEpoch = new mIOToken(0);
        const eligibleDelegates = Object.entries(
          rewardedGateway.delegates,
        ).reduce((acc, [address, delegateData]) => {
          if (delegateData.start <= epochStartHeight.valueOf()) {
            const delegatedStake = new mIOToken(delegateData.delegatedStake);
            totalDelegatedStakeForEpoch =
              totalDelegatedStakeForEpoch.plus(delegatedStake);
            acc[address] = delegateData;
          }
          return acc;
        }, {});
        const gatewayDelegatesTotalReward = gatewayReward.multiply(
          rewardedGateway.settings.delegateRewardShareRatio / 100,
        );
        for (const delegateAddress in eligibleDelegates) {
          const delegateData = rewardedGateway.delegates[delegateAddress];
          const delegatedStake = new mIOToken(delegateData.delegatedStake);
          const delegatedStakeRatio =
            delegatedStake.valueOf() / totalDelegatedStakeForEpoch.valueOf();
          const rewardForDelegate =
            gatewayDelegatesTotalReward.multiply(delegatedStakeRatio);
          if (rewardForDelegate.valueOf() < 1) {
            continue;
          }
          safeDelegateDistribution({
            balances: updatedBalances,
            gateways: updatedGateways,
            protocolAddress: SmartWeave.contract.id,
            gatewayAddress,
            delegateAddress,
            qty: rewardForDelegate,
          });
          totalDistributedToDelegates =
            totalDistributedToDelegates.plus(rewardForDelegate);
        }
        const remainingTokensForOperator = gatewayReward.minus(
          totalDistributedToDelegates,
        );
        if (gateways[gatewayAddress].settings.autoStake) {
          safeGatewayStakeDistribution({
            balances: updatedBalances,
            gateways: updatedGateways,
            protocolAddress: SmartWeave.contract.id,
            gatewayAddress,
            qty: remainingTokensForOperator,
          });
        } else {
          safeTransfer({
            balances: updatedBalances,
            fromAddress: SmartWeave.contract.id,
            toAddress: gatewayAddress,
            qty: remainingTokensForOperator,
          });
        }
      } else {
        if (gateways[gatewayAddress].settings.autoStake) {
          safeGatewayStakeDistribution({
            balances: updatedBalances,
            gateways: updatedGateways,
            protocolAddress: SmartWeave.contract.id,
            gatewayAddress,
            qty: gatewayReward,
          });
        } else {
          safeTransfer({
            balances: updatedBalances,
            fromAddress: SmartWeave.contract.id,
            toAddress: gatewayAddress,
            qty: gatewayReward,
          });
        }
      }
    }
  }
  const totalPotentialObserverReward = totalPotentialReward.multiply(
    OBSERVER_PERCENTAGE_OF_EPOCH_REWARD,
  );
  if (Object.keys(previouslyPrescribedObservers).length > 0) {
    const perObserverReward = totalPotentialObserverReward.divide(
      Object.keys(previouslyPrescribedObservers).length,
    );
    for (const gatewayObservedAndPassed of observerGatewaysToReward) {
      const rewardedGateway = gateways[gatewayObservedAndPassed];
      if (!updatedBalances[SmartWeave.contract.id]) {
        updatedBalances[SmartWeave.contract.id] =
          balances[SmartWeave.contract.id] || 0;
      }
      if (!updatedBalances[gatewayObservedAndPassed]) {
        updatedBalances[gatewayObservedAndPassed] =
          balances[gatewayObservedAndPassed] || 0;
      }
      if (
        // TODO: move this to a utility function
        rewardedGateway.settings.allowDelegatedStaking &&
        Object.keys(rewardedGateway.delegates).length &&
        rewardedGateway.settings.delegateRewardShareRatio > 0
      ) {
        let totalDistributedToDelegates = new mIOToken(0);
        let totalDelegatedStakeForEpoch = new mIOToken(0);
        const eligibleDelegates = Object.entries(
          rewardedGateway.delegates,
        ).reduce((acc, [address, delegateData]) => {
          if (delegateData.start <= epochStartHeight.valueOf()) {
            const delegatedStake = new mIOToken(delegateData.delegatedStake);
            totalDelegatedStakeForEpoch =
              totalDelegatedStakeForEpoch.plus(delegatedStake);
            acc[address] = delegateData;
          }
          return acc;
        }, {});
        const gatewayDelegatesTotalReward = perObserverReward.multiply(
          rewardedGateway.settings.delegateRewardShareRatio / 100,
        );
        for (const delegateAddress in eligibleDelegates) {
          const delegateData = rewardedGateway.delegates[delegateAddress];
          const delegatedStake = new mIOToken(delegateData.delegatedStake);
          const delegatedStakeRatio =
            delegatedStake.valueOf() / totalDelegatedStakeForEpoch.valueOf();
          const rewardForDelegate =
            gatewayDelegatesTotalReward.multiply(delegatedStakeRatio);
          if (rewardForDelegate.valueOf() < 1) {
            continue;
          }
          safeDelegateDistribution({
            balances: updatedBalances,
            gateways: updatedGateways,
            protocolAddress: SmartWeave.contract.id,
            gatewayAddress: gatewayObservedAndPassed,
            delegateAddress,
            qty: rewardForDelegate,
          });
          totalDistributedToDelegates =
            totalDistributedToDelegates.plus(rewardForDelegate);
        }
        const remainingTokensForOperator = perObserverReward.minus(
          totalDistributedToDelegates,
        );
        if (gateways[gatewayObservedAndPassed].settings.autoStake) {
          safeGatewayStakeDistribution({
            balances: updatedBalances,
            gateways: updatedGateways,
            protocolAddress: SmartWeave.contract.id,
            gatewayAddress: gatewayObservedAndPassed,
            qty: remainingTokensForOperator,
          });
        } else {
          safeTransfer({
            balances: updatedBalances,
            fromAddress: SmartWeave.contract.id,
            toAddress: gatewayObservedAndPassed,
            qty: remainingTokensForOperator,
          });
        }
      } else {
        if (gateways[gatewayObservedAndPassed].settings.autoStake) {
          safeGatewayStakeDistribution({
            balances: updatedBalances,
            gateways: updatedGateways,
            protocolAddress: SmartWeave.contract.id,
            gatewayAddress: gatewayObservedAndPassed,
            qty: perObserverReward,
          });
        } else {
          safeTransfer({
            balances: updatedBalances,
            fromAddress: SmartWeave.contract.id,
            toAddress: gatewayObservedAndPassed,
            qty: perObserverReward,
          });
        }
      }
    }
  }
  const newBalances = Object.keys(updatedBalances).length
    ? { ...balances, ...updatedBalances }
    : balances;
  const newGateways = Object.keys(updatedGateways).length
    ? { ...gateways, ...updatedGateways }
    : gateways;
  const {
    epochStartHeight: nextEpochStartHeight,
    epochEndHeight: nextEpochEndHeight,
    epochDistributionHeight: nextDistributionHeight,
    epochPeriod,
  } = getEpochDataForHeight({
    currentBlockHeight: new BlockHeight(epochEndHeight.valueOf() + 1),
    epochZeroStartHeight: new BlockHeight(distributions.epochZeroStartHeight),
    epochBlockLength: new BlockHeight(EPOCH_BLOCK_LENGTH),
  });
  const updatedEpochData = {
    // increment epoch variables to the next one - they should already be updated with the checks above
    epochStartHeight: nextEpochStartHeight.valueOf(),
    epochEndHeight: nextEpochEndHeight.valueOf(),
    epochZeroStartHeight: distributions.epochZeroStartHeight,
    nextDistributionHeight: nextDistributionHeight.valueOf(),
    epochPeriod: epochPeriod.valueOf(),
  };
  const updatedPrescribedObservers = await getPrescribedObserversForEpoch({
    gateways: newGateways,
    epochStartHeight: nextEpochStartHeight,
    epochEndHeight: nextEpochEndHeight,
    distributions: updatedEpochData,
    minOperatorStake: MIN_OPERATOR_STAKE,
  });
  return {
    distributions: updatedEpochData,
    balances: newBalances,
    gateways: newGateways,
    prescribedObservers: {
      [nextEpochStartHeight.valueOf()]: updatedPrescribedObservers,
    },
  };
}
var tick = async (state) => {
  const interactionHeight = new BlockHeight(+SmartWeave.block.height);
  const interactionTimestamp = new BlockTimestamp(+SmartWeave.block.timestamp);
  if (interactionHeight.valueOf() === state.lastTickedHeight) {
    return { state };
  }
  if (interactionHeight.valueOf() < state.lastTickedHeight) {
    throw new ContractError(
      `Interaction height ${interactionHeight} is less than last ticked height ${state.lastTickedHeight}`,
    );
  }
  let updatedState = {
    ...state,
  };
  for (
    let tickHeight = state.lastTickedHeight + 1;
    tickHeight <= interactionHeight.valueOf();
    tickHeight++
  ) {
    const currentBlockHeight = new BlockHeight(tickHeight);
    updatedState = await tickInternal({
      currentBlockHeight,
      currentBlockTimestamp: interactionTimestamp,
      state: updatedState,
    });
  }
  return { state: updatedState };
};

// src/actions/write/transferTokens.ts
var TransferToken = class {
  target;
  qty;
  constructor(input) {
    if (!validateTransferToken(input)) {
      throw new ContractError(
        getInvalidAjvMessage(validateTransferToken, input, 'transferToken'),
      );
    }
    const { target, qty } = input;
    this.target = target;
    this.qty = new mIOToken(qty);
  }
};
var transferTokens = async (state, { caller, input }) => {
  const { balances } = state;
  const { target, qty } = new TransferToken(input);
  safeTransfer({
    balances,
    fromAddress: caller,
    toAddress: target,
    qty,
  });
  return { state };
};

// src/actions/write/updateGatewaySettings.ts
var GatewaySettings = class {
  observerWallet;
  settings;
  constructor(input) {
    if (!validateUpdateGateway(input)) {
      throw new ContractError(
        getInvalidAjvMessage(validateUpdateGateway, input, 'updateGateway'),
      );
    }
    const {
      label,
      port,
      fqdn,
      note,
      protocol,
      properties,
      observerWallet,
      autoStake,
      allowDelegatedStaking,
      delegateRewardShareRatio,
      minDelegatedStake,
    } = input;
    this.settings = {
      ...(fqdn !== void 0 && { fqdn }),
      ...(label !== void 0 && { label }),
      ...(note !== void 0 && { note }),
      ...(properties !== void 0 && { properties }),
      ...(protocol !== void 0 && { protocol }),
      ...(port !== void 0 && { port }),
      ...(autoStake !== void 0 && { autoStake }),
      ...(allowDelegatedStaking !== void 0 && { allowDelegatedStaking }),
      ...(delegateRewardShareRatio !== void 0 && {
        delegateRewardShareRatio,
      }),
      ...(minDelegatedStake !== void 0 && {
        minDelegatedStake: new mIOToken(minDelegatedStake),
      }),
    };
    this.observerWallet = observerWallet;
  }
};
var updateGatewaySettings = async (state, { caller, input }) => {
  const { gateways = {} } = state;
  const { observerWallet: updatedObserverWallet, settings: updatedSettings } =
    new GatewaySettings(input);
  const gateway = gateways[caller];
  if (!gateway) {
    throw new ContractError(INVALID_GATEWAY_REGISTERED_MESSAGE);
  }
  if (
    updatedSettings.minDelegatedStake &&
    updatedSettings.minDelegatedStake.isLessThan(MIN_DELEGATED_STAKE)
  ) {
    throw new ContractError(
      `The minimum delegated stake must be at least ${MIN_DELEGATED_STAKE.toIO()} IO`,
    );
  }
  if (
    Object.entries(gateways).some(
      ([gatewayAddress, gateway2]) =>
        gateway2.observerWallet === updatedObserverWallet &&
        gatewayAddress !== caller,
    )
  ) {
    throw new ContractError(INVALID_OBSERVER_WALLET);
  }
  const updatedGateway = {
    ...gateway,
    observerWallet: updatedObserverWallet || gateways[caller].observerWallet,
    settings: {
      ...gateway.settings,
      ...updatedSettings,
      ...(updatedSettings.minDelegatedStake && {
        minDelegatedStake: updatedSettings.minDelegatedStake.valueOf(),
      }),
    },
  };
  if (
    updatedSettings.allowDelegatedStaking === false &&
    Object.keys(gateway.delegates).length
  ) {
    const interactionHeight = new BlockHeight(+SmartWeave.block.height);
    const delegateEndHeight = interactionHeight.plus(
      DELEGATED_STAKE_UNLOCK_LENGTH,
    );
    for (const address in updatedGateway.delegates) {
      updatedGateway.delegates[address].vaults[SmartWeave.transaction.id] = {
        balance: updatedGateway.delegates[address].delegatedStake,
        start: interactionHeight.valueOf(),
        end: delegateEndHeight.valueOf(),
      };
      updatedGateway.totalDelegatedStake -=
        updatedGateway.delegates[address].delegatedStake;
      updatedGateway.delegates[address].delegatedStake = 0;
    }
  }
  if (
    updatedSettings.allowDelegatedStaking === true &&
    gateway.settings.allowDelegatedStaking === false &&
    Object.keys(gateway.delegates).length > 0
  ) {
    throw new ContractError(
      'You cannot enable delegated staking until all delegated stakes have been withdrawn.',
    );
  }
  state.gateways[caller] = updatedGateway;
  return { state };
};

// src/actions/write/vaultedTransfer.ts
var TransferTokensLocked = class {
  target;
  qty;
  lockLength;
  constructor(input) {
    if (!validateTransferTokensLocked(input)) {
      throw new ContractError(
        getInvalidAjvMessage(
          validateTransferTokensLocked,
          input,
          'transferTokensLocked',
        ),
      );
    }
    const { target, qty, lockLength } = input;
    this.target = target;
    this.qty = new mIOToken(qty);
    this.lockLength = new BlockHeight(lockLength);
  }
};
var vaultedTransfer = async (state, { caller, input }) => {
  const { balances, vaults } = state;
  const { target, qty, lockLength } = new TransferTokensLocked(input);
  safeVaultedTransfer({
    balances,
    vaults,
    fromAddress: caller,
    toAddress: target,
    qty,
    lockLength,
    id: SmartWeave.transaction.id,
    startHeight: new BlockHeight(SmartWeave.block.height),
  });
  return { state };
};

// src/contract.ts
async function handle(state, action) {
  const input = action.input;
  if (SmartWeave.transaction.origin !== 'L1') {
    throw new ContractError('Only L1 transactions are supported.');
  }
  if (input.function === 'evolve') {
    return evolve(state, action);
  }
  if (input.function === 'evolveState') {
    return evolveState(state, action);
  }
  const { state: tickedState } = await tick(state);
  switch (input.function) {
    case 'createReservedName':
      return createReservedName(tickedState, action);
    case 'gateway':
      return getGateway(tickedState, action);
    case 'gateways':
      return getGateways(tickedState);
    case 'prescribedObservers':
      return getPrescribedObservers(tickedState);
    case 'delegateStake':
      return delegateStake(tickedState, action);
    case 'decreaseDelegateStake':
      return decreaseDelegateStake(tickedState, action);
    case 'joinNetwork':
      return joinNetwork(tickedState, action);
    case 'leaveNetwork':
      return leaveNetwork(tickedState, action);
    case 'increaseOperatorStake':
      return increaseOperatorStake(tickedState, action);
    case 'decreaseOperatorStake':
      return decreaseOperatorStake(tickedState, action);
    case 'updateGatewaySettings':
      return updateGatewaySettings(tickedState, action);
    case 'saveObservations':
      return saveObservations(tickedState, action);
    case 'submitAuctionBid':
      return submitAuctionBid(tickedState, action);
    case 'buyRecord':
      return buyRecord(tickedState, action);
    case 'extendRecord':
      return extendRecord(tickedState, action);
    case 'increaseUndernameCount':
      return increaseUndernameCount(tickedState, action);
    case 'record':
      return getRecord(tickedState, action);
    case 'auction':
      return getAuction(tickedState, action);
    case 'transfer':
      return transferTokens(tickedState, action);
    case 'vaultedTransfer':
      return vaultedTransfer(tickedState, action);
    case 'createVault':
      return createVault(tickedState, action);
    case 'extendVault':
      return extendVault(tickedState, action);
    case 'increaseVault':
      return increaseVault(tickedState, action);
    case 'balance':
      return balance(tickedState, action);
    case 'tick':
      return { state: tickedState };
    case 'epoch':
      return getEpoch(tickedState, action);
    case 'priceForInteraction':
      return getPriceForInteraction(tickedState, action);
    default:
      throw new ContractError(
        `No function supplied or function not recognized: "${input.function}"`,
      );
  }
}
