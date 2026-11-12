import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccessDeniedError } from "@/lib/auth/access";

const requireMembership = vi.fn();
vi.mock("@/lib/auth/server", () => ({
  requireOrganizationMembership: (organizationId: string) => requireMembership(organizationId),
}));

import { DELETE, POST } from "@/app/api/public-sources/route";

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "22222222-2222-4222-8222-222222222222";
const COMPANY = "33333333-3333-4333-8333-333333333333";
const SOURCE = "44444444-4444-4444-8444-444444444444";
const ROW = { id: SOURCE, company_id: COMPANY, source_url: "https://example.com/feed.xml", source_type: "rss", last_checked_at: null, last_error: null, created_at: "2026-11-12T00:00:00Z" };

type Result = { data?: unknown; error?: { code?: string } | null };

// The membership returned by the mock is always ORG, whatever organization id the request asked for.
function setup(options: { company?: unknown; insert?: Result; deleted?: unknown[] } = {}) {
  const insert = vi.fn();
  const deleteEq: Array<[string, unknown]> = [];
  const companyEq: Array<[string, unknown]> = [];
  insert.mockReturnValue({ select: () => ({ single: async () => options.insert ?? { data: ROW, error: null } }) });
  const deleteChain: Record<string, unknown> = {};
  deleteChain.eq = (column: string, value: unknown) => { deleteEq.push([column, value]); return deleteChain; };
  deleteChain.select = async () => ({ data: options.deleted ?? [{ id: SOURCE }], error: null });
  const deleteSpy = vi.fn().mockReturnValue(deleteChain);
  const companyChain: Record<string, unknown> = {};
  companyChain.eq = (column: string, value: unknown) => { companyEq.push([column, value]); return companyChain; };
  companyChain.maybeSingle = async () => ({ data: "company" in options ? options.company : { id: COMPANY }, error: null });
  const from = vi.fn((table: string) => {
    if (table === "companies") return { select: () => companyChain };
    if (table === "public_sources") return { insert, delete: deleteSpy };
    throw new Error(`unexpected table ${table}`);
  });
  requireMembership.mockResolvedValue({ supabase: { from }, user: { id: "user" }, membership: { organization_id: ORG, user_id: "user", role: "member" } });
  return { from, insert, deleteSpy, deleteEq, companyEq };
}

