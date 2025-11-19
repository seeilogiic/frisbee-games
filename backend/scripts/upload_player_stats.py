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
from typing import Dict, Any, List, Union

# Add the root directory (frisbee-games) to the path to import utils
# This allows the script to be run from the root directory
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
root_dir = os.path.dirname(backend_dir)
sys.path.insert(0, root_dir)

from backend.scripts.utils.supabase_client import get_supabase_client


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
        
        # Insert all new records in a batch
        print(f"Inserting {len(stats_list)} records into 'player_stats' table...")
        response = supabase.table("player_stats").insert(stats_list).execute()
        
        if response.data:
            print(f"Successfully uploaded {len(response.data)} player stats records")
            return True
        else:
            print("Upload completed but no data returned")
            return False
            
    except Exception as e:
        print(f"Error uploading player stats: {str(e)}")
        return False


def main():
    """
    Main function to upload player statistics to the player_stats table.
    The table will be cleared before inserting new records.
    """
    # Example list of dictionaries (representing a year's worth of stats)
    example_stats = [
        {
            "timestamp": "2024-01-15T10:30:00Z",
            "player_name": "John Doe",
            "game_played": "Game 1",
            "tournament_played": "Spring Tournament 2024",
            "goals": 5,
            "assists": 3,
            "drops": 1,
            "throwaways": 2,
            "ds": 1
        },
        {
            "timestamp": "2024-01-22T14:00:00Z",
            "player_name": "Jane Smith",
            "game_played": "Game 2",
            "tournament_played": "Spring Tournament 2024",
            "goals": 3,
            "assists": 5,
            "drops": 0,
            "throwaways": 1,
            "ds": 2
        }
    ]
    
    print("Uploading player stats to 'player_stats' table...")
    success = upload_player_stats(example_stats)
    
    if success:
        print("Upload completed successfully!")
    else:
        print("Upload failed. Please check the error messages above.")
        sys.exit(1)


if __name__ == "__main__":
    main()

