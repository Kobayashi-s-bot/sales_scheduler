import { ZodError } from "zod";
import { AccessDeniedError } from "@/lib/auth/access";

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message = "Conflict") {
    super(message);
    this.name = "ConflictError";
  }
}

export class BadRequestError extends Error {
  constructor(message = "Invalid request") {
    super(message);
    this.name = "BadRequestError";
  }
}

export function mapCandidateRpcError(message: string): Error {
  if (message.includes("candidate not found")) return new NotFoundError("Candidate not found");
  if (message.includes("candidate is not pending")) return new ConflictError("Candidate is not pending");
  if (message.includes("occurred_on is required")) return new BadRequestError("Event date is required");
  return new Error("Internal server error");
}

export function safeErrorResponse(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: "Invalid request", issues: error.issues.map(({ path, code }) => ({ path, code })) }, { status: 400 });
  if (error instanceof AccessDeniedError) return Response.json({ error: error.message }, { status: error.message === "Authentication required" ? 401 : 403 });
  if (error instanceof NotFoundError) return Response.json({ error: error.message }, { status: 404 });
  if (error instanceof ConflictError) return Response.json({ error: error.message }, { status: 409 });
  if (error instanceof BadRequestError) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
