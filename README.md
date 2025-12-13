# FocusApp
The aim is that the app is very simple, yet very powerful.
- Alarm, Timer, Stopwatch gives you sense of control of time
- Note structure (TimeLog, Todo, Notes) help with frame of focus
- Use AI with Note context to discuss anything using text or voice (brainstorm, task breakdown, time estimate, etc)
- install the app as PWA

## Demo
Enter "demo123" for password: [https://focusapp-demo123.vercel.app/](https://focusapp-demo123.vercel.app/)

## Screenshots
App:
![Main screen](/screenshots/Screenshot_20251213_164951_Chrome.jpg)

Grok (you can ask followup with text or voice):
![Grok](/screenshots/Screenshot_20251213_165048_Grok.jpg)

# Important disclaimer
This app continuously reads the note.md file, which might be a security risk. Vulnerabilities could exist in Node.js or other dependencies that might be exploited. There is a nonzero possibility that using this app could allow unauthorized access to your computer. Use at your own risk. The app was developed with AI assistance.

# Setup
There are several possibilities depending on your needs:

**Browser-only access on the same computer:**
The simplest option is to expose the app at 127.0.0.1:3000. You can even install it as a PWA using http, since it's running on localhost.

**Access from an Android phone:**
You have two options:

1. **Expose via the internet** - Use a Cloudflare tunnel (requires owning a domain)
2. **Expose via Tailscale network** - Requires the Tailscale client on both your computer and Android phone

You can implement both methods simultaneously.

**Installing as a PWA on Android:**
Android requires https with a valid certificate for PWA installation.

- With Cloudflare tunnel, you can use a self-signed certificate since Cloudflare tunnel encrypts the traffic. Android connects to Cloudflare's edge and receives a valid https certificate, enabling PWA installation.

- With Tailscale, the easiest approach is to get a Tailscale certificate and connect Android to the full Tailscale domain. The subpath example was provided because each computer has only one Tailscale domain, which allows you to host other services.


## 1 - start it in Docker (for use in browser on the same computer)
Add the following to docker-compose.yml

    ports:
      - "127.0.0.1:3000:3000"

Update the following with full path to expose relevant file:

    - ./notes.md:/app/notes.md

Start the app

    docker network create apache_letsencrypt
    docker compose up -d

## 2 Using Cloudflare tunnel (using subdomain)

## config.yml 

    tunnel: 199f5562-62d6-4557-8730-56182c62b83f
    credentials-file: /home/nonroot/.cloudflared/199f5562-62d6-4557-8730-56182c62b83f.json
    ingress:
      - hostname: focus.example.org
        service: https://docker-apache-1
        originRequest:                                                              
          noTLSVerify: true
      - service: http_status:404

## Apache config for subdomain

    <VirtualHost *:443>
        ServerAdmin webmaster@localhost
        ServerName focus.example.org

        # Optionally add Basic auth for /api (enabling it at the root level prevents the PWA install prompt from appearing)
        # htpasswd /config/focus_pass admin
        <Location /api>
            AuthType Basic
            AuthName "Restricted Area"
            AuthUserFile /config/focus_pass
            Require user admin
        </Location>

        ProxyPass / http://prog1-focus-app-1:3000/
        ProxyPassReverse / http://prog1-focus-app-1:3000/

        RewriteEngine On
        RewriteCond %{HTTP:Connection} upgrade [NC]
        RewriteCond %{HTTP:Upgrade} websocket [NC]
        RewriteRule /(.*)           ws://prog1-focus-app-1:3000/$1 [P,L]

        SSLCertificateFile /config/certs/server.crt
        SSLCertificateKeyFile /config/certs/server.key
    </VirtualHost>


# Using Tailscale (using /focusapp route)

    <VirtualHost *:443>
        ServerAdmin webmaster@localhost
        ServerName example.org

        # Optionally add Basic auth for /focusapp/api (enabling it at the root level prevents the PWA install prompt from appearing)
        # htpasswd /config/focus_pass admin
        <Location /focusapp/api>
            AuthType Basic
            AuthName "Restricted Area"
            AuthUserFile /config/focus_pass
            Require user admin
        </Location>

        ProxyPass /focusapp/ http://prog1-focus-app-1:3000/
        ProxyPassReverse /focusapp/ http://prog1-focus-app-1:3000/
        ProxyPass /focusapp http://prog1-focus-app-1:3000
        ProxyPassReverse /focusapp http://prog1-focus-app-1:3000

        RewriteEngine On
        RewriteCond %{HTTP:Connection} upgrade [NC]
        RewriteCond %{HTTP:Upgrade} websocket [NC]
        RewriteRule /focusapp/(.*)  ws://prog1-focus-app-1:3000/$1 [P,L]

        # tailscale cert machinename.yournetwork.ts.net
        SSLCertificateFile /config/certs/server.crt
        SSLCertificateKeyFile /config/certs/server.key
    </VirtualHost>

