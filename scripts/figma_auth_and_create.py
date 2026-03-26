#!/usr/bin/env python3
"""
One-shot Figma OAuth2 auth then create Spotter App Store Screenshots file.
Corrects the redirect URI port mismatch in the existing oauth_flow.py.
"""
import json, sys, os, time, hashlib, base64, secrets, socket, threading, webbrowser
import urllib.request, urllib.error, urllib.parse
from pathlib import Path

VAULT_DIR = Path.home() / ".openclaw" / "vault"
TOKEN_FILE_ENC = VAULT_DIR / "figma-oauth-token.json.enc"
CONFIG_FILE = VAULT_DIR / "figma-oauth-config.json"
Figma_API_Base = "https://api.figma.com/v1"
Figma_Auth_Base = "https://www.figma.com/oauth"
REDIRECT_URI = "http://localhost:7777/oauth/callback"  # Fixed: was 7778 in oauth_flow.py

# Encryption
def _get_vault_key():
    instance_key_path = Path.home() / ".openclaw" / ".instance_key"
    if instance_key_path.exists():
        raw = instance_key_path.read_text().strip()
        return hashlib.sha256(raw.encode()).digest()[:32]
    import uuid
    machine_id = uuid.getnode()
    return hashlib.sha256(f"{machine_id}-{os.environ.get('USER','unknown')}-figma-mcp-v2".encode()).digest()[:32]

def _xor_crypt(data: str, key: bytes, decrypt=False):
    b64d = base64.b64decode(data.encode()) if decrypt else data.encode()
    if decrypt:
        b64d = base64.b64decode(data.encode())
    else:
        raw = data.encode()
    result = bytearray()
    for i, c in enumerate(b64d):
        result.append(c ^ key[i % len(key)])
    return bytes(result).decode() if decrypt else base64.b64encode(bytes(result)).decode()

def _vault_read():
    if not TOKEN_FILE_ENC.exists():
        return None
    try:
        key = _get_vault_key()
        encrypted = TOKEN_FILE_ENC.read_text().strip()
        decrypted = _xor_crypt(encrypted, key, decrypt=True)
        return json.loads(decrypted)
    except Exception as e:
        print(f"Vault read error: {e}")
        return None

def _vault_write(data):
    VAULT_DIR.mkdir(parents=True, exist_ok=True)
    key = _get_vault_key()
    raw = json.dumps(data)
    encrypted = _xor_crypt(raw, key)
    TOKEN_FILE_ENC.write_text(encrypted)
    os.chmod(TOKEN_FILE_ENC, 0o600)

# PKCE
def pkce_pair():
    verifier = secrets.token_urlsafe(64)[:128]
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    return verifier, challenge

# Callback server
class CallbackServer:
    def __init__(self, port=7777):
        self.port = port
        self.auth_code = None
        self.error = None
        self._stop = threading.Event()
        self._srv = None

    def start(self):
        threading.Thread(target=self._run, daemon=True).start()
        time.sleep(0.3)

    def _run(self):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind(("127.0.0.1", self.port))
        s.listen(1)
        s.settimeout(5.0)
        self._srv = s
        while not self._stop.is_set():
            try:
                conn, _ = s.accept()
                self._handle(conn)
            except socket.timeout:
                continue
            except Exception:
                break

    def _handle(self, conn):
        try:
            data = conn.recv(4096)
            if not data:
                return
            req_line = data.decode("utf-8", errors="ignore").split("\r\n")[0]
            if req_line.startswith("GET /"):
                query = req_line.split(" ", 2)[1]
                self._respond(conn, query)
        finally:
            try: conn.close()
            except: pass

    def _respond(self, conn, query):
        params = {}
        for pair in query.split("&"):
            if "=" in pair:
                k, v = pair.split("=", 1)
                params[urllib.parse.unquote(k)] = urllib.parse.unquote(v)
        if "error" in params:
            self.error = params.get("error_description", params["error"])
            self._send(conn, 400, f"Error: {self.error}")
            return
        code = params.get("code", "")
        if code:
            self.auth_code = code
            self._send(conn, 200, "Authorization complete! Return to terminal.")
        else:
            self._send(conn, 400, "No code")

    def _send(self, conn, status, body):
        resp = (f"HTTP/1.1 {status} OK\r\nContent-Type: text/plain\r\n"
                f"Content-Length: {len(body.encode())}\r\n\r\n{body}")
        conn.sendall(resp.encode())

    def wait(self, timeout=120.0):
        start = time.time()
        while time.time() - start < timeout:
            if self.auth_code: self._stop.set(); return self.auth_code
            if self.error: self._stop.set(); raise RuntimeError(f"OAuth error: {self.error}")
            time.sleep(0.1)
        self._stop.set()
        raise TimeoutError("OAuth callback timed out")

