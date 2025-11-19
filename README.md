# frisbee-games

## Setup

1. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

2. Set up environment variables:
   Create a `.env.backend` file in the `backend/` directory with the following variables:
   ```bash
   SUPABASE_URL="your-supabase-url"
   SUPABASE_KEY="your-supabase-key"
   
   # Add team export URLs (one per team)
   # Format: {TEAM_NAME}_EXPORT_URL="https://..."
   AUBURN_EXPORT_URL="https://example.com/auburn-export.csv"
   ALABAMA_EXPORT_URL="https://example.com/alabama-export.csv"
   # Add more teams as needed...
   ```
   
   The script will automatically discover all environment variables ending with `_EXPORT_URL` and process each team's CSV data.

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
   - `{TEAM_NAME}_EXPORT_URL` - CSV export URL for each team (e.g., `AUBURN_EXPORT_URL`, `ALABAMA_EXPORT_URL`)
     - Add one secret per team you want to process
     - The secret name should match the format: `{TEAM_NAME}_EXPORT_URL`
     - The secret value should be the full URL to the CSV export

5. Update the workflow file (`.github/workflows/upload-player-stats.yml`) to include your team export URLs in the `env` section:
   ```yaml
   env:
     SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
     SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
     AUBURN_EXPORT_URL: ${{ secrets.AUBURN_EXPORT_URL }}
     ALABAMA_EXPORT_URL: ${{ secrets.ALABAMA_EXPORT_URL }}
     # Add more teams as needed...
   ```

The workflow will run automatically on schedule (every Tuesday at noon US Central Time), or you can trigger it manually from the **Actions** tab in GitHub.
