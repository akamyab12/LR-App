import Constants from 'expo-constants';

type AppExtra = {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
};

function getExpoExtra(): AppExtra {
  const expoExtra = (Constants.expoConfig?.extra ?? {}) as AppExtra;
  const manifest2Extra = (
    (Constants as unknown as { manifest2?: { extra?: Record<string, unknown> } }).manifest2?.extra ?? {}
  ) as Record<string, unknown>;
  const embeddedExtra = (manifest2Extra.expoClient as { extra?: AppExtra } | undefined)?.extra ?? {};

  return {
    ...embeddedExtra,
    ...expoExtra,
  };
}

const appExtra = getExpoExtra();
const supabaseUrl =
  typeof appExtra.EXPO_PUBLIC_SUPABASE_URL === 'string' ? appExtra.EXPO_PUBLIC_SUPABASE_URL : '';
const supabaseAnonKey =
  typeof appExtra.EXPO_PUBLIC_SUPABASE_ANON_KEY === 'string' ? appExtra.EXPO_PUBLIC_SUPABASE_ANON_KEY : '';

type SupabaseUser = {
  id?: string;
  email?: string;
  aud?: string;
  role?: string;
};

export type AppSession = {
  access_token?: string;
  refresh_token?: string;
  user?: SupabaseUser;
};

type SupabaseError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

type AuthChangeEvent =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED';

type AuthChangeListener = (event: AuthChangeEvent, session: AppSession | null) => void;

type SelectResponse<T = unknown> = {
  data: T[] | null;
  error: SupabaseError | null;
};

type MaybeSingleResponse<T = unknown> = {
  data: T | null;
  error: SupabaseError | null;
};

type SingleResponse<T = unknown> = {
  data: T | null;
  error: SupabaseError | null;
};

type InsertSingleResponse<T = unknown> = {
  data: T | null;
  error: SupabaseError | null;
};

type UpdateSingleResponse<T = unknown> = {
  data: T | null;
  error: SupabaseError | null;
};

type RpcResponse<T = unknown> = {
  data: T | null;
  error: SupabaseError | null;
};

type SelectBuilder = {
  eq: (column: string, value: unknown) => SelectBuilder;
  maybeSingle: <T = unknown>() => Promise<MaybeSingleResponse<T>>;
  single: <T = unknown>() => Promise<SingleResponse<T>>;
  limit: <T = unknown>(limit: number) => Promise<SelectResponse<T>>;
  order: <T = unknown>(column: string, options?: { ascending?: boolean }) => Promise<SelectResponse<T>>;
};

type InsertBuilder = {
  select: (columns?: string) => {
    single: <T = unknown>() => Promise<InsertSingleResponse<T>>;
  };
};

type UpdateBuilder = {
  eq: (column: string, value: unknown) => UpdateBuilder;
  select: (columns?: string) => {
    single: <T = unknown>() => Promise<UpdateSingleResponse<T>>;
  };
};

type SupabaseAuth = {
  signInWithPassword: (params: { email: string; password: string }) => Promise<{
    data: { session: AppSession | null };
    error: SupabaseError | null;
  }>;
  signOut: () => Promise<{ error: SupabaseError | null }>;
  getSession: () => Promise<{ data: { session: AppSession | null }; error: SupabaseError | null }>;
  getUser: () => Promise<{ data: { user: SupabaseUser | null }; error: SupabaseError | null }>;
  onAuthStateChange: (
    callback: AuthChangeListener
  ) => { data: { subscription: { unsubscribe: () => void } } };
};

type SupabaseClient = {
  auth: SupabaseAuth;
  rpc: <T = unknown>(fn: string, params?: Record<string, unknown>) => Promise<RpcResponse<T>>;
  from: (table: string) => {
    select: (columns?: string) => SelectBuilder;
    insert: (values: Record<string, unknown> | Record<string, unknown>[]) => InsertBuilder;
    update: (values: Record<string, unknown>) => UpdateBuilder;
  };
};

