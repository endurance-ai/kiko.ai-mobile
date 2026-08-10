//
//  KikoVisualIntelligence.swift
//  KikoAI
//
//  ⚠️ config plugin(`plugins/withVisualIntelligence.js`)이 prebuild 시
//     `ios/KikoAI/` 로 복사 + 메인 앱 타깃 Sources 에 등록한다.
//     편집은 반드시 이 원본(plugins/visual-intelligence/…)에서. ios/ 사본을 고치면
//     다음 `expo prebuild --clean` 에 덮인다.
//
//  전략 B (authed first-light): 실기기에서 진짜 상품이 뜨는 것을 최우선 증명.
//    캡처 이미지 → (기존)POST /v1/uploads presigned → S3 PUT → POST /v1/visual-search
//    → Marqo(v6) 랭킹 상품 → AppEntity 카드.
//    인증은 expo-secure-store Keychain 의 refresh_token 을 Swift 에서 읽어
//    /v1/auth/refresh 로 access token 을 얻어 쓴다(수동 토큰·만료 없음).
//
//  ─────────────────────────────────────────────────────────────────────────
//  ⚠️ VERIFY (Xcode 26 SDK 자동완성으로 확정 후 첫 컴파일):
//     `@AppIntent(schema:)` 매크로 스펠링 / `SemanticContentDescriptor.pixelBuffer`·
//     `.labels` 프로퍼티명 / `IntentValueQuery` 반환형.
//       • https://developer.apple.com/documentation/appintents/appschema/visualintelligenceintent/semanticcontentsearch
//       • WWDC25-275, WWDC26-297
//  ─────────────────────────────────────────────────────────────────────────

import AppIntents
import CoreImage
import Foundation
import UIKit

#if canImport(VisualIntelligence)
import VisualIntelligence
#endif

// MARK: - Config (Info.plist 주입값)

enum KikoConfig {
    /// config plugin 이 env(KIKO_API_BASE_URL)에서 Info.plist 로 주입. 미설정 시 dev.
    static var apiBaseURL: String {
        (Bundle.main.object(forInfoDictionaryKey: "KIKO_API_BASE_URL") as? String)
            .flatMap { $0.isEmpty ? nil : $0 } ?? "https://dev-ai.kikoai.me"
    }
    static let refreshTokenKey = "kiko.refresh_token"  // expo-secure-store 키
}

// MARK: - Keychain (expo-secure-store 56.0.4 매핑과 정확히 일치)

enum KikoKeychain {
    // expo-secure-store 는 requireAuthentication(기본 false)이 nil 이 아니라서
    // service 에 ":no-auth" 접미사를 붙여 저장한다. 저장 성공 후 접미사 없는
    // "app" 별칭은 삭제하므로, 토큰은 service="app:no-auth" 에만 존재한다.
    // account=Data(key.utf8), class=GenericPassword, access group 미설정(=앱 기본).
    static func read(_ key: String) -> String? {
        for service in ["app:no-auth", "app"] {  // "app" 는 레거시 폴백
            if let v = read(key, service: service) { return v }
        }
        return nil
    }

    private static func read(_ key: String, service: String) -> String? {
        let account = Data(key.utf8)
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecReturnData as String: kCFBooleanTrue as Any,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}

// MARK: - API 클라이언트

struct KikoSearchHit: Decodable {
    let id: String
    let brand: String?
    let name: String?
    let price: Double?
    let image_url: String?
    let product_url: String?
}

enum KikoAPIError: Error { case noAuth, http(Int, String), badResponse }

enum KikoVisualSearchAPI {
    private static var base: String { KikoConfig.apiBaseURL }
    private static let session = URLSession(configuration: .ephemeral)

    private static func json(_ obj: [String: Any]) throws -> Data {
        try JSONSerialization.data(withJSONObject: obj)
    }

