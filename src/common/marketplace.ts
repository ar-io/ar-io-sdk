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
import {
  ANT,
  AOProcess,
  AoSigner,
  Logger,
  MARKETPLACE_CONTRACT_ID,
  paginationParamsToTags,
} from '../node/index.js';
import { AoMessageResult, WalletAddress } from '../types/common.js';
import {
  AoARIOWrite,
  PaginationParams,
  PaginationResult,
} from '../types/io.js';

/**
 * User-provided order parameters for intent-based order creation
 * These are the user-configurable fields when creating an order via the intent workflow
 * @experimental
 */
export interface MarketplaceOrderIntentParams {
  orderType?: 'fixed' | 'dutch' | 'english'; // nil defaults to 'fixed'
  quantity?: string; // Amount to trade (string integer)
  price?: string; // Asking price or starting bid
  expirationTime?: string; // Unix timestamp when order expires (min 1h, max 30 days, fee rounded up to nearest hour)
  minimumPrice?: string; // Minimum price floor (dutch auction only)
  decreaseInterval?: string; // Price decrease interval in ms (dutch auction only)
}

/**
 * Intent structure - matches Lua Intent type
 * @experimental
 */
export interface MarketplaceIntent {
  intentId: string; // Unique intent identifier
  initiator: string; // Address that created the intent
  action: string; // Action being performed (Create-Order, Cancel-Order, Settle-Auction, Transfer)
  status:
    | 'pending'
    | 'active'
    | 'settling'
    | 'completed'
    | 'resolved'
    | 'failed'; // Intent status
  createdAt: number; // Creation timestamp
  ttl?: number; // Time-to-live timestamp (24 hours from creation)
  resolvedAt?: number; // Resolution timestamp
  completedAt?: number; // Completion timestamp
  failureReason?: string; // Failure reason if status is failed
  orderParams: MarketplaceOrderIntentParams; // Order parameters stored with the intent
  antProcessId: string; // ANT process ID (set during Create-Intent)
}

/**
 * Fee information structure for calculating order costs
 * @experimental
 */
export interface MarketplaceFeeInfo {
  listingFeePerHour: string; // Listing fee in mARIO per hour (1 ARIO = 1000000000 mARIO)
  saleTaxNumerator: number; // Numerator for sale tax calculation
  saleTaxDenominator: number; // Denominator for sale tax calculation (tax = amount * numerator / denominator)
}

/**
 * Intent statistics structure
 * @experimental
 */
export interface MarketplaceIntentStats {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byAction: Record<string, number>;
}

/**
 * Activity information structure
 * @experimental
 */
export interface MarketplaceActivityInfo {
  totalOrders: number;
  activeOrders: number;
  readyForSettlement: number;
  executedOrders: number;
  cancelledOrders: number;
  expiredOrders: number;
  listedOrders: number;
}

/**
 * Marketplace information structure
 * @experimental
 */
export interface MarketplaceInfo {
  totalPairs: number;
  accruedFees: string;
  arioTokenProcess: string;
}
/**
 * Info response structure from the marketplace
 * @experimental
 */
export interface InfoResponse {
  name: string;
  processId: string;
  activity: MarketplaceActivityInfo;
  intents: MarketplaceIntentStats;
  ucm: MarketplaceInfo;
  whitelistedModules: string[];
  fees: MarketplaceFeeInfo;
}

/**
 * Parameters for creating an intent (Create-Order action is assumed)
 * @experimental
 */
export interface CreateIntentParams {
  antId: string; // Required: ANT process ID for this intent
  orderType: string;
  quantity: string;
  price: string;
  expirationTime: string; // Required: Unix timestamp (min 1h, max 30 days, fee rounded up to nearest hour)
  minimumPrice?: string;
  decreaseInterval?: string;
}

/**
 * Parameters for paginated intent queries
 * @experimental
 */
export interface GetPaginatedIntentsParams {
  cursor?: string;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, string>;
}

/**
 * Parameters for creating an order using internal ARIO balance
 * @experimental
 */
export interface CreateOrderParams {
  swapToken: string; // Required: Token to receive in exchange for ARIO
  quantity: string; // Required: Amount of ARIO to trade
  orderType?: 'fixed' | 'dutch' | 'english'; // Order type (defaults to 'fixed')
  price?: string; // Price (required for fixed and dutch, starting bid for english)
  expirationTime?: string; // Unix timestamp when order expires
  minimumPrice?: string; // Minimum price floor (dutch auction only)
  decreaseInterval?: string; // Price decrease interval in ms (dutch auction only)
  transferDenomination?: string; // Optional transfer denomination
}

/**
 * Parameters for getting orders with flexible selectors
 * @experimental
 */
export interface GetOrdersParams extends GetPaginatedIntentsParams {
  status?:
    | 'all'
    | 'listed'
    | 'completed'
    | 'active'
    | 'ready-for-settlement'
    | 'executed'
    | 'cancelled'
    | 'expired';
  ids?: string[]; // Array of order IDs to fetch specific orders
  dominantToken?: string; // Filter by dominant token in trading pair
  swapToken?: string; // Filter by swap token in trading pair
}