# Token exchange & refresh
def exchange_code(client_id, client_secret, code, verifier):
    data = {"client_id": client_id, "client_secret": client_secret,
            "redirect_uri": REDIRECT_URI, "code": code, "code_verifier": verifier,
            "grant_type": "authorization_code"}
    req = urllib.request.Request(f"{Figma_Auth_Base}/token",
        data=urllib.parse.urlencode(data).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())

def refresh_token(client_id, client_secret, refresh):
    data = {"client_id": client_id, "client_secret": client_secret,
            "refresh_token": refresh, "grant_type": "refresh_token"}
    req = urllib.request.Request(f"{Figma_Auth_Base}/refresh",
        data=urllib.parse.urlencode(data).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())

# Get valid access token
def get_access_token():
    config = json.loads(CONFIG_FILE.read_text())
    client_id = config["client_id"]
    client_secret = config["client_secret"]
    
    token_data = _vault_read()
    if token_data:
        access = token_data.get("access_token","")
        refresh = token_data.get("refresh_token","")
        expires_in = token_data.get("expires_in", 0)
        issued_at = token_data.get("issued_at", 0)
        if access and issued_at + expires_in - 60 > time.time():
            return access, refresh
    
    # Need to authenticate
    print("No valid token — starting OAuth2 flow...")
    verifier, challenge = pkce_pair()
    
    auth_url = (f"{Figma_Auth_Base}/authorize"
                f"?client_id={client_id}&redirect_uri={urllib.parse.quote(REDIRECT_URI)}"
                f"&scope=file_read file_write project_read project_write"
                f"&state={secrets.token_urlsafe(16)}&code_challenge={challenge}"
                f"&code_challenge_method=S256&response_type=code")
    
    server = CallbackServer(port=7777)
    server.start()
    print(f"\n🔗 Opening browser for Figma authorization...")
    print(f"   (If browser doesn't open, visit: {auth_url})\n")
    webbrowser.open(auth_url)
    print("Waiting for callback (120s timeout)...")
    
    try:
        code = server.wait(120.0)
        print("Received code — exchanging for tokens...")
        resp = exchange_code(client_id, client_secret, code, verifier)
        issued_at = int(time.time())
        token_data = {
            "access_token": resp["access_token"],
            "refresh_token": resp.get("refresh_token",""),
            "expires_in": resp.get("expires_in", 3600),
            "issued_at": issued_at,
        }
        _vault_write(token_data)
        print("✓ Tokens saved to vault")
        return token_data["access_token"], token_data["refresh_token"]
    finally:
        server._stop.set()

def figma_get(path, params=None):
    token, _ = get_access_token()
    url = Figma_API_Base + path
    if params:
        url = f"{url}?{'&'.join(f'{urllib.parse.quote(str(k))}={urllib.parse.quote(str(v))}' for k,v in params.items())}"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())

