"""
Supabase client utility for connecting to Supabase database.
"""
import os
from supabase import create_client, Client
from typing import Optional

# Try to load environment variables from .env.backend file if available
try:
    from dotenv import load_dotenv
    # Get the backend directory path
    # This file is in backend/scripts/utils/, so go up 3 levels to get backend/
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    # Load .env.backend from backend directory
    env_path = os.path.join(backend_dir, '.env.backend')
    load_dotenv(env_path)
except ImportError:
    # python-dotenv not installed, skip loading .env file
    pass


def get_supabase_client() -> Optional[Client]:
    """
    Creates and returns a Supabase client instance.
    
    Requires environment variables:
    - SUPABASE_URL: Your Supabase project URL
    - SUPABASE_KEY: Your Supabase service role key (required to bypass RLS)
    
    Note: The service role key bypasses Row Level Security (RLS), allowing
    the script to insert/update/delete data even when RLS is enabled on tables.
    This is the intended behavior - only this script should be able to modify
    player_stats data.
    
    Returns:
        Client: Supabase client instance, or None if credentials are missing
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError(
            "Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_KEY environment variables."
        )
    
    return create_client(supabase_url, supabase_key)

