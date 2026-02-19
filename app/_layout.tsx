import { Stack, useNavigationContainerRef } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { CompanyProvider } from '@/lib/company-context';

function hasPopToTopAction(action: unknown): boolean {
  if (!action || typeof action !== 'object') {
    return false;
  }

  const typedAction = action as { type?: unknown; payload?: unknown };
  if (typedAction.type === 'POP_TO_TOP') {
    return true;
  }

  if (!typedAction.payload || typeof typedAction.payload !== 'object') {
    return false;
  }

  const payload = typedAction.payload as { action?: unknown; routes?: unknown };
  if (hasPopToTopAction(payload.action)) {
    return true;
  }

  if (Array.isArray(payload.routes)) {
    return payload.routes.some((route) => hasPopToTopAction(route));
  }

  return false;
}

export default function RootLayout() {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    let isGuardInstalled = false;
    let restoreDispatch: (() => void) | null = null;

    const installGuard = () => {
      if (isGuardInstalled || !navigationRef.isReady() || !navigationRef.current) {
        return;
      }

      const target = navigationRef.current as {
        dispatch: ((action: unknown) => unknown) & {
          __popToTopGuarded?: boolean;
          __originalDispatch?: (action: unknown) => unknown;
        };
      };

      if (target.dispatch.__popToTopGuarded) {
        isGuardInstalled = true;
        return;
      }

      const originalDispatch = target.dispatch.bind(target);
      const guardedDispatch = ((action: unknown) => {
        if (hasPopToTopAction(action)) {
          return false;
        }
        return originalDispatch(action);
      }) as typeof target.dispatch;

      guardedDispatch.__popToTopGuarded = true;
      guardedDispatch.__originalDispatch = originalDispatch;
      target.dispatch = guardedDispatch;
      isGuardInstalled = true;

      restoreDispatch = () => {
        if (target.dispatch.__popToTopGuarded && target.dispatch.__originalDispatch) {
          target.dispatch = target.dispatch.__originalDispatch as typeof target.dispatch;
        }
      };
    };

    installGuard();
    const unsubscribe = navigationRef.addListener('state', installGuard);

    return () => {
      unsubscribe();
      restoreDispatch?.();
    };
  }, [navigationRef]);

  return (
    <CompanyProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="edit-profile" />
      </Stack>
      <StatusBar style="dark" />
    </CompanyProvider>
  );
}
