#!/usr/bin/env python3
"""
Vault helpers for golf course import.
Decrypts service key from .vault/ using master password from macOS keychain.
"""
from pathlib import Path
import subprocess
import sys

VAULT_DIR = Path(__file__).parent.parent.parent / ".vault"
ENC_FILE = VAULT_DIR / "supabase-service.key.enc"
KEYCHAIN_ACCOUNT = "batcave-golf-vault"
KEYCHAIN_SERVICE = "master"

def get_master_password():
    """Retrieve master password from macOS keychain."""
    result = subprocess.run(
        ["security", "find-generic-password", "-s", KEYCHAIN_ACCOUNT, "-a", KEYCHAIN_SERVICE, "-w"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"Keychain lookup failed: {result.stderr.strip()}")
    return result.stdout.strip()

def get_service_key():
    """Decrypt and return the Supabase service role key."""
    if not ENC_FILE.exists():
        raise FileNotFoundError(f"Encrypted key not found: {ENC_FILE}")

    master_pass = get_master_password()
    result = subprocess.run(
        ["openssl", "enc", "-aes-256-cbc", "-pbkdf2", "-d", "-pass", f"pass:{master_pass}"],
        input=ENC_FILE.read_bytes(),
        capture_output=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"Decryption failed: {result.stderr.decode()}")
    return result.stdout.decode().strip()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: vault_helpers.py get-service-key")
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "get-service-key":
        print(get_service_key())
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
