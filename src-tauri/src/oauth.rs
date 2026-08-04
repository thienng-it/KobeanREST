use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, Emitter};

#[tauri::command]
pub fn start_oauth_login(app: AppHandle, login_url: String) -> Result<(), String> {
    // Ensure any existing window is closed
    if let Some(existing) = app.get_webview_window("oauth-login") {
        let _ = existing.close();
    }

    let app_handle = app.clone();
    
    let _window = WebviewWindowBuilder::new(&app, "oauth-login", WebviewUrl::External(login_url.parse().unwrap()))
        .title("Browser Login")
        .inner_size(800.0, 700.0)
        .initialization_script(
            r#"
            (function() {
                // Intercept Fetch API
                const originalFetch = window.fetch;
                window.fetch = async function(...args) {
                    const url = args[0] instanceof Request ? args[0].url : (typeof args[0] === 'string' ? args[0] : '');
                    const response = await originalFetch.apply(this, args);
                    if (url && url.includes('/token')) {
                        const clone = response.clone();
                        clone.json().then(data => {
                            if (data.access_token) {
                                window.location.replace('http://localhost/oauth-token-captured?access_token=' + data.access_token);
                            }
                        }).catch(e => console.error(e));
                    }
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
                        if (this._url && this._url.includes('/token')) {
                            try {
                                const data = JSON.parse(this.responseText);
                                if (data.access_token) {
                                    window.location.replace('http://localhost/oauth-token-captured?access_token=' + data.access_token);
                                }
                            } catch (e) {}
                        }
                    });
                    return originalXHRSend.apply(this, rest);
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
            
            // Check query params for access_token=
            for (k, _) in url.query_pairs() {
                if k == "access_token" {
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
                        if k == Some("access_token") {
                            found_token = true;
                            break;
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
