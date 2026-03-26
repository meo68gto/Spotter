#!/usr/bin/env python3
"""
Create the Spotter App Store Screenshots Figma file.
Uses Figma OAuth2 API to create the file and add a comment with all design specs.
Note: Figma's public REST API does not support programmatic node creation
(frames, rectangles, text). This creates the empty file and documents the spec.
"""
import json
import sys
import os
import time
import hashlib
import base64
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
VAULT_DIR = Path.home() / ".openclaw" / "vault"
TOKEN_FILE_ENC = VAULT_DIR / "figma-oauth-token.json.enc"
CONFIG_FILE = VAULT_DIR / "figma-oauth-config.json"
Figma_API_Base = "https://api.figma.com/v1"
Figma_Auth_Base = "https://www.figma.com/oauth"
REDIRECT_URI = "http://localhost:7777/oauth/callback"

# ---------------------------------------------------------------------------
# Encryption (vault token storage)
# ---------------------------------------------------------------------------
def _get_vault_key() -> bytes:
    instance_key_path = Path.home() / ".openclaw" / ".instance_key"
    if instance_key_path.exists():
        raw = instance_key_path.read_text().strip()
        return hashlib.sha256(raw.encode()).digest()[:32]
    import uuid
    machine_id = uuid.getnode()
    raw = f"{machine_id}-{os.environ.get('USER', 'unknown')}-figma-mcp-v2"
    return hashlib.sha256(raw.encode()).digest()[:32]

def _xor_decrypt(data: str, key: bytes) -> str:
    raw = base64.b64decode(data.encode())
    result = bytearray()
    for i, c in enumerate(raw):
        result.append(c ^ key[i % len(key)])
    return result.decode()

def _vault_read_encrypted(path: Path):
    if not path.exists():
        return None
    try:
        key = _get_vault_key()
        encrypted = path.read_text().strip()
        decrypted = _xor_decrypt(encrypted, key)
        return json.loads(decrypted)
    except Exception as e:
        print(f"Vault read error: {e}")
        return None

# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------
def refresh_access_token(client_id: str, client_secret: str, refresh_token: str) -> dict:
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    req = urllib.request.Request(
        f"{Figma_Auth_Base}/refresh",
        data=urllib.parse.urlencode(data).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())

def _vault_write_encrypted(path: Path, data: dict) -> None:
    VAULT_DIR.mkdir(parents=True, exist_ok=True)
    key = _get_vault_key()
    raw = json.dumps(data)
    result = bytearray()
    for i, c in enumerate(raw.encode()):
        result.append(c ^ key[i % len(key)])
    encrypted = base64.b64encode(bytes(result)).decode()
    path.write_text(encrypted)
    os.chmod(path, 0o600)

# ---------------------------------------------------------------------------
# Get valid access token
# ---------------------------------------------------------------------------
def get_access_token() -> tuple[str, str]:
    config_data = json.loads(CONFIG_FILE.read_text())
    client_id = config_data["client_id"]
    client_secret = config_data["client_secret"]
    
    token_data = _vault_read_encrypted(TOKEN_FILE_ENC)
    if not token_data:
        raise RuntimeError("No OAuth token found. Run oauth_flow.py first.")
    
    access_token = token_data.get("access_token", "")
    refresh_token = token_data.get("refresh_token", "")
    expires_in = token_data.get("expires_in", 0)
    issued_at = token_data.get("issued_at", 0)
    
    # Check if still valid (60s buffer)
    if issued_at + expires_in - 60 > time.time():
        return access_token, refresh_token
    
    # Expired — refresh
    print("Token expired, refreshing...", file=sys.stderr)
    new_token = refresh_access_token(client_id, client_secret, refresh_token)
    issued_at = int(time.time())
    token_data = {
        "access_token": new_token["access_token"],
        "refresh_token": new_token.get("refresh_token", refresh_token),
        "expires_in": new_token.get("expires_in", 3600),
        "issued_at": issued_at,
    }
    _vault_write_encrypted(TOKEN_FILE_ENC, token_data)
    return token_data["access_token"], token_data["refresh_token"]

