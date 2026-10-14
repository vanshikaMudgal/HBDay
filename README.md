# Birthday Notes

A mobile-first birthday page with a private wish inbox. The local version uses Node.js 18+ and has no external package dependencies. The Vercel deployment uses Supabase's REST API for persistent wish storage.

## Run locally

In PowerShell, from this folder:

```powershell
$env:ADMIN_TOKEN = "choose-a-private-password"
npm start
```

Open [http://localhost:3000](http://localhost:3000) for the birthday page. Open [http://localhost:3000/admin](http://localhost:3000/admin) and enter the same password to read submitted wishes.

Locally, wishes are stored in `data/wishes.jsonl`, outside the publicly served files. The hosted Vercel version stores wishes in Supabase instead.

## Free deployment with Vercel and Supabase

Vercel's Hobby plan and Supabase's Free plan can host a small personal birthday page without charge, within their current limits. Supabase Free projects can pause after a week of inactivity, so the inbox might need a moment to wake up. Check both providers' current plan limits before deploying.

1. Create a Supabase project on its Free plan.
2. In Supabase **SQL Editor**, run:

   ```sql
   create table public.wishes (
     id uuid primary key default gen_random_uuid(),
     name text not null,
     wish text not null,
     created_at timestamptz not null default now()
   );

   alter table public.wishes enable row level security;
   ```

   Do not add public read or write policies. The Vercel function accesses this table using a server-only key.
3. In Supabase **Project Settings → API**, copy the Project URL and the `service_role` key. Never put the `service_role` key in browser code or commit it to the repository.
4. Push this project to a GitHub repository and import it into Vercel. Vercel serves the page and runs the function in [api/wishes.js](api/wishes.js).
5. In Vercel **Project Settings → Environment Variables**, add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ADMIN_TOKEN`. Use the Supabase values from step 3 and choose a long, private password for `ADMIN_TOKEN`. Add them to the Production environment, then redeploy.
6. Open your Vercel app URL to share the birthday page. Open `/admin` on that same domain and enter `ADMIN_TOKEN` to read wishes.

The existing local `data/wishes.jsonl` file is not automatically imported into Supabase. Keep a private backup, and manually migrate any wishes you want to retain. Supabase Free projects have a 500 MB database limit and may pause after one week of inactivity; check [Supabase pricing](https://supabase.com/pricing) and [free-plan details](https://supabase.com/docs/guides/platform/compute-and-disk#free-compute) for current limits.

## Change the photos

Update the image URLs and alt text in [public/images.js](public/images.js). The current pictures are temporary remote examples; you can replace each URL with your own hosted image or a file you add under `public/`.
