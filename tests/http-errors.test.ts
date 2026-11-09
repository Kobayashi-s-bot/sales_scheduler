import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AccessDeniedError } from "@/lib/auth/access";
import {
  ConflictError,
  mapCandidateRpcError,
  NotFoundError,
  safeErrorResponse,
} from "@/lib/http/errors";

describe("safeErrorResponse", () => {
  it("maps not found errors to 404", async () => {
    const response = safeErrorResponse(new NotFoundError("Candidate not found"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Candidate not found" });
  });

  it("maps conflicts to 409", () => {
    expect(safeErrorResponse(new ConflictError("Candidate is not pending")).status).toBe(409);
  });

  it("maps validation errors to 400", () => {
    const result = z.string().safeParse(1);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(safeErrorResponse(result.error).status).toBe(400);
    }
  });

  it.each([
    ["Authentication required", 401],
    ["Access denied", 403],
  ])("maps access error %s to %i", (message, status) => {
    expect(safeErrorResponse(new AccessDeniedError(message)).status).toBe(status);
  });

  it("hides unknown internal error messages", async () => {
    const response = safeErrorResponse(new Error("sensitive SQL detail"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });
});

describe("mapCandidateRpcError", () => {
  it.each([
    ["candidate not found", 404],
    ["candidate is not pending", 409],
    ["occurred_on is required", 400],
  ])("maps %s to HTTP %i", (message, status) => {
    expect(safeErrorResponse(mapCandidateRpcError(message)).status).toBe(status);
  });

  it("does not expose unknown RPC error messages", async () => {
    const response = safeErrorResponse(mapCandidateRpcError("sensitive SQL detail"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