/**
 * Individual order structure returned from Get-Orders and Get-Order handlers
 * @experimental
 */
export interface Order {
  id: string; // Order identifier
  creator: string; // Order creator address
  quantity: string; // Quantity of tokens
  originalQuantity: string; // Original quantity before partial fills
  token: string; // Token process ID
  dominantToken: string; // The dominant token in the trading pair
  swapToken: string; // The swap token in the trading pair
  dateCreated: number; // Creation timestamp
  price?: string; // Order price (optional for some order types)
  expirationTime?: number; // Expiration timestamp (optional)
  orderType: 'fixed' | 'dutch' | 'english'; // Order type
  status:
    | 'active'
    | 'executed'
    | 'cancelled'
    | 'ready-for-settlement'
    | 'expired'; // Order status
  minimumPrice?: string; // Minimum price (dutch auction only)
  decreaseInterval?: string; // Decrease interval (dutch auction only)
  decreaseStep?: string; // Decrease step (dutch auction only)
  sender?: string; // Order sender (set after execution)
  receiver?: string; // Order receiver (set after execution)
  endedAt?: number; // Timestamp when order ended
  bids?: Record<string, boolean>; // Bidders for English auctions (bidder address -> true)
}

/**
 * Marketplace balance information for a wallet address
 * @experimental
 */
export interface MarketplaceBalance {
  address: WalletAddress;
  balance: string;
  lockedBalance: string;
  totalBalance: string;
  orders: Record<string, string>;
}

/**
 * Read-only interface for the ArNS marketplace
 * @experimental
 */
export interface AoArNSMarketplaceRead {
  getInfo(): Promise<InfoResponse>;
  // Can be used to get user intents by using the `initiator` filter
  getPaginatedIntents(
    params: GetPaginatedIntentsParams,
  ): Promise<PaginationResult<MarketplaceIntent>>;
  getIntent(intentId: string): Promise<MarketplaceIntent>;
  getIntentByANTId(antId: string): Promise<MarketplaceIntent>;
  // Can be used to get user ANTs by using the `creator` filter
  getPaginatedOrders(params: GetOrdersParams): Promise<PaginationResult<Order>>;
  getOrder(orderId: string): Promise<Order>;
  getOrderByANTId(antId: string): Promise<Order>;
  getPaginatedMarketplaceBalances(
    params: PaginationParams<MarketplaceBalance>,
  ): Promise<PaginationResult<MarketplaceBalance>>;
  getMarketplaceBalance({
    address,
  }: {
    address: WalletAddress;
  }): Promise<MarketplaceBalance>;
  /**
   * Get all user assets including intents, orders, balances, and ANT IDs
   * @param params - Parameters including address and ARIO process ID
   * @returns User assets including intents, orders, balances, and ANT IDs
   */
  getUserAssets({
    address,
    arioProcessId,
  }: {
    address: WalletAddress;
    arioProcessId: string;
  }): Promise<{
    intents: MarketplaceIntent[];
    orders: Order[];
    balances: MarketplaceBalance;
    antIds: string[];
  }>;
}

/**
 * Common fields for create-intent progress events
 * @experimental
 */
export interface CreateIntentEventData {
  name: string;
  antId: string;
  orderType: 'fixed' | 'dutch' | 'english';
  price: string;
  expirationTime: number;
}

/**
 * Progress event emitted while creating the marketplace intent
 * @experimental
 */
export interface CreatingIntentProgressEvent extends CreateIntentEventData {
  step: 'creating-intent';
}

/**
 * Progress event emitted after successfully creating the marketplace intent
 * @experimental
 */
export interface IntentCreatedProgressEvent extends CreateIntentEventData {
  step: 'intent-created';
  intent: MarketplaceIntent;
}

/**
 * Common fields for transfer-ant progress events
 * @experimental
 */
export interface TransferAntEventData {
  name: string;
  antId: string;
  intentId: string;
  marketplaceProcessId: string;
}

/**
 * Progress event emitted while transferring the ANT to the marketplace
 * @experimental
 */
export interface TransferringAntProgressEvent extends TransferAntEventData {
  step: 'transferring-ant';
}

/**
 * Progress event emitted after successfully transferring the ANT to the marketplace
 * @experimental
 */
export interface AntTransferredProgressEvent extends TransferAntEventData {
  step: 'ant-transferred';
  transferResult: AoMessageResult<
    Record<string, string | number | boolean | null>
  >;
}

/**
 * Progress event emitted when an error occurs during the workflow
 * @experimental
 */
export interface ListNameForSaleErrorEvent {
  step: 'error';
  name: string;
  antId: string;
  error: Error;
  /**
   * The step that was in progress when the error occurred
   */
  failedStep: 'creating-intent' | 'transferring-ant';
  /**
   * The intent if it was created before the error occurred
   */
  intent?: MarketplaceIntent;
}

/**
 * Progress event emitted when the workflow completes successfully
 * @experimental
 */
export interface ListNameForSaleCompleteEvent {
  step: 'complete';
  name: string;
  antId: string;
  intent: MarketplaceIntent;
  order: Order;
  transferResult: AoMessageResult<
    Record<string, string | number | boolean | null>
  >;
}

