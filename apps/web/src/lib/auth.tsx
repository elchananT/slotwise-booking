"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, refreshSession, tokenStore } from "./api";
import type { Business, Me } from "./types";

interface AuthCtx {
  /** "loading" while the stored session is being restored. */
  status: "loading" | "authed" | "anon";
  me: Me | null;
  business: Business | null;
  login: (email: string, password: string) => Promise<Me>;
  register: (name: string, email: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
  reload: () => Promise<Me | null>;
  setBusiness: (b: Business) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthCtx["status"]>("loading");
  const [me, setMe] = useState<Me | null>(null);

  const reload = useCallback(async () => {
    try {
      const m = await api.auth.me();
      setMe(m);
      setStatus("authed");
      return m;
    } catch {
      setMe(null);
      setStatus("anon");
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!tokenStore.hasAccess()) {
        if (!tokenStore.getRefresh() || !(await refreshSession())) {
          if (alive) setStatus("anon");
          return;
        }
      }
      if (alive) await reload();
    })();
    const off = tokenStore.onAuthLost(() => {
      setMe(null);
      setStatus("anon");
    });
    return () => {
      alive = false;
      off();
    };
  }, [reload]);

  const value = useMemo<AuthCtx>(
    () => ({
      status,
      me,
      business: me?.business ?? null,
      login: async (email, password) => {
        const res = await api.auth.login({ email, password });
        tokenStore.set(res);
        const m = (await reload()) ?? { ...res.owner, business: null };
        return m;
      },
      register: async (name, email, password) => {
        const res = await api.auth.register({ name, email, password });
        tokenStore.set(res);
        const m = (await reload()) ?? { ...res.owner, business: null };
        return m;
      },
      logout: async () => {
        try {
          await api.auth.logout();
        } catch {
          /* token may already be invalid; sign out locally regardless */
        }
        tokenStore.clear();
        setMe(null);
        setStatus("anon");
      },
      reload,
      setBusiness: (b) => setMe((m) => (m ? { ...m, business: b } : m)),
    }),
    [status, me, reload],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside <AuthProvider>");
  return c;
}
