import Capacitor
import WebKit
import AuthenticationServices
import CryptoKit

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
        print("[NVA] viewDidAppear called")
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
        guard titleObservation == nil, let myView = self.view else {
            print("[NVA] setupTitleObservation skipped (already set or no view)")
            return
        }

        var foundWebView: WKWebView? = findWKWebView(in: myView)
        if foundWebView == nil, let winRoot = myView.window?.rootViewController?.view {
            foundWebView = findWKWebView(in: winRoot)
        }

        guard let wv = foundWebView else {
            print("[NVA] WKWebView not found yet, retrying in 0.5s")
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                self?.setupTitleObservation()
            }
            return
        }

        wkWebView = wv
        originalTitle = wv.title ?? ""
        print("[NVA] ✅ Title observation set up on WKWebView, current title: '\(originalTitle)'")

        titleObservation = wv.observe(\.title, options: [.new]) {
            [weak self] (webView: WKWebView, _: NSKeyValueObservedChange<String?>) in
            guard let title = webView.title else { return }
            print("[NVA-Title] observed: \(title.prefix(80))")

            // Restore original title
            let restoreTitle = {
                DispatchQueue.main.async {
                    webView.evaluateJavaScript("document.title = '\(self?.originalTitle ?? "")'") {
                        (_: Any?, _: Error?) in }
                }
            }

            if title.hasPrefix("__nvaOAuth:") {
                let urlString = String(title.dropFirst("__nvaOAuth:".count))
                restoreTitle()
                guard let url = URL(string: urlString) else { return }
                DispatchQueue.main.async { self?.launchOAuth(url: url) }
            } else if title.hasPrefix("__nvaAppleSignIn:") {
                let hashedNonce = String(title.dropFirst("__nvaAppleSignIn:".count))
                restoreTitle()
                DispatchQueue.main.async { self?.launchAppleSignIn(hashedNonce: hashedNonce) }
            } else if title.hasPrefix("__nvaUpload:") {
                let payload = String(title.dropFirst("__nvaUpload:".count))
                print("[NVA-Upload] Title KVO fired, token length: \(payload.count)")
                restoreTitle()
                DispatchQueue.main.async { self?.handleNativeUpload(payload: payload) }
            }
        }
    }

    deinit { titleObservation?.invalidate() }

    // MARK: - OAuth (Google etc.)

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

    // MARK: - Native File Upload

    private func handleNativeUpload(payload: String) {
        let token = payload
        print("[NVA-Upload] handleNativeUpload called, token length: \(token.count)")

        wkWebView?.evaluateJavaScript("window.__nvaUploadData || ''") { [weak self] (result: Any?, error: Error?) in
            if let error = error {
                print("[NVA-Upload] Error getting upload data: \(error)")
                self?.sendUploadResult(nil, error: "JS eval error: \(error.localizedDescription)")
                return
            }
            guard let base64String = result as? String, !base64String.isEmpty else {
                print("[NVA-Upload] No base64 data found in window.__nvaUploadData")
                self?.sendUploadResult(nil, error: "No file data")
                return
            }
            print("[NVA-Upload] Got base64 data, length: \(base64String.count)")

            guard let fileData = Data(base64Encoded: base64String) else {
                print("[NVA-Upload] Failed to decode base64")
                self?.sendUploadResult(nil, error: "Invalid base64 data")
                return
            }
            print("[NVA-Upload] Decoded file data: \(fileData.count) bytes")

            self?.wkWebView?.evaluateJavaScript("window.__nvaUploadFileName || 'upload.pdf'") { (nameResult: Any?, _: Error?) in
                let fileName = nameResult as? String ?? "upload.pdf"
                print("[NVA-Upload] Uploading \(fileName)")
                self?.performUpload(fileData: fileData, fileName: fileName, token: token)
            }
        }
    }

    private func performUpload(fileData: Data, fileName: String, token: String) {
        let urlString = "https://www.nva.lat/api/analyze"
        guard let url = URL(string: urlString) else {
            sendUploadResult(nil, error: "Invalid URL")
            return
        }

        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        if !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.timeoutInterval = 180

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        let mime = fileName.hasSuffix(".csv") ? "text/csv" : "application/pdf"
        body.append("Content-Type: \(mime)\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        print("[NVA-Upload] Starting URLSession request to \(urlString), body size: \(body.count) bytes")
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            if let httpResp = response as? HTTPURLResponse {
                print("[NVA-Upload] HTTP response status: \(httpResp.statusCode)")
            }
            if let error = error {
                print("[NVA-Upload] URLSession error: \(error)")
                self?.sendUploadResult(nil, error: error.localizedDescription)
                return
            }
            guard let data = data, let jsonString = String(data: data, encoding: .utf8) else {
                print("[NVA-Upload] Empty response data")
                self?.sendUploadResult(nil, error: "Empty response")
                return
            }
            print("[NVA-Upload] Got response: \(jsonString.prefix(200))")
            self?.sendUploadResult(jsonString, error: nil)
        }.resume()
    }

    private func sendUploadResult(_ json: String?, error: String?) {
        print("[NVA-Upload] sendUploadResult called, hasJSON: \(json != nil), error: \(error ?? "none")")
        DispatchQueue.main.async {
            if let json = json {
                let safe = json.replacingOccurrences(of: "\\", with: "\\\\")
                    .replacingOccurrences(of: "'", with: "\\'")
                    .replacingOccurrences(of: "\n", with: "\\n")
                    .replacingOccurrences(of: "\r", with: "")
                self.wkWebView?.evaluateJavaScript(
                    "window.__nvaUploadResult && window.__nvaUploadResult('\(safe)')"
                ) { (_: Any?, _: Error?) in }
            } else {
                let safeErr = (error ?? "Unknown error").replacingOccurrences(of: "'", with: "\\'")
                self.wkWebView?.evaluateJavaScript(
                    "window.__nvaUploadError && window.__nvaUploadError('\(safeErr)')"
                ) { (_: Any?, _: Error?) in }
            }
        }
    }

    // MARK: - Apple Sign In

    private func launchAppleSignIn(hashedNonce: String) {
        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = hashedNonce

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }
}

