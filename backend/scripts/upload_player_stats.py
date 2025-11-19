"""
Script to upload player statistics dictionary to Supabase 'player_stats' table.

Dictionary structure:
{
    "timestamp": "2024-01-15T10:30:00Z",  # Timestamp from CSV
    "player_name": "John Doe",
    "game_played": "Game Name",
    "tournament_played": "Tournament Name",
    "goals": 5,
    "assists": 3,
    "drops": 1,
    "throwaways": 2,
    "ds": 1  # Defensive stops
}
"""
import os
import sys
import csv
import io
import requests
from typing import Dict, Any, List, Union, Optional
from collections import defaultdict

# Add the root directory (frisbee-games) to the path to import utils
# This allows the script to be run from the root directory
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
root_dir = os.path.dirname(backend_dir)
sys.path.insert(0, root_dir)

from backend.scripts.utils.supabase_client import get_supabase_client

# Try to load environment variables from .env.backend file
try:
    from dotenv import load_dotenv
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(backend_dir, '.env.backend')
    load_dotenv(env_path)
except ImportError:
    pass


def download_csv_from_url(url: str) -> str:
    """
    Downloads CSV content from a URL and returns it as a string buffer.
    
    Args:
        url: URL to download CSV from
        
    Returns:
        CSV content as a string
    """
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        raise Exception(f"Failed to download CSV from {url}: {str(e)}")


def calculate_player_stats_from_csv(csv_content: str, team_name: str, players_dict: Optional[Dict[str, Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
    """
    Calculates player statistics from CSV content and returns a list of records
    matching the database schema.
    
    CSV expected columns:
    - Column 1 (first column): Timestamp for the game (same for all rows in a game)
    - Passer: Name of the player who threw the disc
    - Receiver: Name of the player who received the disc
    - Defender: Name of the player who made a defensive play
    - Action: Type of action (Goal, D, Throwaway, Drop)
    - Tournamemnt: Tournament name (note: typo in original CSV column name)
    - Opponent: Opponent team name
    - Player 0 through Player 6: Players who played in the game
    
    Args:
        csv_content: CSV content as a string
        team_name: Name of the team to calculate stats for (for reference only)
        players_dict: Optional dictionary mapping team names to player names.
                     If None or empty, all players found in CSV will be tracked.
                     If provided, only players in the dict will be tracked.
        
    Returns:
        List of dictionaries, each representing one player's stats for one game
    """
    # Initialize stats tracking structure
    # Format: stats[player_name][tournament][opponent] = {goals, assists, drops, throwaways, ds, timestamp}
    stats = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {
        "goals": 0,
        "assists": 0,
        "drops": 0,
        "throwaways": 0,
        "ds": 0,
        "timestamp": None
    })))
    
    # Track timestamps per game (tournament + opponent combination)
    game_timestamps = {}
    
    # Helper function to check if a player should be tracked
    def should_track_player(player_name: str) -> bool:
        """Check if a player should be tracked based on players_dict."""
        if not player_name:
            return False
        # If players_dict is None or empty, track all players
        if not players_dict or not players_dict.get(team_name):
            return True
        # Otherwise, only track players in the dict
        return player_name in players_dict.get(team_name, {})
    
    # Read CSV from string buffer
    csvfile = io.StringIO(csv_content)
    reader = csv.DictReader(csvfile)
    
    # Get the first column name (timestamp column)
    fieldnames = reader.fieldnames
    if not fieldnames:
        raise ValueError("CSV file has no headers")
    
    timestamp_column = fieldnames[0]  # First column
    
    for row in reader:
        # Get timestamp from first column
        timestamp = row.get(timestamp_column, "").strip()
        
        thrower = row.get("Passer", "").strip()
        receiver = row.get("Receiver", "").strip()
        defender = row.get("Defender", "").strip()
        action = row.get("Action", "").strip()
        tournament = row.get("Tournamemnt", "").strip()  # Note: typo in CSV column name
        opponent = row.get("Opponent", "").strip()
        
        # Skip empty values
        if not tournament or not opponent:
            continue
        
        # Store timestamp for this game (tournament + opponent)
        game_key = f"{tournament}|{opponent}"
        if timestamp and game_key not in game_timestamps:
            game_timestamps[game_key] = timestamp
        
        # Helper function to initialize player stats if needed
        def init_player_stats(p_name: str):
            """Initialize stats structure for a player if not already present."""
            if p_name not in stats:
                stats[p_name] = defaultdict(lambda: defaultdict(lambda: {
                    "goals": 0,
                    "assists": 0,
                    "drops": 0,
                    "throwaways": 0,
                    "ds": 0,
                    "timestamp": None
                }))
            
            if tournament not in stats[p_name]:
                stats[p_name][tournament] = defaultdict(lambda: {
                    "goals": 0,
                    "assists": 0,
                    "drops": 0,
                    "throwaways": 0,
                    "ds": 0,
                    "timestamp": None
                })
            
            if opponent not in stats[p_name][tournament]:
                stats[p_name][tournament][opponent] = {
                    "goals": 0,
                    "assists": 0,
                    "drops": 0,
                    "throwaways": 0,
                    "ds": 0,
                    "timestamp": None
                }
            
        # Process actions
        if action == "Goal":
            if should_track_player(thrower):
                init_player_stats(thrower)
                stats[thrower][tournament][opponent]["assists"] += 1
            
            if should_track_player(receiver):
                init_player_stats(receiver)
                stats[receiver][tournament][opponent]["goals"] += 1
        
        elif action == "D":
            if should_track_player(defender):
                init_player_stats(defender)
                stats[defender][tournament][opponent]["ds"] += 1
        
        elif action == "Throwaway":
            if should_track_player(thrower):
                init_player_stats(thrower)
                stats[thrower][tournament][opponent]["throwaways"] += 1
        
        elif action == "Drop":
            if should_track_player(receiver):
                init_player_stats(receiver)
                stats[receiver][tournament][opponent]["drops"] += 1
        
        # Track which players played in each game (for games with 0 stats)
        for i in range(7):
            player_col = f"Player {i}"
            player_name = row.get(player_col, "").strip()
            
            if should_track_player(player_name):
                init_player_stats(player_name)
    
    # Set timestamps for all games using the stored game timestamps
    for player_name, tournaments in stats.items():
        for tournament, opponents in tournaments.items():
            for opponent, player_stats in opponents.items():
                game_key = f"{tournament}|{opponent}"
                if game_key in game_timestamps:
                    player_stats["timestamp"] = game_timestamps[game_key]
    
    # Convert stats structure to list of records matching database schema
    records = []
    for player_name, tournaments in stats.items():
        for tournament, opponents in tournaments.items():
            for opponent, player_stats in opponents.items():
                # Include all records, even if stats are all zero (player played but had no stats)
                record = {
                    "timestamp": player_stats["timestamp"] or "",
                    "player_name": player_name,
                    "game_played": opponent,  # Using opponent as game identifier
                    "tournament_played": tournament,
                    "goals": player_stats["goals"],
                    "assists": player_stats["assists"],
                    "drops": player_stats["drops"],
                    "throwaways": player_stats["throwaways"],
                    "ds": player_stats["ds"]
                }
                records.append(record)
    
    return records


