import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { AUTH_OPTIONS } from '../src/utils/authStorage';
test('dashboard invite and recovery callbacks work in a fresh tab without a PKCE verifier', async t => {
  const previousWindow = (globalThis as any).window, previousDocument = (globalThis as any).document;
  try {
    for (const type of ['invite', 'recovery']) await t.test(type, async () => {
      const store = new Map<string, string>();
      const token = 'test-token-for-mocked-server-only';
      const location = new URL('https://app.example/kanban/#' + new URLSearchParams({ type, access_token: token, refresh_token: 'test-refresh', expires_in: '3600', token_type: 'bearer' }));
      (globalThis as any).window = { location, addEventListener() {}, removeEventListener() {} };
      (globalThis as any).document = { visibilityState: 'visible' };
      let calls = 0;
      const client = createClient('https://project.example', 'sb_publishable_test', {
        auth: { ...AUTH_OPTIONS, autoRefreshToken: false, storageKey: 'auth-link-test-' + type, storage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => { store.set(key, value); }, removeItem: key => { store.delete(key); } } },
        global: { fetch: async (url, options) => {
          calls++; assert.match(String(url), /\/auth\/v1\/user$/);
          assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer ' + token);
          return new Response(JSON.stringify({ id: 'verified-user', email: 'test@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }), { headers: { 'Content-Type': 'application/json' } });
        } },
      });
      let subscription: { unsubscribe: () => void };
      const callback = new Promise<void>(resolve => {
        subscription = client.auth.onAuthStateChange(event => { if (event === (type === 'recovery' ? 'PASSWORD_RECOVERY' : 'SIGNED_IN')) resolve(); }).data.subscription;
      });
      const { data, error } = await client.auth.getSession();
      await callback;
      assert.equal(error, null);
      assert.equal(data.session?.user.id, 'verified-user');
      assert.equal(calls, 1);
      assert.equal(location.hash, '');
      assert.ok(store.has('auth-link-test-' + type));
      await client.auth.stopAutoRefresh();
      subscription!.unsubscribe();
      (client.auth as any).broadcastChannel?.close();
    });
  } finally { (globalThis as any).window = previousWindow; (globalThis as any).document = previousDocument; }
});

