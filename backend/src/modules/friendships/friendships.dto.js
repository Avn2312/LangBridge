import { buildPaginationMeta } from "../../core/http/pagination.js";

export const serializeFriendsList = ({ friends, page, limit, total }) => ({
  success: true,
  friends,
  pagination: buildPaginationMeta({
    page,
    limit,
    total,
  }),
});

export const serializeReceivedRequests = ({
  incomingReqs,
  acceptedReqs,
  page,
  limit,
  incomingTotal,
  acceptedTotal,
}) => ({
  incomingReqs,
  acceptedReqs,
  pagination: {
    incoming: buildPaginationMeta({ page, limit, total: incomingTotal }),
    accepted: buildPaginationMeta({ page, limit, total: acceptedTotal }),
  },
});

export const serializeSentRequests = ({ requests, page, limit, total }) => ({
  success: true,
  requests,
  pagination: buildPaginationMeta({ page, limit, total }),
});

export const serializeFriendshipMessage = (message) => ({ message });
