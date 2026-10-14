import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { UserInputError } from "@/lib/errors";
import { decodeEntities, htmlToText } from "./html";

export interface JobAd {
  text: string;
  title: string | null;
  company: string | null;
}

const MAX_JOB_CHARS = 30_000;
const MAX_PAGE_BYTES = 3 * 1024 * 1024;
// Ashby returns a whole company board in one response, which can be large.
const MAX_API_BYTES = 20 * 1024 * 1024;
const PASTE_HINT = "Paste the job ad text instead.";

// Sites that require a login or block automated access.
const UNSUPPORTED_HOSTS = ["linkedin.com", "indeed.com", "glassdoor.com", "ziprecruiter.com", "wellfound.com"];

export class JobFetchError extends UserInputError {}

/** Fetches a job ad from a URL. Uses the public APIs of Greenhouse, Lever and Ashby, otherwise parses the page. */
export async function fetchJobAd(rawUrl: string): Promise<JobAd> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new JobFetchError("That doesn't look like a valid URL.");
  }

  const host = url.hostname.replace(/^www\./, "");
  if (UNSUPPORTED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    throw new JobFetchError(`${host} requires a login, so its job ads can't be fetched. ${PASTE_HINT}`);
  }

  const ad = (await fromGreenhouse(url)) ?? (await fromLever(url)) ?? (await fromAshby(url)) ?? (await fromHtmlPage(url));
  if (ad.text.length < 400) {
    throw new JobFetchError(`Couldn't find the job description on that page (it may need JavaScript or a login). ${PASTE_HINT}`);
  }
  return { ...ad, text: ad.text.slice(0, MAX_JOB_CHARS) };
}

async function fromGreenhouse(url: URL): Promise<JobAd | null> {
  if (!/(^|\.)greenhouse\.io$/.test(url.hostname)) return null;
  const match = url.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/);
  if (!match) return null;

  const data = await fetchJson<{ title?: string; content?: string; company_name?: string; location?: { name?: string } }>(
    `https://boards-api.greenhouse.io/v1/boards/${match[1]}/jobs/${match[2]}`,
  );
  const parts = [data.title, data.location?.name, htmlToText(decodeEntities(data.content ?? ""))];
  return { text: parts.filter(Boolean).join("\n\n"), title: data.title ?? null, company: data.company_name ?? null };
}

async function fromLever(url: URL): Promise<JobAd | null> {
  if (url.hostname !== "jobs.lever.co") return null;
  const match = url.pathname.match(/^\/([^/]+)\/([0-9a-f-]{36})/i);
  if (!match) return null;

  const data = await fetchJson<{
    text?: string;
    descriptionPlain?: string;
    additionalPlain?: string;
    lists?: { text: string; content: string }[];
    categories?: { location?: string; team?: string; commitment?: string };
  }>(`https://api.lever.co/v0/postings/${match[1]}/${match[2]}`);

  const lists = (data.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`);
  const meta = [data.categories?.team, data.categories?.location, data.categories?.commitment].filter(Boolean).join(" · ");
  const parts = [data.text, meta, data.descriptionPlain, ...lists, data.additionalPlain];
  return { text: parts.filter(Boolean).join("\n\n"), title: data.text ?? null, company: match[1] };
}

async function fromAshby(url: URL): Promise<JobAd | null> {
  if (url.hostname !== "jobs.ashbyhq.com") return null;
  const match = url.pathname.match(/^\/([^/]+)\/([0-9a-f-]{36})/i);
  if (!match) return null;

  // Ashby only exposes whole boards, so find the posting in its company's board.
  const board = await fetchJson<{ jobs?: { id: string; title?: string; location?: string; descriptionPlain?: string }[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${match[1]}`,
  );
  const job = board.jobs?.find((j) => j.id === match[2]);
  if (!job) throw new JobFetchError(`That Ashby job is no longer listed. ${PASTE_HINT}`);
  return { text: [job.title, job.location, job.descriptionPlain].filter(Boolean).join("\n\n"), title: job.title ?? null, company: match[1] };
}

async function fromHtmlPage(url: URL): Promise<JobAd> {
  const html = await fetchText(url.toString(), "text/html", MAX_PAGE_BYTES);

  // Many job boards embed schema.org JobPosting data for Google Jobs; it's the cleanest source.
  for (const [, json] of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const posting = findJobPosting(safeParse(json));
    if (posting?.description) {
      return {
        text: [posting.title, htmlToText(decodeEntities(posting.description))].filter(Boolean).join("\n\n"),
        title: posting.title ?? null,
        company: posting.hiringOrganization?.name ?? null,
      };
    }
  }

  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return { text: htmlToText(main), title: title ? decodeEntities(title).trim() : null, company: null };
}

interface JobPosting {
  "@type"?: string | string[];
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string };
}

function findJobPosting(node: unknown): JobPosting | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  const obj = node as JobPosting & { "@graph"?: unknown };
  const type = obj["@type"];
  if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return obj;
  return findJobPosting(obj["@graph"]);
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  return JSON.parse(await fetchText(url, "application/json", MAX_API_BYTES)) as T;
}

/** fetch() that only reaches public internet hosts, re-checking every redirect. */
async function fetchText(rawUrl: string, accept: string, maxBytes: number, redirectsLeft = 3): Promise<string> {
  const url = new URL(rawUrl);
  await assertPublicHost(url);

  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "manual",
      headers: { accept, "user-agent": "Mozilla/5.0 (compatible; SkillGap/1.0)" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new JobFetchError(`Couldn't reach ${url.hostname}. ${PASTE_HINT}`);
  }

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    if (!location || redirectsLeft === 0) throw new JobFetchError(`Too many redirects. ${PASTE_HINT}`);
    return fetchText(new URL(location, url).toString(), accept, maxBytes, redirectsLeft - 1);
  }
  if (!res.ok) throw new JobFetchError(`${url.hostname} returned ${res.status}. ${PASTE_HINT}`);

  const body = await res.arrayBuffer();
  if (body.byteLength > maxBytes) throw new JobFetchError(`That page is too large. ${PASTE_HINT}`);
  return new TextDecoder().decode(body);
}

async function assertPublicHost(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new JobFetchError("Only http and https links are supported.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new JobFetchError("That URL uses an unsupported port.");

  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  } catch {
    throw new JobFetchError(`Couldn't find ${url.hostname}. Check the link.`);
  }
  if (addresses.some(isPrivateAddress)) throw new JobFetchError("That URL points to a private network address.");
}

function isPrivateAddress(ip: string): boolean {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isPrivateAddress(mapped[1]);

  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
}
