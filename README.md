

# using subdomain

## make basic auth for more security

    htpasswd /config/focus_pass admin

## Apache config

    <VirtualHost *:443>
        ServerAdmin webmaster@localhost
        ServerName focus.example.org

        # Exclude PWA files from basic auth (required for install prompt)
        # Need: root, index.html, manifest.json, service worker, and icons
        <Location />
            Require all granted
        </Location>
        <Location /index.html>
            Require all granted
        </Location>
        <Location /manifest.json>
            Require all granted
        </Location>
        <Location /sw.js>
            Require all granted
        </Location>
        <Location /icons>
            Require all granted
        </Location>

        # Protect API routes with basic auth
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


## 1

    tailscale cert machinename.yournetwork.ts.net

## using /focusapp route

    <VirtualHost *:443>
        ServerAdmin webmaster@localhost
        ServerName example.org

        # Exclude PWA files from basic auth (required for install prompt)
        # Need: root, index.html, manifest.json, service worker, and icons
        <Location /focusapp>
            Require all granted
        </Location>
        <Location /focusapp/>
            Require all granted
        </Location>
        <Location /focusapp/index.html>
            Require all granted
        </Location>
        <Location /focusapp/manifest.json>
            Require all granted
        </Location>
        <Location /focusapp/sw.js>
            Require all granted
        </Location>
        <Location /focusapp/icons>
            Require all granted
        </Location>

        # Protect API routes with basic auth
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

        SSLCertificateFile /config/certs/server.crt
        SSLCertificateKeyFile /config/certs/server.key
    </VirtualHost>