/**
 * Progress events emitted during listNameForSale workflow
 * @experimental
 */
export type ListNameForSaleProgressEvent =
  | CreatingIntentProgressEvent
  | IntentCreatedProgressEvent
  | TransferringAntProgressEvent
  | AntTransferredProgressEvent
  | ListNameForSaleErrorEvent
  | ListNameForSaleCompleteEvent;

/**
 * Write interface for the ArNS marketplace
 * @experimental
 */
export interface AoArNSMarketplaceWrite {
  createIntent(
    params: CreateIntentParams,
  ): Promise<AoMessageResult<MarketplaceIntent>>;
  cancelOrder(orderId: string): Promise<AoMessageResult>;
  settleAuction(params: {
    orderId: string;
    dominantToken?: string;
    swapToken?: string;
  }): Promise<AoMessageResult>;
  depositArIO(params: { amount: string }): Promise<AoMessageResult>;
  withdrawArIO(params: { amount: string }): Promise<AoMessageResult>;
  /**
   * Push ANT intent resolution to the marketplace
   * @param intentId - The intent ID to push resolution for
   * @returns Message result
   */
  pushANTIntentResolution(intentId: string): Promise<AoMessageResult>;
  /**
   * List a name for sale on the marketplace
   * @param params - Parameters including name, expiration time, price, type, wallet address, and optional auction parameters
   * @returns Result containing intent, order, ANT transfer result, and any error
   */
  listNameForSale({
    name,
    expirationTime,
    price,
    type,
    walletAddress,
    minimumPrice,
    decreaseInterval,
    onProgress,
  }: {
    name: string;
    expirationTime: number;
    price: string;
    type: 'fixed' | 'dutch' | 'english';
    walletAddress: WalletAddress;
    minimumPrice?: string;
    decreaseInterval?: string;
    onProgress?: (event: ListNameForSaleProgressEvent) => void;
  }): Promise<{
    intent: MarketplaceIntent;
    order: Order | null;
    antTransferResult: AoMessageResult<
      Record<string, string | number | boolean | null>
    > | null;
    error: Error | null;
  }>;
  /**
   * Create an order using internal ARIO balance
   * @param params - Order creation parameters
   * @returns Message result with the created order
   */
  createOrder(params: CreateOrderParams): Promise<AoMessageResult<Order>>;
  /**
   * Buy a fixed price ANT
   * @param params - Parameters including ANT ID
   * @returns Message result with the order
   */
  buyFixedPriceANT(params: { antId: string }): Promise<AoMessageResult<Order>>;
  /**
   * Buy a Dutch auction ANT
   * @param params - Parameters including ANT ID
   * @returns Message result with the order
   */
  buyDutchAuctionANT(params: {
    antId: string;
  }): Promise<AoMessageResult<Order>>;
  /**
   * Place a bid on an English auction
   * @param params - Parameters including ANT ID and bid amount
   * @returns Message result
   */
  bidOnANTEnglishAuction(params: {
    antId: string;
    bidAmount: string;
  }): Promise<AoMessageResult>;
  /**
   * Settle an expired English auction
   * @param params - Parameters including ANT ID
   * @returns Message result
   */
  settleANTEnglishAuction(params: { antId: string }): Promise<AoMessageResult>;
}

/**
 * Read-only client for the ArNS marketplace
 * @experimental
 */
export class ArNSMarketplaceRead implements AoArNSMarketplaceRead {
  protected process: AOProcess;
  protected logger: Logger;
  constructor({
    process = new AOProcess({
      processId: MARKETPLACE_CONTRACT_ID,
    }),
    logger = Logger.default,
  }: {
    process: AOProcess;
    logger?: Logger;
  }) {
    this.process = process;
    this.logger = logger;
  }

  async getInfo(): Promise<InfoResponse> {
    return this.process.read<InfoResponse>({
      tags: [{ name: 'Action', value: 'Info' }],
      select: (message) =>
        message.Tags.some(
          (tag) => tag.name === 'Action' && tag.value === 'Info-Notice',
        ),
    });
  }

  async getPaginatedIntents({
    cursor,
    limit,
    sortBy,
    sortOrder,
    filters,
  }: GetPaginatedIntentsParams = {}): Promise<
    PaginationResult<MarketplaceIntent>
  > {
    const tags: Array<{ name: string; value: string | undefined }> = [
      { name: 'Action', value: 'Get-Paginated-Intents' },
      { name: 'Cursor', value: cursor },
      { name: 'Limit', value: limit?.toString() },
      { name: 'Sort-By', value: sortBy },
      { name: 'Sort-Order', value: sortOrder },
      { name: 'Filters', value: JSON.stringify(filters) },
    ];
    const filteredTags = tags.filter(
      (tag): tag is { name: string; value: string } => tag.value !== undefined,
    );
    return this.process.read<PaginationResult<MarketplaceIntent>>({
      tags: filteredTags,
      select: (message) =>
        message.Tags.some(
          (tag) =>
            tag.name === 'Action' &&
            tag.value === 'Get-Paginated-Intents-Notice',
        ),
    });
  }

