const CONTRACT_ID = process.env.ARENA_ATTEST_CONTRACT ?? "attest-ledger.testnet";

const RPC_URLS = ["https://rpc.testnet.fastnear.com", "https://rpc.testnet.near.org"];

export type AttestationState =
  | { state: "match" }
  | { state: "mismatch" }
  | { state: "unattested" }
  | { state: "rpc-unreachable" };

interface RpcSuccess<T> {
  result: T;
  error?: unknown;
}

interface QueryResult {
  result: unknown;
}

function parseAttestationPayload(queryResult: QueryResult): string | null {
  const bytes = queryResult.result;
  if (!Array.isArray(bytes)) throw new Error("unexpected call_function result shape");
  const text = Buffer.from(bytes as number[]).toString("utf8");
  const parsed: unknown = JSON.parse(text);
  if (parsed === null) return null;
  if (typeof parsed !== "object" || parsed === null) throw new Error("unexpected attestation payload");
  const hash = (parsed as Record<string, unknown>).verdict_hash;
  if (typeof hash !== "string") throw new Error("unexpected attestation payload");
  return hash;
}

async function rpcCall<T>(method: string, params: Record<string, unknown>): Promise<T> {
  let lastError: unknown = new Error("no rpc endpoints attempted");
  for (const url of RPC_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "dontcare", method: "query", params }),
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      const body = (await response.json()) as RpcSuccess<T>;
      if (body.error) throw new Error(`rpc error: ${JSON.stringify(body.error)}`);
      return body.result;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export async function getAttestation(
  attackId: string,
  target: string,
  expectedHash: string,
): Promise<AttestationState> {
  const argsBase64 = Buffer.from(JSON.stringify({ attack_id: attackId, target })).toString("base64");
  try {
    const result = await rpcCall<QueryResult>("query", {
      request_type: "call_function",
      finality: "final",
      account_id: CONTRACT_ID,
      method_name: "get_attestation",
      args_base64: argsBase64,
    });
    const onChainHash = parseAttestationPayload(result);
    if (onChainHash === null) return { state: "unattested" };
    return { state: onChainHash === expectedHash ? "match" : "mismatch" };
  } catch {
    return { state: "rpc-unreachable" };
  }
}

export async function getAttestationCount(): Promise<{ contract: string; count: number | null }> {
  try {
    const queryResult = await rpcCall<QueryResult>("query", {
      request_type: "call_function",
      finality: "final",
      account_id: CONTRACT_ID,
      method_name: "attestation_count",
      args_base64: Buffer.from("{}").toString("base64"),
    });
    const bytes = queryResult.result;
    if (!Array.isArray(bytes)) throw new Error("unexpected attestation_count result shape");
    const count = Number(Buffer.from(bytes as number[]).toString("utf8"));
    if (!Number.isFinite(count)) throw new Error("attestation_count is not a number");
    return { contract: CONTRACT_ID, count };
  } catch {
    return { contract: CONTRACT_ID, count: null };
  }
}