const post = (body: unknown) => POST(new Request("https://local.example/api/public-sources", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
const del = (query: string) => DELETE(new Request(`https://local.example/api/public-sources?${query}`, { method: "DELETE" }));
const valid = { organizationId: ORG, companyId: COMPANY, sourceUrl: "https://example.com/feed.xml", sourceType: "rss" };
const deleteQuery = (organizationId = ORG) => `id=${SOURCE}&companyId=${COMPANY}&organizationId=${organizationId}`;

beforeEach(() => {
  requireMembership.mockReset();
  vi.restoreAllMocks();
});

describe("authorization (AC5)", () => {
  it("returns 401 for an unauthenticated POST and DELETE", async () => {
    requireMembership.mockRejectedValue(new AccessDeniedError("Authentication required"));
    expect((await post(valid)).status).toBe(401);
    expect((await del(deleteQuery())).status).toBe(401);
  });

  it("returns 403 for a non-member POST and DELETE", async () => {
    requireMembership.mockImplementation(async () => { throw new AccessDeniedError(); });
    expect((await post(valid)).status).toBe(403);
    expect((await del(deleteQuery())).status).toBe(403);
    expect(requireMembership).toHaveBeenCalledTimes(2);
  });

  it("returns 403 when the request names an organization the user does not belong to", async () => {
    requireMembership.mockImplementation(async (organizationId: string) => {
      if (organizationId !== ORG) throw new AccessDeniedError();
      return { supabase: { from: () => { throw new Error("must not reach the database"); } }, user: { id: "user" }, membership: { organization_id: ORG, user_id: "user", role: "member" } };
    });
    expect((await post({ ...valid, organizationId: OTHER_ORG })).status).toBe(403);
    expect(requireMembership).toHaveBeenCalledWith(OTHER_ORG);
  });
});

describe("POST /api/public-sources", () => {
  it("inserts exactly the four allowed keys, returns 201 and the created row (AC6)", async () => {
    const { insert } = setup();
    const response = await post(valid);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: ROW });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(Object.keys(insert.mock.calls[0][0]).sort()).toEqual(["company_id", "organization_id", "source_type", "source_url"]);
    expect(insert.mock.calls[0][0]).toEqual({ organization_id: ORG, company_id: COMPANY, source_url: "https://example.com/feed.xml", source_type: "rss" });
  });

  it("uses the body organizationId only to pick the membership, and writes the membership value (AC7)", async () => {
    const { insert } = setup();
    const response = await post({ ...valid, organizationId: OTHER_ORG });
    expect(response.status).toBe(201);
    expect(requireMembership).toHaveBeenCalledWith(OTHER_ORG);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0].organization_id).toBe(ORG);
  });

  it("rejects server-controlled keys in the body with 400 and no insert (AC7)", async () => {
    const { insert } = setup();
    for (const extra of [{ organization_id: OTHER_ORG }, { refreshIntervalMinutes: 5 }, { nextCheckAt: "2020-01-01" }, { failureCount: 0 }]) {
      expect((await post({ ...valid, ...extra })).status).toBe(400);
    }
    expect(insert).not.toHaveBeenCalled();
  });

  it("looks the company up inside the verified organization and returns 404 when it is missing (AC8)", async () => {
    const found = setup();
    await post(valid);
    expect(found.companyEq).toEqual(expect.arrayContaining([["id", COMPANY], ["organization_id", ORG]]));
    const missing = setup({ company: null });
    const response = await post(valid);
    expect(response.status).toBe(404);
    expect(missing.insert).not.toHaveBeenCalled();
  });

  it("returns 409 on a unique violation (AC9)", async () => {
    setup({ insert: { error: { code: "23505" } } });
    expect((await post(valid)).status).toBe(409);
  });

  it("never calls fetch and does not reference collection code (AC10)", async () => {
    setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await post(valid);
    expect(fetchSpy).not.toHaveBeenCalled();
    const source = fs.readFileSync("src/app/api/public-sources/route.ts", "utf8");
    expect(source).not.toContain("collection/run");
    expect(source).not.toContain("collectPublicSource");
    expect(source).not.toContain("assertPublicHostResolves");
    expect(source).not.toContain("supabase/admin");
  });

  it("returns 400 and does not insert on invalid input (AC11)", async () => {
    const { insert } = setup();
    for (const body of [
      { ...valid, sourceUrl: "http://example.com/" },
      { ...valid, sourceUrl: "https://192.168.1.1/" },
      { ...valid, sourceType: "atom" },
      { ...valid, companyId: "bad" },
      { ...valid, organizationId: "bad" },
    ]) expect((await post(body)).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/public-sources", () => {
  it("scopes the delete by id, the membership organization and company (AC12)", async () => {
    const { deleteEq } = setup();
    const response = await del(deleteQuery(OTHER_ORG));
    expect(response.status).toBe(204);
    expect(requireMembership).toHaveBeenCalledWith(OTHER_ORG);
    expect(deleteEq).toEqual([["id", SOURCE], ["organization_id", ORG], ["company_id", COMPANY]]);
  });

  it("returns 404 for zero rows and 400 for bad ids (AC13)", async () => {
    setup({ deleted: [] });
    expect((await del(deleteQuery())).status).toBe(404);
    setup();
    expect((await del(`id=bad&companyId=${COMPANY}&organizationId=${ORG}`)).status).toBe(400);
    expect((await del(`id=${SOURCE}&companyId=bad&organizationId=${ORG}`)).status).toBe(400);
  });
});
