import type { APIGatewayProxyResult } from "aws-lambda";

const headers = { "content-type": "application/json" };

export function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, headers, body: JSON.stringify(body) };
}

export function error(statusCode: number, message: string): APIGatewayProxyResult {
  return json(statusCode, { error: message });
}
