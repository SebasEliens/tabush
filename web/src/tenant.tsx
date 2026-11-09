import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api/client";
import type { Tenant } from "./api/types";

interface TenantCtx {
  tenants: Tenant[];
  tenant: Tenant | undefined;
  setTenantId: (id: string) => void;
}

const Ctx = createContext<TenantCtx>({ tenants: [], tenant: undefined, setTenantId: () => {} });

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState<string>();
  useEffect(() => {
    api.listTenants().then((ts) => {
      setTenants(ts);
      setTenantId((cur) => cur ?? ts[0]?.id);
    });
  }, []);
  const tenant = tenants.find((t) => t.id === tenantId);
  return <Ctx.Provider value={{ tenants, tenant, setTenantId }}>{children}</Ctx.Provider>;
}

export const useTenant = () => useContext(Ctx);