function normalizeError(payload: unknown): SupabaseError {
  const objectPayload = (payload ?? {}) as Record<string, unknown>;
  return {
    message:
      (objectPayload.msg as string | undefined) ??
      (objectPayload.error_description as string | undefined) ??
      (objectPayload.message as string | undefined),
    code: objectPayload.code as string | undefined,
    details: objectPayload.details as string | undefined,
    hint: objectPayload.hint as string | undefined,
  };
}

function createFallbackClient(): SupabaseClient {
  let currentSession: AppSession | null = null;
  const listeners = new Set<AuthChangeListener>();

  const notify = (event: AuthChangeEvent) => {
    for (const listener of listeners) {
      listener(event, currentSession);
    }
  };

  const withAuthHeaders = () => {
    const token = currentSession?.access_token ?? supabaseAnonKey;
    return {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const executeSelect = async <T>(
    table: string,
    columns: string,
    options?: {
      filters?: Record<string, string>;
      limit?: number;
      order?: string;
      single?: boolean;
    }
  ): Promise<SelectResponse<T> | MaybeSingleResponse<T>> => {
    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        data: options?.single ? null : null,
        error: { message: 'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY' },
      };
    }

    try {
      const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
      url.searchParams.set('select', columns);

      if (options?.limit) {
        url.searchParams.set('limit', String(options.limit));
      }

      if (options?.order) {
        url.searchParams.set('order', options.order);
      }

      for (const [key, value] of Object.entries(options?.filters ?? {})) {
        url.searchParams.set(key, value);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: withAuthHeaders(),
      });

      const payload = await response.json();

      if (!response.ok) {
        return {
          data: options?.single ? null : null,
          error: normalizeError(payload),
        };
      }

      if (options?.single) {
        return {
          data: Array.isArray(payload) && payload.length > 0 ? payload[0] : null,
          error: null,
        };
      }

      return {
        data: Array.isArray(payload) ? payload : [],
        error: null,
      };
    } catch (error) {
      return {
        data: options?.single ? null : null,
        error: {
          message: error instanceof Error ? error.message : 'Network error',
        },
      };
    }
  };

  const executeInsert = async <T>(
    table: string,
    values: Record<string, unknown> | Record<string, unknown>[],
    columns = '*'
  ): Promise<InsertSingleResponse<T>> => {
    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        data: null,
        error: { message: 'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY' },
      };
    }

    try {
      const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
      if (columns && columns.trim().length > 0) {
        url.searchParams.set('select', columns);
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          ...withAuthHeaders(),
          Prefer: 'return=representation',
        },
        body: JSON.stringify(values),
      });

      const payload = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: normalizeError(payload),
        };
      }

      return {
        data: Array.isArray(payload) ? (payload[0] as T | undefined) ?? null : (payload as T),
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Network error',
        },
      };
    }
  };

  const executeUpdate = async <T>(
    table: string,
    values: Record<string, unknown>,
    filters: Record<string, string>,
    columns = '*'
  ): Promise<UpdateSingleResponse<T>> => {
    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        data: null,
        error: { message: 'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY' },
      };
    }

    try {
      const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
      if (columns && columns.trim().length > 0) {
        url.searchParams.set('select', columns);
      }

      for (const [key, value] of Object.entries(filters)) {
        url.searchParams.set(key, value);
      }

      const response = await fetch(url.toString(), {
        method: 'PATCH',
        headers: {
          ...withAuthHeaders(),
          Prefer: 'return=representation',
        },
        body: JSON.stringify(values),
      });

      const payload = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: normalizeError(payload),
        };
      }

      return {
        data: Array.isArray(payload) ? (payload[0] as T | undefined) ?? null : (payload as T),
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Network error',
        },
      };
    }
  };

  return {
    auth: {
      signInWithPassword: async ({ email, password }) => {
        if (!supabaseUrl || !supabaseAnonKey) {
          return {
            data: { session: null },
            error: { message: 'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY' },
          };
        }

        try {
          const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
              apikey: supabaseAnonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });

          const payload = await response.json();

          if (!response.ok) {
            return {
              data: { session: null },
              error: normalizeError(payload),
            };
          }

          currentSession = payload?.access_token
            ? {
                access_token: payload.access_token,
                refresh_token: payload.refresh_token,
                user: {
                  id: payload?.user?.id,
                  email: payload?.user?.email,
                  aud: payload?.user?.aud,
                  role: payload?.user?.role,
                },
              }
            : null;

          notify('SIGNED_IN');

          return {
            data: { session: currentSession },
            error: null,
          };
        } catch (error) {
          return {
            data: { session: null },
            error: {
              message: error instanceof Error ? error.message : 'Network error',
            },
          };
        }
      },
      getSession: async () => {
        return {
          data: { session: currentSession },
          error: null,
        };
      },
      signOut: async () => {
        currentSession = null;
        notify('SIGNED_OUT');
        return { error: null };
      },
      getUser: async () => {
        return {
          data: { user: currentSession?.user ?? null },
          error: null,
        };
      },
      onAuthStateChange: (callback) => {
        listeners.add(callback);
        callback('INITIAL_SESSION', currentSession);

        return {
          data: {
            subscription: {
              unsubscribe: () => {
                listeners.delete(callback);
              },
            },
          },
        };
      },
    },
    rpc: async <T = unknown>(fn: string, params?: Record<string, unknown>) => {
      if (!supabaseUrl || !supabaseAnonKey) {
        return {
          data: null,
          error: { message: 'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY' },
        };
      }

      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
          method: 'POST',
          headers: withAuthHeaders(),
          body: JSON.stringify(params ?? {}),
        });

        const payload = await response.json();

        if (!response.ok) {
          return {
            data: null,
            error: normalizeError(payload),
          };
        }

        return {
          data: payload as T,
          error: null,
        };
      } catch (error) {
        return {
          data: null,
          error: {
            message: error instanceof Error ? error.message : 'Network error',
          },
        };
      }
    },
    from: (table) => ({
      select: (columns = '*') => {
        const filters: Record<string, string> = {};
        const builder: SelectBuilder = {
          eq: (column, value) => {
            filters[column] = `eq.${String(value ?? '')}`;
            return builder;
          },
          maybeSingle: <T = unknown>() =>
            executeSelect<T>(table, columns, {
              filters,
              limit: 1,
              single: true,
            }) as Promise<MaybeSingleResponse<T>>,
          single: <T = unknown>() =>
            executeSelect<T>(table, columns, {
              filters,
              limit: 1,
              single: true,
            }) as Promise<SingleResponse<T>>,
          limit: <T = unknown>(limit: number) =>
            executeSelect<T>(table, columns, {
              filters,
              limit,
            }) as Promise<SelectResponse<T>>,
          order: <T = unknown>(column: string, options?: { ascending?: boolean }) =>
            executeSelect<T>(table, columns, {
              filters,
              order: `${column}.${options?.ascending === false ? 'desc' : 'asc'}`,
            }) as Promise<SelectResponse<T>>,
        };

        return builder;
      },
      insert: (values) => ({
        select: (columns = '*') => ({
          single: <T = unknown>() => executeInsert<T>(table, values, columns),
        }),
      }),
      update: (values) => {
        const filters: Record<string, string> = {};
        const builder: UpdateBuilder = {
          eq: (column, value) => {
            filters[column] = `eq.${String(value ?? '')}`;
            return builder;
          },
          select: (columns = '*') => ({
            single: <T = unknown>() => executeUpdate<T>(table, values, filters, columns),
          }),
        };

        return builder;
      },
    }),
  };
}

function createSupabaseClient(): SupabaseClient {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@supabase/supabase-js') as {
      createClient: (
        url: string,
        key: string,
        options: {
          auth: {
            storage: unknown;
            persistSession: boolean;
            autoRefreshToken: boolean;
            detectSessionInUrl: boolean;
          };
        }
      ) => SupabaseClient;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;

    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  } catch {
    console.warn(
      'Falling back to fetch-based Supabase client. Install @supabase/supabase-js and @react-native-async-storage/async-storage for the full native client.'
    );
    return createFallbackClient();
  }
}

export const supabase = createSupabaseClient();
