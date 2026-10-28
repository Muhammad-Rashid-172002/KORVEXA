#!/usr/bin/env bash
# One-time hardening of a fresh Ubuntu 24.04 VPS. Run as root ONCE:  bash server-setup.sh "<your ssh public key>"
# Creates a non-root deploy user, SSH-keys-only, firewall (22/80/443), fail2ban, unattended security updates,
# Docker with log rotation, and the nightly backup + verification cron jobs.
set -euo pipefail
PUBKEY="${1:?usage: server-setup.sh \"ssh-ed25519 AAAA… you@host\"}"
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }

apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y ufw fail2ban unattended-upgrades curl ca-certificates openssl cron

# Docker
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'J'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "5" } }
J
systemctl restart docker

# Deploy user (no password, docker group, key-only)
id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
echo "$PUBKEY" > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys; chmod 600 /home/deploy/.ssh/authorized_keys
install -d -o deploy -g deploy /opt/glasswork

# SSH: keys only, no root login
cat > /etc/ssh/sshd_config.d/99-hardening.conf <<'S'
PasswordAuthentication no
PermitRootLogin no
KbdInteractiveAuthentication no
S
systemctl reload ssh || systemctl reload sshd

# Firewall
ufw default deny incoming; ufw default allow outgoing
ufw allow 22/tcp; ufw allow 80/tcp; ufw allow 443/tcp; ufw allow 443/udp
ufw --force enable

systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

# Cron: nightly backup 02:30 UTC, restore verification 03:15 UTC, uptime check every 5 min, disk check hourly
cat > /etc/cron.d/glasswork <<'C'
30 2 * * * deploy cd /opt/glasswork/infra/prod && ./scripts/backup.sh >> /var/log/glasswork-backup.log 2>&1
15 3 * * * deploy cd /opt/glasswork/infra/prod && ./scripts/restore-verify.sh >> /var/log/glasswork-backup.log 2>&1
*/5 * * * * deploy cd /opt/glasswork/infra/prod && ./scripts/monitor.sh >> /var/log/glasswork-monitor.log 2>&1
C
touch /var/log/glasswork-backup.log /var/log/glasswork-monitor.log
chown deploy /var/log/glasswork-*.log
echo "✓ Server hardened. Log in as: ssh deploy@<server-ip>   (root login is now disabled)"