    private static func post(_ path: String, body: Data, bearer: String?, contentType: String = "application/json") async throws -> Data {
        var req = URLRequest(url: URL(string: base + path)!)
        req.httpMethod = "POST"
        req.setValue(contentType, forHTTPHeaderField: "Content-Type")
        if let bearer { req.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization") }
        req.httpBody = body
        let (data, resp) = try await session.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else {
            throw KikoAPIError.http(code, String(data: data.prefix(300), encoding: .utf8) ?? "")
        }
        return data
    }

    /// refresh_token(Keychain) → access_token.
    static func accessToken() async throws -> String {
        guard let refresh = KikoKeychain.read(KikoConfig.refreshTokenKey), !refresh.isEmpty else {
            throw KikoAPIError.noAuth
        }
        let data = try await post("/v1/auth/refresh", body: try json(["refresh_token": refresh]), bearer: nil)
        guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let token = obj["access_token"] as? String else { throw KikoAPIError.badResponse }
        return token
    }

    /// presigned 예약 → S3 PUT → CloudFront image_url.
    static func upload(jpeg: Data, bearer: String) async throws -> String {
        let reserve = try await post(
            "/v1/uploads",
            body: try json(["filename": "vi-query.jpg", "content_type": "image/jpeg", "size_bytes": jpeg.count]),
            bearer: bearer
        )
        guard let obj = try JSONSerialization.jsonObject(with: reserve) as? [String: Any],
              let uploadURL = obj["upload_url"] as? String,
              let imageURL = obj["image_url"] as? String else { throw KikoAPIError.badResponse }

        var put = URLRequest(url: URL(string: uploadURL)!)
        put.httpMethod = "PUT"
        put.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")
        put.httpBody = jpeg
        let (_, resp) = try await session.data(for: put)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else { throw KikoAPIError.http(code, "S3 PUT") }
        return imageURL
    }

    /// image_url → v6 Marqo 랭킹 상품.
    static func search(imageURL: String, bearer: String, limit: Int = 8) async throws -> [KikoSearchHit] {
        let data = try await post(
            "/v1/visual-search",
            body: try json(["image_url": imageURL, "limit": limit]),
            bearer: bearer
        )
        struct Resp: Decodable { let results: [KikoSearchHit] }
        return try JSONDecoder().decode(Resp.self, from: data).results
    }

    static func fetchBytes(_ url: String) async throws -> Data {
        guard let u = URL(string: url) else { throw KikoAPIError.badResponse }
        let (data, _) = try await session.data(from: u)
        return data
    }
}

// MARK: - pixelBuffer → JPEG

enum KikoImageEncoder {
    private static let ciContext = CIContext()

    static func jpeg(fromPixelBuffer pb: CVPixelBuffer, maxDim: CGFloat = 1024, quality: CGFloat = 0.8) -> Data? {
        var ci = CIImage(cvPixelBuffer: pb)
        let ext = ci.extent
        let scale = min(1, maxDim / max(ext.width, ext.height))
        if scale < 1 { ci = ci.transformed(by: CGAffineTransform(scaleX: scale, y: scale)) }
        guard let cg = ciContext.createCGImage(ci, from: ci.extent) else { return nil }
        return UIImage(cgImage: cg).jpegData(compressionQuality: quality)
    }
}

#if canImport(VisualIntelligence)

// MARK: - 결과 엔티티

@available(iOS 26.0, *)
struct KikoProductEntity: AppEntity {
    let id: String
    let name: String
    let brand: String
    let priceText: String?
    let productURL: String?
    let thumbnail: Data?

    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "상품")

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(name)",
            subtitle: "\(brand)\(priceText.map { " · \($0)" } ?? "")",
            image: thumbnail.map { .init(data: $0) }
        )
    }

    var appLinkURL: URL? { URL(string: "kikoaimobile://product/\(id)") }

    static let defaultQuery = KikoProductEntityQuery()
}

@available(iOS 26.0, *)
struct KikoProductEntityQuery: EntityQuery {
    func entities(for identifiers: [KikoProductEntity.ID]) async throws -> [KikoProductEntity] {
        KikoVisualSearchStore.shared.entities(for: identifiers)
    }
}

// 비주얼 검색이 반환하는 엔티티는 OpenIntent 연결이 필수(에러 202).
// 탭 → appLinkURL(kikoaimobile://product/{id}) 딥링크로 PDP 진입.
@available(iOS 26.0, *)
struct OpenKikoProductIntent: OpenIntent {
    static let title: LocalizedStringResource = "KIKO 상품 열기"
    @Parameter(title: "상품") var target: KikoProductEntity

    @MainActor
    func perform() async throws -> some IntentResult {
        if let url = target.appLinkURL {
            _ = await UIApplication.shared.open(url)
        }
        return .result()
    }
}

// MARK: - Visual Intelligence 진입점