# ---------------------------------------------------------------------------
# Figma API helpers
# ---------------------------------------------------------------------------
def figma_get(path: str, params: dict = None) -> dict:
    token, _ = get_access_token()
    url = Figma_API_Base + path
    if params:
        qs = "&".join(f"{urllib.parse.quote(str(k))}={urllib.parse.quote(str(v))}" for k, v in params.items())
        url = f"{url}?{qs}"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        raise RuntimeError(f"Figma API error {e.code}: {body}")

def figma_post(path: str, data: dict) -> dict:
    token, _ = get_access_token()
    url = Figma_API_Base + path
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        url, data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        raise RuntimeError(f"Figma API error {e.code}: {body}")

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=" * 60)
    print("Creating Spotter App Store Screenshots Figma File")
    print("=" * 60)
    
    # Step 1: Create the file
    print("\n[1/2] Creating Figma file...")
    result = figma_post("/files", {
        "name": "Spotter App Store Screenshots",
        "description": "6 App Store screenshot frames for Spotter iOS submission. Code-anchored design from SPOTTER-DESIGN-001.md. Created by Batcave Fox agent."
    })
    
    file_key = result.get("key", "")
    edit_url = result.get("edit_url", "")
    
    if not file_key:
        print(f"ERROR: File creation failed: {result}")
        sys.exit(1)
    
    print(f"  File key: {file_key}")
    print(f"  Edit URL: {edit_url}")
    
    # Step 2: Add a comment with the full design spec
    print("\n[2/2] Adding design specification comment...")
    
    spec_comment = """
🚨 SPOTTER APP STORE SCREENSHOTS — DESIGN SPECIFICATION
Source: SPOTTER-DESIGN-001.md (code-anchored)
Generated by: Batcave Fox agent | 2026-03-25

⚠️  Figma's public REST API does not support programmatic node creation.
    This file was created empty. Please build the 6 frames manually using
    the specifications below, OR use Figma's UI to create frames matching
    the implemented code in ~/Documents/Spotter/apps/mobile/src/

---

SCREEN 1 — Home/Discovery (iPhone 15 Pro Max: 430 × 932)
─────────────────────────────────────────────────────────
Background: #f6f9fc
Card surface: #ffffff
Card border: #d9e2ec, radius 10px, shadow #0b3a53 @ 8% opacity, offset(0,6) blur14
Header: "Discover Golfers" 24px bold #102a43
Subtitle: "Find golfers in your tier" 14px #334e68

Golfer card:
  - Avatar: 56×56 circle, navy600 (#0b3a53) placeholder with initial letter white bold 24px
  - Name: 16px bold #102a43
  - Location: 13px #334e68
  - TierBadge (size sm): FREE=#eaf2f8/#334e68, SELECT=#fef3c7/#92400e, SUMMIT=#fef9c3/#854d0e
  - Compatibility score: 24px bold #0b3a53
  - "Match" label: 11px uppercase #627d98
  - TrustBadgeCompact: 32×32 pill icons (⛳✓🕐🤝★) with ~8% opacity fill
  - Button "Connect": navy600 background, white text

SCREEN 2 — Match/Lobby (430 × 932)
───────────────────────────────────
Header: "Your Matches" 24px bold #102a43
Subtitle: "Top compatible golfers" 14px #334e68

Match card (same card style):
  - Avatar: 48×48 circle, navy600 placeholder
  - Name: 16px bold #102a43
  - Location: 13px #334e68
  - Compatibility score circle: 56×56, 3px border in tier color
    - excellent=#059669, good=#0891b2, fair=#d97706
  - Stats row: Handicap / Mutual / Distance
  - "Request Introduction" button

SCREEN 3 — Scorecard/Round (430 × 932)
───────────────────────────────────────
Background: #f6f9fc
Header: "Scorecard" 24px bold #102a43
Round info card: white bg, radius 10px
Score rows: player name, hole-by-hole scores, total
Par indicators: green for under par, red for over par

SCREEN 4 — Social/Feed (430 × 932)
───────────────────────────────────
Background: #f6f9fc
Feed cards: white bg, radius 10px
Post content: avatar, name, content text, timestamp
Action buttons: Like, Comment, Share (navy600 icons)
Badge display: TrustBadgeDisplay at lg size

SCREEN 5 — Rounds UI (430 × 932)
─────────────────────────────────
Header: "Rounds" 24px bold #102a43
Round scheduling cards:
  - Course name: 16px bold #102a43
  - Date/time: 14px #334e68
  - Attendees: avatar stack (32×32 circles)
  - Status badge: Confirmed=#2f855a, Pending=#b7791f
  - "Join Round" CTA button

SCREEN 6 — Golf Course Directory (430 × 932)
───────────────────────────────────────────────
Header: "Courses" 24px bold #102a43
Search bar: #eaf2f8 bg, #d9e2ec border, radius 14px
Course card:
  - Course name: 16px bold #102a43
  - Location: 13px #334e68
  - Rating: star icons in #eab308
  - "Book" button
Course list OR map view toggle

---

COLOR TOKENS (Light Mode)
─────────────────────────────────────────────────────────
background:    #f6f9fc
surface:       #ffffff
border:        #d9e2ec
borderStrong:  #bcccdc
text:          #102a43
textSecondary: #334e68
textMuted:     #627d98
primary:       #0b3a53  (navy600)
success:       #2f855a
warning:       #b7791f
danger:        #c53030

TIER BADGE COLORS
─────────────────────────────────────────────────────────
FREE:   bg=#eaf2f8, text=#334e68, border=#bcccdc
SELECT: bg=#fef3c7, text=#92400e, border=#fcd34d
SUMMIT: bg=#fef9c3, text=#854d0e, border=#fde047

TRUST BADGE COLORS
─────────────────────────────────────────────────────────
first_round:         #22c55e (⛳)
reliable_player:      #3b82f6 (✓)
punctual:             #8b5cf6 (🕐)
social_connector:     #f59e0b (🤝)
community_vouched:    #ec4899 (★)
regular:              #14b8a6 (🔄)
veteran:              #6366f1 (🏆)
exceptional:          #eab308 (👑)
vouch_giver:          #06b6d4 (🎁)

TYPOGRAPHY
─────────────────────────────────────────────────────────
Display font: System (iOS) | Avenir Next (web)
Body font:    System (iOS) | Avenir (web)
Tier label:   800 weight, 0.5 letter-spacing
Badge name:   600 weight
Heading 24px bold / 16px bold / 14px semibold
Caption:      11px uppercase

SPACING & RADIUS
─────────────────────────────────────────────────────────
Spacing: xs=6, sm=10, md=14, lg=18, xl=24, xxl=32 px
Radius:  sm=10, md=14, lg=18, pill=999 px
Shadow:  #0b3a53 @ 8%, offset(0,6), blur14, elevation 2

Source code: ~/Documents/Spotter/apps/mobile/src/
Design spec: ~/Documents/Batcave/docs/batcave/designs/SPOTTER-DESIGN-001.md
App Store spec: ~/Documents/Spotter/docs/app-store/APP_STORE_iOS.md
""".strip()

    comment_result = figma_post(f"/files/{file_key}/comments", {"message": spec_comment})
    print(f"  Comment added: {comment_result.get('id', 'unknown')}")
    
    # Save result
    output = {
        "file_key": file_key,
        "edit_url": edit_url,
        "name": "Spotter App Store Screenshots",
    }
    
    output_path = Path.home() / "Documents" / "Spotter" / "docs" / "app-store" / "FIGMA-FILE.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, indent=2))
    print(f"\n✅ File created!")
    print(f"   Edit URL: {edit_url}")
    print(f"   File key: {file_key}")
    print(f"   Spec saved: {output_path}")
    
    return output

if __name__ == "__main__":
    main()
