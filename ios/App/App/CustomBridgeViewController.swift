import Capacitor
import WebKit
import AuthenticationServices

class CustomBridgeViewController: CAPBridgeViewController {
    private var authSession: ASWebAuthenticationSession?
    private var titleObservation: NSKeyValueObservation?
    private var originalTitle: String = ""
    private var wkWebView: WKWebView?

    override func instanceDescriptor() -> InstanceDescriptor {
        let descriptor = super.instanceDescriptor()
        descriptor.serverURL = nil
        descriptor.allowedNavigationHostnames = ["nva.lat", "*.nva.lat"]
        return descriptor
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        setupTitleObservation()
    }

    private func findWKWebView(in parentView: UIView) -> WKWebView? {
        if let wv = parentView as? WKWebView { return wv }
        for sub in parentView.subviews {
            if let found = findWKWebView(in: sub) { return found }
        }
        return nil
    }

    private func setupTitleObservation() {
        guard titleObservation == nil, let myView = self.view else { return }

        var foundWebView: WKWebView? = findWKWebView(in: myView)
        if foundWebView == nil, let winRoot = myView.window?.rootViewController?.view {
            foundWebView = findWKWebView(in: winRoot)
        }

        guard let wv = foundWebView else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                self?.setupTitleObservation()
            }
            return
        }

        wkWebView = wv
        originalTitle = wv.title ?? ""

        titleObservation = wv.observe(\.title, options: [.new]) {
            [weak self] (webView: WKWebView, _: NSKeyValueObservedChange<String?>) in
            guard let title = webView.title, title.hasPrefix("__nvaOAuth:") else { return }
            let urlString = String(title.dropFirst("__nvaOAuth:".count))

            DispatchQueue.main.async {
                webView.evaluateJavaScript("document.title = '\(self?.originalTitle ?? "")'") {
                    (_: Any?, _: Error?) in }
            }

            guard let url = URL(string: urlString) else { return }
            DispatchQueue.main.async {
                self?.launchOAuth(url: url)
            }
        }
    }

    deinit { titleObservation?.invalidate() }

    private func launchOAuth(url: URL) {
        let session = ASWebAuthenticationSession(
            url: url, callbackURLScheme: "nvaapp"
        ) { [weak self] (callbackURL: URL?, error: Error?) in
            self?.authSession = nil
            if error != nil {
                DispatchQueue.main.async {
                    self?.wkWebView?.evaluateJavaScript(
                        "window.__nvaOAuthError && window.__nvaOAuthError('cancelled')"
                    ) { (_: Any?, _: Error?) in }
                }
                return
            }
            guard let callbackURL = callbackURL else { return }

            var params: [String: String] = [:]
            if let comps = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false) {
                comps.queryItems?.forEach { params[$0.name] = $0.value }
                if let fragment = comps.fragment,
                   let fragComps = URLComponents(string: "?\(fragment)") {
                    fragComps.queryItems?.forEach { params[$0.name] = $0.value }
                }
            }

            if let accessToken = params["access_token"], let refreshToken = params["refresh_token"] {
                let safeAccess = accessToken.replacingOccurrences(of: "'", with: "\\'")
                let safeRefresh = refreshToken.replacingOccurrences(of: "'", with: "\\'")
                DispatchQueue.main.async {
                    self?.wkWebView?.evaluateJavaScript(
                        "window.__nvaHandleOAuthTokens && window.__nvaHandleOAuthTokens('\(safeAccess)', '\(safeRefresh)')"
                    ) { (_: Any?, _: Error?) in }
                }
            } else if let code = params["code"] {
                let safeCode = code.replacingOccurrences(of: "'", with: "\\'")
                DispatchQueue.main.async {
                    self?.wkWebView?.evaluateJavaScript(
                        "window.__nvaHandleOAuthCode && window.__nvaHandleOAuthCode('\(safeCode)')"
                    ) { (_: Any?, _: Error?) in }
                }
            } else {
                DispatchQueue.main.async {
                    self?.wkWebView?.evaluateJavaScript(
                        "window.__nvaOAuthError && window.__nvaOAuthError('no_tokens')"
                    ) { (_: Any?, _: Error?) in }
                }
            }
        }
        authSession = session
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        session.start()
    }
}

extension CustomBridgeViewController: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return view.window ?? UIWindow()
    }
}