def upload_player_stats(stats_data: Union[Dict[str, Any], List[Dict[str, Any]]]) -> bool:
    """
    Uploads player statistics to the Supabase 'player_stats' table.
    
    This function clears all existing records from the table and then inserts
    the new data. This is intended for uploading an entire year's worth of stats
    at once.
    
    Expected dictionary fields:
    - timestamp: Timestamp from CSV (string or datetime)
    - player_name: Player's name (string)
    - game_played: Name of the game (string)
    - tournament_played: Name of the tournament (string)
    - goals: Number of goals (integer)
    - assists: Number of assists (integer)
    - drops: Number of drops (integer)
    - throwaways: Number of throwaways (integer)
    - ds: Number of defensive stops (integer)
    
    Args:
        stats_data: Single dictionary or list of dictionaries containing player statistics data
        
    Returns:
        bool: True if upload was successful, False otherwise
    """
    try:
        supabase = get_supabase_client()
        
        # Convert single dict to list for consistent processing
        if isinstance(stats_data, dict):
            stats_list = [stats_data]
        else:
            stats_list = stats_data
        
        if not stats_list:
            print("No data to upload")
            return False
        
        # Clear all existing records from the table
        print("Clearing existing records from 'player_stats' table...")
        # Delete all records by matching all IDs (all IDs will be >= 0)
        delete_response = supabase.table("player_stats").delete().gte("id", 0).execute()
        print(f"Cleared existing records")
        
        # Batch upload: Supabase allows maximum 1000 rows per insert
        BATCH_SIZE = 1000
        total_records = len(stats_list)
        total_uploaded = 0
        
        print(f"Inserting {total_records} records into 'player_stats' table in batches of {BATCH_SIZE}...")
        
        # Split into batches
        for i in range(0, total_records, BATCH_SIZE):
            batch = stats_list[i:i + BATCH_SIZE]
            batch_num = (i // BATCH_SIZE) + 1
            total_batches = (total_records + BATCH_SIZE - 1) // BATCH_SIZE
            
            try:
                print(f"Uploading batch {batch_num}/{total_batches} ({len(batch)} records)...")
                response = supabase.table("player_stats").insert(batch).execute()
                
                if response.data:
                    uploaded_count = len(response.data)
                    total_uploaded += uploaded_count
                    print(f"  Successfully uploaded {uploaded_count} records (Total: {total_uploaded}/{total_records})")
                else:
                    print(f"  Batch {batch_num} completed but no data returned")
                    return False
                    
            except Exception as e:
                print(f"  Error uploading batch {batch_num}: {str(e)}")
                return False
        
        if total_uploaded == total_records:
            print(f"\nSuccessfully uploaded all {total_uploaded} player stats records")
            return True
        else:
            print(f"\nWarning: Expected {total_records} records but uploaded {total_uploaded}")
            return False
            
    except Exception as e:
        print(f"Error uploading player stats: {str(e)}")
        return False


def get_team_configs() -> List[Dict[str, str]]:
    """
    Gets team configurations from environment variables.
    Looks for environment variables in the format: {TEAM_NAME}_EXPORT_URL
    
    Example: AUBURN_EXPORT_URL=https://example.com/auburn.csv
    
    Returns:
        List of dictionaries with 'team_name' and 'csv_url' keys
    """
    team_configs = []
    
    # Get all environment variables
    for key, value in os.environ.items():
        if key.endswith("_EXPORT_URL") and value:
            # Extract team name from env var name (e.g., "AUBURN_EXPORT_URL" -> "AUBURN")
            team_name = key.replace("_EXPORT_URL", "")
            team_configs.append({
                "team_name": team_name,
                "csv_url": value
            })
    
    return team_configs


def main():
    """
    Main function to calculate and upload player statistics from CSV URLs to the player_stats table.
    The table will be cleared before inserting new records.
    
    Configuration:
    - Set environment variables in .env.backend file: {TEAM_NAME}_EXPORT_URL=https://...
    - Example: AUBURN_EXPORT_URL=https://example.com/auburn.csv
    
    The script will automatically discover all players from the CSV files.
    If you want to filter to specific players only, you can optionally provide a players_dict.
    """
    # Optional: Dictionary to filter specific players if needed
    # If None or empty, all players found in CSV will be tracked
    # Format: {team_name: {player1: {}, player2: {}, ...}}
    players_dict = None  # Set to None to track all players, or provide dict to filter
    
    # Get team configurations from environment variables
    team_configs = get_team_configs()
    
    if not team_configs:
        print("No team export URLs found in environment variables.")
        print("Please add {TEAM_NAME}_EXPORT_URL variables to .env.backend file")
        print("Example: AUBURN_EXPORT_URL=https://example.com/auburn.csv")
        sys.exit(1)
    
    all_stats_records = []
    
    # Process each team
    for config in team_configs:
        team_name = config["team_name"]
        csv_url = config["csv_url"]
        
        print(f"\nProcessing team: {team_name}")
        print(f"Downloading CSV from: {csv_url}")
        
        try:
            # Download CSV content
            csv_content = download_csv_from_url(csv_url)
            print(f"Downloaded CSV ({len(csv_content)} characters)")
            
            # Calculate stats from CSV (auto-discovers players)
            stats_records = calculate_player_stats_from_csv(csv_content, team_name, players_dict)
            print(f"Calculated stats for {len(stats_records)} player-game records")
            
            all_stats_records.extend(stats_records)
            
        except Exception as e:
            print(f"Error processing team {team_name}: {str(e)}")
            print(f"Skipping team {team_name} and continuing with other teams...")
            continue
    
    if not all_stats_records:
        print("\nNo stats records found. Please check your CSV URLs and players_dict.")
        sys.exit(1)
    
    print(f"\nTotal records to upload: {len(all_stats_records)}")
    
    # Upload to Supabase
    print("Uploading player stats to 'player_stats' table...")
    success = upload_player_stats(all_stats_records)
    
    if success:
        print("Upload completed successfully!")
    else:
        print("Upload failed. Please check the error messages above.")
        sys.exit(1)


if __name__ == "__main__":
    main()