  async getIntent(intentId: string): Promise<MarketplaceIntent> {
    return this.process.read<MarketplaceIntent>({
      tags: [
        { name: 'Action', value: 'Get-Intent-By-Id' },
        { name: 'Intent-Id', value: intentId },
      ],
      select: (message) =>
        message.Tags.some(
          (tag) =>
            tag.name === 'Action' && tag.value === 'Get-Intent-By-Id-Notice',
        ),
    });
  }

  async getIntentByANTId(antId: string): Promise<MarketplaceIntent> {
    const res = await this.getPaginatedIntents({
      filters: {
        antProcessId: antId,
      },
    });

    if (res.items.length === 0) {
      throw new Error(`No intent found for ANT ID: ${antId}`);
    }

    return res.items[0];
  }

  /**
   * Get orders with flexible selectors
   * @param params - Parameters for filtering and pagination
   * @returns Orders matching the criteria
   */
  async getPaginatedOrders(
    params?: GetOrdersParams,
  ): Promise<PaginationResult<Order>> {
    const tags: Array<{ name: string; value: string | undefined }> = [
      { name: 'Action', value: 'Get-Orders' },
      { name: 'Status', value: params?.status },
      { name: 'Ids', value: params?.ids?.join(',') },
      { name: 'Dominant-Token', value: params?.dominantToken },
      { name: 'Swap-Token', value: params?.swapToken },
      { name: 'Cursor', value: params?.cursor },
      { name: 'Limit', value: params?.limit?.toString() },
      { name: 'Sort-By', value: params?.sortBy },
      { name: 'Sort-Order', value: params?.sortOrder },
      {
        name: 'Filters',
        value: params?.filters ? JSON.stringify(params.filters) : undefined,
      },
    ];
    const filteredTags = tags.filter(
      (tag): tag is { name: string; value: string } => tag.value !== undefined,
    );
    return this.process.read<PaginationResult<Order>>({
      tags: filteredTags,
      select: (message) =>
        message.Tags.some(
          (tag) => tag.name === 'Action' && tag.value === 'Get-Orders-Notice',
        ),
    });
  }

  /**
   * Get a single order by ID
   * @param orderId - The order ID to fetch
   * @returns The order if found
   */
  async getOrder(orderId: string): Promise<Order> {
    return this.process.read<Order>({
      tags: [
        { name: 'Action', value: 'Get-Order' },
        { name: 'Order-Id', value: orderId },
      ],
      select: (message) =>
        message.Tags.some(
          (tag) => tag.name === 'Action' && tag.value === 'Get-Order-Notice',
        ),
    });
  }

  async getOrderByANTId(antId: string): Promise<Order> {
    const res = await this.getPaginatedOrders({
      dominantToken: antId,
    });

    if (res.items.length === 0) {
      throw new Error(`No order found for ANT ID: ${antId}`);
    }
    // Strange behaviour here. It seems that the filter logic will return an order with potentially different dominant token.
    const order = res.items[0];
    if (order.dominantToken !== antId) {
      throw new Error(`No order for ANT ID: ${antId}`);
    }

    return res.items[0];
  }

  async getPaginatedMarketplaceBalances(
    params: PaginationParams<MarketplaceBalance>,
  ): Promise<PaginationResult<MarketplaceBalance>> {
    return this.process.read<PaginationResult<MarketplaceBalance>>({
      tags: [
        { name: 'Action', value: 'Get-Paginated-Balances' },
        ...paginationParamsToTags<MarketplaceBalance>(params),
      ],
      select: (message) =>
        message.Tags.some(
          (tag) =>
            tag.name === 'Action' &&
            tag.value === 'Get-Paginated-Balances-Notice',
        ),
    });
  }

  /**
   * Get ARIO balance for an address in the marketplace
   */
  async getMarketplaceBalance({
    address,
  }: {
    address: WalletAddress;
  }): Promise<MarketplaceBalance> {
    return this.process.read<MarketplaceBalance>({
      tags: [
        { name: 'Action', value: 'Get-Balance' },
        { name: 'Address', value: address },
      ],
      select: (message) =>
        message.Tags.some(
          (tag) => tag.name === 'Action' && tag.value === 'Get-Balance-Notice',
        ),
    });
  }

