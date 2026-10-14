# SkillGap

Upload a resume and a job ad (link or pasted text). Claude, OpenAI and Gemini each extract the job's
requirements and check the resume against them. The results are merged into one deduplicated list:

- **All keywords**: every requirement, colored by whether the resume shows it.
- **Skill gaps**: the same items filtered to *missing* and *partial*, required first, each with a note
  on what's lacking.

Because the gaps view filters the keyword list, an item can never appear twice or in conflicting
states. The unique `(analysisId, key)` index in Postgres enforces this.

## How the pipeline works

`src/lib/analysis/pipeline.ts`

1. **Extract** (all providers in parallel): job ad → structured requirements (name, aliases,
   category, required/preferred, detail such as "5+ years").
2. **Merge** (plain code, `merge.ts`): entries whose names or aliases normalize to the same key are
   merged (`React.js` = `ReactJS` = `React`, `Postgres` = `PostgreSQL`). If one provider listed two
   items separately, they are never merged. Soft skills are kept when the ad requires them
   (communication, customer service, organizational skills…); preferred-only ones are dropped.
3. **Compare** (all providers in parallel): merged list + resume → matched / partial / missing per
   item, with a quote from the resume as evidence.
4. **Resolve**: verdicts are averaged (a matched/missing split becomes *partial*) and saved.

If a provider fails or has no API key, the others carry on. Every call is logged in `ProviderRun`
with latency and token counts, so you can compare providers on cost and quality.

## Setup

Requires Node 20+ and Docker (or any Postgres 14+).

```bash
cp .env.example .env        # then add Clerk keys and at least one AI key
npm install
npm run db:up               # starts Postgres in Docker
npm run db:migrate          # creates the tables
npm run dev
```

Clerk: create an application at https://dashboard.clerk.com and copy its two keys. Users are created
in the database on their first visit, so no webhook is needed.

## Job ad links

- Greenhouse, Lever and Ashby links use their public JSON APIs.
- Other pages use the schema.org `JobPosting` data that most career sites embed, falling back to
  page text.
- LinkedIn, Indeed, Glassdoor and ZipRecruiter need a login, so users are asked to paste the text.
- Fetches only go to public IPs (checked on every redirect) to prevent server-side request forgery.

## Moving to AWS later

The code is already split so these swaps are small:

| Now | On AWS |
|---|---|
| `after(() => runAnalysis(id))` in `src/app/actions.ts` | Send `id` to SQS; a Lambda or ECS worker calls `runAnalysis(id)` |
| Docker Postgres | RDS for PostgreSQL or Aurora Serverless v2 (just change `DATABASE_URL`) |
| Resume text stored in Postgres | Optionally keep original files in S3 (encrypted) |
| API keys in `.env` | Secrets Manager |
| Next.js dev server | Amplify Hosting, or a container on ECS/App Runner |

Other things to add before opening it to the public: a stronger rate limit than the per-user daily
cap in `actions.ts`, and a privacy policy plus resume retention period (resumes contain personal data).
