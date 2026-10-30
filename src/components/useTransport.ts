import { useSyncExternalStore } from 'react';
import { transport, type TransportState } from '../audio/transport';

export function useTransport(): TransportState {
  return useSyncExternalStore(transport.subscribe, transport.getState);
}
