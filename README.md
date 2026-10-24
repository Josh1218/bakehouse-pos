# Bakehouse POS (Supabase edition)

React + TypeScript + Tailwind point-of-sale. Data lives in **Supabase** (Postgres), product photos in
**Supabase Storage**, and the site is hosted free on **GitHub Pages** — so it works from any device,
anywhere, with no XAMPP.

## 1. Create the Supabase project (once)

1. Go to <https://supabase.com> -> **New project** (pick a region close to you, e.g. Singapore).
2. **SQL Editor -> New query**, paste the whole of `supabase/schema.sql`, click **Run**.
   This creates the tables, security rules, report functions, the `product-images` bucket and sample products.
3. **Authentication -> Users -> Add user -> Create new user**. Enter your email + a strong password
   and tick **Auto Confirm User**. This is the login you (and any staff) will use.
4. **Authentication -> Sign In / Providers** (or Settings): turn **off** "Allow new users to sign up"
   so strangers cannot create accounts. Add staff yourself in step 3.
5. **Project Settings -> API**: copy the **Project URL** and the **anon / publishable** key.

> Only ever use the anon/publishable key in this app. Never paste the `service_role` / secret key anywhere
> in this repo or in GitHub secrets for this site.

## 2. Run it on your computer

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
# edit .env and paste your URL + anon key
npm run dev
```

## 3. Put it on GitHub + GitHub Pages

```bash
git init
git add .
git commit -m "Bakehouse POS with Supabase"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

Then on GitHub:

1. Repo **Settings -> Secrets and variables -> Actions -> New repository secret**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. Repo **Settings -> Pages -> Source: GitHub Actions**.
3. Go to the **Actions** tab, open **Deploy to GitHub Pages**, and **Run workflow** (it also runs on every push to `main`).
4. Your app will be at `https://<your-username>.github.io/<repo-name>/`.

`.env` is in `.gitignore`, so your keys are never committed. The anon key ends up inside the built website
(that is normal for Supabase); what protects your data is the login + the Row Level Security rules in `schema.sql`.

## Notes

- **GCash QR:** put your `gcash-qr.png` in the `public/` folder. In a public repo that image is public too.
- **Timezone:** "today" and reports use Asia/Manila (set inside the SQL functions).
- **Orders:** staff can create and view orders but not edit or delete them (keeps sales records honest).
  Stock is checked and reduced inside the database when an order is placed.
- **Realtime:** the tables are already enabled for Supabase Realtime, ready for live updates across devices.
