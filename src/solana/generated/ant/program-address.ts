/**
 * Program address constant lifted from Codama's pruned `programs/` output.
 * The full `programs/` plugin requires a kit `Client` we don't use; the
 * generated `instructions/` builders only need this one constant.
 */
import type { Address } from '@solana/kit';

export const ARIO_ANT_PROGRAM_ADDRESS = 'ARioAntProgXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' as Address<'ARioAntProgXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'>;
