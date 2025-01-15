import { AoARIORead } from '@ar.io/sdk';
import { useQuery } from '@tanstack/react-query';

export const useArNSReturnedNames = ({
  ario,
  limit,
  cursor,
  sortBy,
  sortOrder,
}: {
  ario: AoARIORead;
  limit: number;
  cursor: string | undefined;
  sortBy: 'name' | 'startTimestamp' | 'initiator';
  sortOrder: 'asc' | 'desc';
}) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ar-ns-returned-names'],
    queryFn: () =>
      ario.getArNSReturnedNames({ limit, cursor, sortBy, sortOrder }),
  });

  return { data, isLoading, error };
};

export const useArNSRecords = ({
  ario,
  limit,
  cursor,
  sortBy,
  sortOrder,
}: {
  ario: AoARIORead;
  limit: number;
  cursor: string | undefined;
  sortBy:
    | 'processId'
    | 'startTimestamp'
    | 'type'
    | 'undernameLimit'
    | 'purchasePrice'
    | 'name';
  sortOrder: 'asc' | 'desc';
}) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ar-ns-records'],
    queryFn: () => ario.getArNSRecords({ limit, cursor, sortBy, sortOrder }),
  });

  return { data, isLoading, error };
};
