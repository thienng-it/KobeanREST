use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
pub fn start_oauth_login(
    app: AppHandle,
    login_url: String,
    redirect_uri: Option<String>,
) -> Result<(), String> {
    // Ensure any existing window is closed
    if let Some(existing) = app.get_webview_window("oauth-login") {
        let _ = existing.close();
    }

    let app_handle = app.clone();

    let login_url_parsed = login_url
        .parse::<tauri::Url>()
        .unwrap_or_else(|_| tauri::Url::parse("http://localhost").unwrap());
    let login_host = login_url_parsed.host_str().unwrap_or("").to_string();

    let _window = WebviewWindowBuilder::new(&app, "oauth-login", WebviewUrl::External(login_url_parsed))
        .title("Browser Login")
        .inner_size(800.0, 700.0)
        .incognito(true)
        .initialization_script(
            r#"
            (function() {
                function extractTokenFromData(data) {
                    if (data && typeof data === 'object') {
                        const token = data.access_token || data.token || data.id_token;
                        if (token && typeof token === 'string' && token.length > 50) {
                            window.location.replace('http://localhost/oauth-token-captured?access_token=' + encodeURIComponent(token));
                            return true;
                        }
                    }
                    return false;
                }

                // Intercept Fetch API
                const originalFetch = window.fetch;
                window.fetch = async function(...args) {
                    const response = await originalFetch.apply(this, args);
                    const clone = response.clone();
                    clone.json().then(data => {
                        extractTokenFromData(data);
                    }).catch(e => {});
                    return response;
                };

                // Intercept XMLHttpRequest
                const originalXHROpen = XMLHttpRequest.prototype.open;
                XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                    this._url = url;
                    return originalXHROpen.apply(this, [method, url, ...rest]);
                };
                
                const originalXHRSend = XMLHttpRequest.prototype.send;
                XMLHttpRequest.prototype.send = function(...rest) {
                    this.addEventListener('load', function() {
                        try {
                            const data = JSON.parse(this.responseText);
                            extractTokenFromData(data);
                        } catch (e) {}
                    });
                    return originalXHRSend.apply(this, rest);
                };

                // Intercept window.close to scrape localStorage just in case
                const originalClose = window.close;
                window.close = function() {
                    let found = false;
                    try {
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            const val = localStorage.getItem(key);
                            if (val && typeof val === 'string' && (val.startsWith('eyJ') || val.length > 200)) {
                                // likely a JWT or long token
                                window.location.replace('http://localhost/oauth-token-captured?access_token=' + encodeURIComponent(val));
                                found = true;
                                break;
                            }
                        }
                    } catch (e) {}
                    if (!found) {
                        originalClose.call(window);
                    }
                };
            })();
            "#
        )
        .on_navigation(move |url| {
            let url_str = url.as_str();
            
            // 1. Check for token passed via dummy navigation from the JS interceptor
            if url_str.starts_with("http://localhost/oauth-token-captured") {
                if let Some(token) = url.query_pairs().find(|(k, _)| k == "access_token").map(|(_, v)| v.into_owned()) {
                    let _ = app_handle.emit("oauth-token", token);
                }
                if let Some(win) = app_handle.get_webview_window("oauth-login") {
                    let _ = win.close();
                }
                return false;
            }

            // 2. Check for token in standard redirect / implicit flow
            let mut found_token = false;
            
            let is_redirect_uri_match = match &redirect_uri {
                Some(uri) => url_str.starts_with(uri),
                None => {
                    let nav_host = url.host_str().unwrap_or("");
                    nav_host != login_host && nav_host != ""
                }
            };

            if is_redirect_uri_match {
                // Check query params for access_token= or code= or error=
                for (k, _) in url.query_pairs() {
                    if k == "access_token" || k == "code" || k == "error" {
                        found_token = true;
                        break;
                    }
                }
                
                // Check fragment for access_token=
                if !found_token {
                    if let Some(fragment) = url.fragment() {
                        for pair in fragment.split('&') {
                            let mut kv = pair.split('=');
                            let k = kv.next();
                            if k == Some("access_token") || k == Some("code") || k == Some("error") {
                                found_token = true;
                                break;
                            }
                        }
                    }
                }
            }

            if found_token {
                let _ = app_handle.emit("oauth-callback", url_str.to_string());
                if let Some(win) = app_handle.get_webview_window("oauth-login") {
                    let _ = win.close();
                }
                return false;
            }
            
            true
        })
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}