// MARK: - ASWebAuthenticationPresentationContextProviding

extension CustomBridgeViewController: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return view.window ?? UIWindow()
    }
}

// MARK: - ASAuthorizationControllerDelegate

extension CustomBridgeViewController: ASAuthorizationControllerDelegate {
    func authorizationController(controller: ASAuthorizationController,
                                 didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let identityTokenData = appleIDCredential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8) else {
            DispatchQueue.main.async {
                self.wkWebView?.evaluateJavaScript(
                    "window.__nvaAppleError && window.__nvaAppleError('no_identity_token')"
                ) { (_: Any?, _: Error?) in }
            }
            return
        }

        let safeToken = identityToken.replacingOccurrences(of: "'", with: "\\'")
        DispatchQueue.main.async {
            self.wkWebView?.evaluateJavaScript(
                "window.__nvaHandleAppleToken && window.__nvaHandleAppleToken('\(safeToken)')"
            ) { (_: Any?, _: Error?) in }
        }
    }

    func authorizationController(controller: ASAuthorizationController,
                                 didCompleteWithError error: Error) {
        let code = (error as NSError).code
        // 1001 = user cancelled
        let reason = code == 1001 ? "cancelled" : error.localizedDescription
        let safeReason = reason.replacingOccurrences(of: "'", with: "\\'")
        DispatchQueue.main.async {
            self.wkWebView?.evaluateJavaScript(
                "window.__nvaAppleError && window.__nvaAppleError('\(safeReason)')"
            ) { (_: Any?, _: Error?) in }
        }
    }
}

// MARK: - ASAuthorizationControllerPresentationContextProviding

extension CustomBridgeViewController: ASAuthorizationControllerPresentationContextProviding {
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return view.window ?? UIWindow()
    }
}
