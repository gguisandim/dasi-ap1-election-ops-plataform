export interface ApiErrorPayload {
  statusCode?: number;
  code?: string;
  message?: string | string[];
  details?: unknown;
  timestamp?: string;
  path?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly payload?: ApiErrorPayload,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestOptions extends Omit<RequestInit, "body" | "method"> {
  query?: object;
}

function queryString(query?: RequestOptions["query"]) {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const value = params.toString();
  return value ? `?${value}` : "";
}

export class ApiClient {
  private token?: string;
  constructor(private baseUrl = "/api") {}

  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  setToken(token?: string) {
    this.token = token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}${path}${queryString(options.query)}`,
        {
          ...options,
          method,
          headers: {
            Accept: "application/json",
            ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
            ...(body === undefined
              ? {}
              : { "Content-Type": "application/json" }),
            ...options.headers,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
      );
    } catch (cause) {
      throw new ApiError(0, "Não foi possível conectar à API.", {
        details: cause,
      });
    }

    const isJson = response.headers
      .get("content-type")
      ?.includes("application/json");
    const payload = isJson ? ((await response.json()) as unknown) : undefined;
    if (!response.ok) {
      const errorPayload = payload as ApiErrorPayload | undefined;
      const rawMessage = errorPayload?.message;
      const message = Array.isArray(rawMessage)
        ? rawMessage.join("; ")
        : rawMessage;
      throw new ApiError(
        response.status,
        message ?? `Erro HTTP ${response.status}.`,
        errorPayload,
      );
    }
    return payload as T;
  }

  get<T>(path: string, options?: RequestOptions) {
    return this.request<T>("GET", path, undefined, options);
  }
  post<T, B = unknown>(path: string, body: B, options?: RequestOptions) {
    return this.request<T>("POST", path, body, options);
  }
  put<T, B = unknown>(path: string, body: B, options?: RequestOptions) {
    return this.request<T>("PUT", path, body, options);
  }
  patch<T, B = unknown>(path: string, body: B, options?: RequestOptions) {
    return this.request<T>("PATCH", path, body, options);
  }
  delete<T = void>(path: string, options?: RequestOptions) {
    return this.request<T>("DELETE", path, undefined, options);
  }
}

export const apiClient = new ApiClient();
export function configureApiClient(baseUrl?: string) {
  if (baseUrl) apiClient.setBaseUrl(baseUrl);
}
export function configureApiToken(token?: string) {
  apiClient.setToken(token);
}
