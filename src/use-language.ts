import { useSyncExternalStore } from 'react';
import { subscribeLanguage, getLanguage } from '../electron/i18n';
export function useLanguage() { return useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage); }
