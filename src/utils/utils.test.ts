import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  pruneTags,
  sortAndPaginateEpochDataIntoEligibleDistributions,
} from './arweave.js';
import { errorMessageFromOutput } from './index.js';

describe('pruneTags', () => {
  it('should remove tags with undefined values', () => {
    const tags = [
      { name: 'Tag1', value: 'value1' },
      { name: 'Tag2', value: undefined },
      { name: 'Tag3', value: 'value3' },
      { name: 'Tag4', value: undefined },
    ];

    const prunedTags = pruneTags(tags);

    assert.deepEqual(prunedTags, [
      { name: 'Tag1', value: 'value1' },
      { name: 'Tag3', value: 'value3' },
    ]);
  });

  it('should return empty array when all tags have undefined values', () => {
    const tags = [
      { name: 'Tag1', value: undefined },
      { name: 'Tag2', value: undefined },
    ];

    const prunedTags = pruneTags(tags);

    assert.deepEqual(prunedTags, []);
  });

  it('should return same array when no tags have undefined values', () => {
    const tags = [
      { name: 'Tag1', value: 'value1' },
      { name: 'Tag2', value: 'value2' },
    ];

    const prunedTags = pruneTags(tags);

    assert.deepEqual(prunedTags, tags);
  });

  it('should return empty array with no tags', () => {
    const tags: { name: string; value: string | undefined }[] = [];
    const prunedTags = pruneTags(tags);
    assert.deepEqual(prunedTags, []);
  });
});

describe('errorMessageFromOutput', () => {
  it('should return error message from Error field', () => {
    const output = {
      Error: 'Error message',
    };

    const errorMessage = errorMessageFromOutput(output);

    assert.equal(errorMessage, 'Error message');
  });

  it('should return error message from Error tag', () => {
    const output = {
      Messages: [
        {
          Tags: [{ name: 'Error', value: 'Error message' }],
        },
      ],
    };

    const errorMessage = errorMessageFromOutput(output);
    assert.equal(errorMessage, 'Error message');
  });

  it('should return error message from Error tag if Error field is undefined', () => {
    const output = {
      Messages: [
        {
          Tags: [{ name: 'Error', value: 'Error message' }],
        },
      ],
    };

    const errorMessage = errorMessageFromOutput(output);

    assert.equal(errorMessage, 'Error message');
  });

  it('should return undefined if no error message is present', () => {
    const output = {
      Messages: [
        {
          Tags: [{ name: 'Tag1', value: 'value1' }],
        },
      ],
    };

    const errorMessage = errorMessageFromOutput(output);

    assert.equal(errorMessage, undefined);
  });

  it('should return error message with line number', () => {
    const output = {
      Error: '[string "aos"]:123: Error message',
    };

    const errorMessage = errorMessageFromOutput(output);

    assert.equal(errorMessage, 'Error message (line 123)');
  });

  it('should return error message with line number and remove unicode', () => {
    const output = {
      Error: '[string "aos"]:123: Error message\u001b[0m',
    };

    const errorMessage = errorMessageFromOutput(output);

    assert.equal(errorMessage, 'Error message (line 123)');
  });

  const knownErrorMessages =
    '\u001b[31mError\u001b[90m handling message with Action = Register\u001b[0m\n\u001b[32m[string ".handlers"]:723: [string "aos"]:128: Already registered\u001b[0m\n\n\u001b[90mstack traceback:\n\t[string ".process"]:871: in function \'.process.handle\'\u001b[0m\n\n\u001b[31merror:\n\u001b[0m[string ".handlers"]:723: [string "aos"]:128: Already registered';

  it('should display a clean error for a known error message', () => {
    const output = {
      Error: knownErrorMessages,
    };

    const errorMessage = errorMessageFromOutput(output);

    assert.equal(errorMessage, 'Already registered (line 128)');
  });
});

describe.only('sortAndPaginateEpochDataIntoEligibleDistributions', () => {
  const mockEpochData = {
    distributions: {
      rewards: {
        eligible: {
          gateway1: {
            operatorReward: 50,
            delegateRewards: {
              delegate1: 20,
              delegate2: 30,
            },
          },
          gateway2: {
            operatorReward: 70,
            delegateRewards: {
              delegate3: 40,
            },
          },
        },
      },
    },
  };

  it('returns empty results when epochData is undefined', () => {
    assert.deepEqual(
      sortAndPaginateEpochDataIntoEligibleDistributions(undefined),
      {
        hasMore: false,
        items: [],
        totalItems: 0,
        limit: 100,
        sortOrder: 'desc',
        sortBy: 'eligibleReward',
      },
    );
  });

  it('sorts rewards in descending order by eligibleReward', () => {
    const result =
      // @ts-ignore
      sortAndPaginateEpochDataIntoEligibleDistributions(mockEpochData);
    assert.deepEqual(result.items, [
      {
        type: 'operatorReward',
        recipient: 'gateway2',
        eligibleReward: 70,
        cursorId: 'gateway2_gateway2',
        gatewayAddress: 'gateway2',
      },
      {
        type: 'operatorReward',
        recipient: 'gateway1',
        eligibleReward: 50,
        cursorId: 'gateway1_gateway1',
        gatewayAddress: 'gateway1',
      },
      {
        type: 'delegateReward',
        recipient: 'delegate3',
        eligibleReward: 40,
        cursorId: 'gateway2_delegate3',
        gatewayAddress: 'gateway2',
      },
      {
        type: 'delegateReward',
        recipient: 'delegate2',
        eligibleReward: 30,
        cursorId: 'gateway1_delegate2',
        gatewayAddress: 'gateway1',
      },
      {
        type: 'delegateReward',
        recipient: 'delegate1',
        eligibleReward: 20,
        cursorId: 'gateway1_delegate1',
        gatewayAddress: 'gateway1',
      },
    ]);
  });

  it('supports sorting in ascending order', () => {
    const result = sortAndPaginateEpochDataIntoEligibleDistributions(
      // @ts-ignore
      mockEpochData,
      {
        sortOrder: 'asc',
      },
    );
    assert.equal(result.items[0].eligibleReward, 20);
    assert.equal(result.items[result.items.length - 1].eligibleReward, 70);
  });

  it('paginates results correctly', () => {
    const result = sortAndPaginateEpochDataIntoEligibleDistributions(
      // @ts-ignore
      mockEpochData,
      {
        limit: 2,
      },
    );
    assert.equal(result.items.length, 2);
    assert.equal(result.hasMore, true);
    assert.equal(result.nextCursor, 'gateway2_delegate3');
  });

  it('resumes pagination from cursor', () => {
    const firstPage = sortAndPaginateEpochDataIntoEligibleDistributions(
      // @ts-ignore
      mockEpochData,
      { limit: 2 },
    );
    const secondPage = sortAndPaginateEpochDataIntoEligibleDistributions(
      // @ts-ignore
      mockEpochData,
      {
        limit: 2,
        cursor: firstPage.nextCursor,
      },
    );
    assert.equal(secondPage.items.length, 2);
    assert.equal(secondPage.items[0].cursorId, 'gateway1_delegate2');
  });
});