def figma_post(path, data):
    token, _ = get_access_token()
    body = json.dumps(data).encode()
    req = urllib.request.Request(Figma_API_Base + path, data=body, headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body2 = e.read().decode() if e.fp else ""
        raise RuntimeError(f"Figma API {e.code}: {body2}")

def main():
    print("=" * 60)
    print("Spotter App Store Screenshots — Figma File Creator")
    print("=" * 60)
    
    # Create file
    print("\n[1/2] Creating Figma file...")
    result = figma_post("/files", {
        "name": "Spotter App Store Screenshots",
        "description": ("6 App Store screenshot frames for Spotter iOS submission. "
                       "Design anchored to code in apps/mobile/src/. "
                       "Spec: SPOTTER-DESIGN-001.md. Created by Batcave Fox agent.")
    })
    
    file_key = result.get("key", "")
    edit_url = result.get("edit_url", f"https://www.figma.com/file/{file_key}")
    
    if not file_key:
        print(f"ERROR: {result}")
        sys.exit(1)
    
    print(f"  ✓ File key: {file_key}")
    print(f"  ✓ Edit URL: {edit_url}")
    
    # Add comment with full spec
    print("\n[2/2] Adding design specification comment...")
    
    spec = """
🚨 SPOTTER APP STORE SCREENSHOTS — DESIGN SPECIFICATION
Source: SPOTTER-DESIGN-001.md (code-anchored)
Agent: Batcave Fox | 2026-03-25

⚠️  NOTE: Figma's public REST API cannot create nodes (frames, shapes, text).
    This file was created empty. Build the 6 frames manually in Figma using
    the specs below, referencing ~/Documents/Spotter/apps/mobile/src/

---

FRAME 1 — Home/Discovery (430 × 932 px, iPhone 15 Pro Max)
Background: #f6f9fc | Header: white | Border: #d9e2ec
Title: "Discover Golfers" 24px 800wt #102a43
Subtitle: "Find golfers in your tier" 14px #334e68
Golfer card (white, radius 10, shadow #0b3a53@8% offset(0,6)blur14):
  - Avatar: 56×56 circle, #0b3a53 bg, white initial letter 24px bold
  - Name: 16px 700wt #102a43
  - Location: 13px #334e68
  - TierBadge sm: FREE=#eaf2f8/#334e68, SELECT=#fef3c7/#92400e, SUMMIT=#fef9c3/#854d0e
  - Compatibility score: 24px 800wt #0b3a53 | "Match" label 11px uppercase #627d98
  - TrustBadge icons: 32×32 pill circles with badge colors @15% fill (⛳✓🕐🤝★)
  - Button "Connect": #0b3a53 bg, white text 14px 600wt

FRAME 2 — Match/Lobby (430 × 932 px)
Header: "Your Matches" 24px 800wt #102a43
Match card:
  - Avatar: 48×48 circle, #0b3a53 bg
  - Name: 16px 700wt #102a43 | Location: 13px #334e68
  - Compatibility circle: 56×56, 3px border
    Tier colors: excellent=#059669, good=#0891b2, fair=#d97706
  - Stats row: Handicap / Mutual / Distance (10px uppercase labels, 16px bold values)
  - "Request Introduction" button: #0b3a53 bg white

FRAME 3 — Scorecard/Round (430 × 932 px)
Background: #f6f9fc
Round info card: white bg radius 10
Score rows: 14px text #102a43, totals bold 16px
Par cells: #2f855a (under par), #c53030 (over par), #334e68 (par)

FRAME 4 — Social/Feed (430 × 932 px)
Background: #f6f9fc
Post card: white bg radius 10
Avatar: 40×40 circle | Name: 14px 600wt | Timestamp: 12px #627d98
Content: 14px #102a43 | Action row: #0b3a53 icons
TrustBadgeDisplay lg: 16px icon + 13px text

FRAME 5 — Rounds UI (430 × 932 px)
Background: #f6f9fc
Header: "Rounds" 24px 800wt #102a43
Round card: white bg radius 10 shadow
  - Course name: 16px 700wt #102a43
  - Date/time: 14px #334e68
  - Attendee avatars: 32×32 circles
  - Status badge: Confirmed=#2f855a/#ffffff, Pending=#b7791f/#ffffff
  - "Join Round" button: #0b3a53

FRAME 6 — Golf Course Directory (430 × 932 px)
Background: #f6f9fc
Search bar: #eaf2f8 bg, #d9e2ec border, radius 14px, placeholder 14px #627d98
Course card: white bg radius 10
  - Course name: 16px 700wt #102a43
  - Location: 13px #334e68
  - Stars: #eab308
  - "Book" button: #0b3a53

---

COLOR TOKENS (Light Mode)
background=#f6f9fc | surface=#ffffff | border=#d9e2ec | borderStrong=#bcccdc
text=#102a43 | textSecondary=#334e68 | textMuted=#627d98
primary=#0b3a53 | success=#2f855a | warning=#b7791f | danger=#c53030

TIER BADGE COLORS
FREE:   bg=#eaf2f8 text=#334e68 border=#bcccdc
SELECT: bg=#fef3c7 text=#92400e border=#fcd34d
SUMMIT: bg=#fef9c3 text=#854d0e border=#fde047

TRUST BADGE COLORS & ICONS
first_round=#22c55e⛳ | reliable_player=#3b82f6✓ | punctual=#8b5cf6🕐
social_connector=#f59e0b🤝 | community_vouched=#ec4899★
regular=#14b8a6🔄 | veteran=#6366f1🏆 | exceptional=#eab308👑 | vouch_giver=#06b6d4🎁

TYPOGRAPHY: Display=System(iOS) | Body=System | Tier=800wt 0.5ls
SPACING: xs=6 sm=10 md=14 lg=18 xl=24 xxl=32px
RADIUS: sm=10 md=14 lg=18 pill=999px
SHADOW: #0b3a53@8% offset(0,6) blur14

Source: ~/Documents/Spotter/apps/mobile/src/
Spec: ~/Documents/Batcave/docs/batcave/designs/SPOTTER-DESIGN-001.md
App Store: ~/Documents/Spotter/docs/app-store/APP_STORE_iOS.md
""".strip()

    comment_result = figma_post(f"/files/{file_key}/comments", {"message": spec})
    print(f"  ✓ Comment added")
    
    # Save
    output = {"file_key": file_key, "edit_url": edit_url, "name": "Spotter App Store Screenshots"}
    out_path = Path.home() / "Documents" / "Spotter" / "docs" / "app-store" / "FIGMA-FILE.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2))
    
    print(f"\n✅ Done! Edit URL: {edit_url}")
    print(f"   File key: {file_key}")
    return output

if __name__ == "__main__":
    main()