  async getUserAssets({
    address,
    arioProcessId,
  }: {
    address: WalletAddress;
    arioProcessId: string;
  }): Promise<{
    intents: MarketplaceIntent[];
    orders: Order[];
    balances: MarketplaceBalance;
    antIds: string[];
  }> {
    async function fetchIntents(
      context: ArNSMarketplaceRead,
    ): Promise<MarketplaceIntent[]> {
      const intents: MarketplaceIntent[] = [];
      // fetch all intents for user, paginating as needed and adding each ant id to the set
      let intentsCursor: string | undefined = undefined;
      let intentsHasMore = true;
      while (intentsHasMore) {
        const intentsRes = await context.getPaginatedIntents({
          cursor: intentsCursor,
          limit: 1000,
          filters: {
            initiator: address,
          },
        });
        intentsRes.items.forEach((intent) => {
          intents.push(intent);
        });
        intentsCursor = intentsRes.nextCursor;
        intentsHasMore = intentsRes.hasMore;
      }
      return intents;
    }

    async function fetchOrders(context: ArNSMarketplaceRead): Promise<Order[]> {
      const orders: Order[] = [];
      // fetch all orders for user, paginating as needed
      let ordersCursor: string | undefined = undefined;
      let ordersHasMore = true;
      while (ordersHasMore) {
        const ordersRes = await context.getPaginatedOrders({
          cursor: ordersCursor,
          limit: 1000,
          filters: {
            creator: address,
          },
        });
        ordersRes.items.forEach((order) => {
          orders.push(order);
        });
        ordersCursor = ordersRes.nextCursor;
        ordersHasMore = ordersRes.hasMore;
      }
      return orders;
    }
    // parallel fetch balances, intents, and orders
    const [balances, intents, orders] = await Promise.all([
      this.getMarketplaceBalance({ address }),
      fetchIntents(this),
      fetchOrders(this),
    ]);

    const antIdsArray = Array.from(
      new Set<string>([
        ...intents.map((intent) => intent.antProcessId),
        ...orders.map((order) => order.dominantToken),
        ...orders.map((order) => order.swapToken),
      ]),
    ).filter((antId) => antId !== arioProcessId); // since we add both swap and dominant token for simplicity, we need to filter out the ario token

    return { intents, orders, balances, antIds: antIdsArray };
  }
}

/**
 * Write client for the ArNS marketplace
 * @experimental
 */
