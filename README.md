# frisbee-games

## Setup

1. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

2. Set up environment variables:
   Create a `.env` file in the `backend/` directory or set environment variables:
   ```bash
   export SUPABASE_URL="your-supabase-url"
   export SUPABASE_KEY="your-supabase-key"
   ```

## Running Scripts

Scripts can be run directly from the root directory:

```bash
# Upload player stats to Supabase
python3 backend/scripts/upload_player_stats.py
```

## GitHub Actions

The project includes a GitHub Actions workflow that automatically uploads player stats every Tuesday at noon US Central Time.

### Setting up GitHub Secrets

To enable the automated workflow, add the following secrets to your GitHub repository:

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_KEY` - Your Supabase service role key or anon key

The workflow will run automatically on schedule, or you can trigger it manually from the **Actions** tab in GitHub.
