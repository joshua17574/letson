// lib/audit-log.ts
//
// Central audit logging for API mutations.
//
// Two ways to use it:
//
// 1. `withAuditLog(handler, meta)` — wraps a route handler and automatically
//    records an entry whenever the handler returns a 2xx response. Captures
//    who did it, what module/action/entity, the route param id, a sanitized
//    copy of the JSON request body, and the response message.
//
// 2. `logAudit({...})` — direct call for routes that want to record richer
//    detail (e.g. old/new value diffs). Never throws.
//
// Audit logging must never break the business operation, so every write is
// wrapped in try/catch and failures are only reported to the server console.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { isValidObjectId } from "mongoose";

import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import AuditLogModel from "@/models/AuditLog";

const MAX_CAPTURED_BODY_CHARS = 8_000;

const REDACTED_KEYS = new Set([
  "password",
  "newpassword",
  "confirmpassword",
  "currentpassword",
  "oldpassword",
  "secret",
  "token",
  "accesstoken",
  "refreshtoken",
]);

type AuditLogInput = {
  module: string;
  action: string;
  entityType: string;
  entityId?: string;
  outletId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  remarks?: string;
  createdBy?: string;
};

/** Recursively strips credential-like fields from a captured request body. */
function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[TRUNCATED]";

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (REDACTED_KEYS.has(key.toLowerCase())) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = sanitizeValue(item, depth + 1);
      }
    }

    return result;
  }

  if (typeof value === "string" && value.length > 1_000) {
    return `${value.slice(0, 1_000)}…[TRUNCATED]`;
  }

  return value;
}

function capValueSize(value: unknown) {
  if (value === undefined || value === null) return undefined;

  try {
    const serialized = JSON.stringify(value);

    if (serialized.length <= MAX_CAPTURED_BODY_CHARS) return value;

    return {
      note: "Captured value truncated for audit log.",
      preview: `${serialized.slice(0, MAX_CAPTURED_BODY_CHARS)}…`,
    };
  } catch {
    return undefined;
  }
}

/** Writes one audit entry. Never throws; failures only hit the console. */
export async function logAudit(input: AuditLogInput) {
  try {
    await dbConnect();

    await AuditLogModel.create({
      module: input.module,
      action: input.action,
      entityType: input.entityType,
      entityId:
        input.entityId && isValidObjectId(input.entityId)
          ? input.entityId
          : undefined,
      outletId:
        input.outletId && isValidObjectId(input.outletId)
          ? input.outletId
          : undefined,
      oldValue: capValueSize(sanitizeValue(input.oldValue)),
      newValue: capValueSize(sanitizeValue(input.newValue)),
      remarks: input.remarks || "",
      sourceChannel: "WEB",
      createdBy:
        input.createdBy && isValidObjectId(input.createdBy)
          ? input.createdBy
          : undefined,
    });
  } catch (error) {
    console.error("Audit log write failed:", error);
  }
}

type RouteContextLike =
  | { params: Promise<Record<string, unknown>> }
  | { params: Promise<{ id: string }> }
  | undefined;

export type AuditMeta = {
  module: string;
  action: string;
  entityType: string;
  /** Capture the sanitized JSON request body as newValue. Default true. */
  captureBody?: boolean;
};

/**
 * Wraps a mutating route handler so successful (2xx) requests are recorded
 * in the audit log. Handler behavior and errors are untouched — if the
 * handler fails or returns a non-2xx status, nothing is logged.
 */
export function withAuditLog<TContext extends RouteContextLike>(
  handler: (
    req: NextRequest,
    context: TContext
  ) => Promise<NextResponse> | NextResponse,
  meta: AuditMeta
) {
  return async function auditedHandler(req: NextRequest, context: TContext) {
    // Clone before the handler consumes the body so it can be captured after.
    const shouldCaptureBody =
      meta.captureBody !== false &&
      req.method !== "GET" &&
      req.method !== "DELETE" &&
      (req.headers.get("content-type") || "").includes("application/json");

    const bodyClone = shouldCaptureBody ? req.clone() : null;

    const response = await handler(req, context);

    if (response.status < 200 || response.status >= 300) {
      return response;
    }

    try {
      const session = await getServerSession(authOptions);

      const params = context?.params ? await context.params : {};
      const paramId = String((params as Record<string, unknown>)?.id || "");

      let capturedBody: unknown;

      if (bodyClone) {
        try {
          capturedBody = await bodyClone.json();
        } catch {
          capturedBody = undefined;
        }
      }

      let responseMessage = "";
      let responseEntityId = "";

      try {
        const payload = await response.clone().json();
        responseMessage = String(payload?.message || "");
        const dataId = payload?.data?._id;
        if (typeof dataId === "string") responseEntityId = dataId;
      } catch {
        // Non-JSON response; nothing extra to capture.
      }

      await logAudit({
        module: meta.module,
        action: meta.action,
        entityType: meta.entityType,
        entityId: paramId || responseEntityId || undefined,
        newValue: capturedBody,
        remarks: responseMessage,
        createdBy: session?.user?.id,
      });
    } catch (error) {
      console.error("Audit log wrapper failed:", error);
    }

    return response;
  };
}
