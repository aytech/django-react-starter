type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue }

interface RequestJsonOptions extends Omit<RequestInit, 'body'> {
    json?: JsonValue
}

interface ApiErrorOptions {
    status: number
    details?: unknown
}

export class ApiError extends Error {
    readonly status: number
    readonly details: unknown

    constructor(
        message: string,
        { status, details = null }: ApiErrorOptions,
    ) {
        super(message);
        this.name = 'ApiError'
        this.status = status
        this.details = details
    }
}

function readCookie(name: string): string | null {
    const prefix = `${encodeURIComponent(name)}=`

    const cookie = document.cookie
        .split(';')
        .map((value) => value.trim())
        .find((value) => value.startsWith(prefix))

    return cookie
        ? decodeURIComponent(cookie.slice(prefix.length))
        : null
}

function isUnsafeMethod(method: string): boolean {
    return !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)
}

function errorMessage(details: unknown, status: number): string {
    if (
        details !== null
        && typeof details === 'object'
        && 'detail' in details
        && typeof details.detail === 'string'
    ) {
        return details.detail
    }

    return `API request failed with status ${status}`
}

export async function requestJson<T>(
    path: string,
    options: RequestJsonOptions = {},
): Promise<T> {
    const {
        json,
        headers: suppliedHeaders,
        ...requestOptions
    } = options

    const method = requestOptions.method?.toUpperCase() ?? 'GET'
    const headers = new Headers(suppliedHeaders)

    headers.set('Accept', 'application/json')

    if (json !== undefined) {
        headers.set('Content-Type', 'application/json')
    }

    if (isUnsafeMethod(method)) {
        const csrfToken = readCookie('csrftoken')

        if (csrfToken) {
            headers.set('X-CSRFToken', csrfToken)
        }
    }

    const response = await fetch(path, {
        ...requestOptions,
        method,
        headers,
        credentials: 'same-origin',
        body: json === undefined ? undefined : JSON.stringify(json),
    })

    if (response.status === 204) {
        return undefined as T
    }

    const contentType = response.headers.get('content-type') ?? ''
    const isJson = contentType.includes('application/json')
    const details: unknown = isJson
        ? await response.json()
        : await response.text()

    if (!response.ok) {
        throw new ApiError(errorMessage(details, response.status), {
            status: response.status,
            details,
        })
    }

    if (!isJson) {
        throw new ApiError('API returned an unexpected response format', {
            status: response.status,
            details,
        })
    }

    return details as T
}

export function getJson<T>(
    path: string,
    options: Omit<RequestJsonOptions, 'method' | 'json'> = {},
): Promise<T> {
    return requestJson<T>(path, {
        ...options,
        method: 'GET',
    })
}