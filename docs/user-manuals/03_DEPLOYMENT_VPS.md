# 03. Cloud & VPS Deployment Guide ☁️

Once you have tested **Uuilly** locally with Docker, you are ready to deploy it to a production environment like a Virtual Private Server (VPS) from AWS, DigitalOcean, Linode, or any other provider.

---

## 🏗️ VPS Preparation

### 1. Initial Setup
Ensure your VPS is running a modern Linux distribution (like Ubuntu 22.04 LTS) and that you have `docker` and `docker-compose` installed.

### 2. Domain Name
Point your domain (e.g., `uuilly.yourdomain.com`) to the IP address of your VPS using an **A Record** in your DNS provider.

### 3. Open Ports
Ensure your firewall (e.g., `ufw` or Security Groups) allows traffic on:
-   **80 (HTTP)**
-   **443 (HTTPS)**
-   **22 (SSH)**

---

## 🚀 Production Launch

In production, you must use the production-specific configuration to ensure stability, security, and performance.

### 1. Transfer Files
Upload the project files to your VPS (excluding `.env`, which you should create manually on the server).

### 2. Launch with Production Profile
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
This command combines the base architecture with production-grade settings:
-   **Auto-restart**: All services will restart automatically if they crash or the server reboots.
-   **Resource Limits**: CPU and RAM limits are applied to prevent any single service from exhausting the server.
-   **Clean Images**: Uses optimized production images without development tools.

---

## 🌐 Nginx Configuration & Reverse Proxy

While Uuilly includes an internal Nginx container, it is best practice to use an **external Nginx** on the host machine to handle SSL termination and forward traffic to the containers.

### 1. Install Nginx on Host
```bash
sudo apt update
sudo apt install nginx -y
```

### 2. Create a Site Configuration
Create a new file at `/etc/nginx/sites-available/uuilly`:
```nginx
server {
    listen 80;
    server_name uuilly.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080; # Point to the internal Nginx port
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 3. Enable the Site
```bash
sudo ln -s /etc/nginx/sites-available/uuilly /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 Securing with SSL (Certbot)

We highly recommend using **Let's Encrypt** to provide free, automatic SSL certificates.

### 1. Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 2. Obtain Certificate
```bash
sudo certbot --nginx -d uuilly.yourdomain.com
```
Follow the prompts to enable automatic HTTPS redirection. Certbot will automatically update your Nginx configuration.

---

## 🚀 Production Best Practices

-   **Environment Variables**: Ensure `PUBLIC_SERVER_URL` in your `.env` is set to your full domain (e.g., `https://uuilly.yourdomain.com`).
-   **Backups**: Regularly back up the `./postgres_data/` and `./storage/` directories.
-   **Security**: Change your default passwords and secret keys before going live! Use `.env.example.prod` as a reference.

---

## 📁 Next Steps

Now that your platform is live, proceed to **[04. n8n Integration](./04_N8N_INTEGRATION.md)** to start building powerful automations! ➰

---
Built with ❤️ for the **AI community**.
