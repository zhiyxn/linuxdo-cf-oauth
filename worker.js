/**
 * Cloudflare Worker OAuth token proxy (POST /oauth/token).
 * Env vars:
 * - CLIENT_MAP: JSON map of client_id -> client_secret (preferred for multi-app).
 * - CLIENT_ID, CLIENT_SECRET: fallback for single-app setup.
 * - ALLOWED_ORIGINS: comma-separated allowlist (optional).
 */

const TOKEN_ENDPOINT = 'https://connect.linux.do/oauth2/token'
const USER_ENDPOINT = 'https://connect.linux.do/api/user'

const buildCorsHeaders = (origin, allowedOrigins) => {
  if (!origin) {
    return {}
  }
  if (!allowedOrigins || allowedOrigins.length === 0) {
    return { 'Access-Control-Allow-Origin': origin }
  }
  if (allowedOrigins.includes(origin)) {
    return { 'Access-Control-Allow-Origin': origin }
  }
  return {}
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const allowedOrigins = (env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    const corsHeaders = buildCorsHeaders(origin, allowedOrigins)

    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    if (url.pathname === '/api/user') {
      if (request.method !== 'GET') {
        return new Response('Method Not Allowed', {
          status: 405,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/plain; charset=utf-8',
          },
        })
      }

      const upstream = await fetch(USER_ENDPOINT, {
        method: 'GET',
        headers: {
          Authorization: request.headers.get('Authorization') || '',
        },
      })

      const upstreamBody = await upstream.text()
      const responseHeaders = new Headers({
        ...corsHeaders,
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      })

      return new Response(upstreamBody, {
        status: upstream.status,
        headers: responseHeaders,
      })
    }

    if (request.method !== 'POST' || url.pathname !== '/oauth/token') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
        },
      })
    }

    let form
    const contentType = request.headers.get('Content-Type') || ''
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const bodyText = await request.text()
      form = new URLSearchParams(bodyText)
    } else {
      return new Response('Unsupported Media Type', {
        status: 415,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
        },
      })
    }

    const clientId = form.get('client_id') || ''
    let clientSecret = ''
    if (env.CLIENT_MAP) {
      try {
        const map = JSON.parse(env.CLIENT_MAP)
        if (clientId && map && typeof map === 'object') {
          clientSecret = map[clientId] || ''
        }
      } catch {
        return new Response('Invalid CLIENT_MAP', {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/plain; charset=utf-8',
          },
        })
      }
    }

    if (!clientId && env.CLIENT_ID) {
      form.set('client_id', env.CLIENT_ID)
    }
    if (clientSecret) {
      form.set('client_secret', clientSecret)
    } else if (env.CLIENT_SECRET) {
      form.set('client_secret', env.CLIENT_SECRET)
    }

    if (!form.get('client_id') || !form.get('client_secret')) {
      return new Response('Unauthorized client', {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
        },
      })
    }

    const upstream = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    })

    const upstreamBody = await upstream.text()
    const responseHeaders = new Headers({
      ...corsHeaders,
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    })

    return new Response(upstreamBody, {
      status: upstream.status,
      headers: responseHeaders,
    })
  },
}
