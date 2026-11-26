import { randomInt } from "node:crypto";
import { connection } from "next/server";
import EntrySequence from "./EntrySequence";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string | string[] }>;
}) {
  await connection();
  const params = await searchParams;
  const expired = params.expired === "1";
  return <EntrySequence captchaCode={String(randomInt(1000, 10000))} expired={expired} />;
}
