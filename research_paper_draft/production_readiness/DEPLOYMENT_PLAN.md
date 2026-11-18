# Production Deployment Plan & Operations Guide
**Project:** Local College Intelligence ("C-GPT")  
**Target Architecture:** Single-Node On-Premises Departmental Server with Local LAN Access  
**Target Operating System:** Ubuntu Server 24.04 LTS (Headless) or Windows 11 Pro with WSL2 / NVIDIA GPU

---

## 1. Production Architecture Overview

In production, client laptops do not run SSH tunnels. Instead, the compute server hosts an Nginx reverse proxy that provides direct, secure HTTPS access to all student and faculty browsers on the campus Wi-Fi network:

```
[Campus Wi-Fi / LAN Subnet: 10.241.143.0/24]
       │
       ▼
[Host Machine: 10.241.143.89]
   ├── Nginx Reverse Proxy (Ports 80 & 443 with TLS)
   │     ├── /        ──► Next.js Web UI (localhost:3000)
   │     └── /api/    ──► FastAPI Backend (localhost:8000)
   ├── Local Ollama Runtime (localhost:11434 with GPU)
   ├── SQLite Databases (data/institutional.db, data/app_storage.db)
   └── ChromaDB Vector Store (data/chroma/)
```

---

## 2. Hardware Prerequisites & Sizing

| Component | Minimum Specification | Recommended Production Specification |
|---|---|---|
| **CPU** | Intel Core i5 / AMD Ryzen 5 (6 cores) | Intel Core i7 / AMD Ryzen 7 (8+ cores) |
| **System RAM** | 16 GB DDR4 | 32 GB DDR4 / DDR5 |
| **GPU Accelerator** | NVIDIA RTX 3060 (6 GB VRAM) | NVIDIA RTX 4060 / 4070 (8 to 16 GB VRAM) |
| **Storage** | 256 GB NVMe SSD | 512 GB NVMe SSD (dedicated data partition) |
| **Network Interface** | Gigabit Ethernet or 5GHz 802.11ac Wi-Fi | Static IP on Institutional LAN |

---

## 3. Step-by-Step Deployment Instructions

### Step 1: Operating System & Driver Preparation
1. Ensure Ubuntu 24.04 LTS has NVIDIA drivers installed:
   ```bash
   sudo apt update && sudo apt install -y build-essential nvidia-driver-550
   nvidia-smi  # verify GPU is active
   ```
2. Install Ollama:
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   # Pull the target foundation model
   ollama pull qwen2.5-coder:7b
   ```

### Step 2: Application Code Setup
1. Clone repository to `/opt/c-gpt`:
   ```bash
   sudo git clone https://github.com/indra-2007/Local-College-Intelligence.git /opt/c-gpt
   cd /opt/c-gpt
   ```
2. Set up Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```
3. Initialize databases and vector index:
   ```bash
   python backend/ingest.py
   python backend/load_structured.py
   ```

### Step 3: Production Frontend Build
1. Install Node.js 18+ and build Next.js application:
   ```bash
   cd /opt/c-gpt/web
   npm install
   npm run build
   ```

### Step 4: Systemd Service Configuration
1. Create `/etc/systemd/system/cgpt-backend.service`:
   ```ini
   [Unit]
   Description=C-GPT FastAPI Backend
   After=network.target ollama.service

   [Service]
   Type=simple
   User=cgpt-user
   WorkingDirectory=/opt/c-gpt
   ExecStart=/opt/c-gpt/venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --workers 2
   Restart=always
   RestartSec=5
   Environment="OLLAMA_BASE_URL=http://127.0.0.1:11434"

   [Install]
   WantedBy=multi-user.target
   ```
2. Create `/etc/systemd/system/cgpt-frontend.service`:
   ```ini
   [Unit]
   Description=C-GPT Next.js Frontend
   After=network.target

   [Service]
   Type=simple
   User=cgpt-user
   WorkingDirectory=/opt/c-gpt/web
   ExecStart=/usr/bin/npm start -- -p 3000
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```
3. Enable and start services:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now cgpt-backend cgpt-frontend
   ```

### Step 5: Nginx Reverse Proxy Setup
Create `/etc/nginx/sites-available/cgpt`:
```nginx
server {
    listen 80;
    server_name cgpt.rvce.local;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name cgpt.rvce.local;

    ssl_certificate /etc/ssl/certs/cgpt.crt;
    ssl_certificate_key /etc/ssl/private/cgpt.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 180s;
    }
}
```
Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/cgpt /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

---

## 4. Emergency Troubleshooting & Maintenance Runbook

| Symptom | Diagnostic Step | Immediate Fix |
|---|---|---|
| **Ollama model unloading / high response latency** | `curl http://localhost:11434/api/ps` | Verify `keep_alive: -1` is in payload; restart Ollama service. |
| **Backend unreachable (`502 Bad Gateway`)** | `systemctl status cgpt-backend` | Check logs: `journalctl -u cgpt-backend -n 50 --no-pager`. |
| **Vector DB collection missing error** | Check `data/chroma/` directory | Rebuild index: `python backend/ingest.py`. |
| **GPU Out of Memory (OOM)** | `nvidia-smi` | Kill zombie Python/Ollama processes: `pkill -f ollama; systemctl restart ollama`. |
| **Static IP changed after router reboot** | `ip addr show` | Update campus DNS / hosts entry to point to new server LAN IP. |

