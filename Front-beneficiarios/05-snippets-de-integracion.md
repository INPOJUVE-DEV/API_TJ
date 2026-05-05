# Snippets de Integracion

## Helper base para fetch autenticado

```ts
type SessionState = {
  accessToken: string | null;
};

const sessionState: SessionState = {
  accessToken: null
};

async function refreshSession(): Promise<boolean> {
  const response = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok) {
    sessionState.accessToken = null;
    return false;
  }

  const data = await response.json();
  sessionState.accessToken = data.accessToken;
  return true;
}

async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (sessionState.accessToken) {
    headers.set("Authorization", `Bearer ${sessionState.accessToken}`);
  }

  let response = await fetch(input, {
    ...init,
    headers
  });

  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshSession();
  if (!refreshed) {
    return response;
  }

  const retryHeaders = new Headers(init.headers || {});
  if (sessionState.accessToken) {
    retryHeaders.set("Authorization", `Bearer ${sessionState.accessToken}`);
  }

  response = await fetch(input, {
    ...init,
    headers: retryHeaders
  });

  return response;
}
```

## Login

```ts
async function login(username: string, password: string) {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    throw await response.json();
  }

  const data = await response.json();
  sessionState.accessToken = data.accessToken;
  return data;
}
```

## Logout

```ts
async function logout() {
  await fetch("/api/v1/auth/logout", {
    method: "POST",
    credentials: "include"
  });

  sessionState.accessToken = null;
}
```

## Verificar activacion

```ts
async function verifyActivation(tarjeta_numero: string, curp: string) {
  const response = await fetch("/api/v1/cardholders/verify-activation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ tarjeta_numero, curp })
  });

  const data = await response.json();
  if (!response.ok) {
    throw data;
  }
  return data;
}
```

## Completar activacion

```ts
async function completeActivation(payload: {
  tarjeta_numero: string;
  email: string;
  password: string;
  password_confirmation: string;
}) {
  const response = await fetch("/api/v1/cardholders/complete-activation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw data;
  }

  sessionState.accessToken = data.accessToken;
  return data;
}
```

## Forgot password

```ts
async function forgotPassword(email: string) {
  const response = await fetch("/api/v1/auth/forgot-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email })
  });

  return response.json();
}
```

## Reset password

```ts
async function resetPassword(token: string, password: string, password_confirmation: string) {
  const response = await fetch("/api/v1/auth/reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ token, password, password_confirmation })
  });

  const data = await response.json();
  if (!response.ok) {
    throw data;
  }

  sessionState.accessToken = null;
  return data;
}
```