export class ArNSMarketplaceWrite
  extends ArNSMarketplaceRead
  implements AoArNSMarketplaceWrite
{
  protected process: AOProcess;
  protected signer: AoSigner;
  protected ario: AoARIOWrite;
  constructor({
    process = new AOProcess({
      processId: MARKETPLACE_CONTRACT_ID,
    }),
    signer,
    ario,
    logger = Logger.default,
  }: {
    process: AOProcess;
    signer: AoSigner;
    ario: AoARIOWrite;
    logger?: Logger;
  }) {
    super({ process: process, logger: logger });
    this.process = process;
    this.signer = signer;
    this.ario = ario;
    this.logger = logger;
  }

  /**
   * Deposit ARIO to the marketplace (simulates Credit-Notice from ARIO token process)
   * Returns the message ID for verification
   */
  async depositArIO(params: { amount: string }): Promise<AoMessageResult> {
    return this.ario.transfer(
      {
        // the marketplace process id is the target
        target: this.process.processId,
        qty: Number(params.amount),
      },
      {
        tags: [{ name: 'X-Action', value: 'Deposit' }],
      },
    );
  }

  /**
   * Withdraw ARIO from the marketplace back to user
   */
  async withdrawArIO(params: { amount: string }): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
        { name: 'Action', value: 'Withdraw-Ario' },
        { name: 'Quantity', value: params.amount },
      ],
      signer: this.signer,
      select: (message) =>
        message.Tags.some(
          (tag) =>
            tag.name === 'Action' && tag.value === 'Withdraw-Ario-Notice',
        ),
    });
  }

  async createIntent({
    antId,
    orderType,
    quantity,
    price,
    expirationTime,
    minimumPrice,
    decreaseInterval,
  }: CreateIntentParams): Promise<AoMessageResult<MarketplaceIntent>> {
    const tags: Array<{ name: string; value: string | undefined }> = [
      { name: 'Action', value: 'Create-Intent' },
      { name: 'X-Intent-ANT-Id', value: antId },
      { name: 'X-Intent-Order-Type', value: orderType },
      { name: 'X-Intent-Quantity', value: quantity },
      { name: 'X-Intent-Price', value: price },
      { name: 'X-Intent-Expiration-Time', value: expirationTime },
      { name: 'X-Intent-Minimum-Price', value: minimumPrice },
      { name: 'X-Intent-Decrease-Interval', value: decreaseInterval },
    ];

    const filteredTags = tags.filter(
      (tag): tag is { name: string; value: string } => tag.value !== undefined,
    );

    return this.process.send<MarketplaceIntent>({
      tags: filteredTags,
      signer: this.signer,
      select: (message) =>
        message.Tags.some(
          (tag) =>
            tag.name === 'Action' && tag.value === 'Create-Intent-Notice',
        ),
    });
  }

  async pushANTIntentResolution(intentId: string): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
        { name: 'Action', value: 'Push-ANT-Intent-Resolution' },
        { name: 'X-Intent-Id', value: intentId },
      ],
      signer: this.signer,
      select: (message) =>
        message.Tags.some(
          (tag) =>
            tag.name === 'Action' &&
            tag.value === 'Push-ANT-Intent-Resolution-Notice',
        ),
    });
  }
  async settleAuction(params: {
    orderId: string;
    dominantToken?: string;
    swapToken?: string;
  }): Promise<AoMessageResult> {
    const tags: Array<{ name: string; value: string | undefined }> = [
      { name: 'Action', value: 'Settle-Auction' },
      { name: 'Order-Id', value: params.orderId },
      { name: 'Dominant-Token', value: params.dominantToken },
      { name: 'Swap-Token', value: params.swapToken },
    ];
    const filteredTags = tags.filter(
      (tag): tag is { name: string; value: string } => tag.value !== undefined,
    );
    return this.process.send({
      tags: filteredTags,
      signer: this.signer,
      select: (message) =>
        message.Tags.some(
          (tag) =>
            tag.name === 'Action' && tag.value === 'Settle-Auction-Notice',
        ),
    });
  }

  async listNameForSale({
    name,
    expirationTime,
    price,
    type,
    walletAddress,
    minimumPrice,
    decreaseInterval,
    onProgress = (event) => {
      this.logger.info(`List name for sale progress: ${event.step}`);
    },
  }: {
    name: string;
    expirationTime: number;
    price: string;
    type: 'fixed' | 'dutch' | 'english';
    walletAddress: WalletAddress;
    minimumPrice?: string;
    decreaseInterval?: string;
    onProgress?: (event: ListNameForSaleProgressEvent) => void;
  }): Promise<{
    intent: MarketplaceIntent;
    order: Order | null;
    antTransferResult: AoMessageResult<
      Record<string, string | number | boolean | null>
    > | null;
    error: Error | null;
  }> {
    // Get arns record for the current ant id associated with it
    const record = await this.ario.getArNSRecord({ name: name });
    this.logger.info(`Record ${name} found: ${JSON.stringify(record)}`);

    if (record === undefined) {
      throw new Error(`Record ${name} not found`);
    }

    const antId = record.processId;
    this.logger.info(`ANT ID for ${name} found: ${antId}`);
    const ant = ANT.init({
      process: new AOProcess({
        processId: antId,
        ao: this.process.ao,
        logger: this.logger,
      }),
      signer: this.signer,
    });

    const antState = await ant.getState();

    if (antState.Owner !== walletAddress) {
      this.logger.error(
        `Wallet address ${walletAddress} does not match the owner of the ANT ${antId}. Only the owner can list the name for sale.`,
      );
      throw new Error(
        'Wallet address does not match the owner of the ANT. Only the owner can list the name for sale.',
      );
    }

    let intent: MarketplaceIntent;

    const createIntentEventData = {
      name,
      antId,
      orderType: type,
      price,
      expirationTime,
    };

    try {
      onProgress({
        step: 'creating-intent',
        ...createIntentEventData,
      });
      const intentResult = await this.createIntent({
        antId,
        orderType: type,
        quantity: price,
        expirationTime: expirationTime.toString(),
        price: price,
        minimumPrice: minimumPrice,
        decreaseInterval: decreaseInterval,
      });
      if (intentResult.result === undefined) {
        throw new Error('Failed to create intent: ' + intentResult.id);
      }
      this.logger.info(
        `Intent created: ${JSON.stringify(intentResult.result)}`,
      );
      intent = intentResult.result;
      onProgress({
        step: 'intent-created',
        ...createIntentEventData,
        intent,
      });
    } catch (error) {
      this.logger.error(`Error creating intent: ${error.message}`);
      // check error for existing intent. Will be a contract error message.
      const isExistingIntentError = error.message.includes(
        'An intent already exists for this ANT ID',
      );

      if (isExistingIntentError) {
        intent = await this.getIntentByANTId(antId).catch((getIntentError) => {
          this.logger.error(`Failed to get intent: ${getIntentError.message}`);
          const intentError = new Error(
            'An intent already exists for this ANT ID but failed to get intent:\n\n' +
              getIntentError.message,
          );
          onProgress({
            step: 'error',
            name,
            antId,
            error: intentError,
            failedStep: 'creating-intent',
          });
          throw intentError;
        });
      } else {
        // Possible to get other errors, eg insufficient deposited ario balance. Rethrow them here.
        onProgress({
          step: 'error',
          name,
          antId,
          error: error as Error,
          failedStep: 'creating-intent',
        });
        throw error;
      }
    }
    // Type guard to ensure intent is defined
    if (intent === undefined) {
      const intentError = new Error('Failed to create intent');
      onProgress({
        step: 'error',
        name,
        antId,
        error: intentError,
        failedStep: 'creating-intent',
      });
      throw intentError;
    }
    const transferAntEventData = {
      name,
      antId,
      intentId: intent.intentId,
      marketplaceProcessId: this.process.processId,
    };

    let antTransferResult: AoMessageResult<
      Record<string, string | number | boolean | null>
    >;
    try {
      onProgress({
        step: 'transferring-ant',
        ...transferAntEventData,
      });
      antTransferResult = await ant.transfer(
        {
          target: this.process.processId,
          removeControllers: false, // important: do not remove the controllers of the ANT to prevent loss of control
        },
        {
          tags: [{ name: 'X-Intent-Id', value: intent.intentId }],
        },
      );
      this.logger.info(`ANT transferred: ${JSON.stringify(antTransferResult)}`);
      onProgress({
        step: 'ant-transferred',
        ...transferAntEventData,
        transferResult: antTransferResult,
      });
    } catch (error) {
      this.logger.error(`Failed to transfer ANT: ${error.message}`);
      onProgress({
        step: 'error',
        name,
        antId,
        error: error as Error,
        failedStep: 'transferring-ant',
        intent,
      });
      return {
        intent,
        order: null,
        antTransferResult: null,
        error: error as Error,
      };
    }

    // poll for the order to be created
    // This is to ensure the order is created before returning the result for ux purposes.
    // This may still fail, in which case we return the intent and ant transfer result and handle the error in the client.
    let order: Order | null = null;
    let tries = 0;
    while (order === null && tries < 5) {
      try {
        order = await this.getOrderByANTId(antId).catch((error) => {
          console.log(new Error('Failed to get order: ' + error.message));
          return null;
        });
        if (order === null) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          this.logger.info(`Waiting for order to be created...`);
          if (tries === 5) {
            this.logger.error(`Failed to get order after ${tries} attempts`);
            throw new Error(`Failed to get order after ${tries} attempts`);
          }
          tries++;
        }
        // if the order is found, break the loop
        break;
      } catch (error) {
        this.logger.error(`Failed to get order: ${error.message}`);
        const orderError = new Error('Failed to get order: ' + error.message);
        onProgress({
          step: 'error',
          name,
          antId,
          error: orderError,
          failedStep: 'transferring-ant',
          intent,
        });
        return {
          intent,
          order: null,
          antTransferResult,
          error: orderError,
        };
      }
    }
    if (order === null) {
      this.logger.error(`Failed to get order`);
      const orderError = new Error('Failed to get order');
      onProgress({
        step: 'error',
        name,
        antId,
        error: orderError,
        failedStep: 'transferring-ant',
        intent,
      });
      return {
        intent,
        order: null,
        antTransferResult,
        error: orderError,
      };
    }

    onProgress({
      step: 'complete',
      name,
      antId,
      intent,
      order,
      transferResult: antTransferResult,
    });

    return { intent, order, antTransferResult, error: null };
  }

  async cancelOrder(orderId: string): Promise<AoMessageResult> {
    const tags: Array<{ name: string; value: string }> = [
      { name: 'Action', value: 'Cancel-Order' },
      { name: 'Order-Id', value: orderId },
    ];

    return this.process.send({
      tags,
      signer: this.signer,
      select: (message) =>
        message.Tags.some(
          (tag) => tag.name === 'Action' && tag.value === 'Cancel-Order-Notice',
        ),
    });
  }

  async createOrder({
    swapToken,
    quantity,
    orderType,
    price,
    expirationTime,
    minimumPrice,
    decreaseInterval,
    transferDenomination,
  }: CreateOrderParams): Promise<AoMessageResult<Order>> {
    const tags: Array<{ name: string; value: string | undefined }> = [
      { name: 'Action', value: 'Create-Order' },
      { name: 'Swap-Token', value: swapToken },
      { name: 'Quantity', value: quantity },
      { name: 'Order-Type', value: orderType },
      { name: 'Price', value: price },
      { name: 'Expiration-Time', value: expirationTime },
      { name: 'Minimum-Price', value: minimumPrice },
      { name: 'Decrease-Interval', value: decreaseInterval },
      { name: 'Transfer-Denomination', value: transferDenomination },
    ];

    const filteredTags = tags.filter(
      (tag): tag is { name: string; value: string } => tag.value !== undefined,
    );

    // Send the message
    return this.process.send<Order>({
      tags: filteredTags,
      signer: this.signer,
      select: (message) =>
        message.Tags.some(
          (tag) => tag.name === 'Action' && tag.value === 'Create-Order-Notice',
        ),
    });
  }

  async buyFixedPriceANT(params: {
    antId: string;
  }): Promise<AoMessageResult<Order>> {
    const order = await this.getOrderByANTId(params.antId);

    if (order === undefined) {
      throw new Error(`No active sell order found for ANT: ${params.antId}`);
    }

    if (order.status !== 'active') {
      throw new Error(`Order status is ${order.status}, must be active`);
    }

    if (order.price === undefined) {
      throw new Error(`Order price is undefined for ANT: ${params.antId}`);
    }

    // Create a buy order that matches the sell order
    // This should trigger immediate execution if prices match
    // For ArNS: buying 1 ANT, so quantity = price = total cost
    return this.createOrder({
      swapToken: params.antId,
      quantity: order.price, // Total ARIO cost
      orderType: 'fixed',
      price: order.price, // Match their asking price
    });
  }

  async buyDutchAuctionANT(params: {
    antId: string;
  }): Promise<AoMessageResult<Order>> {
    const order = await this.getOrderByANTId(params.antId);

    if (order === undefined) {
      throw new Error(`No active sell order found for ANT: ${params.antId}`);
    }

    if (order.status !== 'active') {
      throw new Error(`Order status is ${order.status}, must be active`);
    }

    if (order.orderType !== 'dutch') {
      throw new Error(`Order is not a Dutch auction, it's: ${order.orderType}`);
    }

    if (order.price === undefined) {
      throw new Error(
        `Order starting price is undefined for ANT: ${params.antId}`,
      );
    }

    // For Dutch auction, the current price will be calculated on execution
    return this.createOrder({
      swapToken: params.antId,
      quantity: order.price,
      orderType: 'fixed',
      price: order.price,
    });
  }

  /**
   * Place a bid on an English auction
   * Note: This requires you to have sufficient ARIO balance in the marketplace
   */
  async bidOnANTEnglishAuction(params: {
    antId: string;
    bidAmount: string; // Amount of ARIO to bid (must be higher than current highest bid)
  }): Promise<AoMessageResult> {
    const order = await this.getOrderByANTId(params.antId);

    if (order === undefined) {
      throw new Error(`No active sell order found for ANT: ${params.antId}`);
    }

    if (order.status !== 'active') {
      throw new Error(`Order status is ${order.status}, must be active`);
    }

    if (order.orderType !== 'english') {
      throw new Error(
        `Order is not an English auction, it's: ${order.orderType}`,
      );
    }

    // Check if auction has expired
    if (
      order.expirationTime !== undefined &&
      Date.now() >= order.expirationTime
    ) {
      throw new Error(`Auction has already expired for ANT: ${params.antId}`);
    }

    return this.process.send({
      tags: [
        { name: 'Action', value: 'Bid-On-English-Auction' },
        { name: 'Order-Id', value: order.id },
        { name: 'Bid-Amount', value: params.bidAmount },
      ],
      signer: this.signer,
      select: (message) =>
        message.Tags.some(
          (tag) =>
            tag.name === 'Action' &&
            tag.value === 'Bid-On-English-Auction-Notice',
        ),
    });
  }

  /**
   * Settle an expired English auction
   * Can be called by anyone after the auction expires
   * The highest bidder wins the ANT
   */
  async settleANTEnglishAuction(params: {
    antId: string;
  }): Promise<AoMessageResult> {
    const order = await this.getOrderByANTId(params.antId);

    if (order === undefined) {
      throw new Error(`No active sell order found for ANT: ${params.antId}`);
    }

    if (order.orderType !== 'english') {
      throw new Error(
        `Order is not an English auction, it's: ${order.orderType}`,
      );
    }

    // Check if auction has expired
    if (
      order.expirationTime !== undefined &&
      Date.now() < order.expirationTime
    ) {
      throw new Error(
        `Auction has not yet expired for ANT: ${params.antId}. Expires at: ${new Date(order.expirationTime).toISOString()}`,
      );
    }

    return this.settleAuction({
      orderId: order.id,
      dominantToken: order.dominantToken,
      swapToken: order.swapToken,
    });
  }
}

