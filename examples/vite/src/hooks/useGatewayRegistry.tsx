import { AoARIORead } from "@ar.io/sdk";
import { useQuery } from "@tanstack/react-query";

export const useGateways = ({
  ario,
  limit,
  cursor,
  sortBy,
  sortOrder,
}: {
  ario: AoARIORead;
  limit: number;
  cursor: string | undefined;
  sortBy: "startTimestamp" | "operatorStake" | "totalDelegatedStake";
  sortOrder: "asc" | "desc";
}) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["gateways"],
    queryFn: () => ario.getGateways({ limit, cursor, sortBy, sortOrder }),
  });

  return { data, isLoading, error };
};

export const useGatewayDelegations = ({
  ario,
  gatewayAddress,
  limit,
  cursor,
}: {
  ario: AoARIORead;
  gatewayAddress: string;
  limit: number;
  cursor: string | undefined;
}) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["gateway-delegations", gatewayAddress],
    queryFn: () =>
      ario.getDelegations({
        address: gatewayAddress,
        limit,
        cursor,
      }),
  });

  return { data, isLoading, error };
};
