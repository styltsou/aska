import { and, eq } from "drizzle-orm";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { z } from "zod";

import { db } from "@/db";
import { verification } from "@/db/schema";
import { factory } from "@/factory";
import { auth } from "@/lib/auth";
import { AppError, ErrorCode } from "@/lib/errors";
import { success } from "@/lib/response";
import { authMiddleware } from "@/middleware";

const REQUEST_PREFIX = "aska-extension-auth:";
const REQUEST_TTL_MS = 10 * 60 * 1000;

const RequestParamSchema = z.object({
  requestId: z.string().uuid(),
});

const SecretBodySchema = z.object({
  secret: z.string().min(32).max(256),
});

type ConnectionRequest = {
  secretHash: string;
  status: "pending" | "approved";
  apiKey?: string;
};

function requestIdentifier(requestId: string): string {
  return `${REQUEST_PREFIX}${requestId}`;
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function createSecret(): string {
  return randomBytes(32).toString("base64url");
}

function parseRequest(value: string): ConnectionRequest {
  const parsed = z
    .object({
      secretHash: z.string(),
      status: z.enum(["pending", "approved"]),
      apiKey: z.string().optional(),
    })
    .safeParse(JSON.parse(value));

  if (!parsed.success) {
    throw new AppError(
      ErrorCode.INTERNAL_ERROR,
      "Invalid extension connection request",
    );
  }

  return parsed.data;
}

async function getRequest(requestId: string) {
  const [record] = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, requestIdentifier(requestId)))
    .limit(1);

  if (!record) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      "This extension connection request no longer exists.",
    );
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    await db.delete(verification).where(eq(verification.id, record.id));
    throw new AppError(
      ErrorCode.NOT_FOUND,
      "This extension connection request has expired.",
    );
  }

  return record;
}

function assertSecret(request: ConnectionRequest, secret: string): void {
  if (request.secretHash !== hashSecret(secret)) {
    throw new AppError(ErrorCode.FORBIDDEN, "Invalid connection request.");
  }
}

export const createExtensionConnectionRequest = factory.createHandlers(
  async (c) => {
    const requestId = randomUUID();
    const secret = createSecret();
    const expiresAt = new Date(Date.now() + REQUEST_TTL_MS);

    await db.insert(verification).values({
      id: randomUUID(),
      identifier: requestIdentifier(requestId),
      value: JSON.stringify({
        secretHash: hashSecret(secret),
        status: "pending",
      } satisfies ConnectionRequest),
      expiresAt,
    });

    return c.json(
      success({
        requestId,
        secret,
        expiresAt: expiresAt.toISOString(),
      }),
    );
  },
);

export const approveExtensionConnectionRequest = factory.createHandlers(
  authMiddleware,
  async (c) => {
    const params = RequestParamSchema.safeParse(c.req.param());
    const body = SecretBodySchema.safeParse(await c.req.json());

    if (!params.success || !body.success) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid connection request.");
    }

    const record = await getRequest(params.data.requestId);
    const request = parseRequest(record.value);
    assertSecret(request, body.data.secret);

    if (request.status === "approved") {
      return c.json(success({ approved: true }));
    }

    const result = await auth.api.createApiKey({
      headers: c.req.raw.headers,
      body: { name: "Aska browser extension" },
    });
    const apiKey = (result as { key?: string }).key;

    if (!apiKey) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        "Could not create an extension credential.",
      );
    }

    await db
      .update(verification)
      .set({
        value: JSON.stringify({
          secretHash: request.secretHash,
          status: "approved",
          apiKey,
        } satisfies ConnectionRequest),
      })
      .where(
        and(
          eq(verification.id, record.id),
          eq(verification.value, record.value),
        ),
      );

    return c.json(success({ approved: true }));
  },
);

export const exchangeExtensionConnectionRequest = factory.createHandlers(
  async (c) => {
    const params = RequestParamSchema.safeParse(c.req.param());
    const body = SecretBodySchema.safeParse(await c.req.json());

    if (!params.success || !body.success) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid connection request.");
    }

    const record = await getRequest(params.data.requestId);
    const request = parseRequest(record.value);
    assertSecret(request, body.data.secret);

    if (request.status !== "approved" || !request.apiKey) {
      throw new AppError(
        ErrorCode.CONFLICT,
        "Approve this connection in Aska before continuing.",
      );
    }

    await db.delete(verification).where(eq(verification.id, record.id));

    return c.json(success({ apiKey: request.apiKey }));
  },
);