/**
 * Calculates the listing fee for an order based on the end timestamp.
 * The fee is calculated by rounding up the hours until the end timestamp to the nearest hour.
 *
 * @experimental
 * @param params - Parameters for calculating the listing fee
 * @param params.listingFeePerHour - The listing fee per hour in mARIO (as a string)
 * @param params.endTimestamp - Unix timestamp when the order expires
 * @returns The listing fee in mARIO as a BigInt
 *
 * @example
 * ```typescript
 * const info = await marketplace.getInfo();
 * const endTimestamp = Date.now() + 24 * 60 * 60 * 1000; // 24 hours from now
 * const listingFee = calculateListingFee({
 *   listingFeePerHour: info.fees.listingFeePerHour,
 *   endTimestamp,
 * });
 * ```
 */
export function calculateListingFee({
  listingFeePerHour,
  endTimestamp,
}: {
  listingFeePerHour: string;
  endTimestamp: number;
}): bigint {
  const now = Date.now();
  const millisecondsUntilEnd = endTimestamp - now;

  if (millisecondsUntilEnd <= 0) {
    return BigInt(0);
  }

  // Convert milliseconds to hours and round up to the nearest hour
  const hoursUntilEnd = Math.ceil(millisecondsUntilEnd / (1000 * 60 * 60));

  // Calculate listing fee: hours * fee per hour
  return BigInt(hoursUntilEnd) * BigInt(listingFeePerHour);
}

/**
 * Calculates the sale tax for an order based on the sale amount.
 *
 * @experimental
 * @param params - Parameters for calculating the sale tax
 * @param params.saleAmount - The sale amount in mARIO (as a string or number)
 * @param params.saleTaxNumerator - The numerator for sale tax calculation
 * @param params.saleTaxDenominator - The denominator for sale tax calculation
 * @returns The sale tax in mARIO as a BigInt
 *
 * @example
 * ```typescript
 * const info = await marketplace.getInfo();
 * const saleAmount = 100000000000; // 100 ARIO in mARIO
 * const tax = calculateSaleTax({
 *   saleAmount,
 *   saleTaxNumerator: info.fees.saleTaxNumerator,
 *   saleTaxDenominator: info.fees.saleTaxDenominator,
 * });
 * ```
 */
export function calculateSaleTax({
  saleAmount,
  saleTaxNumerator,
  saleTaxDenominator,
}: {
  saleAmount: string | number;
  saleTaxNumerator: number;
  saleTaxDenominator: number;
}): bigint {
  // Calculate tax: (saleAmount * numerator) / denominator
  return (
    (BigInt(saleAmount) * BigInt(saleTaxNumerator)) / BigInt(saleTaxDenominator)
  );
}