@available(iOS 26.0, *)
struct KikoImageSearchQuery: IntentValueQuery {
    func values(for input: SemanticContentDescriptor) async throws -> [KikoProductEntity] {
        NSLog("[KIKO][VI] values(for:) labels=\(input.labels)")

        // 실패 시 빈 배열 대신 진단 엔티티 1개를 돌려줘 기기 UI 에서 원인을 본다.
        func diag(_ msg: String) -> [KikoProductEntity] {
            NSLog("[KIKO][VI] diag: \(msg)")
            return [KikoProductEntity(id: "diag", name: msg, brand: "KIKO", priceText: nil, productURL: nil, thumbnail: nil)]
        }

        guard let roBuffer = input.pixelBuffer else { return diag("no pixelBuffer") }
        // iOS 26: SemanticContentDescriptor.pixelBuffer 는 CVReadOnlyPixelBuffer.
        // 내부 CVPixelBuffer 는 withUnsafeBuffer 클로저 스코프에서만 유효하므로
        // JPEG(Data, 값 타입)를 그 안에서 확정해 밖으로 안전하게 반환한다.
        let jpegOpt: Data? = roBuffer.withUnsafeBuffer { pb in
            KikoImageEncoder.jpeg(fromPixelBuffer: pb)
        }
        guard let jpeg = jpegOpt else { return diag("encode fail") }

        do {
            let token = try await KikoVisualSearchAPI.accessToken()
            let imageURL = try await KikoVisualSearchAPI.upload(jpeg: jpeg, bearer: token)
            let hits = try await KikoVisualSearchAPI.search(imageURL: imageURL, bearer: token, limit: 8)
            if hits.isEmpty { return diag("0 results") }

            // DisplayRepresentation 은 Data 필요 → 썸네일 병렬 fetch(순서 보존).
            let entities = try await withThrowingTaskGroup(of: (Int, KikoProductEntity).self) { group in
                for (i, h) in hits.enumerated() {
                    group.addTask {
                        var bytes: Data? = nil
                        if let iu = h.image_url {
                            bytes = try? await KikoVisualSearchAPI.fetchBytes(iu)
                        }
                        let price = h.price.map { "₩\(Int($0))" }
                        return (i, KikoProductEntity(
                            id: h.id,
                            name: h.name ?? "상품",
                            brand: h.brand ?? "",
                            priceText: price,
                            productURL: h.product_url,
                            thumbnail: bytes
                        ))
                    }
                }
                var buf = [KikoProductEntity?](repeating: nil, count: hits.count)
                for try await (i, e) in group { buf[i] = e }
                return buf.compactMap { $0 }
            }
            KikoVisualSearchStore.shared.put(entities)
            NSLog("[KIKO][VI] returned \(entities.count) real result(s)")
            return entities
        } catch KikoAPIError.noAuth {
            return diag("no refresh_token in Keychain (로그인 필요)")
        } catch let KikoAPIError.http(code, msg) {
            return diag("HTTP \(code) \(msg)")
        } catch {
            return diag("error \(error)")
        }
    }
}

// MARK: - semanticContentSearch 스키마 등록

// VERIFY: 매크로/요구 멤버를 Xcode 26 SDK 로 확정.
@available(iOS 26.0, *)
@AppIntent(schema: .visualIntelligence.semanticContentSearch)
struct KikoVisualSearchIntent {
    // 스키마(ShowVisualSearchResultsInAppIntent)가 요구하는 파라미터명 = semanticContent.
    @Parameter var semanticContent: SemanticContentDescriptor

    func perform() async throws -> some IntentResult {
        // "더 보기": 시스템이 앱을 열어 전체 결과 화면으로 이어감(first-light: 진입만).
        // 인라인 상품 결과는 KikoImageSearchQuery(IntentValueQuery)가 제공.
        return .result()
    }
}

// MARK: - 탭 해석 캐시

@available(iOS 26.0, *)
final class KikoVisualSearchStore: @unchecked Sendable {
    static let shared = KikoVisualSearchStore()
    private var byId: [String: KikoProductEntity] = [:]
    private let lock = NSLock()

    func put(_ entities: [KikoProductEntity]) {
        lock.lock(); defer { lock.unlock() }
        for e in entities { byId[e.id] = e }
    }

    func entities(for ids: [String]) -> [KikoProductEntity] {
        lock.lock(); defer { lock.unlock() }
        return ids.compactMap { byId[$0] }
    }
}

#endif  // canImport(VisualIntelligence)
